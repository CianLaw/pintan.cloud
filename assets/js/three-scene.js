import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

let scene, camera, renderer, particleSystem;
let mouseX = 0, mouseY = 0;
let scrollY = 0;
let targetExpansion = 0;
let currentExpansion = 0;
let time = 0;

const PARTICLE_COUNT = 4000;
const BASE_SPREAD = 6;
const MAX_SPREAD = 14;

function createParticleTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.3, 'rgba(255,255,255,0.85)');
  gradient.addColorStop(0.6, 'rgba(255,255,255,0.3)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function init() {
  const canvas = document.getElementById('three-canvas');
  if (!canvas) return;

  scene = new THREE.Scene();

  const width = window.innerWidth;
  const height = window.innerHeight;

  camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
  camera.position.z = 8;

  renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const colors = new Float32Array(PARTICLE_COUNT * 3);
  const sizes = new Float32Array(PARTICLE_COUNT);
  const phases = new Float32Array(PARTICLE_COUNT);
  const speeds = new Float32Array(PARTICLE_COUNT);
  const orbits = new Float32Array(PARTICLE_COUNT);
  const origins = new Float32Array(PARTICLE_COUNT * 3);

  const palette = [
    [0.22, 0.45, 0.95],
    [0.50, 0.25, 0.95],
    [0.92, 0.22, 0.48],
    [0.10, 0.72, 0.62],
    [0.95, 0.52, 0.10],
    [0.92, 0.30, 0.30],
  ];

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = BASE_SPREAD * Math.cbrt(Math.random());

    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta);
    const z = r * Math.cos(phi);

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    origins[i * 3] = x;
    origins[i * 3 + 1] = y;
    origins[i * 3 + 2] = z;

    const c = palette[Math.floor(Math.random() * palette.length)];
    colors[i * 3] = c[0];
    colors[i * 3 + 1] = c[1];
    colors[i * 3 + 2] = c[2];

    sizes[i] = 0.04 + Math.random() * 0.08;
    phases[i] = Math.random() * Math.PI * 2;
    speeds[i] = 0.2 + Math.random() * 0.5;
    orbits[i] = 0.3 + Math.random() * 0.7;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.PointsMaterial({
    size: 0.12,
    map: createParticleTexture(),
    vertexColors: true,
    transparent: true,
    opacity: 1.0,
    blending: THREE.NormalBlending,
    sizeAttenuation: true,
    depthWrite: false,
  });

  particleSystem = new THREE.Points(geometry, material);
  scene.add(particleSystem);

  (window).__particleData = { origins, phases, speeds, orbits, positions, sizes };

  animate();

  window.addEventListener('resize', onResize);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('scroll', onScroll);
}

function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
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
  time += 0.01;

  const data = (window).__particleData;
  if (!data || !particleSystem) return;

  const viewHeight = window.innerHeight;
  const scrollPercent = Math.min(scrollY / viewHeight, 1);
  targetExpansion = scrollPercent;

  currentExpansion += (targetExpansion - currentExpansion) * 0.06;

  const positions = particleSystem.geometry.attributes.position.array;
  const sizes = particleSystem.geometry.attributes.size.array;
  const originals = data.origins;
  const phases = data.phases;
  const speeds = data.speeds;
  const originalSizes = data.sizes;

  const expansionFactor = 1 + currentExpansion * 3.5;

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3;
    const ox = originals[i3];
    const oy = originals[i3 + 1];
    const oz = originals[i3 + 2];

    const floatAmp = 0.3 + currentExpansion * 0.5;
    const fx = Math.sin(time * speeds[i] + phases[i]) * floatAmp * 0.3;
    const fy = Math.cos(time * speeds[i] * 0.7 + phases[i] * 1.3) * floatAmp * 0.3;
    const fz = Math.sin(time * speeds[i] * 0.5 + phases[i] * 0.7) * floatAmp * 0.3;

    positions[i3] = ox * expansionFactor + fx;
    positions[i3 + 1] = oy * expansionFactor + fy;
    positions[i3 + 2] = oz * expansionFactor + fz;

    sizes[i] = originalSizes[i] * (1 + currentExpansion * 2);
  }

  particleSystem.geometry.attributes.position.needsUpdate = true;
  particleSystem.geometry.attributes.size.needsUpdate = true;

  const opacity = Math.max(0.3, 1 - currentExpansion * 0.5);
  particleSystem.material.opacity = opacity;

  const parallaxX = mouseX * 0.1;
  const parallaxY = mouseY * 0.1;
  particleSystem.rotation.x = parallaxY + currentExpansion * 0.1;
  particleSystem.rotation.y = parallaxX + currentExpansion * 0.2;

  renderer.render(scene, camera);
}

init();
