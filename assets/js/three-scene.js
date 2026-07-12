import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

let scene, camera, renderer;
let coreParticles;
let mouseX = 0, mouseY = 0;
let scrollY = 0;
let time = 0;

const CORE_COUNT = 3000;

function createParticleTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.15, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.3)');
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

  const w = window.innerWidth;
  const h = window.innerHeight;

  camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 200);
  camera.position.z = 8;

  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const tex = createParticleTexture();

  // Core particle cluster (center)
  const corePositions = new Float32Array(CORE_COUNT * 3);
  const coreColors = new Float32Array(CORE_COUNT * 3);
  const coreSizes = new Float32Array(CORE_COUNT);
  const coreOrigins = new Float32Array(CORE_COUNT * 3);
  const corePhases = new Float32Array(CORE_COUNT);
  const coreSpeeds = new Float32Array(CORE_COUNT);

  const corePalette = [
    [0.35, 0.50, 0.95],
    [0.50, 0.30, 0.92],
    [0.90, 0.28, 0.52],
    [0.18, 0.72, 0.62],
    [0.92, 0.52, 0.15],
    [0.88, 0.35, 0.35],
  ];

  for (let i = 0; i < CORE_COUNT; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 1.8 * Math.cbrt(Math.random());

    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta);
    const z = r * Math.cos(phi);

    corePositions[i * 3] = x;
    corePositions[i * 3 + 1] = y;
    corePositions[i * 3 + 2] = z;
    coreOrigins[i * 3] = x;
    coreOrigins[i * 3 + 1] = y;
    coreOrigins[i * 3 + 2] = z;

    const c = corePalette[Math.floor(Math.random() * corePalette.length)];
    coreColors[i * 3] = c[0];
    coreColors[i * 3 + 1] = c[1];
    coreColors[i * 3 + 2] = c[2];

    coreSizes[i] = 0.03 + Math.random() * 0.06;
    corePhases[i] = Math.random() * Math.PI * 2;
    coreSpeeds[i] = 0.3 + Math.random() * 0.7;
  }

  const coreGeom = new THREE.BufferGeometry();
  coreGeom.setAttribute('position', new THREE.BufferAttribute(corePositions, 3));
  coreGeom.setAttribute('color', new THREE.BufferAttribute(coreColors, 3));
  coreGeom.setAttribute('size', new THREE.BufferAttribute(coreSizes, 1));

  const coreMat = new THREE.PointsMaterial({
    size: 0.06,
    map: tex,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    blending: THREE.NormalBlending,
    sizeAttenuation: true,
    depthWrite: false,
  });

  coreParticles = new THREE.Points(coreGeom, coreMat);
  scene.add(coreParticles);

  // Store data for animation
  window.__coreData = { origins: coreOrigins, phases: corePhases, speeds: coreSpeeds };

  animate();

  window.addEventListener('resize', onResize);
  document.addEventListener('mousemove', onMouseMove);
  window.addEventListener('scroll', onScroll, { passive: true });
}

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
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
  time += 0.008;

  const viewH = window.innerHeight;
  const scrollPct = Math.min(scrollY / viewH, 1);
  // Scroll UP (less scrollY) = more expansion
  const expansion = 1 + (1 - scrollPct) * 3.5; // 4.5x at top, 1x at bottom

  // --- Core particles ---
  if (coreParticles) {
    const pos = coreParticles.geometry.attributes.position.array;
    const sizes = coreParticles.geometry.attributes.size.array;
    const d = window.__coreData;

    for (let i = 0; i < CORE_COUNT; i++) {
      const i3 = i * 3;
      const ox = d.origins[i3];
      const oy = d.origins[i3 + 1];
      const oz = d.origins[i3 + 2];

      const amp = 0.12 + (1 - scrollPct) * 0.35;
      const fx = Math.sin(time * d.speeds[i] + d.phases[i]) * amp * 0.5;
      const fy = Math.cos(time * d.speeds[i] * 0.7 + d.phases[i] * 1.3) * amp * 0.5;
      const fz = Math.sin(time * d.speeds[i] * 0.5 + d.phases[i] * 0.7) * amp * 0.4;

      pos[i3] = ox * expansion + fx;
      pos[i3 + 1] = oy * expansion + fy;
      pos[i3 + 2] = oz * expansion + fz;

      sizes[i] = (0.035 + (i % 6) * 0.01) * expansion * 0.8;
    }

    coreParticles.geometry.attributes.position.needsUpdate = true;
    coreParticles.geometry.attributes.size.needsUpdate = true;

    coreParticles.rotation.y = time * 0.06 + mouseX * 0.1;
    coreParticles.rotation.x = mouseY * 0.07 + (1 - scrollPct) * 0.2;

    coreParticles.material.opacity = 0.6 + (1 - scrollPct) * 0.4;
  }

  // --- Camera ---
  camera.position.x += (mouseX * 0.5 - camera.position.x) * 0.02;
  camera.position.y += (mouseY * 0.3 - camera.position.y) * 0.02;
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);
}

init();