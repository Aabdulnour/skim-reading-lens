'use strict';
(() => {
  const button = document.getElementById('check-compatibility');
  const status = document.getElementById('check-status');
  const result = document.getElementById('check-result');
  const heading = document.getElementById('result-heading');
  const message = document.getElementById('result-message');
  const next = document.getElementById('webcam-next');
  const nextNote = document.getElementById('webcam-next-note');
  const progressMessages = {
    checking: 'Checking what this browser supports. Your camera is off.',
    loading: 'Loading tracking files from this site. This may take a moment.',
    model: 'Trying the tracking software. Your camera is still off.'
  };
  const resultMessages = {
    ready: 'The tracking files started successfully in this browser. Camera access, calibration, and accuracy still need to be checked in the lab.',
    insecure_context: 'Open Skim using its secure website address or a local development server, then try again. Pointer mode remains available.',
    unsupported_graphics: 'The camera experiment needs a graphics feature this browser has not made available. You can still read with your pointer.',
    unsupported_wasm: 'This browser cannot run the tracking software it needs. Try an updated desktop Chrome browser, or use pointer mode.',
    model_failed: 'The tracking files could not start in this browser. Reload this page and try again, or keep reading with your pointer.',
    timeout: 'The setup check took too long. Try again when your connection is ready. Pointer mode remains available.',
    busy: 'A previous check or camera session is still finishing. Wait a moment and try again. If it stays busy, reload this page.'
  };
  let running = false;
  let generation = 0;

  button.addEventListener('click', async () => {
    if (running) return;
    running = true;
    const attempt = ++generation;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.textContent = 'Checking…';
    result.hidden = true;
    next.hidden = true;
    nextNote.hidden = true;
    status.textContent = 'Starting the setup check. Your camera is off.';

    try {
      if (typeof window.SkimGaze?.checkCompatibility !== 'function') {
        throw new Error('Compatibility check unavailable');
      }
      const outcome = await window.SkimGaze.checkCompatibility({
        onProgress(progress) {
          if (running && attempt === generation && progressMessages[progress?.stage]) {
            status.textContent = progressMessages[progress.stage];
          }
        }
      });
      const ready = outcome?.ok === true && outcome.code === 'ready';
      heading.textContent = ready ? 'This browser passed the setup check.' : 'Webcam mode is not ready here.';
      message.textContent = resultMessages[outcome?.code] || 'The setup check could not finish. Try again, or keep reading with your pointer.';
      next.hidden = !ready;
      nextNote.hidden = !ready;
      status.textContent = ready
        ? 'Setup check passed. Your camera stayed off. Accuracy still needs to be checked in the lab.'
        : 'Setup check finished. Your camera stayed off. You can still use pointer mode.';
      result.hidden = false;
    } catch (_) {
      heading.textContent = 'The setup check could not finish.';
      message.textContent = 'Reload this page and try again. You can use the reading lab with your pointer while the camera experiment is unavailable.';
      status.textContent = 'No compatibility result was recorded. Your camera stayed off.';
      result.hidden = false;
    } finally {
      running = false;
      button.disabled = false;
      button.removeAttribute('aria-busy');
      button.textContent = 'Check again';
    }
  });
})();
