import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

gsap.registerPlugin(ScrollTrigger);

const canvas = document.querySelector('#three-canvas');
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0.4, 7);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

// ======== Central Icosahedron ========
const icoGeo = new THREE.IcosahedronGeometry(1.0, 2);
const icoMat = new THREE.MeshPhysicalMaterial({
  color: 0x9f92ec,
  roughness: 0.12,
  metalness: 0.05,
  transmission: 0.7,
  thickness: 0.8,
  ior: 1.5,
  clearcoat: 1.0,
  clearcoatRoughness: 0.08,
  envMapIntensity: 0.6,
  side: THREE.DoubleSide,
});
const icoMesh = new THREE.Mesh(icoGeo, icoMat);
scene.add(icoMesh);

const edgeGeo = new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.02, 1));
const edgeMat = new THREE.LineBasicMaterial({ color: 0x7B2CBF, transparent: true, opacity: 0.35 });
const edgeLine = new THREE.LineSegments(edgeGeo, edgeMat);
icoMesh.add(edgeLine);

// Inner glow core
const coreGeo = new THREE.SphereGeometry(0.2, 16, 16);
const coreMat = new THREE.MeshBasicMaterial({ color: 0x7B2CBF, transparent: true, opacity: 0.25 });
const coreMesh = new THREE.Mesh(coreGeo, coreMat);
icoMesh.add(coreMesh);

// ======== Nebula Particles ========
const PCOUNT = 2500;
const pos = new Float32Array(PCOUNT * 3);
const cols = new Float32Array(PCOUNT * 3);
const sizes = new Float32Array(PCOUNT);
const origY = new Float32Array(PCOUNT);

const cA = new THREE.Color(0x7B2CBF);
const cB = new THREE.Color(0x00F5FF);

for (let i = 0; i < PCOUNT; i++) {
  const r = 1.5 + Math.random() * 2.8;
  const spiral = r * 2.2;
  const branch = ((i % 4) / 4) * Math.PI * 2;
  const scatter = (1 - (r - 1.5) / 2.8) * 0.35 + 0.08;
  const a = branch + spiral + (Math.random() - 0.5) * scatter;

  const flatten = 0.2 + (1 - (r - 1.5) / 2.8) * 0.25;
  const y = (Math.random() - 0.5) * flatten;

  pos[i*3] = Math.cos(a) * r;
  pos[i*3+1] = y;
  pos[i*3+2] = Math.sin(a) * r;
  origY[i] = y;

  const mix = (r - 1.5) / 2.8;
  cA.clone().lerp(cB, mix).toArray(cols, i*3);
  sizes[i] = 0.015 + Math.random() * 0.045;
}

const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
pGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
pGeo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

const pMat = new THREE.PointsMaterial({
  size: 0.055,
  sizeAttenuation: true,
  transparent: true,
  opacity: 0.85,
  vertexColors: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const particles = new THREE.Points(pGeo, pMat);
scene.add(particles);

// ======== Distant Star Field ========
const STAR_COUNT = 800;
const sPos = new Float32Array(STAR_COUNT * 3);
const sCols = new Float32Array(STAR_COUNT * 3);
for (let i = 0; i < STAR_COUNT; i++) {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  const r = 5 + Math.random() * 5;
  sPos[i*3] = Math.sin(phi) * Math.cos(theta) * r;
  sPos[i*3+1] = Math.sin(phi) * Math.sin(theta) * r * 0.3;
  sPos[i*3+2] = Math.cos(phi) * r;
  const c = new THREE.Color(0xffffff).lerp(new THREE.Color(0x7B2CBF), Math.random() * 0.3);
  c.toArray(sCols, i*3);
}
const sGeo = new THREE.BufferGeometry();
sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
sGeo.setAttribute('color', new THREE.BufferAttribute(sCols, 3));
const sMat = new THREE.PointsMaterial({
  size: 0.025,
  sizeAttenuation: true,
  transparent: true,
  opacity: 0.5,
  vertexColors: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const stars = new THREE.Points(sGeo, sMat);
scene.add(stars);

// ======== Lights ========
scene.add(new THREE.AmbientLight(0xffffff, 0.3));

const dl = new THREE.DirectionalLight(0xffffff, 2);
dl.position.set(5, 5, 5);
scene.add(dl);

const pl1 = new THREE.PointLight(0x7a22ff, 4, 50);
pl1.position.set(-5, -3, 2);
scene.add(pl1);

const pl2 = new THREE.PointLight(0x00f0ff, 2.5, 50);
pl2.position.set(5, -3, -2);
scene.add(pl2);

const pl3 = new THREE.PointLight(0x9f92ec, 1.5, 30);
pl3.position.set(0, -5, 0);
scene.add(pl3);

// ======== Resize ========
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ======== Mouse ========
let mx = 0, my = 0, tx = 0, ty = 0;
window.addEventListener('mousemove', (e) => {
  mx = (e.clientX / window.innerWidth - 0.5) * 2;
  my = (e.clientY / window.innerHeight - 0.5) * 2;
});

// ======== Scroll → Rotation ========
const state = { rot: 0 };
gsap.timeline({
  scrollTrigger: { trigger: 'body', start: 'top top', end: 'bottom bottom', scrub: 1.2 },
})
.to(state, { rot: Math.PI * 6, ease: 'none' }, 0);

// ======== Animation ========
const clock = new THREE.Clock();
const pPos = pGeo.attributes.position.array;

function tick() {
  const t = clock.getElapsedTime();

  // Breathing
  icoMesh.scale.setScalar(1 + Math.sin(t * 0.5) * 0.012);

  // Scroll rotation
  icoMesh.rotation.y += (state.rot - icoMesh.rotation.y) * 0.03;

  // Mouse tilt (independent of scroll rotation)
  tx += (mx - tx) * 0.04;
  ty += (my - ty) * 0.04;
  icoMesh.rotation.x = Math.sin(t * 0.08) * 0.04 + ty * 0.12;
  icoMesh.rotation.z = Math.cos(t * 0.06) * 0.025;

  // Core glow pulse
  coreMesh.scale.setScalar(1 + Math.sin(t * 0.7) * 0.4);

  // Nebula orbit + wave
  for (let i = 0; i < PCOUNT; i++) {
    const i3 = i * 3;
    const x = pPos[i3], z = pPos[i3+2];
    const rad = Math.sqrt(x * x + z * z);
    const angle = Math.atan2(z, x);
    const orbit = t * (0.03 + 0.04 / (1 + rad * 0.5));
    const newAngle = angle + orbit;
    pPos[i3] = Math.cos(newAngle) * rad;
    pPos[i3+2] = Math.sin(newAngle) * rad;
    pPos[i3+1] = origY[i] + Math.sin(t * 0.4 + i * 0.01) * 0.03;
  }
  pGeo.attributes.position.needsUpdate = true;

  // Stars slow drift
  stars.rotation.y = t * 0.008;

  // Particle opacity pulse (global)
  pMat.opacity = 0.75 + Math.sin(t * 0.3) * 0.1;

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

// ======== Exports ========
export function updateScrollProgress(p) {}

export function setTrigger(v) {
  const i = 0.12 + v * 0.3;
  icoMat.emissive = new THREE.Color(0x9f92ec).multiplyScalar(i);
  icoMat.emissiveIntensity = i;
  edgeMat.opacity = 0.25 + v * 0.4;
}
