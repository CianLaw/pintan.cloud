import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

let scene, camera, renderer;
let mainGroup, knotMesh, ringMesh, particles;
let mouseX = 0, mouseY = 0;
let scrollBoost = 0;
let state = { scale: 1, posX: 0, posY: 0, posZ: 0 };
let animTrigger = 0;
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

  const knotGeo = new THREE.TorusKnotGeometry(1.0, 0.30, 220, 32);
  const knotMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uDistortion: { value: 1.0 },
      uColor1: { value: new THREE.Color(0.08, 0.03, 0.16) },
      uColor2: { value: new THREE.Color(0.30, 0.06, 0.38) },
      uGlowColor: { value: new THREE.Color(0.55, 0.18, 0.75) },
      uTrigger: { value: 0.0 },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uDistortion;
      uniform float uTrigger;
      varying vec3 vNormal;
      varying vec3 vPos;
      varying float vFresnel;
      void main() {
        vec3 pos = position;
        float n = sin(pos.x*4.0 + uTime*0.5)*0.015
                + cos(pos.y*5.0 + uTime*0.4)*0.015
                + sin(pos.z*6.0 + uTime*0.6)*0.015;
        float trig = sin(pos.x*3.0 + uTrigger*6.28)*0.025
                   + cos(pos.y*3.5 + uTrigger*6.28)*0.025;
        n += trig * uTrigger;
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
      void main() {
        vec3 viewDir = normalize(-vPos);
        float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 2.8);
        float edge = pow(1.0 - abs(dot(viewDir, vNormal)), 4.0);
        vec3 base = mix(uColor1, uColor2, fresnel + uTrigger*0.4);
        float vein = (sin(vPos.x*10.0 + uTime)*0.5+0.5)
                   + (cos(vPos.y*12.0 + uTime*0.7)*0.5+0.5);
        vein = sin(vein*3.14)*0.4;
        vec3 vc = uGlowColor * vein * 0.25 * (1.0 + uTrigger*1.5);
        vec3 glow = uGlowColor * edge * 0.6 * (1.0 + uTrigger*0.5);
        float pulse = 0.92 + sin(uTime*0.4 + fresnel*2.0)*0.08;
        gl_FragColor = vec4((base + glow + vc) * pulse, 0.88);
      }
    `,
    side: THREE.DoubleSide,
    transparent: true,
  });
  knotMesh = new THREE.Mesh(knotGeo, knotMat);
  mainGroup.add(knotMesh);

  const ringGeo = new THREE.TorusGeometry(1.45, 0.008, 48, 160);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x8855cc, transparent: true, opacity: 0.15,
  });
  ringMesh = new THREE.Mesh(ringGeo, ringMat);
  ringMesh.rotation.x = 0.2;
  mainGroup.add(ringMesh);

  const ringGeo2 = new THREE.TorusGeometry(1.6, 0.005, 32, 160);
  const ringMat2 = new THREE.MeshBasicMaterial({
    color: 0x6644aa, transparent: true, opacity: 0.08,
  });
  const ring2 = new THREE.Mesh(ringGeo2, ringMat2);
  ring2.rotation.x = -0.3;
  ring2.rotation.z = 0.5;
  mainGroup.add(ring2);

  function mkTex() {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32,32,0,32,32,32);
    g.addColorStop(0,'rgba(255,255,255,0.4)');
    g.addColorStop(0.15,'rgba(200,180,255,0.2)');
    g.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0,0,64,64);
    const t = new THREE.CanvasTexture(c); t.needsUpdate = true;
    return t;
  }

  const pCount = 500;
  const pPos = new Float32Array(pCount * 3);
  const pCol = new Float32Array(pCount * 3);
  const pSiz = new Float32Array(pCount);
  for (let i = 0; i < pCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 1.6 + Math.random() * 4.0;
    pPos[i*3] = r * Math.sin(phi) * Math.cos(theta);
    pPos[i*3+1] = (Math.random() - 0.5) * 5;
    pPos[i*3+2] = r * Math.cos(phi);
    const c = new THREE.Color(0.35 + Math.random()*0.3, 0.08 + Math.random()*0.15, 0.45 + Math.random()*0.35);
    pCol[i*3] = c.r; pCol[i*3+1] = c.g; pCol[i*3+2] = c.b;
    pSiz[i] = 0.008 + Math.random() * 0.02;
  }
  const pGeom = new THREE.BufferGeometry();
  pGeom.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeom.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  pGeom.setAttribute('size', new THREE.BufferAttribute(pSiz, 1));
  const pMat = new THREE.PointsMaterial({
    size: 0.022, map: mkTex(), vertexColors: true,
    transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending,
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

let prevScrollY = 0;
function onScroll() {
  const sy = window.scrollY;
  const delta = Math.abs(sy - prevScrollY);
  if (delta > 2) scrollBoost = delta * 2.5;
  prevScrollY = sy;
}

function animate() {
  requestAnimationFrame(animate);
  time += 0.005;
  scrollBoost *= 0.88;

  const s = state.scale, px = state.posX, py = state.posY, pz = state.posZ;
  mainGroup.scale.setScalar(1 + (s - 1)*0.04);
  mainGroup.position.x += (px - mainGroup.position.x)*0.04;
  mainGroup.position.y += (py - mainGroup.position.y)*0.04;
  mainGroup.position.z += (pz - mainGroup.position.z)*0.04;

  const boost = Math.min(scrollBoost, 15);
  const rotBase = 0.004 + boost * 0.004;
  knotMesh.rotation.x += rotBase * 0.6;
  knotMesh.rotation.y += rotBase + mouseX * 0.0005;
  knotMesh.rotation.z += rotBase * 0.2;

  if (knotMesh.material.uniforms) {
    knotMesh.material.uniforms.uTime.value = time;
    knotMesh.material.uniforms.uDistortion.value = 1.0 + boost * 0.06;
    knotMesh.material.uniforms.uTrigger.value += (animTrigger - knotMesh.material.uniforms.uTrigger.value) * 0.04;
  }

  if (ringMesh) {
    ringMesh.rotation.z = time * 0.08 + boost * 0.005;
    ringMesh.material.opacity = 0.15 + boost * 0.01;
  }

  if (particles) {
    particles.rotation.y = time * 0.015;
    particles.material.opacity = 0.2 + animTrigger * 0.12 + boost * 0.005;
  }

  const cx = mouseX * 0.12, cy = mouseY * 0.08;
  camera.position.x += (cx - camera.position.x)*0.02;
  camera.position.y += (cy - camera.position.y)*0.02;
  camera.lookAt(mainGroup.position.x, mainGroup.position.y, 0);

  renderer.render(scene, camera);
}

export function updateScrollProgress(p) {
  state.scale = 1 - p * 0.4;
  state.posX = p * 2.2;
  state.posY = -p * 1.2;
  state.posZ = -p * 0.5;
}

export function setTrigger(v) {
  animTrigger = v;
}

init();
