import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

let scene, camera, renderer;
let orbitGroup;
let shapes = [];
let mouseX = 0, mouseY = 0;
let scrollY = 0;
let time = 0;

const SHAPE_COUNT = 24;

function init() {
  const canvas = document.getElementById('three-canvas');
  if (!canvas) return;

  scene = new THREE.Scene();
  const w = window.innerWidth, h = window.innerHeight;

  camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
  camera.position.set(0, 0, 7);

  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  orbitGroup = new THREE.Group();
  scene.add(orbitGroup);

  const geos = [
    new THREE.OctahedronGeometry(1, 0),
    new THREE.TetrahedronGeometry(1, 0),
    new THREE.IcosahedronGeometry(1, 0),
  ];

  const palette = [
    [0.50, 0.35, 0.95],
    [0.35, 0.55, 1.0],
    [0.95, 0.30, 0.50],
    [0.92, 0.52, 0.12],
    [0.20, 0.72, 0.60],
  ];

  for (let i = 0; i < SHAPE_COUNT; i++) {
    const geoIdx = Math.floor(Math.random() * geos.length);
    const geo = geos[geoIdx].clone();
    const size = 0.12 + Math.random() * 0.2;
    geo.scale(size, size, size);

    const c = palette[Math.floor(Math.random() * palette.length)];
    const color = new THREE.Color(c[0], c[1], c[2]);

    const mainMat = new THREE.MeshPhysicalMaterial({
      color: color,
      metalness: 0.0,
      roughness: 0.2,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
      clearcoat: 0.3,
      clearcoatRoughness: 0.2,
    });
    const mainMesh = new THREE.Mesh(geo, mainMat);

    const edgeMat = new THREE.MeshBasicMaterial({
      color: color,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
    });
    const edgeMesh = new THREE.Mesh(geo.clone(), edgeMat);
    edgeMesh.scale.setScalar(1.02);

    const group = new THREE.Group();
    group.add(mainMesh);
    group.add(edgeMesh);

    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const radius = 1.8 + Math.random() * 2.5;

    group.position.set(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.sin(phi) * Math.sin(theta),
      radius * Math.cos(phi)
    );

    const orbitSpeed = 0.1 + Math.random() * 0.2;
    const rotSpeedX = 0.3 + Math.random() * 0.6;
    const rotSpeedY = 0.4 + Math.random() * 0.8;
    const phase = Math.random() * Math.PI * 2;
    const floatAmp = 0.05 + Math.random() * 0.1;
    const radiusScale = 0.6 + Math.random() * 0.4;

    shapes.push({ group, theta, phi, radius, orbitSpeed, rotSpeedX, rotSpeedY, phase, floatAmp, radiusScale, geoIdx });

    orbitGroup.add(group);
  }

  animate();
  window.addEventListener('resize', onResize);
  document.addEventListener('mousemove', onMouseMove);
  window.addEventListener('scroll', onScroll, { passive: true });
}

function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
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

  const viewH = window.innerHeight;
  const scrollPct = Math.min(scrollY / viewH, 1);
  const scrollUp = 1 - scrollPct;

  // Orbit rotation: scroll up = rotate faster
  const orbitRot = scrollUp * Math.PI * 2 + time * 0.05;
  orbitGroup.rotation.y = orbitRot;
  orbitGroup.rotation.x = Math.sin(time * 0.1) * 0.05 + mouseY * 0.05;

  // Individual shape animation
  for (const s of shapes) {
    const angle = time * s.orbitSpeed + s.phase;
    const r = s.radius;
    const x = r * Math.sin(s.phi) * Math.cos(s.theta + angle);
    const y = r * Math.sin(s.phi) * Math.sin(s.theta + angle) + Math.sin(time * 0.5 + s.phase) * s.floatAmp;
    const z = r * Math.cos(s.phi);

    s.group.position.set(x, y, z);
    s.group.rotation.x += s.rotSpeedX * 0.02;
    s.group.rotation.y += s.rotSpeedY * 0.02;
  }

  // Camera parallax
  camera.position.x += (mouseX * 0.3 - camera.position.x) * 0.02;
  camera.position.y += (mouseY * 0.2 - camera.position.y) * 0.02;
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);
}

init();
