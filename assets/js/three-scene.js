import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

console.log('[three-scene] Loading GLB ceramic sphere model...');

gsap.registerPlugin(ScrollTrigger);

const canvas = document.querySelector('#three-canvas');
const scene = new THREE.Scene();

const W = window.innerWidth, H = window.innerHeight;
const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 100);
camera.position.set(0, 0.1, 7.5);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
renderer.setSize(W, H);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 4));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.8;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.45, 0.2, 0.25);
composer.addPass(bloom);

// ======== Star Field ========
const sPos = new Float32Array(3000 * 3);
for (let i = 0; i < 3000; i++) {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  const r = 10 + Math.random() * 25;
  sPos[i*3] = Math.sin(phi) * Math.cos(theta) * r;
  sPos[i*3+1] = Math.sin(phi) * Math.sin(theta) * r;
  sPos[i*3+2] = Math.cos(phi) * r;
}
const sGeo = new THREE.BufferGeometry();
sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
const sMat = new THREE.PointsMaterial({
  size: 0.035, sizeAttenuation: true, transparent: true,
  opacity: 0.3, color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false,
});
const stars = new THREE.Points(sGeo, sMat);
scene.add(stars);

// ======== Lighting (matched to GLB model) ========
const ambient = new THREE.AmbientLight(0x333344, 0.3);
scene.add(ambient);
const dirLight = new THREE.DirectionalLight(0xfff5ee, 1.2);
dirLight.position.set(5, 2, 3);
scene.add(dirLight);
const fillLight = new THREE.DirectionalLight(0xe8e0d8, 0.4);
fillLight.position.set(-3, -1, 2);
scene.add(fillLight);

// GLB model container
const modelGroup = new THREE.Group();
scene.add(modelGroup);

// Crystal glow lights
const crystalLight1 = new THREE.PointLight(0x3a1c7a, 0.6, 5);
crystalLight1.position.set(0, 0.3, 0);
scene.add(crystalLight1);
const crystalLight2 = new THREE.PointLight(0x22ddcc, 0.3, 4);
crystalLight2.position.set(0.5, -0.2, 0.5);
scene.add(crystalLight2);

// ======== Load GLB Model ========
const loader = new GLTFLoader();
let modelLoaded = false;

loader.load(
  'assets/models/ceramic-cracked-sphere.glb',
  (gltf) => {
    const root = gltf.scene;
    root.traverse((child) => {
      if (child.isMesh) {
        child.material.transparent = true;
        child.material.opacity = 0.95;
        child.material.roughness = 0.2;
        child.material.envMapIntensity = 0.3;
      }
    });
    modelGroup.add(root);
    modelLoaded = true;
    console.log('[three-scene] GLB model loaded');
  },
  (xhr) => {
    if (xhr.lengthComputable && xhr.total > 0) {
      const pct = Math.round((xhr.loaded / xhr.total) * 100);
      if (pct % 50 === 0 || pct === 100) console.log(`[three-scene] Loading model: ${pct}%`);
    }
  },
  (err) => {
    console.error('[three-scene] GLB load error:', err);
  }
);

// ======== Resize ========
window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
});

// ======== Mouse Parallax ========
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
.to(state, { rot: Math.PI * 2, ease: 'none' }, 0);

// ======== Animation Loop ========
const clock = new THREE.Clock();

function tick() {
  const t = clock.getElapsedTime();

  tx += (mx - tx) * 0.04;
  ty += (my - ty) * 0.04;

  if (modelLoaded) {
    modelGroup.rotation.y += (state.rot - modelGroup.rotation.y) * 0.03;
    modelGroup.rotation.x = ty * 0.04;
  }

  crystalLight1.intensity = 0.5 + Math.sin(t * 0.5) * 0.25;
  crystalLight2.intensity = 0.25 + Math.sin(t * 0.7 + 1.0) * 0.15;

  stars.rotation.y = t * 0.003;
  stars.rotation.x = Math.sin(t * 0.002) * 0.008;

  composer.render();
  requestAnimationFrame(tick);
}
tick();

// ======== Exports ========
export function updateScrollProgress(p) {}

export function setTrigger(v) {
  bloom.strength = 0.45 + v * 0.35;
  crystalLight1.intensity = 0.6 + v * 0.5;
}
