import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

console.log('[three-scene] Cracked planet shader...');

gsap.registerPlugin(ScrollTrigger);

const canvas = document.querySelector('#three-canvas');
const W = window.innerWidth, H = window.innerHeight;
const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 100);
camera.position.set(0, 0.1, 8);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
renderer.setSize(W, H);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 3));
renderer.setClearColor(0x000000, 1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.7;

const scene = new THREE.Scene();
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.9, 0.35, 0.12);
composer.addPass(bloom);

// ======== Star Field ========
(function() {
  const N = 4000; const p = new Float32Array(N*3);
  for (let i = 0; i < N; i++) {
    const t = Math.random()*Math.PI*2, ph = Math.acos(2*Math.random()-1), r = 12+Math.random()*30;
    p[i*3]=Math.sin(ph)*Math.cos(t)*r; p[i*3+1]=Math.sin(ph)*Math.sin(t)*r; p[i*3+2]=Math.cos(ph)*r;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const m = new THREE.PointsMaterial({size:.03,sizeAttenuation:true,transparent:true,opacity:.3,color:0xffffff,blending:THREE.AdditiveBlending,depthWrite:false});
  scene.add(new THREE.Points(g, m));
})();

// ======== Cracked Planet ========
const planetMat = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uGlow: { value: 1.2 } },
  vertexShader: `
    varying vec3 vN; varying vec3 vP; varying vec3 vV; varying float vD; varying float vCrack;
    float h(vec3 p) { p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
    float n(vec3 p) {
      vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
      return mix(mix(mix(h(i+vec3(0,0,0)),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z);
    }
    float fbm(vec3 p){float v=0.,a=.5;for(int i=0;i<6;i++){v+=a*n(p);p*=2.1;a*=.48;}return v;}
    float voronoi(vec3 p) {
      vec3 i=floor(p),fr=fract(p);float md=1.;
      for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)for(int z=-1;z<=1;z++){vec3 c=vec3(float(x),float(y),float(z));md=min(md,length(fr-(c+h(i+c))));}
      return md;
    }
    float crackMap(vec3 p) {
      // Layer 1: massive tectonic fractures (large cells)
      float vo1 = voronoi(p * 1.8 + vec3(7.3, 3.1, 2.5));
      float c1 = 1.0 - smoothstep(0.0, 0.35, vo1);
      // Layer 2: medium fracture network
      float vo2 = voronoi(p * 4.5 + vec3(11.7, 5.3, 8.9));
      float c2 = (1.0 - smoothstep(0.0, 0.12, vo2)) * 0.6;
      // Layer 3: fine crack web
      float vo3 = voronoi(p * 12.0 + vec3(3.7, 9.1, 14.2));
      float c3 = (1.0 - smoothstep(0.0, 0.04, vo3)) * 0.35;
      // Combine with noise perturbation
      float np = fbm(p * 6.0 + 20.0);
      float crack = max(max(c1, c2), c3) * (0.4 + np * 0.6);
      return smoothstep(0.1, 0.7, crack);
    }
    void main() {
      vec3 p = position;
      float crack = crackMap(p);
      float terrain = fbm(p * 3.0);
      float crater = 1.0 - smoothstep(0.35, 0.65, fbm(p * 8.0 + 50.0));
      // Deep displacement along cracks (up to 0.12 units)
      float disp = crack * 0.10 + terrain * 0.015 - crater * 0.04;
      vec3 dp = p - normal * disp;
      vN = normalize(normalMatrix * normal);
      vP = dp;
      vD = disp;
      vCrack = crack;
      vec4 mv = modelViewMatrix * vec4(dp, 1.0);
      vV = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }
  `,
  fragmentShader: `
    uniform float uTime; uniform float uGlow;
    varying vec3 vN; varying vec3 vP; varying vec3 vV; varying float vD; varying float vCrack;
    float h(vec3 p) { p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
    float n(vec3 p) {
      vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
      return mix(mix(mix(h(i+vec3(0,0,0)),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z);
    }
    float fbm(vec3 p){float v=0.,a=.5;for(int i=0;i<6;i++){v+=a*n(p);p*=2.1;a*=.48;}return v;}
    float voronoi(vec3 p) {
      vec3 i=floor(p),fr=fract(p);float md=1.;
      for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)for(int z=-1;z<=1;z++){vec3 c=vec3(float(x),float(y),float(z));md=min(md,length(fr-(c+h(i+c))));}
      return md;
    }
    float crackMap(vec3 p) {
      float vo1 = voronoi(p * 1.8 + vec3(7.3, 3.1, 2.5));
      float c1 = 1.0 - smoothstep(0.0, 0.35, vo1);
      float vo2 = voronoi(p * 4.5 + vec3(11.7, 5.3, 8.9));
      float c2 = (1.0 - smoothstep(0.0, 0.12, vo2)) * 0.6;
      float vo3 = voronoi(p * 12.0 + vec3(3.7, 9.1, 14.2));
      float c3 = (1.0 - smoothstep(0.0, 0.04, vo3)) * 0.35;
      float np = fbm(p * 6.0 + 20.0);
      float crack = max(max(c1, c2), c3) * (0.4 + np * 0.6);
      return smoothstep(0.1, 0.7, crack);
    }
    // HSL to RGB for proper rainbow colors
    vec3 hsl2rgb(float h, float s, float l) {
      vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
      return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
    }
    void main() {
      vec3 N = normalize(vN), V = normalize(vV), P = vP;
      float crack = crackMap(P);

      // ===== DEAD PLANET SURFACE =====
      float terrain = fbm(P * 3.0);
      float detail = fbm(P * 10.0 + 30.0);
      float crater = 1.0 - smoothstep(0.35, 0.65, fbm(P * 8.0 + 50.0));
      float ridge = abs(fbm(P * 5.0 + 70.0) - 0.5) * 2.0;

      // Base dark dead-rock colors
      vec3 darkRock = vec3(0.12, 0.10, 0.08);
      vec3 midRock = vec3(0.22, 0.19, 0.15);
      vec3 lightRock = vec3(0.30, 0.26, 0.21);
      vec3 col = mix(darkRock, midRock, terrain);
      col = mix(col, lightRock, ridge * 0.3);
      col = mix(col, darkRock * 0.7, crater * 0.5);
      col += (detail - 0.5) * 0.02;

      // Crack wall darkening (one side shadowed)
      float wallShade = sin(P.x * 15.0 + P.y * 12.0 + P.z * 8.0) * 0.5 + 0.5;
      col *= 1.0 - crack * 0.3 * (1.0 - wallShade);

      // ===== RAINBOW GLOW INSIDE CRACKS =====
      float crackDepth = smoothstep(0.0, 0.12, vD);
      float crackWidth = smoothstep(0.0, 0.5, crack);
      float crackCore = smoothstep(0.3, 0.8, crack);

      // Position-based hue with time cycling
      float hue = dot(P, vec3(0.5, 0.3, 0.7)) * 0.3 + uTime * 0.04;
      // Multiple hue layers for richness
      float hue1 = hue;
      float hue2 = hue + 0.33;
      float hue3 = hue + 0.66;

      // Bright rainbow colors
      vec3 rainbow1 = hsl2rgb(hue1, 0.9, 0.55);
      vec3 rainbow2 = hsl2rgb(hue2, 0.85, 0.50);
      vec3 rainbow3 = hsl2rgb(hue3, 0.9, 0.60);

      // Layered rainbow glow
      vec3 glow = rainbow1 * crackCore * 0.8;
      glow += rainbow2 * crackWidth * 0.4;
      glow += rainbow3 * crackDepth * 0.3;

      // Pulse animation
      float pulse = sin(uTime * 0.5 + crack * 8.0) * 0.2 + 0.8;
      glow *= pulse * uGlow;

      // Inner bright core of cracks
      float coreGlow = smoothstep(0.5, 1.0, crack) * smoothstep(0.0, 0.08, vD);
      vec3 coreColor = hsl2rgb(hue + uTime * 0.06, 1.0, 0.7);
      glow += coreColor * coreGlow * 0.6;

      // ===== COMBINE =====
      col = mix(col, glow, crack * 0.92);
      col += glow * 0.4; // Additive glow for bloom

      // ===== LIGHTING =====
      vec3 L = normalize(vec3(2.0, 1.0, 3.0));
      float diff = max(dot(N, L), 0.0) * 0.4 + 0.6;
      col *= diff;

      // Dim the surface but keep cracks bright (they glow regardless of light)
      col = mix(col * 0.5, col, crack * 0.3);

      // ===== EDGE ATMOSPHERE =====
      float fresnel = pow(1.0 - max(dot(N, V), 0.0), 4.0);
      col += vec3(0.08, 0.05, 0.12) * fresnel * 0.25;

      // ===== CRACK SPECULAR SPARKLE =====
      float sparkle = pow(max(dot(N, L), 0.0), 20.0) * crack * 0.15;
      col += vec3(0.6, 0.4, 0.8) * sparkle;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
  side: THREE.DoubleSide,
});

const planet = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 96), planetMat);
scene.add(planet);

// Lights
scene.add(new THREE.AmbientLight(0x222233, 0.3));
const dl = new THREE.DirectionalLight(0xfff5ee, 1.5); dl.position.set(3,2,4); scene.add(dl);
const rl = new THREE.DirectionalLight(0x443366, 0.6); rl.position.set(-2,-1,-3); scene.add(rl);

// ======== Interaction ========
window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w/h; camera.updateProjectionMatrix();
  renderer.setSize(w,h); composer.setSize(w,h);
});

let mx=0,my=0,tx=0,ty=0;
window.addEventListener('mousemove', e => { mx=(e.clientX/W-.5)*2; my=(e.clientY/H-.5)*2; });

const state = { rot: 0 };
gsap.timeline({scrollTrigger:{trigger:'body',start:'top top',end:'bottom bottom',scrub:1.2}})
  .to(state, { rot: Math.PI * 3, ease: 'none' }, 0);

const clock = new THREE.Clock();
function tick() {
  const t = clock.getElapsedTime();
  tx += (mx-tx)*.04; ty += (my-ty)*.04;
  planet.rotation.y += (state.rot - planet.rotation.y)*.03;
  planet.rotation.x = ty*.04;
  planetMat.uniforms.uTime.value = t;
  scene.children.forEach(c => { if(c.isPoints) { c.rotation.y=t*.003; c.rotation.x=Math.sin(t*.002)*.008; } });
  composer.render();
  requestAnimationFrame(tick);
}
tick();

export function updateScrollProgress(p) {}
export function setTrigger(v) {
  planetMat.uniforms.uGlow.value = 1.2 + v * .6;
  bloom.strength = .9 + v * .4;
}
