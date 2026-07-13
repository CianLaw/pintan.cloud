const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');

if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    navLinks.classList.toggle('open');
  });
  document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
    });
  });
}

function setupScrollReveal() {
  const elements = document.querySelectorAll('.reveal, .fade-in, .reveal-left, .reveal-right, .reveal-scale');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -60px 0px'
  });

  elements.forEach(el => observer.observe(el));
}

document.querySelectorAll('.faq-item').forEach(item => {
  item.addEventListener('click', () => {
    const currentlyOpen = document.querySelector('.faq-item.open');
    if (currentlyOpen && currentlyOpen !== item) {
      currentlyOpen.classList.remove('open');
    }
    item.classList.toggle('open');
  });
});

function smoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', e => {
      e.preventDefault();
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

function initNavScroll() {
  let lastScroll = 0;
  const nav = document.querySelector('.nav');
  const overlay = document.getElementById('three-overlay');
  const canvas = document.getElementById('three-canvas');

  window.addEventListener('scroll', () => {
    const currentScroll = window.scrollY;
    const vh = window.innerHeight;

    if (overlay) {
      const pct = Math.min(currentScroll / vh, 1);
      overlay.style.opacity = pct;
      if (canvas) canvas.style.opacity = Math.max(0, 1 - pct * 2);
    }

    if (currentScroll > lastScroll && currentScroll > 100) {
      nav.style.top = '-80px';
    } else {
      nav.style.top = '16px';
    }
    lastScroll = currentScroll;
  }, { passive: true });
}

setupScrollReveal();
smoothScroll();
initNavScroll();
