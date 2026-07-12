import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

let scene, camera, renderer;
let mainMesh, wireframeMesh;
let particles;
let mouseX = 0, mouseY = 0;
let scrollY = 0;
let time = 0;
let totalRotation = 0;

function init() {
  const canvas = document.getElementById('three-canvas');
  if (!canvas) return;

  scene = new THREE.Scene();

  const w = window.innerWidth;
  const h = window.innerHeight;

  camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
  camera.position.set(0, 0, 5.5);

  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  const ambient = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(3, 4, 5);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x8ab4ff, 0.6);
  fill.position.set(-3, 1, 2);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xff8a8a, 0.4);
  rim.position.set(0, -3, -4);
  scene.add(rim);

  const geo = new THREE.IcosahedronGeometry(1.3, 1);

  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x6b8cff,
    metalness: 0.05,
    roughness: 0.1,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    envMapIntensity: 0.4,
  });

  mainMesh = new THREE.Mesh(geo, mat);
  scene.add(mainMesh);

  const wireMat = new THREE.MeshBasicMaterial({
    color: 0x999999,
    wireframe: true,
    transparent: true,
    opacity: 0.15,
  });
  wireframeMesh = new THREE.Mesh(geo.clone(), wireMat);
  wireframeMesh.scale.setScalar(1.02);
  scene.add(wireframeMesh);

  const pCount = 600;
  const pPos = new Float32Array(pCount * 3);
  const pCol = new Float32Array(pCount * 3);
  const pSiz = new Float32Array(pCount);

  const palette = [
    [0.42, 0.55, 1.0],
    [0.50, 0.35, 0.92],
    [0.92, 0.30, 0.50],
    [0.20, 0.72, 0.62],
    [0.92, 0.52, 0.15],
  ];

  for (let i = 0; i < pCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 2.2 + Math.random() * 2.5;

    pPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    pPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    pPos[i * 3 + 2] = r * Math.cos(phi);

    const c = palette[Math.floor(Math.random() * palette.length)];
    pCol[i * 3] = c[0];
    pCol[i * 3 + 1] = c[1];
    pCol[i * 3 + 2] = c[2];

    pSiz[i] = 0.015 + Math.random() * 0.03;
  }

  const pGeom = new THREE.BufferGeometry();
  pGeom.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeom.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  pGeom.setAttribute('size', new THREE.BufferAttribute(pSiz, 1));

  const pMat = new THREE.PointsMaterial({
    size: 0.04,
    vertexColors: true,
    transparent: true,
    opacity: 0.5,
    blending: THREE.NormalBlending,
    sizeAttenuation: true,
    depthWrite: false,
  });

  particles = new THREE.Points(pGeom, pMat);
  scene.add(particles);

  animate();
  window.addEventListener('resize', onResize);
  document.addEventListener('mousemove', onMouseMove);
  window.addEventListener('scroll', onScroll, { passive: true });
}

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
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
  time += 0.01;

  const viewH = window.innerHeight;
  const scrollPct = Math.min(scrollY / viewH, 1);
  const scrollUp = 1 - scrollPct;

  // 往上滑 = Y轴旋转，滚多少转多少
  totalRotation = scrollUp * Math.PI * 4;

  if (mainMesh) {
    mainMesh.rotation.y = totalRotation + mouseX * 0.2;
    mainMesh.rotation.x = mouseY * 0.15;

    const breathe = 1 + Math.sin(time * 1.2) * 0.025;
    const floatY = Math.sin(time * 0.8) * 0.08;
    mainMesh.position.y = floatY;
    mainMesh.scale.setScalar(breathe);
  }

  if (wireframeMesh) {
    wireframeMesh.rotation.x = mainMesh.rotation.x * 0.95;
    wireframeMesh.rotation.y = mainMesh.rotation.y * 1.05;
    wireframeMesh.position.y = mainMesh.position.y;
    wireframeMesh.scale.copy(mainMesh.scale);
  }

  if (particles) {
    particles.rotation.y = time * 0.04;
    particles.rotation.x = mouseY * 0.05 + Math.sin(time * 0.3) * 0.02;
  }

  // 视差
  const px = mouseX * 0.3;
  const py = mouseY * 0.2;
  camera.position.x += (px - camera.position.x) * 0.025;
  camera.position.y += (py - camera.position.y) * 0.025;
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);
}

init();
