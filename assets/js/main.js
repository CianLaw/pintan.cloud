// ─── Mobile Navigation ───
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

// ─── Scroll Animations (Intersection Observer) ───
const animElements = document.querySelectorAll('.fade-in');

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, {
  threshold: 0.1,
  rootMargin: '0px 0px -50px 0px'
});

animElements.forEach(el => observer.observe(el));

// ─── FAQ Accordion ───
document.querySelectorAll('.faq-item').forEach(item => {
  item.addEventListener('click', () => {
    const currentlyOpen = document.querySelector('.faq-item.open');
    if (currentlyOpen && currentlyOpen !== item) {
      currentlyOpen.classList.remove('open');
    }
    item.classList.toggle('open');
  });
});

// ─── Smooth Reveal on Hero ───
document.addEventListener('DOMContentLoaded', () => {
  const heroElements = document.querySelectorAll('.hero .fade-in, .hero-tag, .hero-title, .hero-actions, .hero-scroll');
  heroElements.forEach((el, i) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    setTimeout(() => {
      el.style.transition = 'opacity 0.8s, transform 0.8s';
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    }, 200 + i * 150);
  });
});

// ─── Parallax hero background ───
const heroBg = document.querySelector('.hero-bg');
if (heroBg) {
  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    heroBg.style.transform = `translateY(${scrollY * 0.3}px)`;
  });
}
