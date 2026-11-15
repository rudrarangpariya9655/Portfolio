const crayons = ['#2f6ed6', '#f0603e', '#f3b418', '#4f9d55', '#8a5cc4', '#ec6c9d', '#22a79c', '#f18b2c'];
const finePointer = window.matchMedia('(pointer: fine)');
const stillMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const motionOff = () => document.body.classList.contains('motion-paused') || stillMotion.matches;
const pick = () => crayons[Math.floor(Math.random() * crayons.length)];

/* ── the headline rises word by word ──────────────────────────────────── */
const headline = document.querySelector('.hero h1');
if (headline) {
  let index = 0;
  const stagger = node => {
    const word = document.createElement('span');
    word.className = 'word';
    word.style.animationDelay = `${0.25 + index++ * 0.07}s`;
    node.replaceWith(word);
    word.appendChild(node);
  };
  [...headline.childNodes].forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      const fragment = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach(chunk => {
        if (!chunk.trim()) { fragment.appendChild(document.createTextNode(chunk)); return; }
        const word = document.createElement('span');
        word.className = 'word';
        word.textContent = chunk;
        word.style.animationDelay = `${0.25 + index++ * 0.07}s`;
        fragment.appendChild(word);
      });
      node.replaceWith(fragment);
    } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName !== 'BR') {
      stagger(node);
    }
  });
}

/* ── the doodle drifts as you scroll ──────────────────────────────────── */
const heroArt = document.querySelector('.hero-art');
function driftDoodle() {
  if (!heroArt) return;
  if (motionOff()) { heroArt.style.translate = ''; return; }
  heroArt.style.translate = `0 ${Math.min(window.scrollY, 700) * -0.06}px`;
}

/* ── each seam gets cut and taped down as it comes into view ──────────── */
/* the seams only start hidden once this class is on, so with no JS at all the
   page still renders every sheet taped down rather than blank */
document.body.classList.add('seams-armed');
let pendingSeams = [...document.querySelectorAll('.seam')];

function tapeDownSeams() {
  if (!pendingSeams.length) return;
  const line = window.innerHeight * 0.86;
  pendingSeams = pendingSeams.filter(seam => {
    if (seam.getBoundingClientRect().top > line) return true;
    seam.classList.add('is-stuck');
    return false;
  });
}

let frameQueued = false;
function onScroll() {
  frameQueued = false;
  driftDoodle();
  tapeDownSeams();
}
window.addEventListener('scroll', () => {
  if (!frameQueued) { frameQueued = true; requestAnimationFrame(onScroll); }
}, { passive: true });
window.addEventListener('resize', onScroll);
onScroll();

/* ── project cards tilt toward the cursor ─────────────────────────────── */
document.querySelectorAll('.project').forEach(card => {
  const visual = card.querySelector('.project-visual');
  if (!visual) return;
  const reset = () => { visual.style.removeProperty('--rx'); visual.style.removeProperty('--ry'); };
  card.addEventListener('pointermove', event => {
    if (motionOff() || event.pointerType !== 'mouse') return;
    const box = visual.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width - 0.5;
    const y = (event.clientY - box.top) / box.height - 0.5;
    visual.style.setProperty('--ry', `${x * 13}deg`);
    visual.style.setProperty('--rx', `${y * -11}deg`);
  });
  card.addEventListener('pointerleave', reset);
  card.addEventListener('blur', reset, true);
});

/* ── a crayon trail follows the cursor ────────────────────────────────── */
const trailLayer = document.createElement('div');
trailLayer.className = 'trail-layer';
trailLayer.setAttribute('aria-hidden', 'true');
document.body.appendChild(trailLayer);

let lastDot = 0;
if (finePointer.matches) {
  window.addEventListener('pointermove', event => {
    if (motionOff() || event.pointerType !== 'mouse') return;
    const now = performance.now();
    if (now - lastDot < 45) return;
    lastDot = now;
    const dot = document.createElement('span');
    dot.className = 'trail-dot';
    dot.style.cssText = `left:${event.clientX}px;top:${event.clientY}px;background:${pick()}`;
    trailLayer.appendChild(dot);
    dot.addEventListener('animationend', () => dot.remove());
  }, { passive: true });
}

/* ── confetti, because why not ────────────────────────────────────────── */
const confettiLayer = document.createElement('div');
confettiLayer.className = 'confetti-layer';
confettiLayer.setAttribute('aria-hidden', 'true');
document.body.appendChild(confettiLayer);

function burst(x, y, count = 22) {
  if (motionOff()) return;
  for (let i = 0; i < count; i++) {
    const bit = document.createElement('span');
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const distance = 70 + Math.random() * 120;
    bit.className = 'confetti-bit';
    bit.style.cssText = `left:${x}px;top:${y}px;background:${pick()};` +
      `--dx:${Math.cos(angle) * distance}px;--dy:${Math.sin(angle) * distance + 90}px;` +
      `--dr:${Math.round(Math.random() * 720 - 360)}deg;--dur:${0.9 + Math.random() * 0.6}s`;
    confettiLayer.appendChild(bit);
    bit.addEventListener('animationend', () => bit.remove());
  }
}

function burstFrom(element, count) {
  const box = element.getBoundingClientRect();
  burst(box.left + box.width / 2, box.top + box.height / 2, count);
}

document.querySelectorAll('.button').forEach(button => {
  button.addEventListener('click', () => burstFrom(button, 26));
});
const sticker = document.querySelector('.about-sticker');
if (sticker) sticker.addEventListener('click', () => burstFrom(sticker, 32));
document.querySelectorAll('.tools > div').forEach(tool => {
  tool.addEventListener('click', () => burstFrom(tool.querySelector('span') || tool, 14));
});

/* pausing motion hides the layers, and paused sprites never fire animationend,
   so sweep them up as soon as the toggle flips */
new MutationObserver(() => {
  if (!document.body.classList.contains('motion-paused')) return;
  trailLayer.replaceChildren();
  confettiLayer.replaceChildren();
}).observe(document.body, { attributes: true, attributeFilter: ['class'] });

/* ── the marquee doubles itself so the loop is seamless ───────────────── */
const track = document.querySelector('.marquee-track');
if (track && track.children.length === 1) {
  track.appendChild(track.firstElementChild.cloneNode(true));
}
