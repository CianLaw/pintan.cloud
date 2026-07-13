import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

let scene, camera, renderer;
let mainGroup;
let rings = [];
let orbiters = [];
let starField, glowParticles, connectionLines;
let mouseX = 0, mouseY = 0;
let scrollY = 0;
let time = 0;

const ORBITER_COUNT = 24;
const COLORS = [
  0xE8786A, 0x6B8FBF, 0xC49A6C, 0x7FA8A0, 0xB892B4
];

function createGlowTex() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.1, 'rgba(255,255,255,0.6)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.15)');
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
  camera.position.set(0, 0.5, 7);

  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.8;

  const ambient = new THREE.AmbientLight(0xffffff, 0.3);
  scene.add(ambient);
  const key = new THREE.DirectionalLight(0xffffff, 2);
  key.position.set(4, 5, 6);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x8899cc, 0.8);
  fill.position.set(-4, 2, 3);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xff8888, 0.5);
  rim.position.set(0, -4, -5);
  scene.add(rim);

  mainGroup = new THREE.Group();
  scene.add(mainGroup);

  // Central glow
  const coreGlowTex = createGlowTex();
  const core = new THREE.Sprite(new THREE.SpriteMaterial({
    map: coreGlowTex, color: 0xffffff, transparent: true, opacity: 0.3,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  core.scale.set(3, 3, 1);
  mainGroup.add(core);

  // 3 rings at different tilts
  const ringConfigs = [
    { radius: 1.8, tilt: 0, color: 0x8899cc, opacity: 0.25 },
    { radius: 2.5, tilt: 0.5, color: 0xcc88aa, opacity: 0.15 },
    { radius: 3.2, tilt: -0.3, color: 0x99bb88, opacity: 0.1 },
  ];
  for (const cfg of ringConfigs) {
    const geo = new THREE.TorusGeometry(cfg.radius, 0.008, 48, 160);
    const mat = new THREE.MeshBasicMaterial({
      color: cfg.color, transparent: true, opacity: cfg.opacity,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = cfg.tilt;
    mesh.rotation.z = Math.random() * Math.PI;
    rings.push(mesh);
    mainGroup.add(mesh);

    // Slightly larger ghost ring
    const ghost = new THREE.Mesh(
      new THREE.TorusGeometry(cfg.radius + 0.02, 0.003, 32, 160),
      new THREE.MeshBasicMaterial({ color: cfg.color, transparent: true, opacity: cfg.opacity * 0.4 })
    );
    ghost.rotation.x = cfg.tilt;
    ghost.rotation.z = mesh.rotation.z + 0.2;
    rings.push(ghost);
    mainGroup.add(ghost);
  }

  // Orbiters
  const shapes = [
    { geo: new THREE.OctahedronGeometry(1, 0), label: 'oct' },
    { geo: new THREE.TetrahedronGeometry(1, 0), label: 'tet' },
    { geo: new THREE.IcosahedronGeometry(1, 0), label: 'ico' },
    { geo: new THREE.DodecahedronGeometry(1, 0), label: 'dod' },
  ];

  for (let i = 0; i < ORBITER_COUNT; i++) {
    const col = COLORS[i % COLORS.length];
    const shape = shapes[i % shapes.length];
    const size = 0.06 + Math.random() * 0.08;

    const mat = new THREE.MeshPhysicalMaterial({
      color: col, metalness: 0.1, roughness: 0.1,
      transparent: true, opacity: 0.7,
      clearcoat: 0.3, clearcoatRoughness: 0.2,
    });
    const mesh = new THREE.Mesh(shape.geo.clone(), mat);
    mesh.scale.setScalar(size);

    const wireMat = new THREE.MeshBasicMaterial({
      color: col, wireframe: true, transparent: true, opacity: 0.25,
    });
    const wire = new THREE.Mesh(shape.geo.clone(), wireMat);
    wire.scale.setScalar(size * 1.2);

    // Orbital ring for this orbiter (tiny)
    const orbitRing = new THREE.Mesh(
      new THREE.RingGeometry(size * 1.6, size * 1.65, 24),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.1, side: THREE.DoubleSide })
    );
    orbitRing.rotation.x = Math.PI / 2;

    const g = new THREE.Group();
    g.add(mesh);
    g.add(wire);
    g.add(orbitRing);

    const angle = (i / ORBITER_COUNT) * Math.PI * 2 + Math.random() * 0.2;
    const radius = 1.2 + Math.random() * 2.3;
    const speed = 0.08 + Math.random() * 0.18;
    const tiltOffset = (Math.random() - 0.5) * 1.2;
    const rotSpeedX = 0.5 + Math.random() * 2;
    const rotSpeedY = 0.6 + Math.random() * 2;
    const floatAmp = 0.02 + Math.random() * 0.06;
    const phase = Math.random() * 6.28;
    const yBase = (Math.random() - 0.5) * 0.8;

    orbiters.push({
      g, angle, radius, speed, tiltOffset, rotSpeedX, rotSpeedY,
      floatAmp, phase, yBase, col, size,
    });
    mainGroup.add(g);
  }

  // Connection lines between nearby orbiters (inner only)
  const lineMat = new THREE.LineBasicMaterial({
    color: 0x8899cc, transparent: true, opacity: 0.06,
  });
  const lineGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(ORBITER_COUNT * ORBITER_COUNT * 6);
  lineGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  lineGeo.setDrawRange(0, 0);
  connectionLines = new THREE.LineSegments(lineGeo, lineMat);
  mainGroup.add(connectionLines);

  // Starfield background
  const starCount = 800;
  const starPos = new Float32Array(starCount * 3);
  const starSizes = new Float32Array(starCount);
  for (let i = 0; i < starCount; i++) {
    const r = 8 + Math.random() * 15;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    starPos[i * 3 + 2] = r * Math.cos(phi);
    starSizes[i] = 0.01 + Math.random() * 0.03;
  }
  const starGeom = new THREE.BufferGeometry();
  starGeom.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeom.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));
  const starMat = new THREE.PointsMaterial({
    size: 0.03, color: 0x99aacc, transparent: true, opacity: 0.4,
    blending: THREE.AdditiveBlending, depthWrite: false,
    sizeAttenuation: true,
  });
  starField = new THREE.Points(starGeom, starMat);
  mainGroup.add(starField);

  // Glow particles along orbital paths
  const glowCount = 500;
  const glowPos = new Float32Array(glowCount * 3);
  for (let i = 0; i < glowCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 1.3 + Math.random() * 2.8;
    glowPos[i * 3] = r * Math.cos(a);
    glowPos[i * 3 + 1] = (Math.random() - 0.5) * 1.2;
    glowPos[i * 3 + 2] = r * Math.sin(a);
  }
  const glowGeom = new THREE.BufferGeometry();
  glowGeom.setAttribute('position', new THREE.BufferAttribute(glowPos, 3));
  const glowMat = new THREE.PointsMaterial({
    size: 0.02, map: createGlowTex(), color: 0xddccff,
    transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending,
    depthWrite: false, sizeAttenuation: true,
  });
  glowParticles = new THREE.Points(glowGeom, glowMat);
  mainGroup.add(glowParticles);

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
}

function onScroll() {
  scrollY = window.scrollY;
}

function animate() {
  requestAnimationFrame(animate);
  time += 0.004;

  const vh = window.innerHeight;
  const pct = Math.min(scrollY / vh, 0.4);
  const fade = Math.max(0, 1 - pct * 2.5);

  // Global rotation - faster on scroll
  const scrollBoost = 1 + (1 - fade) * 2;
  mainGroup.rotation.y += 0.004 * scrollBoost + mouseX * 0.0003;
  mainGroup.rotation.x = Math.sin(time * 0.06) * 0.03 + mouseY * 0.03;
  mainGroup.rotation.z = Math.sin(time * 0.04) * 0.02;

  // Pulse scale
  const pulse = 1 + Math.sin(time * 0.8) * 0.02;

  // Rings
  for (let i = 0; i < rings.length; i++) {
    const r = rings[i];
    r.rotation.z += (i % 2 === 0 ? 1 : -1) * 0.003 * scrollBoost;
    r.material.opacity = r.material.userData?.baseOpacity ?? (0.25 * fade);
    if (!r.material.userData) r.material.userData = { baseOpacity: r.material.opacity };
  }

  // Orbiters
  const innerOrbiters = [];
  for (let i = 0; i < orbiters.length; i++) {
    const o = orbiters[i];
    o.angle += time * o.speed * 0.03 * scrollBoost;
    const x = o.radius * Math.cos(o.angle);
    const z = o.radius * Math.sin(o.angle);
    const y = Math.sin(time * 0.6 + o.phase) * o.floatAmp + o.yBase;
    o.g.position.set(x, y, z);
    o.g.rotation.x += o.rotSpeedX * 0.012;
    o.g.rotation.y += o.rotSpeedY * 0.012;
    o.g.scale.setScalar((0.8 + fade * 0.2) * pulse);

    for (const child of o.g.children) {
      if (child.isMesh) child.material.opacity = (0.7 * fade);
    }

    if (o.radius < 2.2) innerOrbiters.push({ pos: new THREE.Vector3(x, y, z), g: o.g });
  }

  // Update connection lines between nearby inner orbiters
  const positions = connectionLines.geometry.attributes.position.array;
  let idx = 0;
  const maxDist = 1.8;
  for (let i = 0; i < innerOrbiters.length; i++) {
    for (let j = i + 1; j < innerOrbiters.length; j++) {
      const dist = innerOrbiters[i].pos.distanceTo(innerOrbiters[j].pos);
      if (dist < maxDist && idx * 3 + 5 < positions.length) {
        positions[idx * 3] = innerOrbiters[i].pos.x;
        positions[idx * 3 + 1] = innerOrbiters[i].pos.y;
        positions[idx * 3 + 2] = innerOrbiters[i].pos.z;
        positions[idx * 3 + 3] = innerOrbiters[j].pos.x;
        positions[idx * 3 + 4] = innerOrbiters[j].pos.y;
        positions[idx * 3 + 5] = innerOrbiters[j].pos.z;
        idx++;
      }
    }
  }
  connectionLines.geometry.setDrawRange(0, idx * 2);
  connectionLines.geometry.attributes.position.needsUpdate = true;
  connectionLines.material.opacity = 0.06 * fade;

  // Starfield
  if (starField) {
    starField.rotation.y = time * 0.002;
    starField.material.opacity = 0.4 * fade;
  }

  // Glow particles
  if (glowParticles) {
    glowParticles.rotation.y = time * 0.005;
    glowParticles.material.opacity = 0.2 * fade;
  }

  // Camera
  const cx = mouseX * 0.3 - camera.position.x;
  const cy = mouseY * 0.2 - camera.position.y;
  camera.position.x += cx * 0.015;
  camera.position.y += cy * 0.015;
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);
}

init();
