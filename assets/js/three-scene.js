import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

let scene, camera, renderer;
let mainGroup, core, coreWire;
let allJunctions = [], allJunctionMats = [], allNavNodes = [], navHitboxes = [];
let mouseX = 0, mouseY = 0;
let scrollBoost = 0, springVel = 0, extraRotX = 0, extraRotY = 0;
let state = { scale: 1, posX: 0, posY: 0, posZ: 0 };
let animTrigger = 0, time = 0;
let clickPulse = 0, clickRipple = 0, pulseNode = -1;
let coreShaderRef = null;

const NAV_DATA = [
  { en: 'PORTFOLIO', cn: '作品集', pos: [0.8, 2.0, 0.3], color: '#00d4ff', glow: '#00bbdd' },
  { en: 'BLOG', cn: '博客', pos: [2.4, 0.8, -0.1], color: '#c4956a', glow: '#d4a57a' },
  { en: 'LOG', cn: '日志', pos: [2.0, -1.4, 0.4], color: '#b388ff', glow: '#9977ee' },
  { en: 'ABOUT', cn: '关于', pos: [-1.6, -1.6, 0.6], color: '#eeeeF0', glow: '#ddddf0' },
];

const MB_VERT = `
uniform float uTime, uFusion, uPulse;
uniform vec3 uAttractor;
varying vec3 vN, vV;
varying float vF;
void main(){
  vec3 p = position;
  vec3 ta = uAttractor - p;
  float d = length(ta);
  float b = uFusion * 0.2 / (d*0.35+0.12);
  p += normalize(ta)*b;
  p += normal*(sin(p.x*3.0+uTime*0.5)*0.005+cos(p.y*3.5+uTime*0.4)*0.005);
  p += normal*uPulse*0.05;
  vec4 w = modelMatrix*vec4(p,1.0);
  vN = normalize(normalMatrix*normal);
  vV = normalize(cameraPosition-w.xyz);
  vF = pow(1.0-abs(dot(vN,vV)),2.5);
  gl_Position = projectionMatrix*viewMatrix*w;
}
`;

const MB_FRAG = `
uniform vec3 uColor;
uniform float uGlow, uPulse;
varying vec3 vN, vV;
varying float vF;
void main(){
  vec3 g = uColor*(0.25+vF*0.75);
  vec3 b = uColor*(0.3+(1.0-vF)*0.4);
  float pg = uPulse*(0.5+0.5*sin(vF*10.0));
  float a = 0.7+vF*0.3+uPulse*0.2;
  gl_FragColor = vec4(b+g*uGlow+pg*uColor, a);
}
`;

function mbMat(color, glow) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime:{value:0}, uFusion:{value:1}, uPulse:{value:0}, uGlow:{value:glow||0.5},
      uAttractor:{value:new THREE.Vector3(0,0,0)}, uColor:{value:new THREE.Color(color)} },
    vertexShader: MB_VERT, fragmentShader: MB_FRAG,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
}

function init() {
  const canvas = document.getElementById('three-canvas');
  if (!canvas) return;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(38, window.innerWidth/window.innerHeight, 0.1, 100);
  camera.position.set(0, 0.2, 6.5);

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
  const k = new THREE.DirectionalLight(0xffeedd, 3.0); k.position.set(4,6,8); scene.add(k);
  const f = new THREE.DirectionalLight(0x9977bb, 1.2); f.position.set(-5,3,5); scene.add(f);
  const r = new THREE.DirectionalLight(0xbb88ff, 0.7); r.position.set(0,-5,-7); scene.add(r);

  mainGroup = new THREE.Group();
  scene.add(mainGroup);

  // ---- Faceted amethyst core ----
  const coreGeo = new THREE.IcosahedronGeometry(0.85, 2);
  const coreMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0.55, 0.28, 0.78),
    metalness: 0.0, roughness: 0.04,
    clearcoat: 0.5, clearcoatRoughness: 0.05,
    envMap, envMapIntensity: 1.8,
    emissive: new THREE.Color(0.32, 0.10, 0.58),
    emissiveIntensity: 0.10,
    flatShading: true, side: THREE.DoubleSide,
  });
  coreMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = {value:0};
    sh.uniforms.uMorph = {value:0};
    sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>',
      `#include <begin_vertex>
      float w = sin(position.x*2.7+uTime*0.35)*0.008
              + cos(position.y*3.3+uTime*0.3)*0.008
              + sin(position.z*2.9+uTime*0.4)*0.008;
      transformed += normal * w * (1.0+uMorph*0.6);`
    );
    coreShaderRef = sh;
  };
  core = new THREE.Mesh(coreGeo, coreMat);
  mainGroup.add(core);

  coreWire = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.87, 2),
    new THREE.MeshBasicMaterial({ color: 0x8866cc, wireframe: true, transparent: true, opacity: 0.03 })
  );
  mainGroup.add(coreWire);

  // ---- Glass tube material ----
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x8855cc, metalness: 0.0, roughness: 0.02,
    transmission: 0.35, thickness: 2.0, transparent: true,
    clearcoat: 0.4, clearcoatRoughness: 0.05,
    envMap, envMapIntensity: 1.5,
    emissive: 0x4422aa, emissiveIntensity: 0.08,
    side: THREE.DoubleSide,
  });

  const metalGoldMat = new THREE.MeshPhysicalMaterial({
    color: 0xd4a847, metalness: 0.92, roughness: 0.12,
    envMap, envMapIntensity: 1.5,
    emissive: 0x553311, emissiveIntensity: 0.04,
  });

  const metalSilverMat = new THREE.MeshPhysicalMaterial({
    color: 0xc8c8d0, metalness: 0.95, roughness: 0.08,
    envMap, envMapIntensity: 1.5,
    emissive: 0x222233, emissiveIntensity: 0.03,
  });

  // ---- Bundled wrap-around tubes (organized topology) ----
  // Each tube wraps around the core from one nav node region to another
  const tubeGroups = [];
  NAV_DATA.forEach((nd, ni) => {
    const startPos = new THREE.Vector3(nd.pos[0], nd.pos[1], nd.pos[2]);
    const bundle = [];
    for (let t = 0; t < 4; t++) {
      const spread = 0.15;
      const start = startPos.clone().add(new THREE.Vector3(
        (Math.random()-0.5)*spread, (Math.random()-0.5)*spread, (Math.random()-0.5)*spread
      ));

      // Control points that wrap around the core
      const angle1 = Math.atan2(start.y, start.x) + (Math.random()-0.5)*0.8;
      const angle2 = angle1 + (Math.random()-0.5)*1.5 + (ni*0.3);
      const r1 = 1.2 + Math.random()*0.6;
      const r2 = 1.0 + Math.random()*0.8;

      const cp1 = new THREE.Vector3(Math.cos(angle1)*r1, Math.sin(angle1)*r1, (Math.random()-0.5)*1.2);
      const cp2 = new THREE.Vector3(Math.cos(angle2)*r2, Math.sin(angle2)*r2, (Math.random()-0.5)*1.2);

      // End near another nav node
      const nextNi = (ni + 1 + Math.floor(Math.random()*3)) % NAV_DATA.length;
      const endPos = new THREE.Vector3(NAV_DATA[nextNi].pos[0], NAV_DATA[nextNi].pos[1], NAV_DATA[nextNi].pos[2]);
      const end = endPos.clone().add(new THREE.Vector3(
        (Math.random()-0.5)*spread, (Math.random()-0.5)*spread, (Math.random()-0.5)*spread
      ));

      const curve = new THREE.CatmullRomCurve3([start, cp1, cp2, end]);
      const tGeo = new THREE.TubeGeometry(curve, 24, 0.022 + Math.random()*0.012, 6, false);

      const isMetal = t === 1 || t === 3;
      const mat = isMetal ? (Math.random() > 0.5 ? metalGoldMat : metalSilverMat) : glassMat;
      const mesh = new THREE.Mesh(tGeo, mat);
      mesh.userData.bundle = ni;
      mainGroup.add(mesh);
      bundle.push(mesh);
    }
    tubeGroups.push(bundle);
  });

  // ---- Additional wrapping tubes for density ----
  for (let i = 0; i < 20; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = 1.0 + Math.random() * 1.0;
    const start = new THREE.Vector3(Math.cos(angle)*r, Math.sin(angle)*r, (Math.random()-0.5)*0.8);

    const angle2 = angle + Math.PI * 0.3 + Math.random() * Math.PI * 0.4;
    const r2 = 0.8 + Math.random() * 1.2;
    const end = new THREE.Vector3(Math.cos(angle2)*r2, Math.sin(angle2)*r2, (Math.random()-0.5)*0.8);

    const cp1 = new THREE.Vector3(Math.cos(angle+0.5)*(r+0.4), Math.sin(angle+0.5)*(r+0.4), (Math.random()-0.5)*1.0);
    const cp2 = new THREE.Vector3(Math.cos(angle2-0.5)*(r2+0.3), Math.sin(angle2-0.5)*(r2+0.3), (Math.random()-0.5)*1.0);

    const curve = new THREE.CatmullRomCurve3([start, cp1, cp2, end]);
    const isMetal = i % 3 === 0;
    const mat = isMetal ? (i % 2 === 0 ? metalGoldMat : metalSilverMat) : glassMat;
    const geo = new THREE.TubeGeometry(curve, 20, 0.016+Math.random()*0.008, 5, false);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.bundle = -1;
    mainGroup.add(mesh);
  }

  // ---- Navigation nodes with crystal backings ----
  NAV_DATA.forEach((nd, i) => {
    const p = new THREE.Vector3(nd.pos[0], nd.pos[1], nd.pos[2]);

    // Crystal backing behind nav node
    const crystalBacking = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.12 + Math.random()*0.06, 1),
      new THREE.MeshPhysicalMaterial({
        color: nd.color, metalness: 0.1, roughness: 0.05,
        envMap, envMapIntensity: 1.2,
        emissive: nd.glow, emissiveIntensity: 0.15,
        transparent: true, opacity: 0.6,
        flatShading: true, side: THREE.DoubleSide,
      })
    );
    crystalBacking.position.copy(p);
    crystalBacking.position.z -= 0.05;
    crystalBacking.rotation.set(Math.random(), Math.random(), Math.random());
    mainGroup.add(crystalBacking);

    // Nav node sphere (metaball material)
    const sMat = mbMat(nd.color, 0.7);
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), sMat);
    sphere.position.copy(p);
    sphere.userData.navIdx = i;
    sphere.userData.isNav = true;
    mainGroup.add(sphere);
    allNavNodes.push(sphere);
    allJunctionMats.push(sMat);

    // Glow aura
    const aura = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 12, 8),
      new THREE.MeshBasicMaterial({ color: nd.color, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending })
    );
    aura.position.copy(p);
    mainGroup.add(aura);
    sphere.userData.aura = aura;

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
    const sMat2 = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const sprite = new THREE.Sprite(sMat2);
    sprite.position.copy(p);
    sprite.position.x += nd.pos[0] > 0 ? 0.55 : -0.55;
    sprite.scale.set(1.5, 0.48, 1);
    mainGroup.add(sprite);

    // HTML click hitbox
    const hit = document.createElement('div');
    hit.style.cssText = 'position:fixed;width:90px;height:90px;border-radius:50%;cursor:pointer;z-index:10;background:transparent;';
    hit.dataset.navIdx = i;
    hit.addEventListener('click', () => onNavClick(i));
    document.body.appendChild(hit);
    navHitboxes.push(hit);

    // Junction blob at core-tube intersection
    const jMat = mbMat(nd.color, 0.5);
    const jBlob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), jMat);
    jBlob.position.copy(p).multiplyScalar(0.5);
    mainGroup.add(jBlob);
    allJunctions.push(jBlob);
    allJunctionMats.push(jMat);
  });

  // ---- Ambient particles ----
  const pc = 100;
  const pp = new Float32Array(pc*3);
  for (let i = 0; i < pc; i++) {
    const r = 2.0+Math.random()*3.5, th = Math.random()*Math.PI*2, ph = Math.acos(2*Math.random()-1);
    pp[i*3] = r*Math.sin(ph)*Math.cos(th); pp[i*3+1] = r*Math.cos(ph); pp[i*3+2] = r*Math.sin(ph)*Math.sin(th);
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({
    size: 0.005, color: 0x7744bb, transparent: true, opacity: 0.04,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  }));
  mainGroup.add(particles);

  animate();
  window.addEventListener('resize', onResize);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('scroll', onScroll, {passive:true});
}

function onResize() {
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function onMouseMove(e) {
  mouseX = (e.clientX/window.innerWidth)*2-1;
  mouseY = -(e.clientY/window.innerHeight)*2+1;
}

let prevScrollY = 0;
function onScroll() {
  const sy = window.scrollY;
  const d = Math.abs(sy - prevScrollY);
  if (d > 2) scrollBoost = Math.min(scrollBoost + d*3, 50);
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
  const targetX = Math.min(scrollBoost * 0.025, 1.0);
  const targetY = Math.min(scrollBoost * 0.035, 1.2);
  extraRotX += (targetX - extraRotX) * 0.01;
  extraRotY += (targetY - extraRotY) * 0.01;
  extraRotX *= 0.88;
  extraRotY *= 0.88;

  // ---- State lerp ----
  const s = state.scale, px = state.posX, py = state.posY, pz = state.posZ;
  mainGroup.scale.setScalar(1+(s-1)*0.03);
  mainGroup.position.x += (px-mainGroup.position.x)*0.03;
  mainGroup.position.y += (py-mainGroup.position.y)*0.03;
  mainGroup.position.z += (pz-mainGroup.position.z)*0.03;

  // ---- Fixed camera (subtle drift only) ----
  camera.position.x += (mouseX*0.04-camera.position.x)*0.01;
  camera.position.y += (mouseY*0.03-camera.position.y)*0.01;
  camera.lookAt(mainGroup.position.x, mainGroup.position.y, 0);
  camera.position.z = 6.5 + pz*0.2;

  // ---- Idle rotation + elastic spring rotation ----
  const idle = 0.0012;
  mainGroup.rotation.x += idle*0.25 + extraRotX*0.2;
  mainGroup.rotation.y += idle + extraRotY*0.3;
  mainGroup.rotation.z += idle*0.08;

  // ---- Core morphing ----
  if (coreShaderRef) {
    coreShaderRef.uniforms.uTime.value = time;
    coreShaderRef.uniforms.uMorph.value = animTrigger*0.5 + clickPulse*0.2;
  }
  coreWire.rotation.copy(core.rotation);
  coreWire.material.opacity = 0.03 + extraRotY*0.02;

  // ---- Junction metaball uniforms ----
  const fStr = 0.8 + extraRotY*0.2 + animTrigger*0.2;
  allJunctionMats.forEach((jm, i) => {
    if (jm.uniforms) {
      jm.uniforms.uTime.value = time*1.2 + i*0.1;
      jm.uniforms.uFusion.value = fStr;
      jm.uniforms.uPulse.value = 0;
    }
  });

  // ---- Nav node click pulse ----
  allNavNodes.forEach((n, i) => {
    const p = i === pulseNode ? clickPulse : 0;
    if (n.material.uniforms) {
      n.material.uniforms.uPulse.value = p;
      n.material.uniforms.uGlow.value = 0.5 + 0.3*Math.sin(time*0.8+i*1.3) + p*0.8;
    }
    n.position.y += Math.sin(time*0.6+i*1.8)*0.0004;
    if (n.userData.aura) {
      n.userData.aura.material.opacity = 0.06 + 0.04*Math.sin(time*0.5+i*1.3) + p*0.2;
      n.userData.aura.scale.setScalar(1+p*0.4);
    }
  });

  if (clickPulse > 0) clickPulse *= 0.96;
  if (clickRipple > 0) clickRipple *= 0.98;
  if (clickPulse < 0.01) { clickPulse = 0; pulseNode = -1; }

  // ---- Update HTML hitboxes ----
  allNavNodes.forEach((n, i) => {
    const v = new THREE.Vector3();
    n.getWorldPosition(v);
    v.project(camera);
    if (v.z < 1) {
      const x = (v.x*0.5+0.5)*window.innerWidth;
      const y = (-v.y*0.5+0.5)*window.innerHeight;
      const h = navHitboxes[i];
      if (h) { h.style.left = `${x-45}px`; h.style.top = `${y-45}px`; h.style.display = 'block'; }
    } else {
      navHitboxes[i].style.display = 'none';
    }
  });

  renderer.render(scene, camera);
}

export function updateScrollProgress(p) {
  state.scale = 1 - p*0.3;
  state.posX = p*1.8;
  state.posY = -p*0.8;
  state.posZ = -p*0.4;
}

export function setTrigger(v) {
  animTrigger = v;
}

init();
