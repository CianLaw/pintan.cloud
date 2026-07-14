import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

gsap.registerPlugin(ScrollTrigger);
console.log('[three-scene] Initializing cracked glass sphere scene...');

const canvas = document.querySelector('#three-canvas');
const scene = new THREE.Scene();

const W = window.innerWidth, H = window.innerHeight;
const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 100);
camera.position.set(0, 0.3, 8);
camera.lookAt(0, 0.1, 0);

const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
renderer.setSize(W, H);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.5;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.8, 0.3, 0.15);
composer.addPass(bloom);

// ======== Star Field ========
const STAR_N = 6000;
const sPos = new Float32Array(STAR_N * 3);
const sSiz = new Float32Array(STAR_N);
for (let i = 0; i < STAR_N; i++) {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  const r = 15 + Math.random() * 25;
  sPos[i*3] = Math.sin(phi) * Math.cos(theta) * r;
  sPos[i*3+1] = Math.sin(phi) * Math.sin(theta) * r;
  sPos[i*3+2] = Math.cos(phi) * r;
  sSiz[i] = 0.5 + Math.random() * 1.5;
}
const sGeo = new THREE.BufferGeometry();
sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
sGeo.setAttribute('size', new THREE.BufferAttribute(sSiz, 1));
const sMat = new THREE.PointsMaterial({
  size: 0.06, sizeAttenuation: true, transparent: true,
  opacity: 0.6, color: 0xffffff, blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const stars = new THREE.Points(sGeo, sMat);
scene.add(stars);

// ======== Cracked Glass Sphere ========
const SPHERE_R = 1;
const sphereGeo = new THREE.SphereGeometry(SPHERE_R, 72, 72);
const sphereMat = new THREE.MeshPhysicalMaterial({
  color: 0x1a3a5c, roughness: 0.08, metalness: 0.0,
  transmission: 0.55, thickness: 0.6, ior: 1.5,
  clearcoat: 0.8, clearcoatRoughness: 0.1,
  transparent: true, opacity: 0.65, side: THREE.DoubleSide,
  envMapIntensity: 0.4,
});
const sphere = new THREE.Mesh(sphereGeo, sphereMat);
sphere.position.y = 0.3;
scene.add(sphere);

// ======== Crack Path Generator ========
function genCrack(radius, seed, steps = 35, branch = false) {
  const pts = [];
  const theta0 = seed * 2.399963 + Math.random() * 0.5;
  const phi0 = 0.05 + Math.random() * 0.25;
  let theta = theta0, phi = phi0;
  for (let i = 0; i < steps; i++) {
    const n1 = Math.sin(i * 0.7 + seed * 13) * 0.06;
    const n2 = Math.cos(i * 0.4 + seed * 11) * 0.045;
    const jitter = (Math.random() - 0.5) * 0.07;
    phi += 0.05 + n1 + jitter * 0.5;
    theta += n2 + (Math.random() - 0.5) * 0.08;
    if (branch && i > 5) theta += Math.sin(i * 0.3) * 0.03;
    phi = Math.max(0.02, Math.min(Math.PI - 0.02, phi));
    const x = radius * Math.cos(theta) * Math.sin(phi);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(theta) * Math.sin(phi);
    pts.push(new THREE.Vector3(x, y, z));
  }
  return pts;
}

// ======== Crack Glow Lines on Sphere ========
const CRACK_COL = 0xff44aa;
const crackLines = [];
const numCracks = 20;
for (let i = 0; i < numCracks; i++) {
  const pts = genCrack(SPHERE_R * 1.005, i, 30 + Math.floor(Math.random() * 20));
  const curve = new THREE.CatmullRomCurve3(pts);
  const curvePts = curve.getPoints(40);
  const g = new THREE.BufferGeometry().setFromPoints(curvePts);
  const m = new THREE.LineBasicMaterial({
    color: CRACK_COL, transparent: true, opacity: 0.3 + Math.random() * 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const line = new THREE.Line(g, m);
  line.position.copy(sphere.position);
  scene.add(line);
  crackLines.push({ line, baseOpacity: m.opacity, pts });

  // Glow tube for wider cracks
  if (i % 2 === 0) {
    const tubeGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.008, 4, false);
    const tubeMat = new THREE.MeshBasicMaterial({
      color: CRACK_COL, transparent: true, opacity: 0.15,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const tube = new THREE.Mesh(tubeGeo, tubeMat);
    tube.position.copy(sphere.position);
    scene.add(tube);
  }

  // Branch cracks
  if (i % 3 === 0) {
    const branchPts = genCrack(SPHERE_R * 1.005, i + 50, 15, true);
    const bCurve = new THREE.CatmullRomCurve3(branchPts);
    const bPts = bCurve.getPoints(20);
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

// Crack sparkle points along lines
const sparklePos = [];
for (let i = 0; i < crackLines.length; i++) {
  const pts = crackLines[i].pts;
  for (let j = 0; j < pts.length; j += 2) {
    const off = (Math.random() - 0.5) * 0.04;
    sparklePos.push(
      pts[j].x + off, pts[j].y + off, pts[j].z + off
    );
  }
}
const spkGeo = new THREE.BufferGeometry();
spkGeo.setAttribute('position', new THREE.Float32BufferAttribute(sparklePos, 3));
const spkMat = new THREE.PointsMaterial({
  size: 0.012, color: CRACK_COL, transparent: true, opacity: 0.9,
  blending: THREE.AdditiveBlending, depthWrite: false,
});
const sparkles = new THREE.Points(spkGeo, spkMat);
sparkles.position.copy(sphere.position);
scene.add(sparkles);

// ======== Crack Opening at Top ========
// Dark jagged shards simulating broken opening
function createShard() {
  const g = new THREE.BufferGeometry();
  const v = [];
  for (let i = 0; i < 5; i++) {
    const theta = Math.random() * Math.PI * 2;
    const r = 0.08 + Math.random() * 0.15;
    v.push(r * Math.cos(theta), Math.random() * 0.1 - 0.05, r * Math.sin(theta));
  }
  v.push(0, -0.1, 0);
  const idx = [];
  for (let i = 0; i < 4; i++) idx.push(5, i, i+1);
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.MeshStandardMaterial({
    color: 0x050510, roughness: 0.9, metalness: 0.3,
    emissive: CRACK_COL, emissiveIntensity: 0.08,
    side: THREE.DoubleSide,
  });
  return new THREE.Mesh(g, m);
}

const shards = [];
for (let i = 0; i < 12; i++) {
  const sh = createShard();
  const angle = (i / 12) * Math.PI * 2;
  const rad = 0.85 + Math.random() * 0.15;
  sh.position.set(
    Math.cos(angle) * rad,
    1.25 + Math.random() * 0.08,
    Math.sin(angle) * rad
  );
  sh.rotation.set(Math.random() * 0.3, Math.random() * Math.PI, Math.random() * 0.3);
  sh.scale.setScalar(0.8 + Math.random() * 0.6);
  sphere.add(sh);
  shards.push(sh);
}

// ======== Platform ========
const platformGroup = new THREE.Group();
const blockMat = new THREE.MeshStandardMaterial({
  color: 0x0a0a12, roughness: 0.7, metalness: 0.8,
});
const BLOCK_COUNT = 18;
const platformBlocks = [];
for (let i = 0; i < BLOCK_COUNT; i++) {
  const w = 0.2 + Math.random() * 0.5;
  const h = 0.08 + Math.random() * 0.2;
  const d = 0.2 + Math.random() * 0.5;
  const g = new THREE.BoxGeometry(w, h, d);
  const b = new THREE.Mesh(g, blockMat);
  const stepsDown = Math.floor(Math.random() * 6);
  const ly = -0.7 - stepsDown * (0.1 + Math.random() * 0.08);
  const lx = (Math.random() - 0.5) * 1.8;
  const lz = (Math.random() - 0.5) * 1.8;
  if (Math.abs(lx) < 0.3 && Math.abs(lz) < 0.3) continue;
  b.position.set(lx, ly, lz);
  b.rotation.set(
    (Math.random() - 0.5) * 0.08,
    Math.random() * 0.2,
    (Math.random() - 0.5) * 0.08,
  );
  platformGroup.add(b);
  platformBlocks.push(b);
}
platformGroup.position.y = sphere.position.y;
scene.add(platformGroup);

// Platform crack glow lines (from sphere bottom onto blocks)
for (let i = 0; i < 6; i++) {
  const angle = (i / 6) * Math.PI * 2 + Math.random() * 0.3;
  const pts = [];
  for (let j = 0; j < 20; j++) {
    const t = j / 19;
    const x = Math.cos(angle + Math.sin(t * 8 + i) * 0.15) * (0.5 + t * 1.2);
    const z = Math.sin(angle + Math.cos(t * 6 + i) * 0.12) * (0.5 + t * 1.2);
    const y = -0.7 - t * t * 0.6;
    pts.push(new THREE.Vector3(x, y, z));
  }
  const g = new THREE.BufferGeometry().setFromPoints(pts);
  const m = new THREE.LineBasicMaterial({
    color: CRACK_COL, transparent: true, opacity: 0.15 + Math.random() * 0.2,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const line = new THREE.Line(g, m);
  line.position.copy(sphere.position);
  scene.add(line);
}

// ======== Fragments (Radial Explosion) ========
const FRAG_COUNT = 120;
const fragments = [];

function makeFragmentGeo() {
  const isTetra = Math.random() > 0.4;
  const base = isTetra ? new THREE.TetrahedronGeometry(1) : new THREE.OctahedronGeometry(1);
  const pos = base.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const p = 0.3 * (Math.random() - 0.5);
    pos.setXYZ(i, pos.getX(i) + p, pos.getY(i) + p, pos.getZ(i) + p);
  }
  pos.needsUpdate = true;
  base.computeVertexNormals();
  return base;
}

for (let i = 0; i < FRAG_COUNT; i++) {
  const geo = makeFragmentGeo();
  const scale = 0.02 + Math.random() * 0.18;
  const hasGlow = Math.random() > 0.6;

  const mat = new THREE.MeshStandardMaterial({
    color: 0x08080e, roughness: 0.7, metalness: 0.5,
    emissive: hasGlow ? CRACK_COL : 0x000000,
    emissiveIntensity: hasGlow ? 0.06 + Math.random() * 0.12 : 0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.scale.setScalar(scale);

  // Edge highlight
  const eGeo = new THREE.EdgesGeometry(geo);
  const eMat = new THREE.LineBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.1 + Math.random() * 0.25,
  });
  const eLine = new THREE.LineSegments(eGeo, eMat);
  mesh.add(eLine);

  // Radial position
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  const dist = 1.2 + Math.random() * 4.5;
  const spread = 0.15 * (1 + dist * 0.1);

  mesh.userData = {
    dir: new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta),
      Math.sin(phi) * Math.sin(theta) * 0.6 + 0.15,
      Math.cos(phi)
    ).normalize(),
    dist: dist,
    rotSpeed: new THREE.Vector3(
      (Math.random() - 0.5) * 0.02,
      (Math.random() - 0.5) * 0.02,
      (Math.random() - 0.5) * 0.02,
    ),
    phase: Math.random() * Math.PI * 2,
  };

  const p = mesh.userData.dir.clone().multiplyScalar(mesh.userData.dist);
  mesh.position.copy(p);
  mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);

  scene.add(mesh);
  fragments.push(mesh);
}

// ======== Spray Particles from Top ========
const SPRAY_N = 800;
const sprayPos = new Float32Array(SPRAY_N * 3);
const sprayVel = [];
const sprayCol = new Float32Array(SPRAY_N * 3);
const sprayLife = new Float32Array(SPRAY_N);
const cPurple = new THREE.Color(CRACK_COL);
const cWhite = new THREE.Color(0xffffff);

for (let i = 0; i < SPRAY_N; i++) {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.random() * Math.PI * 0.3;
  const r = 0.02 + Math.random() * 0.05;
  sprayPos[i*3] = Math.cos(theta) * Math.sin(phi) * r;
  sprayPos[i*3+1] = 1.3 + Math.random() * 0.1;
  sprayPos[i*3+2] = Math.sin(theta) * Math.sin(phi) * r;
  sprayVel.push(new THREE.Vector3(
    (Math.random() - 0.5) * 0.008,
    0.005 + Math.random() * 0.015,
    (Math.random() - 0.5) * 0.008,
  ));
  cPurple.clone().lerp(cWhite, Math.random() * 0.4).toArray(sprayCol, i*3);
  sprayLife[i] = Math.random();
}

const sprayGeo = new THREE.BufferGeometry();
sprayGeo.setAttribute('position', new THREE.BufferAttribute(sprayPos, 3));
sprayGeo.setAttribute('color', new THREE.BufferAttribute(sprayCol, 3));
const sprayMat = new THREE.PointsMaterial({
  size: 0.012, sizeAttenuation: true, transparent: true, opacity: 0.8,
  vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false,
});
const sprayPts = new THREE.Points(sprayGeo, sprayMat);
sprayPts.position.copy(sphere.position);
scene.add(sprayPts);

// ======== Glow Particle Trails ========
const TRAIL_N = 400;
const tPos = new Float32Array(TRAIL_N * 3);
const tCol = new Float32Array(TRAIL_N * 3);
const tLife = new Float32Array(TRAIL_N);
const tVel = [];

for (let i = 0; i < TRAIL_N; i++) {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  const r = 1.5 + Math.random() * 3;
  tPos[i*3] = Math.sin(phi) * Math.cos(theta) * r;
  tPos[i*3+1] = Math.cos(phi) * r * 0.5;
  tPos[i*3+2] = Math.sin(phi) * Math.sin(theta) * r;
  cPurple.clone().toArray(tCol, i*3);
  tLife[i] = Math.random();
  tVel.push(new THREE.Vector3(
    (Math.random() - 0.5) * 0.003,
    (Math.random() - 0.5) * 0.003,
    (Math.random() - 0.5) * 0.003,
  ));
}

const tGeo = new THREE.BufferGeometry();
tGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3));
tGeo.setAttribute('color', new THREE.BufferAttribute(tCol, 3));
const tMat = new THREE.PointsMaterial({
  size: 0.008, sizeAttenuation: true, transparent: true, opacity: 0.3,
  vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false,
});
const trailPts = new THREE.Points(tGeo, tMat);
scene.add(trailPts);

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
.to(state, { rot: Math.PI * 4, ease: 'none' }, 0);

// ======== Animation Loop ========
const clock = new THREE.Clock();

function tick() {
  const t = clock.getElapsedTime();

  // Mouse
  tx += (mx - tx) * 0.04;
  ty += (my - ty) * 0.04;

  // Scroll rotation (applied to a parent group for the whole scene)
  sphere.rotation.y += (state.rot - sphere.rotation.y) * 0.03;
  sphere.rotation.x = ty * 0.08;
  platformGroup.rotation.y = sphere.rotation.y;

  // Crack glow pulse
  crackLines.forEach((c, i) => {
    const pulse = 0.6 + 0.4 * Math.sin(t * 0.5 + i * 0.7);
    c.line.material.opacity = c.baseOpacity * pulse;
  });

  // Spray particles
  const sp = sprayGeo.attributes.position.array;
  const sc = sprayGeo.attributes.color.array;
  for (let i = 0; i < SPRAY_N; i++) {
    sprayLife[i] -= 0.003;
    if (sprayLife[i] <= 0) {
      sprayLife[i] = 1;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.3;
      const r = 0.02 + Math.random() * 0.05;
      sp[i*3] = Math.cos(theta) * Math.sin(phi) * r;
      sp[i*3+1] = 1.3 + Math.random() * 0.1;
      sp[i*3+2] = Math.sin(theta) * Math.sin(phi) * r;
      sprayVel[i].set(
        (Math.random() - 0.5) * 0.008,
        0.005 + Math.random() * 0.02,
        (Math.random() - 0.5) * 0.008,
      );
    } else {
      sp[i*3] += sprayVel[i].x + Math.sin(t + i) * 0.001;
      sp[i*3+1] += sprayVel[i].y;
      sp[i*3+2] += sprayVel[i].z + Math.cos(t + i) * 0.001;
      // Opacity fade
      sc[i*3+1] = 0.4 * sprayLife[i];
    }
  }
  sprayGeo.attributes.position.needsUpdate = true;
  sprayGeo.attributes.color.needsUpdate = true;

  // Trail particles
  const tp = tGeo.attributes.position.array;
  for (let i = 0; i < TRAIL_N; i++) {
    tLife[i] -= 0.002;
    if (tLife[i] <= 0) {
      tLife[i] = 1;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 1.3 + Math.random() * 0.5;
      tp[i*3] = Math.sin(phi) * Math.cos(theta) * r;
      tp[i*3+1] = Math.cos(phi) * r * 0.5 + 0.3;
      tp[i*3+2] = Math.sin(phi) * Math.sin(theta) * r;
      tVel[i].set(
        (Math.random() - 0.5) * 0.004,
        (Math.random() - 0.5) * 0.004,
        (Math.random() - 0.5) * 0.004,
      );
    } else {
      tp[i*3] += tVel[i].x;
      tp[i*3+1] += tVel[i].y;
      tp[i*3+2] += tVel[i].z;
    }
  }
  tGeo.attributes.position.needsUpdate = true;

  // Fragment slow drift + rotation
  fragments.forEach((f) => {
    f.rotation.x += f.userData.rotSpeed.x;
    f.rotation.y += f.userData.rotSpeed.y;
    f.rotation.z += f.userData.rotSpeed.z;
    const drift = 0.0002;
    const p = f.userData.dir.clone().multiplyScalar(
      f.userData.dist + Math.sin(t * 0.1 + f.userData.phase) * 0.05
    );
    f.position.lerp(p, 0.02);
  });

  // Star slow drift
  stars.rotation.y = t * 0.006;
  stars.rotation.x = Math.sin(t * 0.003) * 0.02;

  // Render via composer for bloom
  composer.render();
  requestAnimationFrame(tick);
}
tick();

// ======== Exports ========
export function updateScrollProgress(p) {}

export function setTrigger(v) {
  const i = 0.12 + v * 0.3;
  sphereMat.emissive = new THREE.Color(CRACK_COL).multiplyScalar(i * 0.5);
  sphereMat.emissiveIntensity = i * 0.3;
  bloom.strength = 0.8 + v * 0.4;
}
