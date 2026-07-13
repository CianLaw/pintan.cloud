import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

let scene, camera, renderer;
let mainGroup, core, coreWire, particles, lineField;
let tubes = [], tubeMats = [];
let navNodes = [], navHitboxes = [];
let mouseX = 0, mouseY = 0;
let scrollBoost = 0, springVel = 0, extraRot = 0;
let state = { scale: 1, posX: 0, posY: 0, posZ: 0 };
let animTrigger = 0, time = 0;
let clickPulse = 0, pulseNode = -1;
let raycaster, pointer;

const NAV_DATA = [
  { en: 'PORTFOLIO', cn: '作品集', pos: [2.4, 1.6, 0.3], color: '#00d4ff', zone: 'top-right' },
  { en: 'BLOG', cn: '博客', pos: [2.6, 0.3, 0.0], color: '#c4956a', zone: 'center-right' },
  { en: 'LOG', cn: '日志', pos: [2.3, -1.2, 0.5], color: '#b388ff', zone: 'bottom-right' },
  { en: 'ABOUT', cn: '关于', pos: [-2.0, -1.4, 0.8], color: '#eeeef0', zone: 'bottom-left' },
];

function init() {
  const canvas = document.getElementById('three-canvas');
  if (!canvas) return;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0.3, 7);

  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.8;

  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x1a0a2a);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envMap = pmrem.fromScene(envScene).texture;
  pmrem.dispose();

  scene.add(new THREE.AmbientLight(0x445566, 0.4));
  const key = new THREE.DirectionalLight(0xffeedd, 2.8);
  key.position.set(4, 6, 7);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x9977cc, 1.0);
  fill.position.set(-4, 3, 4);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xcc88ff, 0.6);
  rim.position.set(0, -5, -6);
  scene.add(rim);

  mainGroup = new THREE.Group();
  scene.add(mainGroup);

  // ---- Core: faceted amethyst crystal ----
  const coreGeo = new THREE.IcosahedronGeometry(0.9, 2);
  const coreMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0.55, 0.30, 0.75),
    metalness: 0.0,
    roughness: 0.05,
    clearcoat: 0.4,
    clearcoatRoughness: 0.05,
    envMap, envMapIntensity: 1.5,
    emissive: new THREE.Color(0.30, 0.10, 0.55),
    emissiveIntensity: 0.12,
    flatShading: true,
    side: THREE.DoubleSide,
  });
  coreMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = { value: 0 };
    sh.uniforms.uMorph = { value: 0 };
    sh.vertexShader = sh.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      float n = sin(position.x*2.3+uTime*0.4)*0.006
             + cos(position.y*3.1+uTime*0.35)*0.006
             + sin(position.z*2.7+uTime*0.3)*0.006;
      transformed += normal * n * (1.0+uMorph*0.5);`
    );
  };
  core = new THREE.Mesh(coreGeo, coreMat);
  mainGroup.add(core);

  // ---- Wireframe overlay for faceted look ----
  const wireGeo = new THREE.IcosahedronGeometry(0.91, 2);
  const wireMat = new THREE.MeshBasicMaterial({
    color: 0x8866cc, wireframe: true, transparent: true, opacity: 0.04,
  });
  coreWire = new THREE.Mesh(wireGeo, wireMat);
  mainGroup.add(coreWire);

  // ---- Extract core vertices for filament origins ----
  const posAttr = coreGeo.getAttribute('position');
  const verts = [];
  const visited = new Set();
  for (let i = 0; i < posAttr.count; i++) {
    const idx = i * 3;
    const key = `${posAttr.array[idx].toFixed(2)},${posAttr.array[idx+1].toFixed(2)},${posAttr.array[idx+2].toFixed(2)}`;
    if (!visited.has(key)) {
      visited.add(key);
      verts.push(new THREE.Vector3(posAttr.array[idx], posAttr.array[idx+1], posAttr.array[idx+2]).normalize().multiplyScalar(0.9));
    }
  }

  // ---- Filaments: curved glass/metal tubes from core ----
  function makeTube(start, end, midOffset, matCfg) {
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    mid.x += midOffset[0]; mid.y += midOffset[1]; mid.z += midOffset[2];
    const curve = new THREE.CatmullRomCurve3([start, mid, end]);
    const geo = new THREE.TubeGeometry(curve, 20, 0.012, 4, false);
    const c = new THREE.Color(matCfg.color);
    const mat = new THREE.MeshPhysicalMaterial({
      color: c,
      metalness: matCfg.metalness || 0.0,
      roughness: matCfg.roughness || 0.05,
      transparent: matCfg.transparent || false,
      transmission: matCfg.transmission || 0,
      thickness: 1.0,
      clearcoat: matCfg.clearcoat || 0,
      clearcoatRoughness: 0.1,
      envMap, envMapIntensity: 1.0,
      emissive: c.clone().multiplyScalar(0.15),
      emissiveIntensity: 0.08,
      side: THREE.DoubleSide,
      depthWrite: !matCfg.transparent,
    });
    const mesh = new THREE.Mesh(geo, mat);
    tubeMats.push(mat);
    return mesh;
  }

  // Pick a subset of vertices for tube origins
  const tubeCount = 60;
  const selected = [];
  for (let i = 0; i < tubeCount; i++) {
    const vi = Math.floor(Math.random() * verts.length);
    selected.push(verts[vi]);
  }

  const metalConfigs = [
    { color: '#d4a847', metalness: 0.9, roughness: 0.15 },
    { color: '#c0c0c0', metalness: 0.95, roughness: 0.1 },
    { color: '#e8c56a', metalness: 0.85, roughness: 0.2 },
  ];
  const glassConfig = { color: '#9966dd', transparent: true, transmission: 0.4, clearcoat: 0.3, roughness: 0.02 };

  selected.forEach((sv, i) => {
    const dir = sv.clone().normalize();
    const len = 1.2 + Math.random() * 1.8;
    const end = sv.clone().add(dir.multiplyScalar(len));
    const spiral = [
      (Math.random() - 0.5) * 1.5,
      (Math.random() - 0.5) * 1.5,
      (Math.random() - 0.5) * 1.5,
    ];
    const isMetal = i % 3 !== 0;
    const cfg = isMetal
      ? metalConfigs[Math.floor(Math.random() * metalConfigs.length)]
      : glassConfig;
    const tube = makeTube(sv, end, spiral, cfg);
    tube.userData.originIdx = i;
    tube.userData.basePos = sv.clone();
    tubes.push(tube);
    mainGroup.add(tube);

    // Junction sphere at filament end (fusion effect)
    const jMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(cfg.color || '#9966dd'),
      metalness: isMetal ? 0.8 : 0.0,
      roughness: 0.05,
      transparent: isMetal ? false : true,
      transmission: isMetal ? 0 : 0.3,
      clearcoat: 0.3,
      envMap, envMapIntensity: 1.0,
      emissive: new THREE.Color(isMetal ? 0.3 : 0.25, isMetal ? 0.15 : 0.08, isMetal ? 0.05 : 0.40),
      emissiveIntensity: 0.1,
    });
    const jSphere = new THREE.Mesh(new THREE.SphereGeometry(0.04 + Math.random()*0.03, 8, 6), jMat);
    jSphere.position.copy(end);
    jSphere.userData.parentTube = tube;
    jSphere.userData.springOffset = Math.random() * 2;
    mainGroup.add(jSphere);
  });

  // ---- Dense line field for "thousands of filaments" look ----
  const lineCount = 800;
  const lPos = new Float32Array(lineCount * 3);
  const lCol = new Float32Array(lineCount * 3);
  for (let i = 0; i < lineCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 0.95 + Math.random() * 2.5;
    lPos[i*3] = r * Math.sin(phi) * Math.cos(theta);
    lPos[i*3+1] = r * Math.cos(phi);
    lPos[i*3+2] = r * Math.sin(phi) * Math.sin(theta);
    const t = Math.random();
    lCol[i*3] = 0.35 + t * 0.25;
    lCol[i*3+1] = 0.15 + t * 0.15;
    lCol[i*3+2] = 0.45 + t * 0.25;
  }
  const lGeo = new THREE.BufferGeometry();
  lGeo.setAttribute('position', new THREE.BufferAttribute(lPos, 3));
  lGeo.setAttribute('color', new THREE.BufferAttribute(lCol, 3));
  const lMat = new THREE.PointsMaterial({
    size: 0.006, vertexColors: true, transparent: true, opacity: 0.25,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  });
  lineField = new THREE.Points(lGeo, lMat);
  mainGroup.add(lineField);

  // ---- Navigation nodes (glowing spheres + sprites) ----
  const navGroup = new THREE.Group();
  mainGroup.add(navGroup);
  const sprites = [];

  NAV_DATA.forEach((nd, i) => {
    const p = new THREE.Vector3(nd.pos[0], nd.pos[1], nd.pos[2]);
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 16, 12),
      new THREE.MeshPhysicalMaterial({
        color: nd.color, emissive: nd.color, emissiveIntensity: 0.6,
        metalness: 0.1, roughness: 0.1, transparent: true, opacity: 0.9,
        envMap, envMapIntensity: 0.8,
      })
    );
    sphere.position.copy(p);
    sphere.userData.navIdx = i;
    navGroup.add(sphere);
    navNodes.push(sphere);

    // Glow aura
    const aura = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 12, 8),
      new THREE.MeshBasicMaterial({ color: nd.color, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending })
    );
    aura.position.copy(p);
    navGroup.add(aura);
    sphere.userData.aura = aura;

    // Text sprite
    const c = document.createElement('canvas');
    c.width = 320; c.height = 100;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 320, 100);
    ctx.font = '600 28px Inter, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = nd.color;
    ctx.shadowBlur = 20;
    ctx.fillStyle = nd.color;
    ctx.fillText(nd.en, 160, 38);
    ctx.font = '400 18px Inter, -apple-system, sans-serif';
    ctx.shadowBlur = 12;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(nd.cn, 160, 72);

    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.copy(p);
    sprite.position.x += nd.pos[0] > 0 ? 0.5 : -0.5;
    sprite.position.y += nd.pos[0] > 0 ? 0.0 : 0.0;
    sprite.scale.set(1.4, 0.44, 1);
    navGroup.add(sprite);
    sprites.push(sprite);

    // HTML click hitbox - invisible div over the sphere
    const hit = document.createElement('div');
    hit.style.cssText = 'position:fixed;width:80px;height:80px;border-radius:50%;cursor:pointer;z-index:10;background:transparent;';
    hit.dataset.navIdx = i;
    hit.addEventListener('click', () => onNavClick(i));
    document.body.appendChild(hit);
    navHitboxes.push(hit);
  });

  // ---- Ambient particles ----
  const pCount = 200;
  const pPos = new Float32Array(pCount * 3);
  for (let i = 0; i < pCount; i++) {
    const r = 1.5 + Math.random() * 4;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    pPos[i*3] = r * Math.sin(phi) * Math.cos(theta);
    pPos[i*3+1] = r * Math.cos(phi);
    pPos[i*3+2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const pMat = new THREE.PointsMaterial({
    size: 0.008, color: 0x8855cc, transparent: true, opacity: 0.08,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  });
  particles = new THREE.Points(pGeo, pMat);
  mainGroup.add(particles);

  // ---- Interaction ----
  raycaster = new THREE.Raycaster();
  pointer = new THREE.Vector2();

  animate();
  window.addEventListener('resize', onResize);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('scroll', onScroll, { passive: true });
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function onMouseMove(e) {
  mouseX = (e.clientX / window.innerWidth) * 2 - 1;
  mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
}

let prevScrollY = 0;
function onScroll() {
  const sy = window.scrollY;
  const delta = Math.abs(sy - prevScrollY);
  if (delta > 2) scrollBoost = Math.min(scrollBoost + delta * 3, 40);
  prevScrollY = sy;
}

function onNavClick(idx) {
  pulseNode = idx;
  clickPulse = 1;
}

function animate() {
  requestAnimationFrame(animate);
  time += 0.005;
  scrollBoost *= 0.85;

  // ---- Spring-damper for scroll elastic rotation ----
  const targetRot = Math.min(scrollBoost * 0.025, 0.8);
  const diff = targetRot - extraRot;
  springVel += diff * 0.008;
  springVel *= 0.82;
  extraRot += springVel;

  // ---- State lerp (scroll progress from GSAP) ----
  const s = state.scale, px = state.posX, py = state.posY, pz = state.posZ;
  mainGroup.scale.setScalar(1 + (s - 1)*0.03);
  mainGroup.position.x += (px - mainGroup.position.x)*0.03;
  mainGroup.position.y += (py - mainGroup.position.y)*0.03;
  mainGroup.position.z += (pz - mainGroup.position.z)*0.03;

  // ---- Idle rotation + spring rotation ----
  const idleRot = 0.0015;
  mainGroup.rotation.x += idleRot * 0.3 + extraRot * 0.2;
  mainGroup.rotation.y += idleRot + extraRot * 0.3 + mouseX * 0.0004;
  mainGroup.rotation.z += idleRot * 0.1 + extraRot * 0.1;

  // ---- Core morphing ----
  if (core.material.userData.shaderRef) {
    const s = core.material.userData.shaderRef;
    s.uniforms.uTime.value = time * 1.2;
    s.uniforms.uMorph.value = animTrigger * 0.5 + clickPulse * 0.3;
  }
  coreWire.rotation.copy(core.rotation);
  coreWire.material.opacity = 0.04 + extraRot * 0.02;

  // ---- Tube animations (subtle wave) ----
  tubeMats.forEach((m, i) => {
    if (m.transparent) {
      m.emissiveIntensity = 0.08 + 0.04 * Math.sin(time * 0.7 + i * 0.3) + clickPulse * 0.1;
    }
  });

  // ---- Nav node animations ----
  navNodes.forEach((n, i) => {
    const pulse = i === pulseNode ? clickPulse : 0;
    n.material.emissiveIntensity = 0.4 + 0.2 * Math.sin(time * 1.5 + i * 1.2) + pulse * 1.0;
    n.scale.setScalar(1 + pulse * 0.3);
    n.position.y += Math.sin(time * 0.8 + i * 1.5) * 0.001;
    if (n.userData.aura) {
      n.userData.aura.material.opacity = 0.08 + 0.06 * Math.sin(time * 0.6 + i * 1.2) + pulse * 0.2;
      n.userData.aura.scale.setScalar(1 + pulse * 0.5);
    }
  });

  // ---- Click pulse decay ----
  if (clickPulse > 0) {
    clickPulse *= 0.97;
    if (clickPulse < 0.01) { clickPulse = 0; pulseNode = -1; }
  }

  // ---- Line field subtle motion ----
  lineField.rotation.y += 0.0002;
  lineField.material.opacity = 0.15 + extraRot * 0.04 + animTrigger * 0.05;

  // ---- Particles ----
  if (particles) {
    const p = particles.geometry.attributes.position;
    const arr = p.array;
    for (let i = 0; i < 200; i++) {
      const idx = i * 3;
      arr[idx] += (Math.random() - 0.5) * 0.002 + clickPulse * (arr[idx]) * 0.002;
      arr[idx+1] += (Math.random() - 0.5) * 0.002 + clickPulse * (arr[idx+1]) * 0.002;
      arr[idx+2] += (Math.random() - 0.5) * 0.002;
      for (let a = 0; a < 3; a++) {
        if (Math.abs(arr[idx+a]) > 5) arr[idx+a] *= 0.99;
      }
    }
    p.needsUpdate = true;
    particles.material.opacity = 0.06 + animTrigger * 0.04 + extraRot * 0.008;
  }

  // ---- Update HTML hitbox positions ----
  navNodes.forEach((n, i) => {
    const v = new THREE.Vector3();
    n.getWorldPosition(v);
    v.project(camera);
    const x = (v.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
    const hit = navHitboxes[i];
    if (hit) {
      hit.style.left = `${x - 40}px`;
      hit.style.top = `${y - 40}px`;
      hit.style.display = v.z < 1 ? 'block' : 'none';
    }
  });

  // ---- Camera drift ----
  camera.position.x += (mouseX * 0.06 - camera.position.x) * 0.015;
  camera.position.y += (mouseY * 0.05 - camera.position.y) * 0.015;
  camera.lookAt(mainGroup.position.x, mainGroup.position.y, 0);

  renderer.render(scene, camera);
}

export function updateScrollProgress(p) {
  state.scale = 1 - p * 0.35;
  state.posX = p * 1.6;
  state.posY = -p * 0.7;
  state.posZ = -p * 0.4;
}

export function setTrigger(v) {
  animTrigger = v;
}

init();
