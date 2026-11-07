'use strict';
const practiceButton = document.getElementById('practice');
const practiceStatus = document.getElementById('practice-status');
document.addEventListener('skim-lens-state', event => {
  if (event.detail?.active === false) {
    practiceButton.firstChild.textContent = 'Start the practice lens ';
    practiceStatus.textContent = 'Stopped. Start again whenever you like.';
  }
});
practiceButton.addEventListener('click', () => {
  if (globalThis.__skimPointerOverlay) {
    globalThis.__skimPointerOverlay.destroy();
    practiceButton.firstChild.textContent = 'Start the practice lens ';
    practiceStatus.textContent = 'Stopped. Start again whenever you like.';
    return;
  }
  practiceButton.disabled = true;
  const script = document.createElement('script');
  script.src = 'overlay.js';
  script.addEventListener('load', async () => {
    try {
      if (globalThis.__skimPointerStarting) await globalThis.__skimPointerStarting;
      if (globalThis.__skimPointerOverlay) {
        practiceButton.firstChild.textContent = 'Toggle practice lens ';
        practiceStatus.textContent = 'The dock is at the top. Hover over a practice paragraph below.';
        document.querySelector('.practice').scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start'});
      } else {
        practiceStatus.textContent = 'If Skim is paused, resume it in Settings. A recent Chrome browser is required.';
      }
    } finally { practiceButton.disabled = false; script.remove(); }
  });
  script.addEventListener('error', () => {
    practiceStatus.textContent = 'The practice lens could not load. Reinstall Skim or open Help.';
    practiceButton.disabled = false; script.remove();
  });
  document.head.append(script);
});
