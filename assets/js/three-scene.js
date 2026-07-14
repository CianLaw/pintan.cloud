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

const geometry = new THREE.TorusKnotGeometry(1.4, 0.35, 200, 16, 2, 3);

const material = new THREE.MeshPhysicalMaterial({
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

const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const mainLight = new THREE.DirectionalLight(0xffffff, 1.5);
mainLight.position.set(5, 5, 5);
scene.add(mainLight);

const violetLight = new THREE.PointLight(0x7a22ff, 3, 50);
violetLight.position.set(-5, -3, 2);
scene.add(violetLight);

const cyanLight = new THREE.PointLight(0x00f0ff, 2, 50);
cyanLight.position.set(5, -3, -2);
scene.add(cyanLight);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let mouseX = 0, mouseY = 0;
let targetX = 0, targetY = 0;

window.addEventListener('mousemove', (event) => {
  mouseX = (event.clientX / window.innerWidth - 0.5) * 2;
  mouseY = (event.clientY / window.innerHeight - 0.5) * 2;
});

const clock = new THREE.Clock();

const tick = () => {
  const elapsedTime = clock.getElapsedTime();

  mesh.rotation.y = elapsedTime * 0.12;
  mesh.rotation.x = elapsedTime * 0.08;

  targetX += (mouseX - targetX) * 0.05;
  targetY += (mouseY - targetY) * 0.05;
  mesh.rotation.y += targetX * 0.4;
  mesh.rotation.x += -targetY * 0.4;

  renderer.render(scene, camera);
  window.requestAnimationFrame(tick);
};
tick();

gsap.timeline({
  scrollTrigger: {
    trigger: 'body',
    start: 'top top',
    end: 'bottom bottom',
    scrub: 1.2,
  },
})
.to(mesh.scale, { x: 0.35, y: 0.35, z: 0.35 }, 0)
.to(mesh.position, {
  x: window.innerWidth > 768 ? 2.8 : 0,
  y: window.innerWidth > 768 ? 1.5 : -1,
}, 0);

export function updateScrollProgress(p) {}

export function setTrigger(v) {
  const intensity = 0.15 + v * 0.2;
  material.emissive = new THREE.Color(0x9f92ec).multiplyScalar(intensity);
  material.emissiveIntensity = intensity;
}
