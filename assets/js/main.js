import { updateScrollProgress, setTrigger } from './three-scene.js';

const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');

if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => navLinks.classList.toggle('open'));
  document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', () => navLinks.classList.remove('open'));
  });
}

document.querySelectorAll('.faq-item').forEach(item => {
  item.addEventListener('click', () => {
    const open = document.querySelector('.faq-item.open');
    if (open && open !== item) open.classList.remove('open');
    item.classList.toggle('open');
  });
});

let lastScroll = 0;
const nav = document.querySelector('.nav');
const overlay = document.getElementById('three-overlay');
const canvas = document.getElementById('three-canvas');
const progressBar = document.getElementById('scrollProgressBar');
const scrollIndicator = document.getElementById('scrollIndicator');

gsap.registerPlugin(ScrollTrigger);

const contentSections = document.querySelectorAll('.section');
if (contentSections.length > 0) {
  const first = contentSections[0];
  const last = contentSections[contentSections.length - 1];
  ScrollTrigger.create({
    trigger: first,
    start: 'top bottom',
    end: () => last.offsetTop + last.offsetHeight - window.innerHeight * 0.3,
    onUpdate: self => {
      const p = Math.min(self.progress, 1);
      updateScrollProgress(p);
      if (overlay) overlay.style.opacity = Math.min(p * 2, 1);
      if (canvas) canvas.style.opacity = Math.max(0, 1 - p * 3);
      if (progressBar) progressBar.style.height = `${p * 100}%`;
      if (scrollIndicator) {
        scrollIndicator.style.opacity = p > 0.05 ? '0' : '1';
        scrollIndicator.style.pointerEvents = p > 0.05 ? 'none' : 'auto';
      }
    },
  });
}

const sectionElements = document.querySelectorAll('.section');
sectionElements.forEach(section => {
  const items = section.querySelectorAll(
    '.about-text, .about-desc p, .stat-item, .portfolio-item, .blog-card, .faq-item, .section-label, .portfolio-title, .portfolio-header .btn'
  );
  if (items.length === 0) return;
  gsap.from(items, {
    scrollTrigger: {
      trigger: section,
      start: 'top 85%',
      toggleActions: 'play none none none',
    },
    y: 50,
    opacity: 0,
    duration: 0.7,
    stagger: 0.08,
    ease: 'back.out(1.6)',
    overwrite: 'auto',
  });
});

const workSection = document.getElementById('work');
if (workSection) {
  ScrollTrigger.create({
    trigger: workSection,
    start: 'top center',
    end: 'center center',
    onUpdate: self => {
      setTrigger(Math.min(self.progress * 2, 1));
    },
    onLeave: () => setTrigger(1),
    onEnterBack: () => {},
  });
}

window.addEventListener('scroll', () => {
  const currentScroll = window.scrollY;
  if (currentScroll > lastScroll && currentScroll > 100) {
    nav.style.top = '-80px';
  } else {
    nav.style.top = '16px';
  }
  lastScroll = currentScroll;
}, { passive: true });

// ======== Planet Destruction Sequence ========
const planetStages = document.querySelectorAll('.planet-stage');
const phaseNum = document.getElementById('phaseNum');
const phaseBar = document.getElementById('phaseBar');
const roman = ['I','II','III','IV','V'];

if (planetStages.length > 0) {
  ScrollTrigger.create({
    trigger: '#planet-sequence',
    start: 'top top',
    end: 'bottom bottom',
    scrub: 0.8,
    onUpdate: ({ progress }) => {
      const total = planetStages.length;
      const idxFloat = progress * (total - 1);
      const current = Math.min(Math.floor(idxFloat), total - 1);
      const next = Math.min(current + 1, total - 1);
      const t = idxFloat - current;

      planetStages.forEach((s, i) => {
        if (i === current) {
          s.style.opacity = '1';
          s.style.transform = 'scale(1)';
        } else if (i === next) {
          s.style.opacity = String(t);
          s.style.transform = `scale(${1 - t * 0.06})`;
        } else {
          s.style.opacity = '0';
          s.style.transform = 'scale(1.05)';
        }
      });

      if (phaseNum) phaseNum.textContent = roman[Math.round(idxFloat)] || 'V';
      if (phaseBar) phaseBar.style.width = `${progress * 100}%`;
    },
  });
}
