import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

let scene, camera, renderer;
let mainGroup, knot1, knot2, glowRing, particles;
let mouseX = 0, mouseY = 0, mouseZone = 'center';
let scrollBoost = 0;
let state = { scale: 1, posX: 0, posY: 0, posZ: 0 };
let animTrigger = 0, burstPhase = 0;
let time = 0;
let particleVel = [];

function init() {
  const canvas = document.getElementById('three-canvas');
  if (!canvas) return;

  scene = new THREE.Scene();
  const w = window.innerWidth, h = window.innerHeight;

  camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
  camera.position.set(0, 0.2, 6);

  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.7;

  const amb = new THREE.AmbientLight(0x443366, 0.25);
  scene.add(amb);
  const key = new THREE.DirectionalLight(0xffffff, 2.5);
  key.position.set(4, 6, 7);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x7744cc, 0.8);
  fill.position.set(-4, 3, 2);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xaa44ff, 0.4);
  rim.position.set(0, -5, -6);
  scene.add(rim);

  mainGroup = new THREE.Group();
  scene.add(mainGroup);

  const vs = `
    uniform float uTime;
    uniform float uDistortion;
    uniform float uTrigger;
    uniform float uMouseZone;
    varying vec3 vNormal;
    varying vec3 vPos;
    varying vec3 vWorldPos;
    void main() {
      vec3 pos = position;
      float n = sin(pos.x*4.5 + uTime*0.55)*0.012
              + cos(pos.y*5.5 + uTime*0.45)*0.012
              + sin(pos.z*6.5 + uTime*0.65)*0.012;
      float trig = sin(pos.x*3.5 + uTrigger*6.28)*0.025
                 + cos(pos.y*4.0 + uTrigger*6.28)*0.025;
      n += trig * uTrigger * 0.8;
      pos += normal * n * uDistortion;
      vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
      vNormal = normalize(normalMatrix * normal);
      vPos = mvPos.xyz;
      vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;
      gl_Position = projectionMatrix * mvPos;
    }
  `;

  const fs = `
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    uniform vec3 uColor3;
    uniform vec3 uGlowColor;
    uniform float uTime;
    uniform float uTrigger;
    uniform float uMouseZone;
    uniform float uBurst;
    varying vec3 vNormal;
    varying vec3 vPos;
    varying vec3 vWorldPos;
    void main() {
      vec3 viewDir = normalize(-vPos);
      float NdotV = max(dot(viewDir, vNormal), 0.0);
      float fresnel = pow(1.0 - NdotV, 3.0);
      float edgeGlow = pow(1.0 - abs(dot(viewDir, vNormal)), 5.0);
      float iri = sin(vWorldPos.x*2.5 + vWorldPos.y*3.0 + vWorldPos.z*2.0 + uTime*0.2)*0.5 + 0.5;
      vec3 iriColor = mix(uColor1, uColor2, iri);
      iriColor = mix(iriColor, uColor3, fresnel*0.6);
      float zoneShift = sin(uMouseZone*3.14)*0.15;
      vec3 base = mix(iriColor, vec3(0.5,0.15,0.6), zoneShift);
      float vein = sin(vWorldPos.x*9.0 + uTime*0.4)*0.5+0.5
                 + cos(vWorldPos.y*11.0 + uTime*0.6)*0.5+0.5;
      vein = sin(vein*3.14)*0.35;
      vec3 vc = uGlowColor * vein * 0.2 * (1.0 + uTrigger*1.5);
      float b = uBurst * exp(-pow(length(vWorldPos.xy)*2.0 - uBurst*2.0, 2.0)*3.0);
      vec3 burstGlow = uGlowColor * b * 0.5;
      vec3 glow = uGlowColor * edgeGlow * 0.5 * (1.0 + uTrigger*0.8);
      float pulse = 0.92 + sin(uTime*0.35 + fresnel*3.0)*0.06;
      float alpha = 0.85 + uTrigger*0.1 + b*0.1;
      gl_FragColor = vec4((base + glow + vc + burstGlow) * pulse, alpha);
    }
  `;

  const uniformDef = {
    uTime: { value: 0 },
    uDistortion: { value: 1.0 },
    uTrigger: { value: 0.0 },
    uMouseZone: { value: 0.0 },
    uBurst: { value: 0.0 },
    uColor1: { value: new THREE.Color(0.06, 0.02, 0.18) },
    uColor2: { value: new THREE.Color(0.25, 0.05, 0.35) },
    uColor3: { value: new THREE.Color(0.45, 0.12, 0.40) },
    uGlowColor: { value: new THREE.Color(0.50, 0.20, 0.80) },
  };

  const knotGeo1 = new THREE.TorusKnotGeometry(1.0, 0.28, 240, 32);
  knot1 = new THREE.Mesh(knotGeo1, new THREE.ShaderMaterial({
    uniforms: uniformDef, vertexShader: vs, fragmentShader: fs,
    side: THREE.DoubleSide, transparent: true,
  }));
  mainGroup.add(knot1);

  const knotGeo2 = new THREE.TorusKnotGeometry(0.35, 0.10, 120, 16);
  const mat2 = new THREE.ShaderMaterial({
    uniforms: JSON.parse(JSON.stringify(uniformDef)),
    vertexShader: vs, fragmentShader: fs,
    side: THREE.DoubleSide, transparent: true,
  });
  mat2.uniforms.uColor1.value = new THREE.Color(0.30, 0.05, 0.10);
  mat2.uniforms.uColor2.value = new THREE.Color(0.50, 0.10, 0.25);
  mat2.uniforms.uColor3.value = new THREE.Color(0.35, 0.08, 0.45);
  mat2.uniforms.uGlowColor.value = new THREE.Color(0.80, 0.25, 0.50);
  knot2 = new THREE.Mesh(knotGeo2, mat2);
  mainGroup.add(knot2);

  const ringGeo = new THREE.TorusGeometry(1.5, 0.006, 48, 160);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x7755bb, transparent: true, opacity: 0.1,
  });
  glowRing = new THREE.Mesh(ringGeo, ringMat);
  glowRing.rotation.x = 0.3;
  mainGroup.add(glowRing);

  const ringGeo2 = new THREE.TorusGeometry(1.7, 0.004, 32, 160);
  const ringMat2 = new THREE.MeshBasicMaterial({
    color: 0x9966cc, transparent: true, opacity: 0.06,
  });
  const ring2 = new THREE.Mesh(ringGeo2, ringMat2);
  ring2.rotation.x = -0.4;
  ring2.rotation.z = 0.6;
  mainGroup.add(ring2);

  function mkTex() {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32,32,0,32,32,32);
    g.addColorStop(0,'rgba(255,255,255,0.5)');
    g.addColorStop(0.12,'rgba(210,180,255,0.2)');
    g.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0,0,64,64);
    const t = new THREE.CanvasTexture(c); t.needsUpdate = true;
    return t;
  }

  const pCount = 400;
  const pPos = new Float32Array(pCount * 3);
  const pCol = new Float32Array(pCount * 3);
  const pSiz = new Float32Array(pCount);
  particleVel = [];
  for (let i = 0; i < pCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 1.5 + Math.random() * 4.5;
    pPos[i*3] = r * Math.sin(phi) * Math.cos(theta);
    pPos[i*3+1] = (Math.random() - 0.5) * 5;
    pPos[i*3+2] = r * Math.cos(phi);
    const c = new THREE.Color(0.3+Math.random()*0.3, 0.08+Math.random()*0.15, 0.4+Math.random()*0.4);
    pCol[i*3] = c.r; pCol[i*3+1] = c.g; pCol[i*3+2] = c.b;
    pSiz[i] = 0.006 + Math.random() * 0.025;
    particleVel.push(new THREE.Vector3(
      (Math.random()-0.5)*0.003, (Math.random()-0.5)*0.003, (Math.random()-0.5)*0.003
    ));
  }
  const pGeom = new THREE.BufferGeometry();
  pGeom.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeom.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  pGeom.setAttribute('size', new THREE.BufferAttribute(pSiz, 1));
  const pMat = new THREE.PointsMaterial({
    size: 0.018, map: mkTex(), vertexColors: true,
    transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending,
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
  const zone = e.clientX / window.innerWidth;
  if (zone < 0.3) mouseZone = 'left';
  else if (zone > 0.7) mouseZone = 'right';
  else mouseZone = 'center';
}

let prevScrollY = 0;
function onScroll() {
  const sy = window.scrollY;
  const delta = Math.abs(sy - prevScrollY);
  if (delta > 2) scrollBoost = delta * 3;
  prevScrollY = sy;
}

function animate() {
  requestAnimationFrame(animate);
  time += 0.004;
  scrollBoost *= 0.85;
  burstPhase *= 0.96;

  const s = state.scale, px = state.posX, py = state.posY, pz = state.posZ;
  mainGroup.scale.setScalar(1 + (s - 1)*0.04);
  mainGroup.position.x += (px - mainGroup.position.x)*0.04;
  mainGroup.position.y += (py - mainGroup.position.y)*0.04;
  mainGroup.position.z += (pz - mainGroup.position.z)*0.04;

  const boost = Math.min(scrollBoost, 20);
  const rotBase = 0.003 + boost * 0.004;
  knot1.rotation.x += rotBase * 0.5;
  knot1.rotation.y += rotBase + mouseX * 0.0004;
  knot1.rotation.z += rotBase * 0.15;

  const angle = time * 0.3;
  knot2.position.x = Math.cos(angle) * 1.4;
  knot2.position.y = Math.sin(angle * 0.7) * 0.5;
  knot2.position.z = Math.sin(angle) * 1.4;
  knot2.rotation.x = time * 0.5;
  knot2.rotation.y = time * 0.7;

  let zoneVal = 0;
  if (mouseZone === 'left') zoneVal = -0.6;
  else if (mouseZone === 'right') zoneVal = 0.6;
  else zoneVal = 0;

  for (const k of [knot1, knot2]) {
    if (k.material.uniforms) {
      const u = k.material.uniforms;
      u.uTime.value = time;
      u.uDistortion.value = 1.0 + boost * 0.05 + animTrigger * 0.3;
      u.uTrigger.value += (animTrigger - u.uTrigger.value) * 0.04;
      u.uMouseZone.value += (zoneVal - u.uMouseZone.value) * 0.03;
      u.uBurst.value += (burstPhase - u.uBurst.value) * 0.05;
    }
  }

  if (glowRing) {
    glowRing.rotation.z = time * 0.06 + boost * 0.004;
    glowRing.material.opacity = 0.1 + boost * 0.008;
  }

  if (particles) {
    const pos = particles.geometry.attributes.position;
    const arr = pos.array;
    const mx = mouseX * 3;
    const my = mouseY * 2;
    for (let i = 0; i < arr.length / 3; i++) {
      const v = particleVel[i];
      const px = arr[i*3], py = arr[i*3+1], pz = arr[i*3+2];
      const dx = mx - px, dy = my - py;
      v.x += dx * 0.00001;
      v.y += dy * 0.00001;
      v.x *= 0.999; v.y *= 0.999; v.z *= 0.999;
      arr[i*3] += v.x + burstPhase * (arr[i*3] - mx) * 0.001;
      arr[i*3+1] += v.y + burstPhase * (arr[i*3+1] - my) * 0.001;
      arr[i*3+2] += v.z;
      if (Math.abs(arr[i*3]) > 6) arr[i*3] *= 0.99;
      if (Math.abs(arr[i*3+1]) > 6) arr[i*3+1] *= 0.99;
      if (Math.abs(arr[i*3+2]) > 6) arr[i*3+2] *= 0.99;
    }
    pos.needsUpdate = true;
    particles.rotation.y = time * 0.008;
    particles.material.opacity = 0.15 + animTrigger * 0.15 + boost * 0.004;
  }

  const cx = mouseX * 0.1 + zoneVal * 0.05;
  const cy = mouseY * 0.08;
  camera.position.x += (cx - camera.position.x)*0.02;
  camera.position.y += (cy - camera.position.y)*0.02;
  camera.lookAt(mainGroup.position.x, mainGroup.position.y, 0);

  renderer.render(scene, camera);
}

export function updateScrollProgress(p) {
  state.scale = 1 - p * 0.35;
  state.posX = p * 2.0;
  state.posY = -p * 1.0;
  state.posZ = -p * 0.4;
}

export function setTrigger(v) {
  animTrigger = v;
  if (v > 0.3 && burstPhase < 0.1) burstPhase = 1;
}

init();
