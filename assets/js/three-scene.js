import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

let scene, camera, renderer;
let mainGroup, ring1, ring2;
let orbiters = [];
let particles;
let mouseX = 0, mouseY = 0;
let scrollY = 0;
let time = 0;

const ORBITER_COUNT = 12;

function createGlowTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.15, 'rgba(255,255,255,0.7)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.15)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

function init() {
  const canvas = document.getElementById('three-canvas');
  if (!canvas) return;

  scene = new THREE.Scene();
  const w = window.innerWidth, h = window.innerHeight;

  camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
  camera.position.set(0, 0.3, 6.5);

  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const ambient = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambient);
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(3, 4, 5);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x99bbff, 0.6);
  fill.position.set(-3, 1, 2);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xff8888, 0.4);
  rim.position.set(0, -3, -4);
  scene.add(rim);

  mainGroup = new THREE.Group();
  scene.add(mainGroup);

  // --- Ring 1 (horizontal) ---
  const ringGeo = new THREE.TorusGeometry(1.6, 0.012, 64, 128);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x8888cc,
    transparent: true,
    opacity: 0.3,
  });
  ring1 = new THREE.Mesh(ringGeo, ringMat);
  mainGroup.add(ring1);

  // --- Ring 2 (tilted) ---
  const ringMat2 = new THREE.MeshBasicMaterial({
    color: 0xcc88aa,
    transparent: true,
    opacity: 0.2,
  });
  ring2 = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.008, 64, 128), ringMat2);
  ring2.rotation.x = Math.PI * 0.4;
  ring2.rotation.z = Math.PI * 0.3;
  mainGroup.add(ring2);

  // --- Orbiter shapes ---
  const orbiterPalette = [
    new THREE.Color(0.91, 0.47, 0.42),
    new THREE.Color(0.42, 0.56, 0.75),
    new THREE.Color(0.77, 0.60, 0.42),
    new THREE.Color(0.50, 0.66, 0.63),
    new THREE.Color(0.72, 0.57, 0.71),
  ];

  for (let i = 0; i < ORBITER_COUNT; i++) {
    const col = orbiterPalette[i % orbiterPalette.length];
    const size = 0.06 + Math.random() * 0.04;
    const geo = new THREE.OctahedronGeometry(size, 0);

    const mat = new THREE.MeshPhysicalMaterial({
      color: col,
      metalness: 0.0,
      roughness: 0.15,
      transparent: true,
      opacity: 0.6,
      clearcoat: 0.4,
      clearcoatRoughness: 0.15,
    });
    const mesh = new THREE.Mesh(geo, mat);

    const wireMat = new THREE.MeshBasicMaterial({
      color: col,
      wireframe: true,
      transparent: true,
      opacity: 0.3,
    });
    const wire = new THREE.Mesh(geo.clone(), wireMat);
    wire.scale.setScalar(1.15);

    const g = new THREE.Group();
    g.add(mesh);
    g.add(wire);

    const angle = (i / ORBITER_COUNT) * Math.PI * 2;
    const radius = 1.2 + Math.random() * 0.8;
    const tilt = (Math.random() - 0.5) * 0.3;
    const speed = 0.15 + Math.random() * 0.15;
    const rotX = 0.5 + Math.random() * 1.5;
    const rotY = 0.8 + Math.random() * 1.2;
    const floatAmp = 0.03 + Math.random() * 0.04;

    orbiters.push({ g, angle, radius, tilt, speed, rotX, rotY, floatAmp, phase: Math.random() * 6 });
    mainGroup.add(g);
  }

  // --- Glow particles ---
  const tex = createGlowTexture();
  const pCount = 200;
  const pPos = new Float32Array(pCount * 3);
  for (let i = 0; i < pCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 1.8 + Math.random() * 2.5;
    pPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    pPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    pPos[i * 3 + 2] = r * Math.cos(phi);
  }
  const pGeom = new THREE.BufferGeometry();
  pGeom.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const pMat = new THREE.PointsMaterial({
    size: 0.015,
    map: tex,
    color: 0xaaaadd,
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
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
  scrollY = window.scrollY;
}

function animate() {
  requestAnimationFrame(animate);
  time += 0.006;

  const vh = window.innerHeight;
  const pct = Math.min(scrollY / vh, 0.5);
  // Fade out 3D completely within first 35% of viewport scroll
  const fade = Math.max(0, 1 - pct * 3);

  // Global rotation
  const rotateY = (1 - pct) * Math.PI * 1.5 + time * 0.02;
  mainGroup.rotation.y = rotateY + mouseX * 0.08;
  mainGroup.rotation.x = Math.sin(time * 0.08) * 0.04 + mouseY * 0.05;

  // Rings
  if (ring1) {
    ring1.rotation.z = time * 0.1;
    ring1.material.opacity = 0.3 * fade;
  }
  if (ring2) {
    ring2.rotation.z = time * -0.06 + 0.3;
    ring2.material.opacity = 0.2 * fade;
  }

  // Orbiters
  for (const o of orbiters) {
    o.angle += time * o.speed * 0.02;
    const x = o.radius * Math.cos(o.angle);
    const z = o.radius * Math.sin(o.angle);
    const y = Math.sin(time * 0.5 + o.phase) * o.floatAmp + o.tilt;
    o.g.position.set(x, y, z);
    o.g.rotation.x += o.rotX * 0.015;
    o.g.rotation.y += o.rotY * 0.015;
    o.g.scale.setScalar(0.8 + fade * 0.2);

    for (const child of o.g.children) {
      if (child.isMesh) child.material.opacity = (0.6 * fade);
    }
  }

  // Particles
  if (particles) {
    particles.rotation.y = time * 0.01;
    particles.material.opacity = 0.3 * fade;
  }

  // Camera drift
  const cx = mouseX * 0.2 - camera.position.x;
  const cy = mouseY * 0.15 - camera.position.y;
  camera.position.x += cx * 0.02;
  camera.position.y += cy * 0.02;
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);
}

init();
