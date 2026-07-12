import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

let scene, camera, renderer;
let mainMesh, wireframeMesh, particleSystem;
let mouseX = 0, mouseY = 0;
let scrollY = 0;
let time = 0;

const PARTICLE_COUNT = 1500;

function init() {
  const canvas = document.getElementById('three-canvas');
  if (!canvas) return;

  scene = new THREE.Scene();

  const width = window.innerWidth;
  const height = window.innerHeight;

  camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 200);
  camera.position.z = 6;

  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(5, 5, 5);
  scene.add(directionalLight);

  const pointLight1 = new THREE.PointLight(0x6b8cff, 1.2, 20);
  pointLight1.position.set(-3, 2, 3);
  scene.add(pointLight1);

  const pointLight2 = new THREE.PointLight(0xff6b9d, 0.8, 20);
  pointLight2.position.set(3, -2, 3);
  scene.add(pointLight2);

  const icoGeometry = new THREE.IcosahedronGeometry(1.4, 1);

  const solidMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x6b8cff,
    metalness: 0.1,
    roughness: 0.15,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
  });
  mainMesh = new THREE.Mesh(icoGeometry, solidMaterial);
  scene.add(mainMesh);

  const wireframeMaterial = new THREE.MeshBasicMaterial({
    color: 0x333333,
    wireframe: true,
    transparent: true,
    opacity: 0.12,
  });
  wireframeMesh = new THREE.Mesh(icoGeometry.clone(), wireframeMaterial);
  wireframeMesh.scale.setScalar(1.01);
  scene.add(wireframeMesh);

  createParticles();
  animate();

  window.addEventListener('resize', onResize);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('scroll', onScroll);
}

function createParticles() {
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const colors = new Float32Array(PARTICLE_COUNT * 3);
  const sizes = new Float32Array(PARTICLE_COUNT);

  const palette = [
    [0.42, 0.55, 1.0],
    [0.55, 0.35, 0.95],
    [0.95, 0.30, 0.50],
    [0.20, 0.75, 0.65],
    [0.95, 0.55, 0.15],
  ];

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 2.5 + Math.random() * 4;

    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi) - 2;

    const c = palette[Math.floor(Math.random() * palette.length)];
    colors[i * 3] = c[0];
    colors[i * 3 + 1] = c[1];
    colors[i * 3 + 2] = c[2];

    sizes[i] = 0.02 + Math.random() * 0.04;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.PointsMaterial({
    size: 0.04,
    vertexColors: true,
    transparent: true,
    opacity: 0.6,
    blending: THREE.NormalBlending,
    sizeAttenuation: true,
    depthWrite: false,
  });

  particleSystem = new THREE.Points(geometry, material);
  scene.add(particleSystem);
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
  time += 0.008;

  const viewHeight = window.innerHeight;
  const scrollPercent = Math.min(scrollY / viewHeight, 1);

  if (mainMesh) {
    mainMesh.rotation.x = time * 0.3 + scrollPercent * Math.PI * 2 + mouseY * 0.15;
    mainMesh.rotation.y = time * 0.5 + scrollPercent * Math.PI * 1.5 + mouseX * 0.15;

    const breathe = 1 + Math.sin(time * 1.5) * 0.03;
    const expand = 1 + scrollPercent * 0.3;
    mainMesh.scale.setScalar(breathe * expand);

    mainMesh.position.y = -scrollPercent * 0.5;
  }

  if (wireframeMesh) {
    wireframeMesh.rotation.x = mainMesh.rotation.x * 0.98;
    wireframeMesh.rotation.y = mainMesh.rotation.y * 1.02;
    wireframeMesh.scale.copy(mainMesh.scale);
    wireframeMesh.position.y = mainMesh.position.y;
  }

  if (particleSystem) {
    particleSystem.rotation.y = time * 0.05 + mouseX * 0.08;
    particleSystem.rotation.x = mouseY * 0.05;
  }

  camera.position.x += (mouseX * 0.3 - camera.position.x) * 0.03;
  camera.position.y += (mouseY * 0.2 - camera.position.y) * 0.03;
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);
}

init();
