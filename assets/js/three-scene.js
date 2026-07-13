import * as THREE from 'three';

let scene, camera, renderer;
let mainGroup, torusKnot, knotWire, glowParticles;
let mouseX = 0, mouseY = 0;

const state = { scale: 1, posX: 0, posY: 0, posZ: 0 };

function createGlowTex() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.08, 'rgba(255,255,255,0.5)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.12)');
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

  camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
  camera.position.set(0, 0, 5.5);

  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;

  const ambient = new THREE.AmbientLight(0xffffff, 0.25);
  scene.add(ambient);
  const key = new THREE.DirectionalLight(0xffffff, 2.5);
  key.position.set(5, 6, 7);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x8888cc, 0.8);
  fill.position.set(-5, 3, 4);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xff7788, 0.5);
  rim.position.set(0, -5, -6);
  scene.add(rim);

  mainGroup = new THREE.Group();
  scene.add(mainGroup);

  const knotGeo = new THREE.TorusKnotGeometry(1.0, 0.32, 180, 24);
  const knotMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0.75, 0.60, 0.88),
    metalness: 0.0,
    roughness: 0.04,
    transparent: true,
    transmission: 0.55,
    thickness: 1.8,
    clearcoat: 0.6,
    clearcoatRoughness: 0.08,
    envMapIntensity: 1.2,
    side: THREE.DoubleSide,
    emissive: new THREE.Color(0.30, 0.18, 0.45),
    emissiveIntensity: 0.08,
  });
  torusKnot = new THREE.Mesh(knotGeo, knotMat);
  mainGroup.add(torusKnot);

  const wireMat = new THREE.MeshBasicMaterial({
    color: 0xccbbff,
    wireframe: true,
    transparent: true,
    opacity: 0.09,
  });
  knotWire = new THREE.Mesh(knotGeo.clone(), wireMat);
  knotWire.scale.setScalar(1.12);
  mainGroup.add(knotWire);

  const glowCount = 350;
  const glowPos = new Float32Array(glowCount * 3);
  const glowSizes = new Float32Array(glowCount);
  for (let i = 0; i < glowCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 1.2 + Math.random() * 2.5;
    glowPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    glowPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    glowPos[i * 3 + 2] = r * Math.cos(phi);
    glowSizes[i] = 0.01 + Math.random() * 0.025;
  }
  const glowGeom = new THREE.BufferGeometry();
  glowGeom.setAttribute('position', new THREE.BufferAttribute(glowPos, 3));
  glowGeom.setAttribute('size', new THREE.BufferAttribute(glowSizes, 1));
  const glowMat2 = new THREE.PointsMaterial({
    size: 0.02,
    map: createGlowTex(),
    color: 0xbbaadd,
    transparent: true,
    opacity: 0.15,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  glowParticles = new THREE.Points(glowGeom, glowMat2);
  mainGroup.add(glowParticles);

  animate();
  window.addEventListener('resize', onResize);
  document.addEventListener('mousemove', onMouseMove);
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

function animate() {
  requestAnimationFrame(animate);
  const time = performance.now() * 0.0006;

  const targetRotX = mouseY * 0.12;
  const targetRotY = time * 0.2 + mouseX * 0.15;
  torusKnot.rotation.x += (targetRotX - torusKnot.rotation.x) * 0.04;
  torusKnot.rotation.y += (targetRotY - torusKnot.rotation.y) * 0.04;
  knotWire.rotation.copy(torusKnot.rotation);

  const s = state.scale;
  const px = state.posX;
  const py = state.posY;
  const pz = state.posZ;
  mainGroup.scale.setScalar(1 + (s - 1) * 0.05);
  mainGroup.position.x += (px - mainGroup.position.x) * 0.04;
  mainGroup.position.y += (py - mainGroup.position.y) * 0.04;
  mainGroup.position.z += (pz - mainGroup.position.z) * 0.04;

  const cameraX = mouseX * 0.15;
  const cameraY = mouseY * 0.1;
  camera.position.x += (cameraX - camera.position.x) * 0.02;
  camera.position.y += (cameraY - camera.position.y) * 0.02;
  camera.lookAt(mainGroup.position.x, mainGroup.position.y, 0);

  if (glowParticles) {
    glowParticles.rotation.y = time * 0.03;
  }

  renderer.render(scene, camera);
}

export function updateScrollProgress(p) {
  state.scale = 1 - p * 0.5;
  state.posX = p * 2.8;
  state.posY = -p * 1.6;
  state.posZ = -p * 0.8;
}

init();
