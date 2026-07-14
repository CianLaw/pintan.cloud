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
    varying vec3 vN; varying vec3 vP; varying vec3 vV; varying float vD;
    float h(vec3 p) { p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
    float n(vec3 p) {
      vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
      return mix(mix(mix(h(i+vec3(0,0,0)),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z);
    }
    float f(vec3 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p*=2.;a*=.5;}return v;}
    float vo(vec3 p) {
      vec3 i=floor(p),fr=fract(p);float md=1.;
      for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)for(int z=-1;z<=1;z++){vec3 c=vec3(float(x),float(y),float(z));md=min(md,length(fr-(c+h(i+c))));}
      return md;
    }
    float cr(vec3 p){
      float c1=1.-smoothstep(0.,.18,vo(p*5.));
      float c2=(1.-smoothstep(0.,.07,vo(p*10.+30.)))*.4;
      float c3=(1.-smoothstep(0.,.28,vo(p*2.5+15.)))*.2;
      return smoothstep(.12,.55,max(max(c1,c2),c3)*(.5+f(p*8.+50.)*.5));
    }
    void main() {
      vec3 p=position;float crack=cr(p),ter=f(p*2.5);float d=crack*.055+ter*.006;
      vec3 dp=p-normal*d;
      vN=normalize(normalMatrix*normal);vP=dp;vD=d;
      vec4 mv=modelViewMatrix*vec4(dp,1.);vV=normalize(-mv.xyz);
      gl_Position=projectionMatrix*mv;
    }
  `,
  fragmentShader: `
    uniform float uTime; uniform float uGlow;
    varying vec3 vN; varying vec3 vP; varying vec3 vV; varying float vD;
    float h(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
    float n(vec3 p) {
      vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
      return mix(mix(mix(h(i+vec3(0,0,0)),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z);
    }
    float f(vec3 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p*=2.;a*=.5;}return v;}
    float vo(vec3 p){
      vec3 i=floor(p),fr=fract(p);float md=1.;
      for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)for(int z=-1;z<=1;z++){vec3 c=vec3(float(x),float(y),float(z));md=min(md,length(fr-(c+h(i+c))));}
      return md;
    }
    float cr(vec3 p){
      float c1=1.-smoothstep(0.,.18,vo(p*5.));
      float c2=(1.-smoothstep(0.,.07,vo(p*10.+30.)))*.4;
      float c3=(1.-smoothstep(0.,.28,vo(p*2.5+15.)))*.2;
      return smoothstep(.12,.55,max(max(c1,c2),c3)*(.5+f(p*8.+50.)*.5));
    }
    vec3 rb(float t){return vec3(sin(t*6.283)*.5+.5,sin(t*6.283+2.094)*.5+.5,sin(t*6.283+4.189)*.5+.5);}
    void main() {
      vec3 N=normalize(vN),V=normalize(vV),P=vP;
      float crack=cr(P),ter=f(P*2.5);
      vec3 c1=vec3(.30,.26,.22),c2=vec3(.20,.17,.14),c3=vec3(.13,.11,.09);
      vec3 col=mix(c1,c2,ter);col=mix(col,c3,smoothstep(.3,.7,f(P*5.+10.))*.4);
      col+=(f(P*12.+100.)-.5)*.03;

      float phase=dot(P,vec3(.4,.3,.6))+uTime*.06;
      vec3 glow=rb(phase)*crack*uGlow*(sin(uTime*.3+crack*3.)*.15+.85);
      glow+=rb(phase+.5)*smoothstep(0.,.12,vD)*crack*.25;

      col=mix(col,glow,crack*.85);col+=glow*.5;

      vec3 L=normalize(vec3(2.,1.,3.));
      float diff=max(dot(N,L),0.)*.5+.5;
      col*=.3+diff*.7;

      float ws=sin(dot(P,vec3(1.,.5,.3))*30.+crack*5.)*.5+.5;
      col-=crack*.12*(1.-ws);

      float fr=pow(1.-max(dot(N,V),0.),3.);
      col+=vec3(.12,.08,.2)*fr*.35;
      col+=vec3(.25,.15,.4)*pow(1.-max(dot(N,V),0.),5.)*.06;

      gl_FragColor=vec4(col,1.);
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
