import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { EffectComposer } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/UnrealBloomPass.js';

let scene, camera, renderer, composer, bloomPass;
let mainGroup, tubeMeshes = [], junctionRings = [];
let navNodes = [], navSprites = [], navHitboxes = [];
let mouseX = 0, mouseY = 0;
let scrollBoost = 0, springVel = 0, springPos = 0;
let state = { scale: 1, posX: 0, posY: 0, posZ: 0 };
let animTrigger = 0, time = 0;
let clickPulse = 0, clickRipple = 0, pulseNode = -1;
let coreShaderRef = null;

const NAV_DATA = [
  { en: 'PORTFOLIO', cn: '作品集', pos: [-1.6, 1.0, 0.2], color: '#00e5ff', glow: '#00e5ff' },
  { en: 'BLOG', cn: '博客', pos: [1.8, 1.8, -0.3], color: '#ff8833', glow: '#ffaa55' },
  { en: 'LOG', cn: '日志', pos: [2.0, -1.4, 0.4], color: '#cc66ff', glow: '#bb' },
  { en: 'ABOUT', cn: '关于', pos: [-1.8, -1.6, 0.6], color: '#ffffff', glow: '#ffffff' },
];

function init() {
  const canvas = document.getElementById('three-canvas');
  if (!canvas) return;

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0.1, 6.8);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  // ---- Post-processing: UnrealBloomPass ----
  const renderPass = new RenderPass(scene, camera);
  bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.6,  // strength
    0.3,  // radius
    0.85  // threshold
  );
  composer = new EffectComposer(renderer);
  composer.addPass(renderPass);
  composer.addPass(bloomPass);

  // ---- Environment ----
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x100420);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envMap = pmrem.fromScene(envScene).texture;
  pmrem.dispose();

  // ---- Lights ----
  scene.add(new THREE.AmbientLight(0x334455, 0.4));
  const key = new THREE.DirectionalLight(0xffeedd, 2.8); key.position.set(4, 6, 8); scene.add(key);
  const fill = new THREE.DirectionalLight(0x9977bb, 1.0); fill.position.set(-5, 3, 5); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xbb88ff, 0.6); rim.position.set(0, -5, -7); scene.add(rim);

  mainGroup = new THREE.Group();
  scene.add(mainGroup);

  // ---- Premium tube material (amethyst glass) ----
  const tubeMat = new THREE.MeshPhysicalMaterial({
    color: 0x7B2CBF,
    transparent: true,
    transmission: 0.96,
    opacity: 1.0,
    roughness: 0.02,
    metalness: 0.05,
    ior: 1.55,
    thickness: 3.0,
    clearcoat: 0.3,
    clearcoatRoughness: 0.04,
    envMap, envMapIntensity: 1.5,
    emissive: 0x330066,
    emissiveIntensity: 0.04,
    side: THREE.DoubleSide,
  });

  // ---- Metal ring material (champagne gold) ----
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0xE0A96D,
    metalness: 1.0,
    roughness: 0.1,
    envMap, envMapIntensity: 1.2,
  });

  // ---- Build closed interlocking tube network ----
  const curves = [
    // Loop 1: Upper wrap
    [[-1.8, 1.2, 0.2], [-1.2, 1.8, 0.5], [0.2, 2.2, 0.8], [1.5, 2.0, 0.6], [2.0, 1.0, 0.0], [1.2, 0.2, -0.3], [0.0, -0.6, 0.0], [-1.0, -0.2, 0.3], [-1.8, 1.2, 0.2]],
    // Loop 2: Lower wrap
    [[-1.8, -1.2, 0.6], [-1.2, -1.8, 0.3], [0.2, -2.2, 0.0], [1.5, -2.0, -0.2], [2.0, -1.0, 0.1], [1.2, -0.2, 0.2], [0.0, 0.6, -0.1], [-1.0, 0.2, 0.5], [-1.8, -1.2, 0.6]],
    // Loop 3: Front-back spiral
    [[-1.2, 1.8, 0.5], [-0.6, 2.0, 1.5], [0.8, 1.5, 2.0], [1.8, 0.5, 1.8], [2.0, -0.5, 1.0], [1.5, -1.5, 0.2], [0.5, -2.0, -0.8], [-0.8, -1.8, -1.2], [-1.5, -1.0, -1.5], [-1.2, 1.8, 0.5]],
    // Loop 4: Tight core wrap
    [[-0.8, 0.8, 0.6], [-0.4, 1.2, 1.0], [0.4, 1.2, 1.0], [0.8, 0.8, 0.6], [0.8, 0.0, 0.8], [0.4, -0.8, 1.0], [-0.4, -0.8, 1.0], [-0.8, 0.0, 0.8], [-0.8, 0.8, 0.6]],
  ];

  const tubeRadius = 0.035;
  tubeMeshes = [];
  junctionRings = [];

  curves.forEach((pts, ci) => {
    const v3 = pts.map(p => new THREE.Vector3(...p));
    const curve = new THREE.CatmullRomCurve3(v3);
    curve.closed = true;

    // High segment tube
    const geo = new THREE.TubeGeometry(curve, 240, tubeRadius, 24, true);
    const mesh = new THREE.Mesh(geo, tubeMat);
    mesh.userData.curveIdx = ci;
    mainGroup.add(mesh);
    tubeMeshes.push(mesh);

    // Junction rings at each original vertex
    v3.forEach((v, vi) => {
      if (vi % 2 === 0) { // Every other point gets a ring
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(tubeRadius * 1.6, tubeRadius * 0.35, 16, 32),
          ringMat
        );
        ring.position.copy(v);
        // Orient ring to curve tangent
        const t = vi / (v3.length - 1);
        const tangent = curve.getTangentAt(t);
        ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
        mainGroup.add(ring);
        junctionRings.push(ring);
      }
    });
  });

  // ---- Navigation nodes (emissive spheres for bloom) ----
  NAV_DATA.forEach((nd, i) => {
    const p = new THREE.Vector3(...nd.pos);

    // Emissive sphere - will glow via UnrealBloomPass
    const geo = new THREE.SphereGeometry(0.13, 32, 24);
    const mat = new THREE.MeshPhysicalMaterial({
      color: nd.color,
      emissive: nd.color,
      emissiveIntensity: 3.0,
      metalness: 0.0,
      roughness: 0.05,
      transparent: true,
      opacity: 0.85,
      transmission: 0.2,
      clearcoat: 0.5,
      clearcoatRoughness: 0.05,
      envMap, envMapIntensity: 1.0,
      side: THREE.DoubleSide,
    });
    const sphere = new THREE.Mesh(geo, mat);
    sphere.position.copy(p);
    sphere.userData.navIdx = i;
    sphere.userData.baseEmissive = nd.color;
    mainGroup.add(sphere);
    navNodes.push(sphere);

    // Text sprite
    const cv = document.createElement('canvas');
    cv.width = 380; cv.height = 110;
    const ctx = cv.getContext('2d');
    ctx.shadowColor = nd.color; ctx.shadowBlur = 30;
    ctx.font = '700 32px Inter,-apple-system,sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = nd.color; ctx.fillText(nd.en, 190, 44);
    ctx.font = '400 22px Inter,-apple-system,sans-serif'; ctx.shadowBlur = 15;
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillText(nd.cn, 190, 82);
    const tex = new THREE.CanvasTexture(cv); tex.needsUpdate = true;
    const sMat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const sprite = new THREE.Sprite(sMat);
    sprite.position.copy(p);
    sprite.position.x += nd.pos[0] > 0 ? 0.65 : -0.65;
    sprite.scale.set(1.7, 0.5, 1);
    mainGroup.add(sprite);
    navSprites.push(sprite);

    // HTML hitbox
    const hit = document.createElement('div');
    hit.style.cssText = 'position:fixed;width:100px;height:100px;border-radius:50%;cursor:pointer;z-index:10;background:transparent;';
    hit.dataset.navIdx = i;
    hit.addEventListener('click', () => onNavClick(i));
    document.body.appendChild(hit);
    navHitboxes.push(hit);
  });

  // ---- Core crystal (faceted) ----
  const coreGeo = new THREE.IcosahedronGeometry(0.35, 1);
  const coreMat = new THREE.MeshPhysicalMaterial({
    color: 0x440088,
    metalness: 0.0, roughness: 0.03,
    transmission: 0.8, thickness: 2.0,
    clearcoat: 0.6, clearcoatRoughness: 0.03,
    envMap, envMapIntensity: 2.0,
    emissive: 0x330066, emissiveIntensity: 0.15,
    flatShading: true, side: THREE.DoubleSide,
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  coreMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = { value: 0 };
    sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>',
      `#include <begin_vertex>
      float w = sin(position.x*2.5+uTime*0.3)*0.006
              + cos(position.y*3.0+uTime*0.25)*0.006
              + sin(position.z*2.7+uTime*0.35)*0.006;
      transformed += normal * w;`
    );
    coreShaderRef = sh;
  });
  mainGroup.add(core);

  // ---- Ambient particles ----
  const pc = 100;
  const pp = new Float32Array(pc*3);
  for (let i = 0; i < pc; i++) {
    const r = 2.2+Math.random()*2.5, th = Math.random()*Math.PI*2, ph = Math.acos(2*Math.random()-1);
    pp[i*3] = r*Math.sin(ph)*Math.cos(th); pp[i*3+1] = r*Math.cos(ph); pp[i*3+2] = r*Math.sin(ph)*Math.sin(th);
  }
  const particles = new THREE.Points(
    new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pp, 3)),
    new THREE.PointsMaterial({ size: 0.004, color: 0x6622aa, transparent: true, opacity: 0.03,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true })
  );
  mainGroup.add(particles);

  animate();
  window.addEventListener('resize', onResize);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('scroll', onScroll, { passive: true });
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
}

function onMouseMove(e) {
  mouseX = (e.clientX / window.innerWidth) * 2 - 1;
  mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
}

let prevScrollY = 0;
function onScroll() {
  const sy = window.scrollY;
  const d = Math.abs(sy - prevScrollY);
  if (d > 2) scrollBoost = Math.min(scrollBoost + d * 3.5, 60);
  prevScrollY = sy;
}

function onNavClick(idx) {
  pulseNode = idx;
  clickPulse = 1.0;
}

function animate() {
  requestAnimationFrame(animate);
  time += 0.005;
  scrollBoost *= 0.83;

  // ---- Spring physics for scroll rotation ----
  const target = Math.min(scrollBoost * 0.03, 1.8);
  const diff = target - springPos;
  springVel += diff * 0.008;
  springVel *= 0.78;
  springPos += springVel;

  // ---- State lerp ----
  const s = state.scale, px = state.posX, py = state.posY, pz = state.posZ;
  mainGroup.scale.setScalar(1 + (s - 1) * 0.03);
  mainGroup.position.x += (px - mainGroup.position.x) * 0.03;
  mainGroup.position.y += (py - mainGroup.position.y) * 0.03;
  mainGroup.position.z += (pz - mainGroup.position.z) * 0.03;

  // ---- Fixed camera (z=6.8 fixed, subtle drift) ----
  camera.position.x += (mouseX * 0.03 - camera.position.x) * 0.01;
  camera.position.y += (mouseY * 0.02 - camera.position.y) * 0.01;
  camera.lookAt(mainGroup.position.x, mainGroup.position.y, 0);
  camera.position.z = 6.8;

  // ---- Idle rotation + spring rotation ----
  const idle = 0.0015;
  mainGroup.rotation.y += idle + springPos * 0.35;
  mainGroup.rotation.x += idle * 0.2 + springPos * 0.15;
  mainGroup.rotation.z += springPos * 0.08;

  // ---- Core morphing ----
  if (coreShaderRef) coreShaderRef.uniforms.uTime.value = time;

  // ---- Tube emissive ripple (click) ----
  const ripple = clickRipple;
  tubeMeshes.forEach((m, i) => {
    if (m.material.emissiveIntensity !== undefined) {
      const wave = 0.02 * Math.sin(time * 0.7 + i * 0.6);
      const rp = ripple * 0.05 * Math.max(0, Math.sin(time * 4.0 - i * 0.4));
      m.material.emissiveIntensity = 0.02 + wave + rp;
    }
  });

  // ---- Nav node click pulse ----
  navNodes.forEach((n, i) => {
    const p = i === pulseNode ? clickPulse : 0;
    n.material.emissiveIntensity = 2.0 + 1.5 * Math.sin(time * 0.8 + i * 1.2) + p * 5.0;
    n.scale.setScalar(1 + p * 0.35);
  });

  if (clickPulse > 0) clickPulse *= 0.95;
  if (clickRipple > 0) clickRipple *= 0.97;
  if (clickPulse < 0.01) { clickPulse = 0; pulseNode = -1; }

  // ---- Update HTML hitboxes ----
  navNodes.forEach((n, i) => {
    const v = new THREE.Vector3();
    n.getWorldPosition(v);
    v.project(camera);
    if (v.z < 1) {
      const x = (v.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
      const h = navHitboxes[i];
      if (h) { h.style.left = `${x - 50}px`; h.style.top = `${y - 50}px`; h.style.display = 'block'; }
    } else {
      navHitboxes[i].style.display = 'none';
    }
  });

  composer.render();
}

export function updateScrollProgress(p) {
  state.scale = 1 - p * 0.3;
  state.posX = p * 1.8;
  state.posY = -p * 0.8;
  state.posZ = -p * 0.4;
}

export function setTrigger(v) {
  animTrigger = v;
}

init();