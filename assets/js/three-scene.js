import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

let scene, camera, renderer;
let mainGroup, core, coreWire, lineField, particles;
let tubes = [], tubeMats = [], junctions = [], junctionMats = [];
let navNodes = [], navHitboxes = [], navSprites = [];
let mouseX = 0, mouseY = 0;
let scrollBoost = 0, springVel = 0, extraRot = 0;
let state = { scale: 1, posX: 0, posY: 0, posZ: 0 };
let animTrigger = 0, time = 0;
let clickPulse = 0, clickRipple = 0, pulseNode = -1;
let coreShaderRef = null;

const NAV_DATA = [
  { en: 'PORTFOLIO', cn: '作品集', pos: [2.6, 1.8, 0.0], color: '#00d4ff', zone: 'top-right' },
  { en: 'BLOG', cn: '博客', pos: [2.8, 0.4, -0.2], color: '#c4956a', zone: 'center-right' },
  { en: 'LOG', cn: '日志', pos: [2.5, -1.3, 0.3], color: '#b388ff', zone: 'bottom-right' },
  { en: 'ABOUT', cn: '关于', pos: [-2.2, -1.5, 0.6], color: '#eeeef0', zone: 'bottom-left' },
];

const METABALL_VERT = `
uniform float uTime;
uniform float uFusion;
uniform float uPulse;
uniform vec3 uAttractor;

varying vec3 vNormal;
varying vec3 vViewDir;
varying float vFresnel;

void main() {
  vec3 pos = position;
  vec3 toAttract = uAttractor - pos;
  float d = length(toAttract);
  float blend = uFusion * 0.25 / (d * 0.4 + 0.15);
  pos += normalize(toAttract) * blend;

  float w = sin(pos.x*3.2 + uTime*0.6)*0.006 + cos(pos.y*3.8 + uTime*0.5)*0.006;
  pos += normal * w;
  pos += normal * uPulse * 0.06;

  vec4 wp = modelMatrix * vec4(pos, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vec3 vd = normalize(cameraPosition - wp.xyz);
  vViewDir = vd;
  vFresnel = 1.0 - abs(dot(vNormal, vd));
  vFresnel = pow(vFresnel, 2.5);

  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const METABALL_FRAG = `
uniform vec3 uColor;
uniform float uGlowIntensity;
uniform float uPulse;

varying vec3 vNormal;
varying vec3 vViewDir;
varying float vFresnel;

void main() {
  float rim = vFresnel;
  vec3 glow = uColor * (0.2 + rim * 0.8);
  float core = 1.0 - rim;
  vec3 base = uColor * (0.3 + core * 0.4);

  float pulseGlow = uPulse * (0.6 + 0.4 * sin(rim * 12.0));
  float alpha = 0.65 + rim * 0.35 + uPulse * 0.25;

  vec3 fc = base + glow * uGlowIntensity + pulseGlow * uColor;
  gl_FragColor = vec4(fc, alpha);
}
`;

function makeMetaballMat(color, glowIntensity) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uFusion: { value: 1.0 },
      uPulse: { value: 0 },
      uGlowIntensity: { value: glowIntensity || 0.5 },
      uAttractor: { value: new THREE.Vector3(0, 0, 0) },
      uColor: { value: new THREE.Color(color) },
    },
    vertexShader: METABALL_VERT,
    fragmentShader: METABALL_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide,
  });
}

function init() {
  const canvas = document.getElementById('three-canvas');
  if (!canvas) return;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0.2, 6.8);

  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x18082a);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envMap = pmrem.fromScene(envScene).texture;
  pmrem.dispose();

  scene.add(new THREE.AmbientLight(0x334455, 0.5));
  const k = new THREE.DirectionalLight(0xffeedd, 3.0); k.position.set(4, 6, 8); scene.add(k);
  const f = new THREE.DirectionalLight(0x9977bb, 1.2); f.position.set(-5, 3, 5); scene.add(f);
  const r = new THREE.DirectionalLight(0xbb88ff, 0.7); r.position.set(0, -5, -7); scene.add(r);

  mainGroup = new THREE.Group();
  scene.add(mainGroup);

  // ---- Faceted amethyst core ----
  const cGeo = new THREE.IcosahedronGeometry(0.85, 2);
  const cMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0.55, 0.28, 0.78),
    metalness: 0.0, roughness: 0.04,
    clearcoat: 0.5, clearcoatRoughness: 0.05,
    envMap, envMapIntensity: 1.8,
    emissive: new THREE.Color(0.32, 0.10, 0.58),
    emissiveIntensity: 0.10,
    flatShading: true, side: THREE.DoubleSide,
  });
  cMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = { value: 0 };
    sh.uniforms.uMorph = { value: 0 };
    sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>',
      `#include <begin_vertex>
      float w = sin(position.x*2.7+uTime*0.35)*0.008
              + cos(position.y*3.3+uTime*0.3)*0.008
              + sin(position.z*2.9+uTime*0.4)*0.008;
      transformed += normal * w * (1.0+uMorph*0.6);`
    );
    coreShaderRef = sh;
  };
  core = new THREE.Mesh(cGeo, cMat);
  mainGroup.add(core);

  coreWire = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.87, 2),
    new THREE.MeshBasicMaterial({ color: 0x8866cc, wireframe: true, transparent: true, opacity: 0.03 })
  );
  mainGroup.add(coreWire);

  // ---- Extract core vertices ----
  const pa = cGeo.getAttribute('position');
  const verts = [];
  const seen = new Set();
  for (let i = 0; i < pa.count; i++) {
    const k = `${pa.array[i*3].toFixed(2)},${pa.array[i*3+1].toFixed(2)},${pa.array[i*3+2].toFixed(2)}`;
    if (!seen.has(k)) {
      seen.add(k);
      verts.push(new THREE.Vector3(pa.array[i*3], pa.array[i*3+1], pa.array[i*3+2]).normalize().multiplyScalar(0.85));
    }
  }

  // ---- Tube filaments ----
  const tubeCount = 70;
  const configs = [
    { color: '#9966dd', transparent: true, transmission: 0.35, clearcoat: 0.3, rough: 0.02, label: 'glass' },
    { color: '#d4a847', metalness: 0.92, rough: 0.12, label: 'gold' },
    { color: '#c8c8d0', metalness: 0.95, rough: 0.08, label: 'silver' },
    { color: '#b080ee', transparent: true, transmission: 0.25, clearcoat: 0.4, rough: 0.03, label: 'glass2' },
    { color: '#e8c56a', metalness: 0.88, rough: 0.15, label: 'gold2' },
  ];

  for (let i = 0; i < tubeCount; i++) {
    const vi = Math.floor(Math.random() * verts.length);
    const sv = verts[vi].clone();
    const dir = sv.clone().normalize();
    const len = 1.0 + Math.random() * 2.2;
    const end = sv.clone().add(dir.multiplyScalar(len));
    const midOff = new THREE.Vector3(
      (Math.random() - 0.5) * 2.0,
      (Math.random() - 0.5) * 2.0,
      (Math.random() - 0.5) * 2.0
    );
    const mid = new THREE.Vector3().addVectors(sv, end).multiplyScalar(0.5).add(midOff);

    const curve = new THREE.CatmullRomCurve3([sv, mid, end]);
    const tGeo = new THREE.TubeGeometry(curve, 16, 0.018 + Math.random() * 0.015, 5, false);

    const cfg = configs[i % configs.length];
    const c = new THREE.Color(cfg.color);
    const tMat = new THREE.MeshPhysicalMaterial({
      color: c,
      metalness: cfg.metalness || 0.0,
      roughness: cfg.rough || 0.05,
      transparent: cfg.transparent || false,
      transmission: cfg.transmission || 0,
      thickness: 1.5,
      clearcoat: cfg.clearcoat || 0,
      clearcoatRoughness: 0.1,
      envMap, envMapIntensity: 1.2,
      emissive: c.clone().multiplyScalar(0.2),
      emissiveIntensity: 0.06,
      side: THREE.DoubleSide,
      depthWrite: !cfg.transparent,
    });
    const mesh = new THREE.Mesh(tGeo, tMat);
    mesh.userData.baseEnd = end.clone();
    mesh.userData.tubeIdx = i;
    mainGroup.add(mesh);
    tubes.push(mesh);
    tubeMats.push(tMat);

    // Junction blob at filament end (metaball fusion)
    const jMat = makeMetaballMat(cfg.color, 0.6);
    const jGeo = new THREE.SphereGeometry(0.055 + Math.random() * 0.03, 10, 8);
    const jBlob = new THREE.Mesh(jGeo, jMat);
    jBlob.position.copy(end);
    jBlob.userData.attractor = new THREE.Vector3(0, 0, 0);
    jBlob.userData.tubeIdx = i;
    mainGroup.add(jBlob);
    junctions.push(jBlob);
    junctionMats.push(jMat);

    // Small fusion bridge toward a random nearby junction
    if (i > 1 && i % 3 === 0) {
      const targetJ = junctions[Math.floor(Math.random() * junctions.length)];
      const bridgeStart = end.clone();
      const bridgeEnd = targetJ.position.clone();
      const bMid = new THREE.Vector3().addVectors(bridgeStart, bridgeEnd).multiplyScalar(0.5);
      bMid.x += (Math.random() - 0.5) * 0.3;
      bMid.y += (Math.random() - 0.5) * 0.3;
      const bCurve = new THREE.CatmullRomCurve3([bridgeStart, bMid, bridgeEnd]);
      const bGeo = new THREE.TubeGeometry(bCurve, 8, 0.008, 4, false);
      const bMat = new THREE.MeshPhysicalMaterial({
        color: cfg.label === 'glass' ? 0x9966dd : 0xccaa77,
        metalness: 0.3, roughness: 0.1,
        transparent: true, opacity: 0.25,
        emissive: cfg.label === 'glass' ? 0x6633aa : 0x886633,
        emissiveIntensity: 0.04,
        side: THREE.DoubleSide, depthWrite: false,
      });
      const bridge = new THREE.Mesh(bGeo, bMat);
      mainGroup.add(bridge);
    }
  }

  // ---- Dense line field ----
  const lc = 600;
  const lp = new Float32Array(lc * 3);
  for (let i = 0; i < lc; i++) {
    const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
    const r = 0.9 + Math.random() * 2.8;
    lp[i*3] = r * Math.sin(ph) * Math.cos(th);
    lp[i*3+1] = r * Math.cos(ph);
    lp[i*3+2] = r * Math.sin(ph) * Math.sin(th);
  }
  const lGeo = new THREE.BufferGeometry();
  lGeo.setAttribute('position', new THREE.BufferAttribute(lp, 3));
  const lMat = new THREE.PointsMaterial({
    size: 0.005, color: 0x8855cc, transparent: true, opacity: 0.08,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  });
  lineField = new THREE.Points(lGeo, lMat);
  mainGroup.add(lineField);

  // ---- Navigation nodes ----
  const navGroup = new THREE.Group();
  mainGroup.add(navGroup);

  NAV_DATA.forEach((nd, i) => {
    const p = new THREE.Vector3(nd.pos[0], nd.pos[1], nd.pos[2]);

    const sphereMat = makeMetaballMat(nd.color, 0.8);
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), sphereMat);
    sphere.position.copy(p);
    sphere.userData.navIdx = i;
    sphere.userData.isNav = true;
    navGroup.add(sphere);
    navNodes.push(sphere);
    junctionMats.push(sphereMat);

    // Glow aura
    const aura = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 12, 8),
      new THREE.MeshBasicMaterial({ color: nd.color, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending })
    );
    aura.position.copy(p);
    navGroup.add(aura);
    sphere.userData.aura = aura;

    // Thicker fusion connectors from nav node to nearby filaments
    for (let j = 0; j < 3 && j < junctions.length; j++) {
      const jIdx = Math.floor(Math.random() * junctions.length);
      const jPos = junctions[jIdx].position.clone();
      const d = p.distanceTo(jPos);
      if (d > 0.3 && d < 2.0) {
        const bMid = new THREE.Vector3().addVectors(p, jPos).multiplyScalar(0.5);
        bMid.x += (Math.random() - 0.5) * 0.2;
        const bCurve = new THREE.CatmullRomCurve3([p, bMid, jPos]);
        const bGeo = new THREE.TubeGeometry(bCurve, 8, 0.006, 4, false);
        const bMat = new THREE.MeshPhysicalMaterial({
          color: nd.color, transparent: true, opacity: 0.08,
          emissive: nd.color, emissiveIntensity: 0.03,
          blending: THREE.AdditiveBlending, depthWrite: false,
        });
        navGroup.add(new THREE.Mesh(bGeo, bMat));
      }
    }

    // Text sprite
    const cv = document.createElement('canvas');
    cv.width = 360; cv.height = 120;
    const ctx = cv.getContext('2d');
    ctx.shadowColor = nd.color; ctx.shadowBlur = 30;
    ctx.font = '700 30px Inter,-apple-system,sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = nd.color; ctx.fillText(nd.en, 180, 42);
    ctx.font = '400 20px Inter,-apple-system,sans-serif'; ctx.shadowBlur = 15;
    ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.fillText(nd.cn, 180, 80);
    const tex = new THREE.CanvasTexture(cv); tex.needsUpdate = true;
    const sMat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const sprite = new THREE.Sprite(sMat);
    sprite.position.copy(p);
    sprite.position.x += nd.pos[0] > 0 ? 0.6 : -0.6;
    sprite.scale.set(1.6, 0.5, 1);
    navGroup.add(sprite);
    navSprites.push(sprite);

    // HTML click hitbox
    const hit = document.createElement('div');
    hit.style.cssText = 'position:fixed;width:90px;height:90px;border-radius:50%;cursor:pointer;z-index:10;background:transparent;';
    hit.dataset.navIdx = i;
    hit.addEventListener('click', () => onNavClick(i));
    document.body.appendChild(hit);
    navHitboxes.push(hit);
  });

  // ---- Ambient particles ----
  const pc = 150;
  const pp = new Float32Array(pc * 3);
  for (let i = 0; i < pc; i++) {
    const r = 1.8 + Math.random() * 4, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
    pp[i*3] = r * Math.sin(ph) * Math.cos(th);
    pp[i*3+1] = r * Math.cos(ph);
    pp[i*3+2] = r * Math.sin(ph) * Math.sin(th);
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  particles = new THREE.Mesh(pGeo, new THREE.PointsMaterial({
    size: 0.006, color: 0x7744bb, transparent: true, opacity: 0.04,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  }));
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
}

function onMouseMove(e) {
  mouseX = (e.clientX / window.innerWidth) * 2 - 1;
  mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
}

let prevScrollY = 0;
function onScroll() {
  const sy = window.scrollY;
  const delta = Math.abs(sy - prevScrollY);
  if (delta > 2) scrollBoost = Math.min(scrollBoost + delta * 3, 50);
  prevScrollY = sy;
}

function onNavClick(idx) {
  pulseNode = idx;
  clickPulse = 1.0;
  clickRipple = 1.0;
}

function animate() {
  requestAnimationFrame(animate);
  time += 0.006;
  scrollBoost *= 0.82;

  // ---- Spring-damper elastic rotation ----
  const targetRot = Math.min(scrollBoost * 0.03, 1.2);
  const diff = targetRot - extraRot;
  springVel += diff * 0.01;
  springVel *= 0.78;
  extraRot += springVel;

  // ---- State lerp ----
  const s = state.scale, px = state.posX, py = state.posY, pz = state.posZ;
  mainGroup.scale.setScalar(1 + (s - 1) * 0.03);
  mainGroup.position.x += (px - mainGroup.position.x) * 0.03;
  mainGroup.position.y += (py - mainGroup.position.y) * 0.03;
  mainGroup.position.z += (pz - mainGroup.position.z) * 0.03;

  // ---- Fixed camera (subtle drift only) ----
  camera.position.x += (mouseX * 0.04 - camera.position.x) * 0.01;
  camera.position.y += (mouseY * 0.03 - camera.position.y) * 0.01;
  camera.lookAt(mainGroup.position.x, mainGroup.position.y, 0);
  camera.position.z = 6.8 + pz * 0.2;

  // ---- Idle rotation + elastic spring rotation ----
  const idle = 0.0012;
  mainGroup.rotation.x += idle * 0.25 + extraRot * 0.25;
  mainGroup.rotation.y += idle + extraRot * 0.35;
  mainGroup.rotation.z += idle * 0.08 + extraRot * 0.12;

  // ---- Core morphing ----
  if (coreShaderRef) {
    coreShaderRef.uniforms.uTime.value = time;
    coreShaderRef.uniforms.uMorph.value = animTrigger * 0.5 + clickPulse * 0.2;
  }
  coreWire.rotation.copy(core.rotation);
  coreWire.material.opacity = 0.03 + extraRot * 0.025 + animTrigger * 0.02;

  // ---- Junction metaball uniforms ----
  const jTime = time * 1.2;
  const fStrength = 0.8 + extraRot * 0.2 + animTrigger * 0.2;
  junctionMats.forEach((jm, i) => {
    if (jm.uniforms) {
      jm.uniforms.uTime.value = jTime + i * 0.1;
      jm.uniforms.uFusion.value = fStrength;
      jm.uniforms.uPulse.value = 0;
    }
  });

  // ---- Tube animations ----
  const rippleDecay = clickRipple;
  tubeMats.forEach((tm, i) => {
    if (tm.emissiveIntensity !== undefined) {
      const wave = 0.04 * Math.sin(time * 0.6 + i * 0.5);
      const ripple = rippleDecay * 0.08 * Math.max(0, Math.sin(time * 3.0 - i * 0.3));
      tm.emissiveIntensity = 0.04 + wave + ripple;
    }
  });

  // ---- Nav node click pulse ----
  navNodes.forEach((n, i) => {
    const p = i === pulseNode ? clickPulse : 0;
    if (n.material.uniforms) {
      n.material.uniforms.uPulse.value = p;
      n.material.uniforms.uGlowIntensity.value = 0.6 + 0.3 * Math.sin(time * 0.8 + i * 1.3) + p * 0.8;
    }
    n.position.y += Math.sin(time * 0.6 + i * 1.8) * 0.0006;
    if (n.userData.aura) {
      n.userData.aura.material.opacity = 0.06 + 0.04 * Math.sin(time * 0.5 + i * 1.3) + p * 0.2;
      n.userData.aura.scale.setScalar(1 + p * 0.4);
    }
  });

  if (clickPulse > 0) clickPulse *= 0.96;
  if (clickRipple > 0) clickRipple *= 0.98;
  if (clickPulse < 0.01) { clickPulse = 0; pulseNode = -1; }

  // ---- Line field ----
  lineField.rotation.y += 0.00015;
  lineField.material.opacity = 0.06 + extraRot * 0.03 + animTrigger * 0.03;

  // ---- Particles ----
  if (particles) {
    const pa = particles.geometry.attributes.position;
    const arr = pa.array;
    for (let i = 0; i < 150; i++) {
      const idx = i * 3;
      arr[idx] += (Math.random() - 0.5) * 0.0015;
      arr[idx+1] += (Math.random() - 0.5) * 0.0015;
      arr[idx+2] += (Math.random() - 0.5) * 0.0015;
      for (let a = 0; a < 3; a++) {
        if (Math.abs(arr[idx+a]) > 5) arr[idx+a] *= 0.98;
      }
    }
    pa.needsUpdate = true;
  }

  // ---- Update HTML hitboxes ----
  navNodes.forEach((n, i) => {
    const v = new THREE.Vector3();
    n.getWorldPosition(v);
    v.project(camera);
    if (v.z < 1) {
      const x = (v.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
      const h = navHitboxes[i];
      if (h) { h.style.left = `${x - 45}px`; h.style.top = `${y - 45}px`; h.style.display = 'block'; }
    } else {
      navHitboxes[i].style.display = 'none';
    }
  });

  renderer.render(scene, camera);
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
