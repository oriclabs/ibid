// Help page — back to top, sidebar tracking, mobile TOC

// Back to top
const btnTop = document.getElementById('btn-top');
window.addEventListener('scroll', () => {
  btnTop.classList.toggle('hidden', window.scrollY < 300);
  btnTop.classList.toggle('flex', window.scrollY >= 300);
});
btnTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

// Active sidebar link tracking
const sections = document.querySelectorAll('section[id]');
const links = document.querySelectorAll('.sidebar-link');
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      links.forEach((link) => link.classList.remove('active'));
      const active = document.querySelector(`.sidebar-link[href="#${entry.target.id}"]`);
      if (active) active.classList.add('active');
    }
  });
}, { rootMargin: '-20% 0px -70% 0px' });
sections.forEach((s) => observer.observe(s));

// Mobile TOC toggle
document.getElementById('toc-toggle').addEventListener('click', () => {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('hidden');
  sidebar.classList.toggle('fixed');
  sidebar.classList.toggle('left-0');
  sidebar.classList.toggle('top-14');
  sidebar.classList.toggle('bg-white');
  sidebar.classList.toggle('dark:bg-zinc-900');
  sidebar.classList.toggle('z-50');
  sidebar.classList.toggle('border-r');
  sidebar.classList.toggle('border-zinc-200');
  sidebar.classList.toggle('shadow-lg');
});

// Browser detection — show/hide Chrome/Firefox-specific content
const isFirefox = typeof browser !== 'undefined' || navigator.userAgent.includes('Firefox');
document.querySelectorAll('.ibid-chrome-only').forEach(el => el.classList.toggle('hidden', isFirefox));
document.querySelectorAll('.ibid-firefox-only').forEach(el => el.classList.toggle('hidden', !isFirefox));
