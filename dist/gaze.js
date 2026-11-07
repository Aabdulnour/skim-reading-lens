(function () {
  'use strict';

  // Keep the runtime and every MediaPipe asset together. Upstream's default
  // model path is relative to the document, not to the WebGazer script.
  // These pinned files are fetched from this site only after explicit consent.
  // The downloadable Manifest V3 extension still ships a pointer-only adapter.
  const VENDOR_BASE = new URL('vendor/webgazer-3.5.3/', document.currentScript?.src || location.href);
  const WEBGAZER_URL = new URL('webgazer.js', VENDOR_BASE).href;
  const MODEL_PATH = new URL('mediapipe/face_mesh/', VENDOR_BASE).href;
  const WEBGAZER_INTEGRITY = 'sha384-N9TfYQEjUGiaDcITkzB/MtVHEfF2JtTWCwHG8NUhjOSvJ8zObGwfebHUFLBS+4Rb';
  let loadingLibrary;
  let compatibilityOperation, cameraOwner;
  const cameraStarts = new Set();
  const cameraInitializations = new Set();

  function hasUsableWebGL() {
    let canvas, context;
    try {
      canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      // Match the pinned MediaPipe runtime's WebGL2, then WebGL fallback.
      // Probe before loading it so unsupported devices avoid its native alert.
      for (const kind of ['webgl2', 'webgl']) {
        try { context = canvas.getContext(kind, {}); } catch (_) {}
        if (context) break;
      }
      return Boolean(context && !context.isContextLost());
    } catch (_) {
      return false;
    } finally {
      try { context?.getExtension('WEBGL_lose_context')?.loseContext(); } catch (_) {}
      if (canvas) {
        canvas.width = canvas.height = 0;
        canvas.remove();
      }
    }
  }

  function loadLibrary() {
    if (window.webgazer) return Promise.resolve(window.webgazer);
    if (loadingLibrary) return loadingLibrary;
    loadingLibrary = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = WEBGAZER_URL;
      script.integrity = WEBGAZER_INTEGRITY;
      script.async = true;
      const fail = message => {
        clearTimeout(timer);
        script.onload = script.onerror = null;
        script.remove();
        reject(new Error(message));
      };
      const timer = setTimeout(() => fail('The eye tracking library did not load in time.'), 30000);
      script.onload = () => {
        clearTimeout(timer);
        script.onload = script.onerror = null;
        if (window.webgazer) resolve(window.webgazer);
        else fail('The eye tracking library was unavailable.');
      };
      script.onerror = () => fail('The eye tracking library could not be loaded. Check your connection, then try again.');
      document.head.append(script);
    }).catch(error => { loadingLibrary = null; throw error; });
    return loadingLibrary;
  }

  function checkCompatibility(options = {}) {
    const outcome = (ok, code, message) => ({ ok, code, message });
    if (compatibilityOperation) {
      return compatibilityOperation.expired
        ? Promise.resolve(outcome(false, 'busy', 'The previous model startup is still finishing. Wait a moment, or reload this page before trying again. The camera is off.'))
        : compatibilityOperation.result;
    }
    if (cameraOwner || cameraStarts.size || cameraInitializations.size) {
      return Promise.resolve(outcome(false, 'busy', 'Stop camera setup or tracking before running this separate compatibility check.'));
    }
    const operation = { expired: false, pending: false, result: null };
    compatibilityOperation = operation;
    const progress = (stage, message) => {
      try { options.onProgress?.({ stage, message }); } catch (_) {}
    };
    operation.result = (async () => {
      progress('checking', 'Checking browser support. The camera remains off.');
      if (!window.isSecureContext) {
        return outcome(false, 'insecure_context', 'Open Skim over HTTPS or localhost to use the webcam experiment. Pointer mode is available.');
      }
      if (!hasUsableWebGL()) {
        return outcome(false, 'unsupported_graphics', 'WebGL graphics support is unavailable in this browser. Pointer mode is ready; no camera or model download was started.');
      }
      if (typeof globalThis.WebAssembly?.compile !== 'function') {
        return outcome(false, 'unsupported_wasm', 'WebAssembly is unavailable in this browser. Pointer mode is ready; the camera remains off.');
      }
      let tracker, detector, deadline;
      const disposed = new Set();
      const dispose = () => {
        for (const model of [detector, tracker?.detector]) {
          if (!model || disposed.has(model)) continue;
          disposed.add(model);
          try { model.dispose?.(); } catch (_) {}
          if (tracker?.detector === model) {
            tracker.detector = null;
            tracker.predictionReady = false;
            tracker.positionsArray = null;
          }
        }
      };
      operation.pending = true;
      const startup = (async () => {
        try {
          progress('loading', 'Loading the local tracker files. The camera remains off.');
          const library = await loadLibrary();
          if (operation.expired) return;
          library.params.faceMeshSolutionPath = MODEL_PATH;
          library.saveDataAcrossSessions(false);
          tracker = library.getTracker();
          progress('model', 'Initializing the bundled face model. The camera remains off.');
          detector = await tracker.init();
          if (operation.expired) return;
          if (!detector || typeof detector.estimateFaces !== 'function') {
            throw new Error('The face model did not return a usable detector.');
          }
          return outcome(true, 'ready', 'The tracker and face model initialized successfully. No camera was opened. A real camera calibration is still needed to assess gaze accuracy.');
        } catch (error) {
          return outcome(false, 'model_failed', 'The face model could not initialize in this browser. Pointer mode is ready and the camera remains off. ' + (error?.message || 'Try again after checking your connection.'));
        } finally {
          dispose();
          operation.pending = false;
          if (operation.expired && compatibilityOperation === operation) compatibilityOperation = null;
        }
      })();
      try {
        return await Promise.race([
          startup,
          new Promise(resolve => {
            deadline = setTimeout(() => {
              operation.expired = true;
              dispose();
              resolve(outcome(false, 'timeout', 'The compatibility check took too long. The camera remains off. A model still finishing will be released when it settles; reload this page if retry stays busy.'));
            }, 45000);
          })
        ]);
      } finally { clearTimeout(deadline); }
    })().finally(() => {
      if (!operation.pending && compatibilityOperation === operation) compatibilityOperation = null;
    });
    return operation.result;
  }

  const median = values => {
    if (!values.length) return Infinity;
    const a = [...values].sort((a, b) => a - b);
    const i = Math.floor(a.length / 2);
    return a.length % 2 ? a[i] : (a[i - 1] + a[i]) / 2;
  };
  const percentile = (values, p) => {
    if (!values.length) return Infinity;
    const a = [...values].sort((a, b) => a - b);
    return a[Math.min(a.length - 1, Math.ceil(a.length * p) - 1)];
  };

  function create(options = {}) {
    const owner = {};
    let wg, host, root, state = 'off', generation = 0, pendingStart, pendingInitialization;
    let trainingIndex = 0, trainingClicks = 0, trainingPoints = [];
    let validationIndex = 0, validationPoints = [], validationResults = [];
    let capture, timer, lastClick = 0, viewport, limits;
    let previousFocus, lastPredictionAt = 0, monitoring;
    const streams = new Set();
    const status = (next, message, extra = {}) => {
      state = next;
      if (typeof options.onStatus === 'function') options.onStatus({ state: next, message, ...extra });
    };
    const find = selector => root && root.querySelector(selector);

    function removeOverlay() {
      if (host) host.remove();
      host = root = null;
      document.removeEventListener('keydown', onKey, true);
      if (previousFocus && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
      previousFocus = null;
    }

    function releaseCamera() {
      clearTimeout(timer);
      clearInterval(monitoring);
      capture = null;
      if (wg) {
        try { wg.pause(); } catch (_) {}
        try { wg.clearGazeListener(); } catch (_) {}
        try { wg.removeMouseEventListeners(); } catch (_) {}
      }
      // WebGazer.end() does not reliably stop tracks in its current release.
      const video = document.getElementById(wg?.params?.videoElementId || 'webgazerVideoFeed');
      if (video && video.srcObject) streams.add(video.srcObject);
      for (const stream of streams) {
        if (typeof stream.getTracks === 'function') {
          for (const track of stream.getTracks()) track.stop();
        }
      }
      streams.clear();
      if (cameraOwner === owner) cameraOwner = null;
      if (wg) {
        try { wg.end(); } catch (_) {}
        // setRegression preserves training data. Reset models directly so this
        // clears only in-memory data, without touching browser storage.
        try { for (const model of wg.getRegression()) model.init(); } catch (_) {}
      }
      for (const id of ['webgazerVideoContainer', 'webgazerGazeDot']) {
        const el = document.getElementById(id);
        if (el) el.remove();
      }
    }

    function stop() {
      generation++;
      releaseCamera();
      removeOverlay();
      status('stopped', 'Camera stopped. Pointer mode is ready.');
    }

    function onKey(event) {
      if (!host) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); stop(); }
      if (event.key !== 'Tab') return;
      const controls = [...root.querySelectorAll('button:not([disabled]),a[href]')].filter(el => el.offsetParent !== null);
      if (!controls.length) { event.preventDefault(); return; }
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && (root.activeElement === first || !root.activeElement)) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && (root.activeElement === last || !root.activeElement)) { event.preventDefault(); first.focus(); }
    }

    function overlay() {
      previousFocus = document.activeElement;
      host = document.createElement('div');
      host.id = 'skim-camera-setup';
      host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;isolation:isolate;';
      root = host.attachShadow({ mode: 'open' });
      root.innerHTML = `<style>
        :host{font-family:Inter,Arial,sans-serif;color:#142b25;font-size:16px;line-height:1.5}*{box-sizing:border-box}button,a{-webkit-tap-highlight-color:transparent}button{font:inherit;cursor:pointer}button:focus-visible,a:focus-visible{outline:3px solid #7461dc;outline-offset:4px}[hidden]{display:none!important}.veil{position:fixed;inset:0;background:rgba(19,39,33,.48);backdrop-filter:blur(6px);display:grid;place-items:center;padding:22px}.card{background:#faf9f4;border:1px solid #dadfd5;box-shadow:0 18px 90px #112b2530;border-radius:24px;width:min(550px,100%);max-height:92vh;overflow:auto;padding:30px}.eyebrow{font-size:11px;letter-spacing:.13em;font-weight:700;color:#597063}h2{font-size:27px;line-height:1.14;letter-spacing:-.03em;margin:14px 0}p{font-size:14px;color:#4d6359;margin:12px 0}.detail{background:#edf0e8;border-radius:12px;padding:12px 15px}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:22px}.primary,.secondary{border:1px solid #d5ddd0;border-radius:10px;padding:11px 16px;background:#f8f9f3;color:#223e32;font-weight:650;font-size:14px}.primary{background:#173f31;border-color:#173f31;color:white}.primary:disabled{opacity:.5;cursor:wait}.secondary{background:transparent}.subtle{font-size:12px;color:#697b70}.stage{position:fixed;inset:0;background:#faf9f4}.banner{position:absolute;top:12px;left:50%;transform:translateX(-50%);width:min(580px,calc(100% - 150px));text-align:center;pointer-events:none}.banner strong{display:block;font-size:17px}.banner p{margin:3px 0;font-size:13px}.cancel{position:absolute;top:15px;right:16px}.target{position:absolute;width:54px;height:54px;padding:0;border:2px solid #1d573f;border-radius:50%;background:#e5f0c7;box-shadow:0 0 0 8px #d3e2ae55;transform:translate(-50%,-50%);display:grid;place-items:center;color:#183e2e;font-weight:700;font-size:14px}.target::after{content:'';position:absolute;inset:19px;border-radius:50%;background:#173f31}.target.training::after{display:none}.target.validation{pointer-events:none}.footer{position:absolute;bottom:14px;left:20px;right:20px;text-align:center;font-size:13px;color:#587063;pointer-events:none}.footer .bar{width:180px;height:4px;background:#dde5d5;border-radius:5px;margin:10px auto 0;overflow:hidden}.footer .fill{height:100%;width:0;background:#315b3f;transition:width .2s}.result{font-size:33px;letter-spacing:-.04em;font-weight:700;color:#234e37;margin:15px 0 0}a{color:#355945}.video{position:absolute;left:12px;top:12px;width:76px;height:57px;object-fit:cover;transform:scaleX(-1);border-radius:8px;opacity:.8}@media(max-height:550px){.banner strong{font-size:14px}.banner p{font-size:11px}.footer{font-size:11px;bottom:6px}}
      </style><div class="veil" role="dialog" aria-modal="true" aria-label="Webcam gaze setup"><div class="card"><span class="eyebrow">OPTIONAL CAMERA EXPERIMENT</span><h2>Let your attention pick the region.</h2><p>Your browser will ask for camera permission. Keep your head steady, click nine targets while looking at them, then look at five new targets for an independent accuracy check.</p><p class="detail">WebGazer estimates broad screen regions. It does not identify exact words or know what you understand. If the check is too noisy, Skim keeps pointer mode.</p><p>After you continue, this page loads WebGazer and its face model assets from this website. The website host receives normal asset requests. Camera frames and gaze estimates stay in this browser; Skim does not record them.</p><p class="subtle">Calibration is held in memory for this session. Escape, Stop, or switching tabs releases the camera. Setup usually takes about a minute.</p><div class="actions"><button class="primary" id="consent">Start camera setup</button><button class="secondary" id="cancel">Use pointer</button></div></div></div>`;
      document.body.append(host);
      document.addEventListener('keydown', onKey, true);
      find('#consent').addEventListener('click', () => {
        find('#consent').disabled = true;
        pendingStart = beginCamera(generation).finally(() => { pendingStart = null; });
      });
      find('#cancel').addEventListener('click', stop);
      find('#consent').focus();
    }

    function renderStage(title, description) {
      const veil = find('.veil');
      if (!veil) return;
      veil.className = 'stage';
      veil.innerHTML = '<div class="banner"><strong id="step-title"></strong><p id="step-description"></p></div><button class="secondary cancel" id="cancel">Stop</button><button class="target training" id="target" aria-label="Look here and click to train"></button><div class="footer"><span id="step-footer"></span><div class="bar"><div class="fill" id="progress"></div></div></div>';
      find('#step-title').textContent = title;
      find('#step-description').textContent = description;
      find('#cancel').addEventListener('click', stop);
      const source = document.getElementById(wg.params?.videoElementId || 'webgazerVideoFeed');
      if (source?.srcObject) {
        streams.add(source.srcObject);
        const preview = document.createElement('video');
        preview.className = 'video';
        preview.muted = true;
        preview.playsInline = true;
        preview.autoplay = true;
        preview.srcObject = source.srcObject;
        veil.append(preview);
        preview.play().catch(() => {});
      }
    }

    function pointAt(point) {
      const target = find('#target');
      target.style.left = point.x + 'px';
      target.style.top = point.y + 'px';
    }

    function accuracyLimits() {
      const heights = [...document.querySelectorAll('.paragraph')].map(el => el.getBoundingClientRect()).filter(r => r.height > 0 && r.bottom > 0 && r.top < innerHeight).map(r => r.height);
      const regionHeight = heights.length ? median(heights) : 160;
      // Product gates, not published guarantees. Adjacent short paragraphs
      // require substantially better accuracy than coarse screen quadrants.
      const mid = Math.min(100, regionHeight * .5);
      return { median: mid, p90: Math.min(180, mid * 1.8) };
    }

    async function beginWithGuard(token) {
      const media = navigator.mediaDevices;
      const originalGetUserMedia = media.getUserMedia;
      let expired = false, deadline;
      // WebGazer requests getUserMedia synchronously in begin(), but resolves
      // only after model readiness. Capture the stream before that delay, and
      // reject late permission grants after cancellation so no camera leaks.
      const guardedGetUserMedia = constraints => originalGetUserMedia.call(media, constraints).then(stream => {
        if (expired || token !== generation) {
          for (const track of stream.getTracks()) track.stop();
          throw new DOMException('Camera setup was cancelled.', 'AbortError');
        }
        streams.add(stream);
        return stream;
      });
      let initialization;
      try {
        media.getUserMedia = guardedGetUserMedia;
        if (media.getUserMedia !== guardedGetUserMedia) throw new Error('The camera shutdown guard is unavailable in this browser.');
        initialization = Promise.resolve(wg.begin());
      } finally {
        if (media.getUserMedia === guardedGetUserMedia) media.getUserMedia = originalGetUserMedia;
      }
      pendingInitialization = initialization;
      cameraInitializations.add(initialization);
      initialization.then(() => {
        if (expired || token !== generation) releaseCamera();
      }, () => {
        if (expired || token !== generation) releaseCamera();
      }).finally(() => {
        cameraInitializations.delete(initialization);
        if (pendingInitialization === initialization) pendingInitialization = null;
      });
      try {
        await Promise.race([
          initialization,
          new Promise((_, reject) => {
            deadline = setTimeout(() => {
              expired = true;
              releaseCamera();
              reject(new Error('Camera setup took too long. Any available camera tracks were stopped. Close the permission prompt before retrying.'));
            }, 45000);
          })
        ]);
      } finally { clearTimeout(deadline); }
    }

    async function beginCamera(token) {
      if (compatibilityOperation || (cameraOwner && cameraOwner !== owner)) {
        showResult(false, 'Another tracker operation is still finishing.', 'Wait for the compatibility check or other camera session to finish, then try again. Pointer mode is ready.');
        status('unavailable', 'Another tracker operation is still finishing. Pointer mode is ready.');
        return;
      }
      cameraStarts.add(owner);
      try {
        if (!hasUsableWebGL()) {
          showResult(false, 'Webcam tracking needs graphics support.', 'WebGL is unavailable in this browser. The camera remains off. You can keep using pointer mode, or try a browser with WebGL graphics support.');
          status('unavailable', 'WebGL is unavailable. Camera remains off; pointer mode is ready.');
          return;
        }
        cameraOwner = owner;
        status('loading', 'Loading the bundled eye tracking library after your consent.');
        const consentButton = find('#consent');
        if (consentButton) consentButton.textContent = 'Loading tracker…';
        wg = await loadLibrary();
        if (token !== generation) return;
        // MediaPipe receives this explicit absolute path before its detector is
        // created. A relative default resolves against /lab and breaks loading.
        wg.params.faceMeshSolutionPath = MODEL_PATH;
        status('starting', 'Allow the camera, then complete calibration.');
        wg.saveDataAcrossSessions(false);
        wg.setRegression('ridge');
        for (const model of wg.getRegression()) model.init();
        wg.applyKalmanFilter(true);
        wg.setGazeListener(onPrediction);
        await beginWithGuard(token);
        if (token !== generation) { releaseCamera(); return; }
        wg.removeMouseEventListeners();
        // Startup installs automatic mouse training. Remove any incidental
        // samples from that interval before explicit target calibration.
        for (const model of wg.getRegression()) model.init();
        wg.showVideo(false);
        wg.showFaceOverlay(false);
        wg.showFaceFeedbackBox(false);
        wg.showPredictionPoints(false);
        viewport = { width: innerWidth, height: innerHeight };
        limits = accuracyLimits();
        startTraining();
      } catch (error) {
        releaseCamera();
        if (token !== generation) return;
        const denied = error?.name === 'NotAllowedError' || error?.name === 'SecurityError';
        const message = denied ? 'Camera permission was not available. Pointer mode is ready.' : 'Camera setup could not finish. Pointer mode is ready.';
        showResult(false, message, error?.message || 'The camera or face model could not start.');
        status('error', message);
      } finally { cameraStarts.delete(owner); }
    }

    function startTraining() {
      trainingIndex = trainingClicks = 0;
      validationResults = [];
      const { width, height } = viewport;
      trainingPoints = [
        [.5, .5], [.12, .18], [.5, .18], [.88, .18],
        [.88, .5], [.88, .82], [.5, .82], [.12, .82], [.12, .5]
      ].map(([x, y]) => ({ x: x * width, y: y * height }));
      renderStage('Look at the dot, then click it five times.', 'Keep looking at the dot as you click. Keep your head in the same position.');
      status('calibrating', 'Calibrating nine screen targets. No gaze drives the reader yet.');
      const target = find('#target');
      target.addEventListener('click', trainClick);
      showTrainingTarget();
    }

    function showTrainingTarget() {
      pointAt(trainingPoints[trainingIndex]);
      find('#target').textContent = String(5 - trainingClicks);
      find('#step-footer').textContent = 'Target ' + (trainingIndex + 1) + ' of 9 · ' + trainingClicks + ' of 5 clicks';
      find('#progress').style.width = ((trainingIndex * 5 + trainingClicks) / 45 * 100) + '%';
    }

    function trainClick(event) {
      // Only a deliberate pointer click on the visible target trains the model.
      // Pointer locations are never emitted as gaze points.
      if (state !== 'calibrating' || !event.isTrusted || event.detail === 0) return;
      const now = performance.now();
      if (now - lastClick < 180) return;
      lastClick = now;
      const point = trainingPoints[trainingIndex];
      wg.recordScreenPosition(point.x, point.y, 'click');
      trainingClicks++;
      if (trainingClicks === 5) {
        trainingIndex++;
        trainingClicks = 0;
        if (trainingIndex === trainingPoints.length) { startValidation(); return; }
      }
      showTrainingTarget();
    }

    function startValidation() {
      // No clicks, default pointer training, or target positions are supplied to
      // the regressor during this heldout check.
      wg.removeMouseEventListeners();
      validationIndex = 0;
      validationResults = [];
      validationPoints = [[.3, .32], [.72, .68], [.7, .3], [.28, .7], [.51, .54]].map(([x, y]) => ({ x: x * viewport.width, y: y * viewport.height }));
      const target = find('#target');
      target.removeEventListener('click', trainClick);
      target.className = 'target validation';
      target.textContent = '';
      target.tabIndex = -1;
      target.setAttribute('aria-label', 'Look at this accuracy check target');
      find('#step-title').textContent = 'Now look at each dot. No clicking.';
      find('#step-description').textContent = 'These five new positions test your calibration without training it.';
      find('#cancel').focus();
      status('validating', 'Checking five heldout targets. This check does not train the model.');
      nextValidation();
    }

    function nextValidation() {
      const point = validationPoints[validationIndex];
      pointAt(point);
      find('#step-footer').textContent = 'Accuracy check ' + (validationIndex + 1) + ' of 5 · keep your eyes on the dot';
      find('#progress').style.width = (validationIndex / 5 * 100) + '%';
      // Let the eye and the smoothing filter settle before measuring.
      capture = { point, start: performance.now() + 850, end: performance.now() + 2650, samples: [], attempted: 0 };
      timer = setTimeout(() => {
        if (state !== 'validating' || !capture) return;
        validationResults.push(capture);
        capture = null;
        validationIndex++;
        if (validationIndex < validationPoints.length) nextValidation();
        else finishValidation();
      }, 2700);
    }

    function onPrediction(data) {
      const now = performance.now();
      const valid = data && Number.isFinite(data.x) && Number.isFinite(data.y);
      if (state === 'validating' && capture && now >= capture.start && now <= capture.end) {
        capture.attempted++;
        if (valid) capture.samples.push(Math.hypot(data.x - capture.point.x, data.y - capture.point.y));
      }
      if (!valid) return;
      lastPredictionAt = now;
      if (state !== 'tracking' || document.hidden) return;
      if (data.x < 0 || data.y < 0 || data.x > innerWidth || data.y > innerHeight) return;
      if (typeof options.onPoint === 'function') options.onPoint({ x: data.x, y: data.y });
    }

    function finishValidation() {
      const errors = validationResults.flatMap(result => result.samples);
      const errorPx = median(errors), p90 = percentile(errors, .9);
      const enoughSamples = validationResults.every(result => result.samples.length >= 8 && result.samples.length / Math.max(1, result.attempted) >= .7);
      const passed = enoughSamples && errorPx <= limits.median && p90 <= limits.p90 && validationResults.every(result => median(result.samples) <= limits.p90);
      const report = { passed, errorPx, p90, samples: errors.length, medianLimit: limits.median, p90Limit: limits.p90, targets: validationResults.map(result => ({ samples: result.samples.length, median: median(result.samples) })) };
      if (typeof options.onCalibration === 'function') options.onCalibration(report);
      if (!passed) {
        releaseCamera();
        const headline = enoughSamples ? 'The camera estimate is too coarse for these paragraphs.' : 'The camera did not return enough usable samples.';
        const detail = errors.length ? 'Measured median error: ' + Math.round(errorPx) + ' px. The limit for these paragraphs is ' + Math.round(limits.median) + ' px; 90th percentile error: ' + Math.round(p90) + ' px, limit ' + Math.round(limits.p90) + ' px. Try more even light, a steadier head position, or stay with pointer mode.' : 'Try more even lighting and keep your face visible. Pointer mode is ready.';
        showResult(false, headline, detail);
        status('failed', headline + ' Pointer mode is ready.', { errorPx: Number.isFinite(errorPx) ? errorPx : undefined });
        return;
      }
      showResult(true, 'The short accuracy check passed.', 'Median error: ' + Math.round(errorPx) + ' px. 90th percentile: ' + Math.round(p90) + ' px. This supports a cautious regional experiment. Moving your head, resizing the window, or camera drift can invalidate it.');
      find('#continue').addEventListener('click', () => {
        removeOverlay();
        lastPredictionAt = performance.now();
        status('tracking', 'Camera tracking is active. Regional estimates only.', { errorPx, p90 });
        monitoring = setInterval(() => {
          if (state === 'tracking' && performance.now() - lastPredictionAt > 5000) {
            releaseCamera();
            status('failed', 'The tracker lost your face. Camera stopped; recalibrate or use pointer mode.');
          }
        }, 1000);
      });
    }

    function showResult(passed, title, detail) {
      const veil = find('.stage') || find('.veil');
      if (!veil) return;
      veil.className = 'veil';
      veil.innerHTML = '<div class="card"><span class="eyebrow">' + (passed ? 'SHORT ACCURACY CHECK' : 'POINTER MODE IS READY') + '</span><h2 id="result-title"></h2><p id="result-detail"></p><p class="subtle">This is an experimental webcam estimate. Passing a short check does not guarantee ongoing accuracy or exact word tracking.</p><div class="actions">' + (passed ? '<button class="primary" id="continue">Try gaze mode</button>' : '') + '<button class="secondary" id="close">Use pointer</button></div></div>';
      find('#result-title').textContent = title;
      find('#result-detail').textContent = detail;
      find('#close').addEventListener('click', stop);
      (find('#continue') || find('#close')).focus();
    }

    async function start() {
      if (compatibilityOperation) {
        status('unavailable', 'The compatibility check is still finishing. Wait or reload this page before camera setup. Pointer mode is ready.');
        return;
      }
      if (location.protocol === 'chrome-extension:' || globalThis.chrome?.runtime?.id) {
        status('unavailable', 'Webcam gaze is available in the hosted demo. The extension keeps local pointer mode.');
        return;
      }
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        status('unavailable', 'Webcam gaze needs HTTPS or localhost and a supported camera browser. Pointer mode is ready.');
        return;
      }
      if (innerWidth < 560 || innerHeight < 420) {
        status('unavailable', 'Use a larger desktop window for the webcam calibration. Pointer mode is ready.');
        return;
      }
      if ((pendingStart || pendingInitialization) && !host) {
        status('unavailable', 'The previous camera request is still finishing. Close its permission prompt. If it stays blocked, reload this page to retry.');
        return;
      }
      if (host || state === 'tracking') return;
      generation++;
      overlay();
    }

    window.addEventListener('pagehide', stop);
    document.addEventListener('visibilitychange', () => { if (document.hidden && (host || state === 'tracking')) stop(); });
    window.addEventListener('resize', () => {
      if (viewport && (state === 'calibrating' || state === 'validating' || state === 'tracking') && (innerWidth !== viewport.width || innerHeight !== viewport.height)) {
        stop();
        status('unavailable', 'The window size changed. Recalibrate before using webcam gaze.');
      }
    });
    return { start, stop };
  }

  window.SkimGaze = { create, checkCompatibility };
})();
