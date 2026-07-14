import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

gsap.registerPlugin(ScrollTrigger);

const canvas = document.querySelector('#three-canvas');
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.z = 6;

const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

// ======== Central Model ========
const icoGeo = new THREE.IcosahedronGeometry(1.0, 1);
const icoMat = new THREE.MeshPhysicalMaterial({
  color: 0x9f92ec,
  roughness: 0.15,
  metalness: 0.1,
  transmission: 0.6,
  thickness: 1.2,
  ior: 1.5,
  clearcoat: 1.0,
  clearcoatRoughness: 0.1,
  side: THREE.DoubleSide,
});
const icoMesh = new THREE.Mesh(icoGeo, icoMat);
scene.add(icoMesh);

const edgeGeo = new THREE.EdgesGeometry(icoGeo);
const edgeMat = new THREE.LineBasicMaterial({ color: 0x7B2CBF, transparent: true, opacity: 0.25 });
const edgeLine = new THREE.LineSegments(edgeGeo, edgeMat);
icoMesh.add(edgeLine);

// ======== Particle Rings ========
function makeRing(radius, count, color, spread = 0.15, tilt = 0) {
  const pos = new Float32Array(count * 3);
  const cols = new Float32Array(count * 3);
  const c = new THREE.Color(color);
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const r = radius + (Math.random() - 0.5) * spread;
    pos[i*3] = Math.cos(a) * r;
    pos[i*3+1] = (Math.random() - 0.5) * 0.1;
    pos[i*3+2] = Math.sin(a) * r;
    c.toArray(cols, i*3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const m = new THREE.PointsMaterial({
    size: 0.045,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.85,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const p = new THREE.Points(g, m);
  if (tilt) p.rotation.x = tilt;
  return p;
}

const ringAmethyst = makeRing(2.0, 400, 0x7B2CBF, 0.25, 0);
scene.add(ringAmethyst);

const ringCyan = makeRing(3.0, 320, 0x00F5FF, 0.3, Math.PI * 0.18);
scene.add(ringCyan);

const ringLavender = makeRing(1.5, 200, 0x9f92ec, 0.12, Math.PI * 0.35);
scene.add(ringLavender);

// ======== Lights ========
scene.add(new THREE.AmbientLight(0xffffff, 0.4));

const mainLight = new THREE.DirectionalLight(0xffffff, 1.5);
mainLight.position.set(5, 5, 5);
scene.add(mainLight);

const violetLight = new THREE.PointLight(0x7a22ff, 3, 50);
violetLight.position.set(-5, -3, 2);
scene.add(violetLight);

const cyanLight = new THREE.PointLight(0x00f0ff, 2, 50);
cyanLight.position.set(5, -3, -2);
scene.add(cyanLight);

// ======== Resize ========
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ======== Mouse Parallax ========
let mouseX = 0, mouseY = 0;
let targetX = 0, targetY = 0;
window.addEventListener('mousemove', (e) => {
  mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
  mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
});

// ======== Scroll → Rotation ========
const scrollState = { y: 0 };
gsap.timeline({
  scrollTrigger: {
    trigger: 'body',
    start: 'top top',
    end: 'bottom bottom',
    scrub: 1.2,
  },
})
.to(scrollState, { y: Math.PI * 6, ease: 'none' }, 0);

// ======== Animation Loop ========
const clock = new THREE.Clock();

function tick() {
  const t = clock.getElapsedTime();

  // Idle wobble
  icoMesh.rotation.x = Math.sin(t * 0.12) * 0.08;
  icoMesh.rotation.z = Math.cos(t * 0.1) * 0.04;

  // Mouse parallax
  targetX += (mouseX - targetX) * 0.05;
  targetY += (mouseY - targetY) * 0.05;
  icoMesh.rotation.y += targetX * 0.3;
  icoMesh.rotation.x += -targetY * 0.2;

  // Scroll-driven Y rotation (additive)
  const icoBase = icoMesh.rotation.y;
  icoMesh.rotation.y = icoBase + (scrollState.y - icoBase) * 0.05;

  // Particle orbits
  ringAmethyst.rotation.y = t * 0.1;
  ringCyan.rotation.y = -t * 0.06;
  ringLavender.rotation.y = t * 0.14;

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

// ======== Exports ========
export function updateScrollProgress(p) {}

export function setTrigger(v) {
  const i = 0.15 + v * 0.25;
  icoMat.emissive = new THREE.Color(0x9f92ec).multiplyScalar(i);
  icoMat.emissiveIntensity = i;
}
