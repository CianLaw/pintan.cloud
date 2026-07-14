import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { EffectComposer } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/UnrealBloomPass.js';

let scene, camera, renderer, composer;
let particles, particleSystem;
let pos, sizes, colors, origPos;
let mouse = new THREE.Vector3(999, 999, 999);
let mouseOnScreen = new THREE.Vector2(999, 999);
let mouseWorld = new THREE.Vector3();
let raycaster, planeIntersect;
let scrollPos = 0, idleRot = 0;
let time = 0;
let navCards = [];
let lineMeshes = [];
let state = { scale: 1, posX: 0, posY: 0, posZ: 0 };
let animTrigger = 0;

const PARTICLE_COUNT = 3500;

function init() {
  const canvas = document.getElementById('three-canvas');
  if (!canvas) return;

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0.5, 7);

  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.8;

  const rp = new RenderPass(scene, camera);
  const bp = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.4, 0.2, 0.5);
  composer = new EffectComposer(renderer);
  composer.addPass(rp);
  composer.addPass(bp);

  scene.add(new THREE.AmbientLight(0x223344, 0.3));

  // ---- Particle system ----
  const posArr = new Float32Array(PARTICLE_COUNT * 3);
  const colArr = new Float32Array(PARTICLE_COUNT * 3);
  const sizArr = new Float32Array(PARTICLE_COUNT);
  origPos = new Float32Array(PARTICLE_COUNT * 3);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const t = Math.random() * Math.PI * 2;
    const p = Math.acos(2 * Math.random() - 1);
    const r = (0.8 + Math.random() * 0.4) + Math.random() * 2.0;
    const noise = 1 + 0.3 * Math.sin(t * 3) * Math.cos(p * 2);
    const rr = r * noise;
    const x = rr * Math.sin(p) * Math.cos(t);
    const y = rr * Math.cos(p);
    const z = rr * Math.sin(p) * Math.sin(t);
    posArr[i*3] = x; posArr[i*3+1] = y; posArr[i*3+2] = z;
    origPos[i*3] = x; origPos[i*3+1] = y; origPos[i*3+2] = z;

    const isCyan = Math.random() < 0.2;
    colArr[i*3] = isCyan ? 0.0 : 0.48;
    colArr[i*3+1] = isCyan ? 0.96 : 0.17;
    colArr[i*3+2] = isCyan ? 1.0 : 0.75;

    sizArr[i] = 0.008 + Math.random() * 0.025;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(sizArr, 1));

  const mat = new THREE.PointsMaterial({
    size: 0.025, sizeAttenuation: true, transparent: true, opacity: 0.7,
    blending: THREE.AdditiveBlending, depthWrite: false,
    vertexColors: true,
  });
  particleSystem = new THREE.Points(geo, mat);
  particleSystem.position.set(0.5, 0, 0);
  scene.add(particleSystem);

  pos = geo.attributes.position.array;

  raycaster = new THREE.Raycaster();
  planeIntersect = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

  // ---- Nav cards (glassmorphism HTML) ----
  const navData = [
    { en: 'PORTFOLIO', cn: '作品集', pos: [-2.0, 1.4, 0.5], color: '#00e5ff' },
    { en: 'BLOG', cn: '博客', pos: [2.2, 1.6, -0.2], color: '#ff8833' },
    { en: 'LOG', cn: '日志', pos: [2.0, -1.4, 0.4], color: '#cc66ff' },
    { en: 'ABOUT', cn: '关于', pos: [-2.2, -1.6, 0.6], color: '#ffffff' },
  ];

  navData.forEach((nd, i) => {
    const el = document.createElement('div');
    el.className = 'nav-card';
    el.innerHTML = `<span class="nav-card-en">${nd.en}</span><span class="nav-card-cn">${nd.cn}</span>`;
    el.style.cssText = `
      position:fixed; padding:10px 18px; border-radius:999px;
      background: rgba(255,255,255,0.06); backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255,255,255,0.08);
      box-shadow: 0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.1);
      pointer-events: auto; cursor: pointer; z-index: 10;
      display: flex; flex-direction: column; align-items: center; gap: 1px;
      transition: transform 0.3s cubic-bezier(0.25,1,0.5,1), border-color 0.3s;
      font-family: Inter,-apple-system,sans-serif; min-width: 110px;
    `;
    el.addEventListener('mouseenter', () => { el.style.borderColor = nd.color; });
    el.addEventListener('mouseleave', () => { el.style.borderColor = 'rgba(255,255,255,0.08)'; });
    document.body.appendChild(el);

    const enSpan = el.querySelector('.nav-card-en');
    const cnSpan = el.querySelector('.nav-card-cn');
    enSpan.style.cssText = `font-size:12px;font-weight:700;letter-spacing:0.05em;color:${nd.color};text-shadow:0 0 20px ${nd.color}`;
    cnSpan.style.cssText = 'font-size:10px;color:rgba(255,255,255,0.5);letter-spacing:0.05em;';

    navCards.push({ el, pos: new THREE.Vector3(...nd.pos), color: nd.color, idx: i });

    // Hairline beam from nav card to center
    const beamCnt = 60;
    const bPos = new Float32Array(beamCnt * 3);
    const p3 = new THREE.Vector3(...nd.pos);
    for (let j = 0; j < beamCnt; j++) {
      const t = j / (beamCnt - 1);
      const cp = new THREE.Vector3(0, 0, 0).lerp(p3, t);
      cp.x += (Math.random() - 0.5) * 0.04;
      cp.y += (Math.random() - 0.5) * 0.04;
      bPos[j*3] = cp.x; bPos[j*3+1] = cp.y; bPos[j*3+2] = cp.z;
    }
    const bGeo = new THREE.BufferGeometry();
    bGeo.setAttribute('position', new THREE.BufferAttribute(bPos, 3));
    const bMat = new THREE.LineBasicMaterial({
      color: nd.color, transparent: true, opacity: 0.15,
      blending: THREE.AdditiveBlending,
    });
    const beam = new THREE.Line(bGeo, bMat);
    scene.add(beam);
    lineMeshes.push(beam);
  });

  animate();

  document.addEventListener('mousemove', onMouseMove);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);

  // Init card positions
  updateCardPositions();
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
}

function onMouseMove(e) {
  mouseOnScreen.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouseOnScreen.y = -(e.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouseOnScreen, camera);
  const pt = new THREE.Vector3();
  raycaster.ray.intersectSphere(new THREE.Sphere(new THREE.Vector3(particleSystem.position.x, particleSystem.position.y, particleSystem.position.z), 4), pt);
  if (pt) { mouse.copy(pt); } else { mouse.set(999, 999, 999); }
}

let prevScrollY = 0, scrollVel = 0;
function onScroll() {
  const sy = window.scrollY;
  scrollVel = Math.abs(sy - prevScrollY);
  if (scrollVel > 2) scrollPos = Math.min(scrollPos + scrollVel * 0.002, Math.PI);
  prevScrollY = sy;
}

function updateCardPositions() {
  navCards.forEach((nd) => {
    const v = nd.pos.clone();
    particleSystem.updateMatrixWorld();
    v.applyMatrix4(particleSystem.matrixWorld);
    v.project(camera);
    if (v.z < 1) {
      const x = (v.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
      nd.el.style.left = `${x}px`;
      nd.el.style.top = `${y}px`;
      nd.el.style.opacity = '1';
    } else {
      nd.el.style.opacity = '0';
    }
  });
}

function animate() {
  requestAnimationFrame(animate);
  time += 0.005;

  // ---- Idle rotation ----
  idleRot += 0.002;
  scrollPos *= 0.85;

  // ---- Scroll rotation ----
  const targetRot = scrollPos;
  const smoothRot = scrollPos;

  // ---- Particle wave animation ----
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3;
    const ox = origPos[i3], oy = origPos[i3+1], oz = origPos[i3+2];
    const wave = 0.02 * Math.sin(ox * 2 + time * 0.6) * Math.cos(oz * 1.5 + time * 0.5);
    const wave2 = 0.015 * Math.sin(oy * 3 + time * 0.8);

    // Mouse repulsion
    const dx = (ox + particleSystem.position.x) - mouse.x;
    const dy = (oy + particleSystem.position.y) - mouse.y;
    const dz = (oz + particleSystem.position.z) - mouse.z;
    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
    let repX = 0, repY = 0, repZ = 0;
    if (dist < 1.5 && dist > 0.01) {
      const force = (1.5 - dist) / 1.5 * 0.15;
      repX = dx / dist * force;
      repY = dy / dist * force;
      repZ = dz / dist * force;
    }

    // Spring-back toward original position
    const springX = (ox - (pos[i3] - repX)) * 0.04;
    const springY = (oy - (pos[i3+1] - repY)) * 0.04;
    const springZ = (oz - (pos[i3+2] - repZ)) * 0.04;

    pos[i3] += (ox - pos[i3]) * 0.02 + repX * 0.5 + springX + wave;
    pos[i3+1] += (oy - pos[i3+1]) * 0.02 + repY * 0.5 + springY + wave2;
    pos[i3+2] += (oz - pos[i3+2]) * 0.02 + repZ * 0.5 + springZ;
  }
  particleSystem.geometry.attributes.position.needsUpdate = true;

  // ---- Rotation ----
  particleSystem.rotation.y = idleRot + smoothRot;
  particleSystem.rotation.x = Math.sin(idleRot * 0.3) * 0.05;

  // ---- State lerp ----
  const s = state.scale, px = state.posX, py = state.posY, pz = state.posZ;
  particleSystem.scale.setScalar(1 + (s - 1) * 0.03);
  particleSystem.position.x += (px * 0.8 - particleSystem.position.x) * 0.03;
  particleSystem.position.y += (py * 0.5 - particleSystem.position.y) * 0.03;
  particleSystem.position.z += (pz * 0.3 - particleSystem.position.z) * 0.03;

  // ---- Camera subtile drift ----
  camera.position.x += (mouseOnScreen.x * 0.04 - camera.position.x) * 0.01;
  camera.position.y += (mouseOnScreen.y * 0.03 - camera.position.y) * 0.01;
  camera.lookAt(particleSystem.position.x, particleSystem.position.y, 0);

  // ---- Beam animations ----
  lineMeshes.forEach((beam, i) => {
    const bp = beam.geometry.attributes.position.array;
    const target = navCards[i].pos;
    for (let j = 0; j < bp.length / 3; j++) {
      const t = j / (bp.length / 3 - 1);
      const targetX = target.x * t;
      const targetY = target.y * t;
      const targetZ = target.z * t;
      bp[j*3] += (targetX - bp[j*3]) * 0.01;
      bp[j*3+1] += (targetY - bp[j*3+1]) * 0.01;
      bp[j*3+2] += (targetZ - bp[j*3+2]) * 0.01;
    }
    beam.geometry.attributes.position.needsUpdate = true;
    beam.material.opacity = 0.15 + 0.1 * Math.sin(time + i);
  });

  updateCardPositions();
  composer.render();
}

export function updateScrollProgress(p) {
  state.scale = 1 - p * 0.3;
  state.posX = p * 1.5;
  state.posY = -p * 0.6;
  state.posZ = -p * 0.3;
}

export function setTrigger(v) {
  animTrigger = v;
}

init();