const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const motionButton = document.getElementById('motion-toggle');
let motionPaused = reducedMotion.matches;
function updateMotion() {
  document.body.classList.toggle('motion-paused', motionPaused);
  motionButton.setAttribute('aria-pressed', String(motionPaused));
  motionButton.textContent = motionPaused ? 'Enable motion ▷' : 'Pause motion Ⅱ';
}
motionButton.addEventListener('click', () => { motionPaused = !motionPaused; updateMotion(); });
reducedMotion.addEventListener('change', event => { motionPaused = event.matches; updateMotion(); });
updateMotion();
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
    });
  }, { threshold: 0.08 });
  document.querySelectorAll('.section-heading, .project, .about-sticker, .about-copy, .tools > div, .contact').forEach(element => { element.classList.add('reveal'); observer.observe(element); });
}
const progress = document.querySelector('.reading-progress');
let scrollQueued = false;
function updateProgress() {
  const height = document.documentElement.scrollHeight - window.innerHeight;
  progress.style.transform = `scaleX(${height > 0 ? Math.min(1, window.scrollY / height) : 0})`;
  scrollQueued = false;
}
window.addEventListener('scroll', () => { if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(updateProgress); } }, { passive: true });
window.addEventListener('resize', updateProgress);
updateProgress();
