import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

let scene, camera, renderer;
let mainGroup, knotMesh, tendrils = [], particles;
let mouseX = 0, mouseY = 0, scrollVel = 0, prevScrollY = 0;
let animTrigger = 0, triggerActive = false;
let state = { scale: 1, posX: 0, posY: 0, posZ: 0 };
let time = 0;

function init() {
  const canvas = document.getElementById('three-canvas');
  if (!canvas) return;

  scene = new THREE.Scene();
  const w = window.innerWidth, h = window.innerHeight;

  camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
  camera.position.set(0, 0.3, 6);

  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.8;

  const amb = new THREE.AmbientLight(0x443366, 0.3);
  scene.add(amb);
  const key = new THREE.DirectionalLight(0xffeedd, 2);
  key.position.set(4, 5, 6);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x6644aa, 0.8);
  fill.position.set(-4, 3, 2);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xaa44ff, 0.5);
  rim.position.set(0, -5, -6);
  scene.add(rim);

  mainGroup = new THREE.Group();
  scene.add(mainGroup);

  const knotGeo = new THREE.TorusKnotGeometry(0.9, 0.28, 200, 32);
  const knotMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uDistortion: { value: 1.0 },
      uColor1: { value: new THREE.Color(0.10, 0.04, 0.18) },
      uColor2: { value: new THREE.Color(0.35, 0.08, 0.40) },
      uGlowColor: { value: new THREE.Color(0.60, 0.20, 0.80) },
      uTrigger: { value: 0.0 },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uDistortion;
      uniform float uTrigger;
      varying vec3 vNormal;
      varying vec3 vPos;
      varying float vDisplace;
      void main() {
        vec3 pos = position;
        float n = sin(pos.x*5.0 + uTime*0.6)*0.012
                + cos(pos.y*6.0 + uTime*0.5)*0.012
                + sin(pos.z*7.0 + uTime*0.7)*0.012;
        float trig = sin(pos.x*3.0 + uTrigger*6.28)*0.02
                   + cos(pos.y*4.0 + uTrigger*6.28)*0.02;
        n += trig * uTrigger * 0.5;
        vDisplace = n;
        pos += normal * n * uDistortion;
        vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vPos = mvPos.xyz;
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      uniform vec3 uGlowColor;
      uniform float uTime;
      uniform float uTrigger;
      varying vec3 vNormal;
      varying vec3 vPos;
      varying float vDisplace;
      void main() {
        vec3 viewDir = normalize(-vPos);
        float fresnel = 1.0 - max(dot(viewDir, vNormal), 0.0);
        fresnel = pow(fresnel, 2.5);
        float edge = 1.0 - abs(dot(viewDir, vNormal));
        edge = pow(edge, 3.0);
        vec3 base = mix(uColor1, uColor2, fresnel + uTrigger*0.3);
        float vein = sin(vPos.x*12.0 + uTime)*0.5+0.5
                   + cos(vPos.y*14.0 + uTime*0.7)*0.5+0.5;
        vein = sin(vein * 3.14) * 0.5;
        vec3 veinCol = uGlowColor * vein * 0.3 * (1.0 + uTrigger);
        vec3 glow = uGlowColor * edge * 0.8;
        float pulse = 0.9 + sin(uTime*0.5 + fresnel*3.0)*0.1;
        vec3 final = (base + glow + veinCol) * pulse;
        gl_FragColor = vec4(final, 0.85);
      }
    `,
    side: THREE.DoubleSide,
    transparent: true,
  });
  knotMesh = new THREE.Mesh(knotGeo, knotMat);
  knotMesh.scale.setScalar(0.95);
  mainGroup.add(knotMesh);

  const wireMat = new THREE.MeshBasicMaterial({
    color: 0x8855cc, wireframe: true, transparent: true, opacity: 0.06,
  });
  const wire = new THREE.Mesh(knotGeo.clone(), wireMat);
  wire.scale.setScalar(1.08);
  mainGroup.add(wire);

  for (let i = 0; i < 7; i++) {
    const pts = [];
    const segs = 30;
    for (let j = 0; j <= segs; j++) {
      const t = j / segs;
      const angle = t * Math.PI * 1.8 + i * 0.9;
      const r = 0.3 + t * 1.2;
      const x = r * Math.cos(angle + i * 0.5);
      const y = (t - 0.5) * 2.2 + (Math.random() - 0.5) * 0.3;
      const z = r * Math.sin(angle + i * 0.5) * 0.6;
      pts.push(new THREE.Vector3(x, y, z));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const tGeo = new THREE.TubeGeometry(curve, 28, 0.015, 6, false);
    const tMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0.30, 0.08, 0.40 + i * 0.05),
      metalness: 0.1, roughness: 0.2, transparent: true, opacity: 0.45,
      emissive: new THREE.Color(0.50, 0.15, 0.60),
      emissiveIntensity: 0.1,
    });
    const mesh = new THREE.Mesh(tGeo, tMat);
    tendrils.push({ mesh, phase: Math.random() * 6.28, speed: 0.3 + Math.random() * 0.4, pts, basePts: pts.map(p => p.clone()) });
    mainGroup.add(mesh);
  }

  const pCount = 600;
  const pPos = new Float32Array(pCount * 3);
  const pCol = new Float32Array(pCount * 3);
  const pSiz = new Float32Array(pCount);
  for (let i = 0; i < pCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 1.5 + Math.random() * 3.5;
    pPos[i*3] = r * Math.sin(phi) * Math.cos(theta);
    pPos[i*3+1] = (Math.random() - 0.5) * 4;
    pPos[i*3+2] = r * Math.cos(phi);
    const c = new THREE.Color(0.40 + Math.random()*0.3, 0.10 + Math.random()*0.2, 0.50 + Math.random()*0.3);
    pCol[i*3] = c.r; pCol[i*3+1] = c.g; pCol[i*3+2] = c.b;
    pSiz[i] = 0.01 + Math.random() * 0.025;
  }
  const pGeom = new THREE.BufferGeometry();
  pGeom.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeom.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  pGeom.setAttribute('size', new THREE.BufferAttribute(pSiz, 1));

  function mkTex() {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32,32,0,32,32,32);
    g.addColorStop(0,'rgba(255,255,255,0.6)');
    g.addColorStop(0.2,'rgba(255,255,255,0.2)');
    g.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0,0,64,64);
    const t = new THREE.CanvasTexture(c); t.needsUpdate = true;
    return t;
  }
  const pMat = new THREE.PointsMaterial({
    size: 0.025, map: mkTex(), vertexColors: true,
    transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending,
    depthWrite: false, sizeAttenuation: true,
  });
  particles = new THREE.Points(pGeom, pMat);
  mainGroup.add(particles);

  animate();
  window.addEventListener('resize', onResize);
  document.addEventListener('mousemove', onMouseMove);
  window.addEventListener('scroll', onScroll, { passive: true });
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function onMouseMove(e) {
  mouseX = (e.clientX / window.innerWidth) * 2 - 1;
  mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
}

function onScroll() {
  const sy = window.scrollY;
  scrollVel = sy - prevScrollY;
  prevScrollY = sy;
}

function animate() {
  requestAnimationFrame(animate);
  time += 0.005;
  const dt = scrollVel * 0.002;
  scrollVel *= 0.92;

  const s = state.scale, px = state.posX, py = state.posY, pz = state.posZ;
  mainGroup.scale.setScalar(1 + (s - 1)*0.04);
  mainGroup.position.x += (px - mainGroup.position.x)*0.04;
  mainGroup.position.y += (py - mainGroup.position.y)*0.04;
  mainGroup.position.z += (pz - mainGroup.position.z)*0.04;

  const rotSpeed = 0.3 + Math.abs(dt) * 8;
  knotMesh.rotation.x += 0.004 + dt * 0.03;
  knotMesh.rotation.y += rotSpeed * 0.005 + mouseX * 0.0005 + dt * 0.04;
  knotMesh.rotation.z += dt * 0.01;

  if (knotMesh.material.uniforms) {
    knotMesh.material.uniforms.uTime.value = time;
    knotMesh.material.uniforms.uDistortion.value = 1.0 + Math.abs(dt) * 5;
    knotMesh.material.uniforms.uTrigger.value += (animTrigger - knotMesh.material.uniforms.uTrigger.value) * 0.05;
  }

  for (const t of tendrils) {
    for (let j = 0; j < t.basePts.length; j++) {
      const bp = t.basePts[j];
      const wave = Math.sin(time * t.speed + j * 0.3 + t.phase) * 0.08 * (1 + animTrigger * 0.5);
      const wave2 = Math.cos(time * t.speed * 0.7 + j * 0.2 + t.phase) * 0.05;
      t.pts[j].x = bp.x + wave;
      t.pts[j].y = bp.y + wave2;
      t.pts[j].z = bp.z + wave * 0.5;
    }
    const curve = new THREE.CatmullRomCurve3(t.pts);
    t.mesh.geometry.dispose();
    t.mesh.geometry = new THREE.TubeGeometry(curve, 28, 0.015, 6, false);
    const intensity = 0.1 + Math.abs(dt) * 0.3 + animTrigger * 0.15;
    t.mesh.material.emissiveIntensity += (intensity - t.mesh.material.emissiveIntensity) * 0.05;
    t.mesh.material.opacity = 0.45 + animTrigger * 0.2;
  }

  if (particles) {
    particles.rotation.y = time * 0.02;
    particles.material.opacity = 0.25 + animTrigger * 0.15;
  }

  const cx = mouseX * 0.15, cy = mouseY * 0.1;
  camera.position.x += (cx - camera.position.x)*0.02;
  camera.position.y += (cy - camera.position.y)*0.02;
  camera.lookAt(mainGroup.position.x, mainGroup.position.y, 0);

  renderer.render(scene, camera);
}

export function updateScrollProgress(p) {
  state.scale = 1 - p * 0.45;
  state.posX = p * 2.5;
  state.posY = -p * 1.4;
  state.posZ = -p * 0.6;
}

export function setTrigger(v) {
  animTrigger = v;
}

init();
