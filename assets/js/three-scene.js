import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

console.log('[three-scene] Initializing refined cracked glass sphere scene...');

gsap.registerPlugin(ScrollTrigger);

const canvas = document.querySelector('#three-canvas');
const scene = new THREE.Scene();

const W = window.innerWidth, H = window.innerHeight;
const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 100);
camera.position.set(0, 0.2, 8);
camera.lookAt(0, 0.1, 0);

const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
renderer.setSize(W, H);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 4));
renderer.setClearColor(0x000000, 1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.5;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.6, 0.25, 0.2);
composer.addPass(bloom);

// ======== Star Field (dim, scattered) ========
const STAR_N = 4000;
const sPos = new Float32Array(STAR_N * 3);
for (let i = 0; i < STAR_N; i++) {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  const r = 12 + Math.random() * 30;
  sPos[i*3] = Math.sin(phi) * Math.cos(theta) * r;
  sPos[i*3+1] = Math.sin(phi) * Math.sin(theta) * r;
  sPos[i*3+2] = Math.cos(phi) * r;
}
const sGeo = new THREE.BufferGeometry();
sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
const sMat = new THREE.PointsMaterial({
  size: 0.04, sizeAttenuation: true, transparent: true,
  opacity: 0.35, color: 0xffffff, blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const stars = new THREE.Points(sGeo, sMat);
scene.add(stars);

// ======== Glass Sphere (smooth, translucent) ========
const SPHERE_R = 1;
const sphereGeo = new THREE.SphereGeometry(SPHERE_R, 96, 96);
const sphereMat = new THREE.MeshPhysicalMaterial({
  color: 0x1a3a5c,
  roughness: 0.06,
  metalness: 0.0,
  transmission: 0.65,
  thickness: 0.5,
  ior: 1.5,
  clearcoat: 0.9,
  clearcoatRoughness: 0.05,
  transparent: true,
  opacity: 0.6,
  side: THREE.DoubleSide,
});
const sphere = new THREE.Mesh(sphereGeo, sphereMat);
sphere.position.y = 0.3;
scene.add(sphere);

// ======== Decorative Crack Lines (thin, elegant) ========
const CRACK_COL = 0xcc66dd;

function genDecoCrack(radius, seed, steps = 25) {
  const pts = [];
  const theta0 = seed * 2.399963;
  const phi0 = 0.05 + Math.random() * 0.2;
  let theta = theta0, phi = phi0;
  for (let i = 0; i < steps; i++) {
    phi += 0.04 + (Math.sin(i * 0.6 + seed * 11) * 0.035) + ((Math.random() - 0.5) * 0.04);
    theta += (Math.cos(i * 0.35 + seed * 9) * 0.03) + ((Math.random() - 0.5) * 0.05);
    phi = Math.max(0.02, Math.min(Math.PI - 0.02, phi));
    const x = radius * Math.cos(theta) * Math.sin(phi);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(theta) * Math.sin(phi);
    pts.push(new THREE.Vector3(x, y, z));
  }
  return pts;
}

const crackLines = [];
const numCracks = 14;
for (let i = 0; i < numCracks; i++) {
  const pts = genDecoCrack(SPHERE_R * 1.003, i, 22 + Math.floor(Math.random() * 12));
  const curve = new THREE.CatmullRomCurve3(pts);
  const curvePts = curve.getPoints(30);
  const g = new THREE.BufferGeometry().setFromPoints(curvePts);
  const m = new THREE.LineBasicMaterial({
    color: CRACK_COL,
    transparent: true,
    opacity: 0.35 + Math.random() * 0.25,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const line = new THREE.Line(g, m);
  line.position.copy(sphere.position);
  scene.add(line);
  crackLines.push({ line, baseOpacity: m.opacity });

  // Occasional branch
  if (i % 4 === 0) {
    const branchPts = genDecoCrack(SPHERE_R * 1.003, i + 100, 12);
    const bCurve = new THREE.CatmullRomCurve3(branchPts);
    const bPts = bCurve.getPoints(16);
    const bG = new THREE.BufferGeometry().setFromPoints(bPts);
    const bM = new THREE.LineBasicMaterial({
      color: CRACK_COL, transparent: true, opacity: 0.2,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const bLine = new THREE.Line(bG, bM);
    bLine.position.copy(sphere.position);
    scene.add(bLine);
  }
}

// Crack glow points (sparse, elegant)
const glowPtCount = 300;
const glowPtPos = new Float32Array(glowPtCount * 3);
for (let i = 0; i < glowPtCount; i++) {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.random() * Math.PI;
  const r = SPHERE_R * 1.01 + (Math.random() - 0.5) * 0.03;
  glowPtPos[i*3] = r * Math.sin(phi) * Math.cos(theta);
  glowPtPos[i*3+1] = r * Math.cos(phi);
  glowPtPos[i*3+2] = r * Math.sin(phi) * Math.sin(theta);
}
const glowPtGeo = new THREE.BufferGeometry();
glowPtGeo.setAttribute('position', new THREE.Float32BufferAttribute(glowPtPos, 3));
const glowPtMat = new THREE.PointsMaterial({
  size: 0.015, color: CRACK_COL, transparent: true, opacity: 0.7,
  blending: THREE.AdditiveBlending, depthWrite: false,
});
const glowPoints = new THREE.Points(glowPtGeo, glowPtMat);
glowPoints.position.copy(sphere.position);
scene.add(glowPoints);

// ======== Platform (stacked geometric cubes, matte dark metal) ========
const platformGroup = new THREE.Group();
const blockMat = new THREE.MeshStandardMaterial({
  color: 0x08080e, roughness: 0.85, metalness: 0.6,
});

const BLOCK_COUNT = 22;
for (let i = 0; i < BLOCK_COUNT; i++) {
  const w = 0.15 + Math.random() * 0.45;
  const h = 0.06 + Math.random() * 0.18;
  const d = 0.15 + Math.random() * 0.45;
  const g = new THREE.BoxGeometry(w, h, d);
  const b = new THREE.Mesh(g, blockMat);
  const stepsDown = Math.floor(Math.random() * 5);
  const ly = -0.65 - stepsDown * (0.08 + Math.random() * 0.06);
  const lx = (Math.random() - 0.5) * 1.6;
  const lz = (Math.random() - 0.5) * 1.6;
  if (Math.abs(lx) < 0.3 && Math.abs(lz) < 0.3) continue;
  b.position.set(lx, ly, lz);
  b.rotation.set(
    (Math.random() - 0.5) * 0.06,
    Math.random() * 0.15,
    (Math.random() - 0.5) * 0.06,
  );
  platformGroup.add(b);

  // Cube edge highlight
  const edgeGeo = new THREE.EdgesGeometry(g);
  const edgeMat = new THREE.LineBasicMaterial({
    color: 0x222233, transparent: true, opacity: 0.25,
  });
  const edgeLine = new THREE.LineSegments(edgeGeo, edgeMat);
  b.add(edgeLine);
}
platformGroup.position.y = sphere.position.y;
scene.add(platformGroup);

// Platform crack glow lines (extending from sphere bottom)
for (let i = 0; i < 4; i++) {
  const angle = (i / 4) * Math.PI * 2 + Math.random() * 0.3;
  const pts = [];
  for (let j = 0; j < 15; j++) {
    const t = j / 14;
    const x = Math.cos(angle + Math.sin(t * 6 + i) * 0.1) * (0.4 + t * 1.0);
    const z = Math.sin(angle + Math.cos(t * 5 + i) * 0.08) * (0.4 + t * 1.0);
    const y = -0.65 - t * t * 0.5;
    pts.push(new THREE.Vector3(x, y, z));
  }
  const g = new THREE.BufferGeometry().setFromPoints(pts);
  const m = new THREE.LineBasicMaterial({
    color: CRACK_COL, transparent: true, opacity: 0.12 + Math.random() * 0.12,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const line = new THREE.Line(g, m);
  line.position.copy(sphere.position);
  scene.add(line);
}

// ======== Floating Fragments (sparse, elegant) ========
const FRAG_COUNT = 40;
const fragments = [];

function makeFragGeo() {
  const isBox = Math.random() > 0.3;
  const base = isBox
    ? new THREE.BoxGeometry(1, 1, 1)
    : new THREE.TetrahedronGeometry(1);
  const pos = base.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const p = 0.15 * (Math.random() - 0.5);
    pos.setXYZ(i, pos.getX(i) + p, pos.getY(i) + p, pos.getZ(i) + p);
  }
  pos.needsUpdate = true;
  base.computeVertexNormals();
  return base;
}

for (let i = 0; i < FRAG_COUNT; i++) {
  const geo = makeFragGeo();
  const scale = 0.015 + Math.random() * 0.08;
  const hasGlow = Math.random() > 0.7;

  const mat = new THREE.MeshStandardMaterial({
    color: 0x08080e, roughness: 0.8, metalness: 0.5,
    emissive: hasGlow ? CRACK_COL : 0x000000,
    emissiveIntensity: hasGlow ? 0.04 + Math.random() * 0.06 : 0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.scale.setScalar(scale);

  // Edge highlight
  const eGeo = new THREE.EdgesGeometry(geo);
  const eMat = new THREE.LineBasicMaterial({
    color: 0x333344, transparent: true, opacity: 0.15 + Math.random() * 0.15,
  });
  const eLine = new THREE.LineSegments(eGeo, eMat);
  mesh.add(eLine);

  // Radial position
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  const dist = 1.5 + Math.random() * 3.5;

  mesh.userData = {
    dir: new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta),
      Math.sin(phi) * Math.sin(theta) * 0.5 + 0.1,
      Math.cos(phi)
    ).normalize(),
    dist: dist,
    rotSpeed: new THREE.Vector3(
      (Math.random() - 0.5) * 0.008,
      (Math.random() - 0.5) * 0.008,
      (Math.random() - 0.5) * 0.008,
    ),
    phase: Math.random() * Math.PI * 2,
  };

  const p = mesh.userData.dir.clone().multiplyScalar(mesh.userData.dist);
  mesh.position.copy(p);
  mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);

  scene.add(mesh);
  fragments.push(mesh);
}

// ======== Subtle Glow Particles ========
const GLOW_N = 200;
const glowNPos = new Float32Array(GLOW_N * 3);
const glowNCols = new Float32Array(GLOW_N * 3);
const glowNLife = new Float32Array(GLOW_N);
const glowNVel = [];
const cPurple = new THREE.Color(CRACK_COL);

for (let i = 0; i < GLOW_N; i++) {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  const r = 1.2 + Math.random() * 2.5;
  glowNPos[i*3] = Math.sin(phi) * Math.cos(theta) * r;
  glowNPos[i*3+1] = Math.cos(phi) * r * 0.4;
  glowNPos[i*3+2] = Math.sin(phi) * Math.sin(theta) * r;
  cPurple.toArray(glowNCols, i*3);
  glowNLife[i] = Math.random();
  glowNVel.push(new THREE.Vector3(
    (Math.random() - 0.5) * 0.002,
    (Math.random() - 0.5) * 0.002,
    (Math.random() - 0.5) * 0.002,
  ));
}

const glowNGeo = new THREE.BufferGeometry();
glowNGeo.setAttribute('position', new THREE.BufferAttribute(glowNPos, 3));
glowNGeo.setAttribute('color', new THREE.BufferAttribute(glowNCols, 3));
const glowNMat = new THREE.PointsMaterial({
  size: 0.008, sizeAttenuation: true, transparent: true, opacity: 0.25,
  vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false,
});
const glowNPoints = new THREE.Points(glowNGeo, glowNMat);
scene.add(glowNPoints);

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
.to(state, { rot: Math.PI * 3, ease: 'none' }, 0);

// ======== Animation Loop ========
const clock = new THREE.Clock();

function tick() {
  const t = clock.getElapsedTime();

  tx += (mx - tx) * 0.04;
  ty += (my - ty) * 0.04;

  // Scroll rotation
  sphere.rotation.y += (state.rot - sphere.rotation.y) * 0.03;
  sphere.rotation.x = ty * 0.06;
  platformGroup.rotation.y = sphere.rotation.y;

  // Crack glow pulse (gentle)
  crackLines.forEach((c, i) => {
    const pulse = 0.7 + 0.3 * Math.sin(t * 0.4 + i * 0.5);
    c.line.material.opacity = c.baseOpacity * pulse;
  });

  // Glow points pulse
  glowPtMat.opacity = 0.6 + Math.sin(t * 0.3) * 0.15;

  // Fragment drift + rotation
  fragments.forEach((f) => {
    f.rotation.x += f.userData.rotSpeed.x;
    f.rotation.y += f.userData.rotSpeed.y;
    f.rotation.z += f.userData.rotSpeed.z;
    const p = f.userData.dir.clone().multiplyScalar(
      f.userData.dist + Math.sin(t * 0.06 + f.userData.phase) * 0.03
    );
    f.position.lerp(p, 0.015);
  });

  // Glow particles drift
  const gp = glowNGeo.attributes.position.array;
  for (let i = 0; i < GLOW_N; i++) {
    gp[i*3] += glowNVel[i].x;
    gp[i*3+1] += glowNVel[i].y;
    gp[i*3+2] += glowNVel[i].z;
  }
  glowNGeo.attributes.position.needsUpdate = true;

  // Star drift
  stars.rotation.y = t * 0.004;
  stars.rotation.x = Math.sin(t * 0.002) * 0.01;

  composer.render();
  requestAnimationFrame(tick);
}
tick();

// ======== Exports ========
export function updateScrollProgress(p) {}

export function setTrigger(v) {
  const i = 0.08 + v * 0.2;
  sphereMat.emissive = new THREE.Color(CRACK_COL).multiplyScalar(i * 0.3);
  sphereMat.emissiveIntensity = i * 0.2;
  bloom.strength = 0.6 + v * 0.3;
}
