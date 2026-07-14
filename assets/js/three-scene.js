import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

console.log('[three-scene] Initializing ceramic sphere + ice crack scene...');

gsap.registerPlugin(ScrollTrigger);

const canvas = document.querySelector('#three-canvas');
const scene = new THREE.Scene();

const W = window.innerWidth, H = window.innerHeight;
const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 100);
camera.position.set(0, 0.1, 7.5);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
renderer.setSize(W, H);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 4));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.8;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.5, 0.2, 0.25);
composer.addPass(bloom);

// ======== Ceramic Sphere ========
const SPHERE_R = 1.0;
const sphereGeo = new THREE.SphereGeometry(SPHERE_R, 128, 128);
const sphereMat = new THREE.MeshPhysicalMaterial({
  color: 0xf0ebe5,
  roughness: 0.5,
  metalness: 0.0,
  clearcoat: 0.2,
  clearcoatRoughness: 0.35,
  sheen: 0.6,
  sheenRoughness: 0.5,
  sheenColor: new THREE.Color(0xfff5ee),
  envMapIntensity: 0.3,
});
const sphere = new THREE.Mesh(sphereGeo, sphereMat);
scene.add(sphere);

// ======== Edge Glow (Fresnel) ========
const glowGeo = new THREE.SphereGeometry(SPHERE_R * 1.015, 96, 96);
const glowMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  side: THREE.BackSide,
  uniforms: {
    uColor: { value: new THREE.Color(0xf5f5f8) },
    uIntensity: { value: 0.35 },
  },
  vertexShader: `
    varying vec3 vNormal;
    varying vec3 vViewDir;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
      vViewDir = normalize(-mvPos.xyz);
      gl_Position = projectionMatrix * mvPos;
    }
  `,
  fragmentShader: `
    uniform vec3 uColor;
    uniform float uIntensity;
    varying vec3 vNormal;
    varying vec3 vViewDir;
    void main() {
      float fresnel = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), 3.5);
      gl_FragColor = vec4(uColor, fresnel * uIntensity);
    }
  `,
});
const glowMesh = new THREE.Mesh(glowGeo, glowMat);
scene.add(glowMesh);

// ======== Ice Crack Generation ========
const CRACK_ORIGIN = new THREE.Vector3(0, SPHERE_R * 0.35, SPHERE_R * 0.92);
const CRACK_COL = new THREE.Color(0xcc66dd);

function generateIceCrack(origin, direction, steps, seed) {
  const pts = [origin.clone()];
  let pos = origin.clone();
  let dir = direction.clone();
  const rng = () => {
    const x = Math.sin(seed * 12.9898 + pos.length() * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };

  for (let i = 0; i < steps; i++) {
    const perturbation = new THREE.Vector3(
      (rng() - 0.5) * 0.08,
      (rng() - 0.5) * 0.06,
      (rng() - 0.5) * 0.08,
    );
    dir.add(perturbation).normalize();
    pos.add(dir.clone().multiplyScalar(0.06 + rng() * 0.04));
    pts.push(pos.clone());
  }
  return pts;
}

// Generate cracks radiating from origin
const allCracks = [];
const MAIN_CRACKS = 10;
const SECONDARY = 16;
const TERTIARY = 24;

for (let i = 0; i < MAIN_CRACKS; i++) {
  const angle = (i / MAIN_CRACKS) * Math.PI * 2;
  const dir = new THREE.Vector3(
    Math.cos(angle) * 0.6,
    -0.3 - Math.random() * 0.3,
    Math.sin(angle) * 0.6,
  ).normalize();
  const pts = generateIceCrack(
    CRACK_ORIGIN.clone(),
    dir,
    18 + Math.floor(Math.random() * 10),
    i * 7.3,
  );
  allCracks.push({ pts, width: 0.008 + Math.random() * 0.004, depth: 0 });

  // Secondary branches
  if (Math.random() > 0.3) {
    const branchIdx = 3 + Math.floor(Math.random() * (pts.length - 6));
    const branchOrigin = pts[Math.min(branchIdx, pts.length - 1)];
    const branchDir = dir.clone().multiplyScalar(-1).add(
      new THREE.Vector3((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.5)
    ).normalize();
    const branchPts = generateIceCrack(
      branchOrigin.clone().add(branchDir.clone().multiplyScalar(0.05)),
      branchDir,
      8 + Math.floor(Math.random() * 6),
      i * 7.3 + branchIdx * 3.1,
    );
    allCracks.push({ pts: branchPts, width: 0.004 + Math.random() * 0.003, depth: 1 });
  }
}

// Tertiary cracks spreading outward
for (let i = 0; i < TERTIARY; i++) {
  const angle = Math.random() * Math.PI * 2;
  const phi = 0.2 + Math.random() * 1.2;
  const origin = new THREE.Vector3(
    CRACK_ORIGIN.x + Math.cos(angle) * phi * SPHERE_R * 0.4,
    CRACK_ORIGIN.y - Math.sin(phi) * SPHERE_R * 0.3,
    CRACK_ORIGIN.z + Math.sin(angle) * phi * SPHERE_R * 0.4,
  );
  const dir = new THREE.Vector3(
    (Math.random() - 0.5) * 0.5,
    -0.2 - Math.random() * 0.3,
    (Math.random() - 0.5) * 0.5,
  ).normalize();
  const pts = generateIceCrack(origin, dir, 6 + Math.floor(Math.random() * 6), i * 11.7);
  allCracks.push({ pts, width: 0.003 + Math.random() * 0.003, depth: 2 });
}

// ======== Crystal Tubes ========
const CENTER_COLOR = new THREE.Color(0x3a1c7a); // purple-blue
const OUTER_COLOR = new THREE.Color(0x22ddcc);  // cyan-green

allCracks.forEach(({ pts, width }) => {
  if (pts.length < 3) return;
  const curve = new THREE.CatmullRomCurve3(pts);
  const tubeGeo = new THREE.TubeGeometry(curve, Math.max(pts.length, 16), width, 4, false);

  // Add UV-based position attribute (0=center, 1=edge along crack)
  const uvs = tubeGeo.attributes.uv;
  const tValues = new Float32Array(uvs.count);
  for (let i = 0; i < uvs.count; i++) {
    tValues[i] = uvs.getX(i); // U coordinate along tube
  }
  tubeGeo.setAttribute('crackT', new THREE.BufferAttribute(tValues, 1));

  const crystalMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uCenterColor: { value: CENTER_COLOR },
      uOuterColor: { value: OUTER_COLOR },
      uTime: { value: 0 },
      uWidthFade: { value: 1.0 },
    },
    vertexShader: `
      attribute float crackT;
      uniform float uTime;
      varying float vT;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        vT = crackT;
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uCenterColor;
      uniform vec3 uOuterColor;
      uniform float uTime;
      varying float vT;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        // Crystal gradient
        vec3 color = mix(uCenterColor, uOuterColor, vT);

        // Iridescent shimmer
        float irid = sin(vT * 15.0 + uTime * 1.2) * 0.12;
        irid += cos(vT * 10.0 - uTime * 0.6) * 0.08;
        color += vec3(irid * 0.4, irid * 0.2, irid * 0.6);

        // Transmission simulation
        float trans = 0.5 + 0.5 * sin(vT * 8.0 + uTime * 1.8);
        color *= trans;

        // Edge glow
        float fresnel = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), 2.0);
        color += vec3(0.85, 0.9, 1.0) * fresnel * 0.25;

        // Width taper
        float taper = smoothstep(0.0, 0.25, vT) * smoothstep(1.0, 0.6, vT);
        color *= (0.4 + 0.6 * taper);

        gl_FragColor = vec4(color, 0.75);
      }
    `,
  });

  const tube = new THREE.Mesh(tubeGeo, crystalMat);
  scene.add(tube);
});

// ======== Star Field ========
const STAR_N = 3000;
const sPos = new Float32Array(STAR_N * 3);
const sSizes = new Float32Array(STAR_N);
for (let i = 0; i < STAR_N; i++) {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  const r = 10 + Math.random() * 25;
  sPos[i*3] = Math.sin(phi) * Math.cos(theta) * r;
  sPos[i*3+1] = Math.sin(phi) * Math.sin(theta) * r;
  sPos[i*3+2] = Math.cos(phi) * r;
  sSizes[i] = 0.3 + Math.random() * 1.2;
}
const sGeo = new THREE.BufferGeometry();
sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
const sMat = new THREE.PointsMaterial({
  size: 0.035, sizeAttenuation: true, transparent: true,
  opacity: 0.3, color: 0xffffff, blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const stars = new THREE.Points(sGeo, sMat);
scene.add(stars);

// ======== Lighting ========
const ambient = new THREE.AmbientLight(0x333344, 0.3);
scene.add(ambient);

const dirLight = new THREE.DirectionalLight(0xfff5ee, 1.2);
dirLight.position.set(5, 2, 3);
scene.add(dirLight);

const fillLight = new THREE.DirectionalLight(0xe8e0d8, 0.4);
fillLight.position.set(-3, -1, 2);
scene.add(fillLight);

// Crystal glow point lights
const crystalLight1 = new THREE.PointLight(0x3a1c7a, 0.8, 5);
crystalLight1.position.set(0, 0.3, 0);
scene.add(crystalLight1);

const crystalLight2 = new THREE.PointLight(0x22ddcc, 0.4, 4);
crystalLight2.position.set(0.5, -0.2, 0.5);
scene.add(crystalLight2);

// ======== Resize ========
window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
});

// ======== Mouse Parallax ========
let mx = 0, my = 0, tx = 0, ty = 0;
window.addEventListener('mousemove', (e) => {
  mx = (e.clientX / window.innerWidth - 0.5) * 2;
  my = (e.clientY / window.innerHeight - 0.5) * 2;
});

// ======== Scroll → Rotation ========
const state = { rot: 0 };
gsap.timeline({
  scrollTrigger: { trigger: 'body', start: 'top top', end: 'bottom bottom', scrub: 1.2 },
})
.to(state, { rot: Math.PI * 2, ease: 'none' }, 0);

// ======== Animation Loop ========
const clock = new THREE.Clock();

function tick() {
  const t = clock.getElapsedTime();

  tx += (mx - tx) * 0.04;
  ty += (my - ty) * 0.04;

  // Gentle idle rotation
  sphere.rotation.y = t * 0.03;
  sphere.rotation.x = ty * 0.05;

  // Scroll rotation
  sphere.rotation.y += (state.rot - sphere.rotation.y) * 0.03;

  // Update crystal uniforms
  scene.traverse((obj) => {
    if (obj.material && obj.material.uniforms && obj.material.uniforms.uTime) {
      obj.material.uniforms.uTime.value = t;
    }
  });

  // Star drift
  stars.rotation.y = t * 0.003;
  stars.rotation.x = Math.sin(t * 0.002) * 0.008;

  // Crystal light pulse
  crystalLight1.intensity = 0.6 + Math.sin(t * 0.5) * 0.3;
  crystalLight2.intensity = 0.3 + Math.sin(t * 0.7 + 1.0) * 0.2;

  composer.render();
  requestAnimationFrame(tick);
}
tick();

// ======== Exports ========
export function updateScrollProgress(p) {}

export function setTrigger(v) {
  bloom.strength = 0.5 + v * 0.4;
  crystalLight1.intensity = 0.8 + v * 0.6;
}
