import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

let scene, camera, renderer;
let mainGroup, knot1, knot2, glowRing, particles;
let mouseX = 0, mouseY = 0, mouseZone = 'center';
let scrollBoost = 0;
let state = { scale: 1, posX: 0, posY: 0, posZ: 0 };
let animTrigger = 0;
let time = 0, shaderTime = 0;
let shaderRef = null;

function init() {
  const canvas = document.getElementById('three-canvas');
  if (!canvas) return;

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0.15, 6);

  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.6;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene.add(new THREE.AmbientLight(0x556688, 0.3));

  const key = new THREE.DirectionalLight(0xffffff, 2.5);
  key.position.set(5, 6, 8);
  key.castShadow = true;
  key.shadow.mapSize.width = 2048;
  key.shadow.mapSize.height = 2048;
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.02;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 15;
  {
    const d = 6;
    key.shadow.camera.left = -d;
    key.shadow.camera.right = d;
    key.shadow.camera.top = d;
    key.shadow.camera.bottom = -d;
  }
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x9977bb, 0.8);
  fill.position.set(-5, 4, 3);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xbb88ff, 0.4);
  rim.position.set(0, -6, -7);
  scene.add(rim);

  mainGroup = new THREE.Group();
  mainGroup.position.z = 0;
  scene.add(mainGroup);

  const knotGeo = new THREE.TorusKnotGeometry(1.0, 0.28, 320, 48);
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0.50, 0.30, 0.70),
    metalness: 0.05,
    roughness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.0,
    envMapIntensity: 1.5,
    emissive: new THREE.Color(0.28, 0.08, 0.48),
    emissiveIntensity: 0.15,
    side: THREE.DoubleSide,
    depthWrite: true,
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uDistort = { value: 0 };
    shader.uniforms.uBurst = { value: 0 };
    shaderRef = shader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      [
        '#include <begin_vertex>',
        'float w = sin(position.x*3.5 + uTime*0.25)*0.003',
        '        + cos(position.y*4.5 + uTime*0.2)*0.003',
        '        + sin(position.z*5.5 + uTime*0.3)*0.003;',
        'transformed += normal * w * (uDistort + uBurst*0.5);',
      ].join('\n')
    );
  };
  knot1 = new THREE.Mesh(knotGeo, mat);
  knot1.scale.setScalar(1.05);
  knot1.castShadow = true;
  knot1.receiveShadow = true;
  mainGroup.add(knot1);

  const knotGeoSmall = new THREE.TorusKnotGeometry(0.30, 0.09, 128, 20);
  knot2 = new THREE.Mesh(knotGeoSmall, new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0.60, 0.20, 0.50),
    metalness: 0.05,
    roughness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.0,
    envMapIntensity: 1.2,
    emissive: new THREE.Color(0.40, 0.05, 0.30),
    emissiveIntensity: 0.12,
    side: THREE.DoubleSide,
    depthWrite: true,
  }));
  mainGroup.add(knot2);

  glowRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.4, 0.006, 64, 200),
    new THREE.MeshBasicMaterial({ color: 0x8866cc, transparent: true, opacity: 0.08 })
  );
  glowRing.rotation.x = 0.2;
  mainGroup.add(glowRing);

  const ring2 = new THREE.Mesh(
    new THREE.TorusGeometry(1.8, 0.004, 32, 200),
    new THREE.MeshBasicMaterial({ color: 0x7755bb, transparent: true, opacity: 0.04 })
  );
  ring2.rotation.x = -0.35;
  ring2.rotation.z = 0.5;
  mainGroup.add(ring2);

  function mkTex() {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,0.4)');
    g.addColorStop(0.15, 'rgba(200,180,255,0.15)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.needsUpdate = true;
    return t;
  }

  const pCount = 300;
  const pPos = new Float32Array(pCount * 3);
  const pCol = new Float32Array(pCount * 3);
  for (let i = 0; i < pCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 2.0 + Math.random() * 5.0;
    pPos[i*3] = r * Math.sin(phi) * Math.cos(theta);
    pPos[i*3+1] = (Math.random() - 0.5) * 6;
    pPos[i*3+2] = r * Math.cos(phi);
    const c = new THREE.Color(0.3+Math.random()*0.3, 0.1+Math.random()*0.2, 0.4+Math.random()*0.4);
    pCol[i*3] = c.r; pCol[i*3+1] = c.g; pCol[i*3+2] = c.b;
  }
  const pGeom = new THREE.BufferGeometry();
  pGeom.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeom.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const pMat = new THREE.PointsMaterial({
    size: 0.015, map: mkTex(), vertexColors: true,
    transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending,
    depthWrite: false, sizeAttenuation: true,
  });
  particles = new THREE.Points(pGeom, pMat);
  mainGroup.add(particles);

  animate();
  window.addEventListener('resize', onResize);
  document.addEventListener('mousemove', onMouseMove);
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
  const z = e.clientX / window.innerWidth;
  mouseZone = z < 0.3 ? 'left' : z > 0.7 ? 'right' : 'center';
}

let prevScrollY = 0;
function onScroll() {
  const sy = window.scrollY;
  const delta = Math.abs(sy - prevScrollY);
  if (delta > 2) scrollBoost = Math.min(scrollBoost + delta * 2, 25);
  prevScrollY = sy;
}

function animate() {
  requestAnimationFrame(animate);
  time += 0.004;
  shaderTime += 0.006;
  scrollBoost *= 0.88;

  const s = state.scale, px = state.posX, py = state.posY, pz = state.posZ;
  mainGroup.scale.setScalar(1 + (s - 1)*0.03);
  mainGroup.position.x += (px - mainGroup.position.x)*0.03;
  mainGroup.position.y += (py - mainGroup.position.y)*0.03;
  mainGroup.position.z += (pz - mainGroup.position.z)*0.03;

  const boost = Math.min(scrollBoost, 25);
  const rBase = 0.002 + boost * 0.003;
  knot1.rotation.x += rBase * 0.4;
  knot1.rotation.y += rBase + mouseX * 0.0003;
  knot1.rotation.z += rBase * 0.1;

  const ang = time * 0.25;
  knot2.position.set(
    Math.cos(ang) * 2.8,
    Math.sin(ang * 0.7) * 0.8,
    Math.sin(ang) * 2.8
  );
  knot2.rotation.x = time * 0.4;
  knot2.rotation.y = time * 0.6;

  const distort = Math.min(boost * 0.03, 0.6);
  if (shaderRef) {
    shaderRef.uniforms.uTime.value = shaderTime;
    shaderRef.uniforms.uDistort.value += (distort + animTrigger*0.3 - shaderRef.uniforms.uDistort.value) * 0.05;
    shaderRef.uniforms.uBurst.value += (animTrigger - shaderRef.uniforms.uBurst.value) * 0.04;
  }

  const zoneVal = mouseZone === 'left' ? -1 : mouseZone === 'right' ? 1 : 0;
  knot1.material.emissive.lerp(new THREE.Color(
    0.28 + zoneVal * 0.08,
    0.08 + zoneVal * 0.04 + animTrigger * 0.05,
    0.48 - zoneVal * 0.1 + animTrigger * 0.05
  ), 0.04);
  knot1.material.emissiveIntensity += (0.06 + animTrigger * 0.08 - knot1.material.emissiveIntensity) * 0.04;
  knot1.material.opacity += (0.88 + animTrigger * 0.08 - knot1.material.opacity) * 0.03;

  glowRing.rotation.z = shaderTime * 0.05 + boost * 0.003;
  glowRing.material.opacity = 0.08 + boost * 0.005 + animTrigger * 0.04;

  if (particles) {
    const pos = particles.geometry.attributes.position;
    const arr = pos.array;
    const mx = mouseX * 4, my = mouseY * 3;
    for (let i = 0; i < 300; i++) {
      const idx = i * 3;
      const dx = mx - arr[idx], dy = my - arr[idx+1];
      arr[idx] += dx * 0.000008 + (Math.random()-0.5)*0.001 + animTrigger * (arr[idx]-mx) * 0.0005;
      arr[idx+1] += dy * 0.000008 + (Math.random()-0.5)*0.001 + animTrigger * (arr[idx+1]-my) * 0.0005;
      arr[idx+2] += (Math.random()-0.5)*0.001;
      for (let a = 0; a < 3; a++) {
        if (Math.abs(arr[idx+a]) > 7) arr[idx+a] *= 0.98;
      }
    }
    pos.needsUpdate = true;
    particles.rotation.y = shaderTime * 0.006;
    particles.material.opacity = 0.12 + animTrigger * 0.1 + boost * 0.002;
  }

  camera.position.x += (mouseX * 0.08 + zoneVal * 0.03 - camera.position.x) * 0.02;
  camera.position.y += (mouseY * 0.06 - camera.position.y) * 0.02;
  camera.lookAt(mainGroup.position.x, mainGroup.position.y, 0);

  renderer.render(scene, camera);
}

export function updateScrollProgress(p) {
  state.scale = 1 - p * 0.3;
  state.posX = p * 1.8;
  state.posY = -p * 0.8;
  state.posZ = -p * 0.3;
}

export function setTrigger(v) {
  animTrigger = v;
}

init();
