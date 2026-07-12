import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

let scene, camera, renderer, sphere, sphereGroup, particles;
let mouseX = 0, mouseY = 0;
let scrollY = 0;
let targetRotationX = 0, targetRotationY = 0;
let currentRotationX = 0, currentRotationY = 0;

function init() {
  const canvas = document.getElementById('three-canvas');
  if (!canvas) return;

  scene = new THREE.Scene();

  const width = window.innerWidth;
  const height = window.innerHeight;

  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.z = 5;

  renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  sphereGroup = new THREE.Group();
  scene.add(sphereGroup);

  const torusKnotGeo = new THREE.TorusKnotGeometry(0.85, 0.3, 180, 24);
  const torusMat = new THREE.MeshPhysicalMaterial({
    color: 0xc4956a,
    metalness: 0.7,
    roughness: 0.2,
    clearcoat: 0.3,
    clearcoatRoughness: 0.2,
    reflectivity: 0.8,
    envMapIntensity: 0.8,
  });
  sphere = new THREE.Mesh(torusKnotGeo, torusMat);
  sphereGroup.add(sphere);

  const innerGeo = new THREE.IcosahedronGeometry(0.3, 1);
  const innerMat = new THREE.MeshPhysicalMaterial({
    color: 0xe8d5c0,
    metalness: 0.3,
    roughness: 0.4,
    transparent: true,
    opacity: 0.6,
  });
  const innerSphere = new THREE.Mesh(innerGeo, innerMat);
  sphereGroup.add(innerSphere);

  const particlesGeo = new THREE.BufferGeometry();
  const particleCount = 200;
  const positions = new Float32Array(particleCount * 3);
  const sizes = new Float32Array(particleCount);
  for (let i = 0; i < particleCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 1.6 + Math.random() * 0.8;
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
    sizes[i] = 0.02 + Math.random() * 0.02;
  }
  particlesGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particlesGeo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const particlesMat = new THREE.PointsMaterial({
    color: 0xc4956a,
    size: 0.035,
    transparent: true,
    opacity: 0.4,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
  });
  particles = new THREE.Points(particlesGeo, particlesMat);
  sphereGroup.add(particles);

  animate();

  window.addEventListener('resize', onResize);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('scroll', onScroll);
}

function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
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

  const scrollFactor = Math.min(scrollY / (window.innerHeight * 2), 1);

  targetRotationY = mouseX * 0.5 + scrollFactor * Math.PI * 2;
  targetRotationX = mouseY * 0.3 + scrollFactor * 0.5;

  currentRotationX += (targetRotationX - currentRotationX) * 0.05;
  currentRotationY += (targetRotationY - currentRotationY) * 0.05;

  sphereGroup.rotation.x = currentRotationX;
  sphereGroup.rotation.y = currentRotationY;

  sphere.rotation.x += 0.003;
  sphere.rotation.y += 0.005;

  const floatY = Math.sin(Date.now() * 0.0008) * 0.15;
  sphereGroup.position.y = floatY - scrollFactor * 0.5;

  camera.position.y = -scrollFactor * 0.3;
  camera.lookAt(0, 0, 0);

  const opacity = Math.max(0, 1 - scrollFactor * 1.5);
  sphereGroup.children.forEach(child => {
    if (child.material) {
      child.material.opacity = child === sphere ? 1 : opacity;
      child.material.transparent = child !== sphere;
    }
  });

  renderer.render(scene, camera);
}

init();
