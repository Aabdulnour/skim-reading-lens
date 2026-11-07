'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const adapterSource = fs.readFileSync(path.join(__dirname, '../dist/gaze.js'), 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));

// This fixture checks camera lifecycle behavior, not webcam accuracy. It uses
// no real camera, network requests, browser storage, or predicted gaze samples.
function fixture({ loaded = true, webgl = true, webgl2 = true, contextLost = false } = {}) {
  const nodes = new Map();
  const scripts = [];
  const windowEvents = new Map();
  const documentEvents = new Map();
  const timers = new Map();
  const canvasProbes = [];
  let releasedContexts = 0;
  const graphicsContext = {
    isContextLost: () => contextLost,
    getExtension: name => name === 'WEBGL_lose_context' ? { loseContext() { releasedContexts++; } } : null
  };

  class Element {
    constructor(tag = 'div') {
      this.tagName = tag.toUpperCase();
      this.listeners = {};
      this.style = {};
      this.isConnected = true;
      this.offsetParent = {};
    }
    set innerHTML(value) { this.html = value; }
    get innerHTML() { return this.html; }
    attachShadow() { return new Element(); }
    querySelector(selector) {
      if (!nodes.has(selector)) nodes.set(selector, new Element());
      return nodes.get(selector);
    }
    querySelectorAll() { return []; }
    addEventListener(event, listener) { this.listeners[event] = listener; }
    removeEventListener(event) { delete this.listeners[event]; }
    append(child) { if (child?.tagName === 'SCRIPT') scripts.push(child); }
    getContext(kind) {
      canvasProbes.push({ canvas: this, kind });
      return webgl && (kind === 'webgl' || (kind === 'webgl2' && webgl2)) ? graphicsContext : null;
    }
    remove() { this.isConnected = false; }
    focus() {}
    setAttribute() {}
  }

  const pendingGrants = [];
  const statuses = [];
  const points = [];
  let stoppedTracks = 0;
  let modelResets = 0;
  let disposedModels = 0;
  let modelStarts = 0;
  const detector = { estimateFaces() {}, dispose() { disposedModels++; } };
  const tracker = {
    detector: null,
    async init() { modelStarts++; this.detector = detector; return detector; }
  };
  const stream = { getTracks: () => [{ stop: () => stoppedTracks++ }] };
  const media = {
    getUserMedia: () => new Promise(resolve => pendingGrants.push(() => resolve(stream)))
  };
  const webgazer = {
    params: {},
    pause() {},
    clearGazeListener() {},
    removeMouseEventListeners() {},
    end() {},
    getRegression: () => [{ init() { modelResets++; } }],
    getTracker: () => tracker,
    setRegression() {},
    saveDataAcrossSessions() {},
    applyKalmanFilter() {},
    setGazeListener(listener) { this.listener = listener; },
    showVideo() {},
    showFaceOverlay() {},
    showFaceFeedbackBox() {},
    showPredictionPoints() {},
    recordScreenPosition() {},
    begin() { return media.getUserMedia({ video: true }).then(() => webgazer); }
  };
  const document = {
    currentScript: { src: 'https://skim.example/gaze.js' },
    activeElement: new Element(),
    hidden: false,
    createElement: tag => new Element(tag),
    body: new Element(),
    head: new Element(),
    // Deliberately omit the library's video element. Shutdown must still stop
    // the stream captured before WebGazer finishes initializing its DOM.
    getElementById: () => null,
    querySelectorAll: () => [],
    addEventListener(name, listener) { documentEvents.set(name, listener); },
    removeEventListener(name) { documentEvents.delete(name); }
  };
  const context = {
    document,
    navigator: { mediaDevices: media },
    location: { protocol: 'https:', href: 'https://skim.example/lab' },
    innerWidth: 1200,
    innerHeight: 900,
    performance,
    DOMException,
    URL,
    WebAssembly: { compile() {} },
    console,
    Promise,
    Set,
    Math,
    Number,
    setTimeout(callback, delay) {
      const handle = setTimeout(callback, delay);
      timers.set(handle, { callback, delay });
      return handle;
    },
    clearTimeout(handle) { clearTimeout(handle); timers.delete(handle); },
    setInterval,
    clearInterval,
    addEventListener(name, listener) { windowEvents.set(name, listener); },
    isSecureContext: true,
    webgazer: loaded ? webgazer : undefined
  };
  context.window = context;
  context.globalThis = context;
  vm.runInNewContext(adapterSource, context, { filename: 'gaze.js' });
  const adapter = context.SkimGaze.create({
    onStatus: status => statuses.push(status),
    onPoint: point => points.push(point)
  });

  return {
    adapter,
    api: context.SkimGaze,
    nodes,
    scripts,
    context,
    document,
    documentEvents,
    windowEvents,
    webgazer,
    tracker,
    detector,
    disposedModels: () => disposedModels,
    modelStarts: () => modelStarts,
    timers,
    canvasProbes,
    releasedContexts: () => releasedContexts,
    media,
    pendingGrants,
    statuses,
    points,
    stoppedTracks: () => stoppedTracks,
    modelResets: () => modelResets,
    async cleanup() {
      adapter.stop();
      for (const grant of pendingGrants) grant();
      await settle();
      await settle();
    }
  };
}

test('opening camera consent does not request camera access', async t => {
  const f = fixture();
  t.after(() => f.cleanup());
  await f.adapter.start();
  assert.equal(f.pendingGrants.length, 0);
  assert.equal(f.scripts.length, 0, 'opening consent must not download the tracker');
  assert.equal(f.canvasProbes.length, 0, 'graphics probe starts only after explicit camera setup');
  assert.equal(f.points.length, 0);
  assert.ok(f.nodes.get('#consent').listeners.click);
});

test('a camera permission grant arriving after Stop releases every captured track', async t => {
  const f = fixture();
  t.after(() => f.cleanup());
  const originalGetUserMedia = f.media.getUserMedia;
  await f.adapter.start();
  f.nodes.get('#consent').listeners.click();
  await settle();

  assert.equal(f.pendingGrants.length, 1);
  assert.equal(f.webgazer.params.faceMeshSolutionPath, 'https://skim.example/vendor/webgazer-3.5.3/mediapipe/face_mesh/');
  assert.equal(f.media.getUserMedia, originalGetUserMedia, 'camera method must be restored before permission resolves');
  f.adapter.stop();
  f.pendingGrants[0]();
  await settle();
  await settle();

  assert.ok(f.stoppedTracks() >= 1, 'late camera grant must be stopped');
  assert.ok(!f.statuses.some(status => status.state === 'tracking'));
  assert.equal(f.points.length, 0);
});

test('camera initialization reaches calibration only, resets training, and Stop releases the stream without a DOM video', async t => {
  const f = fixture();
  t.after(() => f.cleanup());
  await f.adapter.start();
  f.nodes.get('#consent').listeners.click();
  await settle();
  f.pendingGrants[0]();
  await settle();
  await settle();

  assert.equal(f.statuses.at(-1).state, 'calibrating');
  assert.ok(f.modelResets() >= 2, 'reset in-memory training before and after startup');
  assert.ok(!f.statuses.some(status => status.state === 'tracking'));
  assert.equal(f.points.length, 0);
  f.adapter.stop();
  assert.ok(f.stoppedTracks() >= 1, 'captured stream must stop even if no video element exists');
});

test('consent loads the pinned same-origin runtime and sets the matching model path before requesting a camera', async t => {
  const f = fixture({ loaded: false });
  t.after(() => f.cleanup());
  await f.adapter.start();
  assert.equal(f.scripts.length, 0);
  f.nodes.get('#consent').listeners.click();
  await settle();
  assert.equal(f.scripts.length, 1);
  assert.equal(f.pendingGrants.length, 0);
  const script = f.scripts[0];
  assert.equal(script.src, 'https://skim.example/vendor/webgazer-3.5.3/webgazer.js');
  assert.match(script.integrity, /^sha384-/);
  const vendor = fs.readFileSync(path.join(__dirname, '../dist/vendor/webgazer-3.5.3/webgazer.js'));
  const expected = 'sha384-' + require('node:crypto').createHash('sha384').update(vendor).digest('base64');
  assert.equal(script.integrity, expected, 'browser integrity must match the actual shipped runtime');
  f.context.webgazer = f.webgazer;
  script.onload();
  await settle();
  assert.equal(f.pendingGrants.length, 1);
  assert.equal(f.webgazer.params.faceMeshSolutionPath, 'https://skim.example/vendor/webgazer-3.5.3/mediapipe/face_mesh/');
});

test('canceling during the tracker download prevents a late load from requesting the camera', async t => {
  const f = fixture({ loaded: false });
  t.after(() => f.cleanup());
  await f.adapter.start();
  f.nodes.get('#consent').listeners.click();
  await settle();
  f.adapter.stop();
  f.context.webgazer = f.webgazer;
  f.scripts[0].onload();
  await settle();
  assert.equal(f.pendingGrants.length, 0);
  assert.equal(f.statuses.at(-1).state, 'stopped');
  assert.equal(f.points.length, 0);
});

test('a failed tracker download removes its script, preserves pointer mode, and can be retried', async t => {
  const f = fixture({ loaded: false });
  t.after(() => f.cleanup());
  await f.adapter.start();
  f.nodes.get('#consent').listeners.click();
  await settle();
  f.scripts[0].onerror();
  await settle();
  assert.equal(f.scripts[0].isConnected, false);
  assert.equal(f.pendingGrants.length, 0);
  assert.equal(f.statuses.at(-1).state, 'error');
  assert.match(f.statuses.at(-1).message, /Pointer mode is ready/);
  f.adapter.stop();
  await f.adapter.start();
  f.nodes.get('#consent').listeners.click();
  await settle();
  assert.equal(f.scripts.length, 2, 'failed loader promise must not block a deliberate retry');
  f.scripts[1].onerror();
  await settle();
});

test('the library download deadline removes the pending script and leaves the camera off', async t => {
  const f = fixture({ loaded: false });
  t.after(() => f.cleanup());
  await f.adapter.start();
  f.nodes.get('#consent').listeners.click();
  await settle();
  const deadline = [...f.timers.values()].find(timer => timer.delay === 30000);
  assert.ok(deadline);
  deadline.callback();
  await settle();
  assert.equal(f.scripts[0].isConnected, false);
  assert.equal(f.scripts[0].onload, null);
  assert.equal(f.pendingGrants.length, 0);
  assert.equal(f.statuses.at(-1).state, 'error');
});

test('hiding a tab during calibration releases the camera and clears the setup', async t => {
  const f = fixture();
  t.after(() => f.cleanup());
  await f.adapter.start();
  f.nodes.get('#consent').listeners.click();
  await settle();
  f.pendingGrants[0]();
  await settle();
  assert.equal(f.statuses.at(-1).state, 'calibrating');
  f.document.hidden = true;
  f.documentEvents.get('visibilitychange')();
  assert.ok(f.stoppedTracks() >= 1);
  assert.equal(f.statuses.at(-1).state, 'stopped');
});

test('changing the viewport during calibration releases the camera and requires a new calibration', async t => {
  const f = fixture();
  t.after(() => f.cleanup());
  await f.adapter.start();
  f.nodes.get('#consent').listeners.click();
  await settle();
  f.pendingGrants[0]();
  await settle();
  f.context.innerWidth = 1000;
  f.windowEvents.get('resize')();
  assert.ok(f.stoppedTracks() >= 1);
  assert.equal(f.statuses.at(-1).state, 'unavailable');
  assert.match(f.statuses.at(-1).message, /Recalibrate/);
});

test('unavailable WebGL keeps the camera and tracker off and shows a clear pointer fallback', async t => {
  const f = fixture({ loaded: false, webgl: false });
  t.after(() => f.cleanup());
  await f.adapter.start();
  f.nodes.get('#consent').listeners.click();
  await settle();
  assert.deepEqual(f.canvasProbes.map(probe => probe.kind), ['webgl2', 'webgl']);
  assert.equal(f.scripts.length, 0);
  assert.equal(f.pendingGrants.length, 0);
  assert.equal(f.statuses.at(-1).state, 'unavailable');
  assert.match(f.statuses.at(-1).message, /WebGL is unavailable/);
  assert.match(f.statuses.at(-1).message, /pointer mode is ready/);
  assert.equal(f.canvasProbes[0].canvas.isConnected, false);
  assert.equal(f.canvasProbes[0].canvas.width, 0);
});

test('the capability check accepts WebGL1 fallback and releases its temporary graphics context', async t => {
  const f = fixture({ webgl2: false });
  t.after(() => f.cleanup());
  await f.adapter.start();
  f.nodes.get('#consent').listeners.click();
  await settle();
  assert.deepEqual(f.canvasProbes.map(probe => probe.kind), ['webgl2', 'webgl']);
  assert.equal(f.releasedContexts(), 1);
  assert.equal(f.canvasProbes[0].canvas.isConnected, false);
  assert.equal(f.canvasProbes[0].canvas.width, 0);
  assert.equal(f.pendingGrants.length, 1);
});

test('an already-lost graphics context does not start the tracker or request a camera', async t => {
  const f = fixture({ loaded: false, contextLost: true });
  t.after(() => f.cleanup());
  await f.adapter.start();
  f.nodes.get('#consent').listeners.click();
  await settle();
  assert.equal(f.releasedContexts(), 1);
  assert.equal(f.scripts.length, 0);
  assert.equal(f.pendingGrants.length, 0);
  assert.equal(f.statuses.at(-1).state, 'unavailable');
});

test('compatibility check initializes and releases the model without opening a camera', async t => {
  const f = fixture({ loaded: false });
  t.after(() => f.cleanup());
  const progress = [];
  const result = f.api.checkCompatibility({ onProgress: item => progress.push(item) });
  await settle();
  assert.equal(f.scripts.length, 1);
  assert.equal(f.pendingGrants.length, 0);
  f.context.webgazer = f.webgazer;
  f.scripts[0].onload();
  const report = await result;
  assert.equal(report.ok, true);
  assert.equal(report.code, 'ready');
  assert.match(report.message, /calibration is still needed/);
  assert.deepEqual(progress.map(item => item.stage), ['checking', 'loading', 'model']);
  assert.equal(f.modelStarts(), 1);
  assert.equal(f.disposedModels(), 1);
  assert.equal(f.tracker.detector, null, 'a later camera session must not reuse a disposed detector');
  assert.equal(f.pendingGrants.length, 0);
  assert.equal(f.webgazer.params.faceMeshSolutionPath, 'https://skim.example/vendor/webgazer-3.5.3/mediapipe/face_mesh/');
});

test('compatibility checks fail early for missing graphics, WebAssembly, or secure context', async t => {
  for (const feature of ['graphics', 'wasm', 'secure']) {
    const f = fixture({ loaded: false, webgl: feature !== 'graphics' });
    t.after(() => f.cleanup());
    if (feature === 'wasm') f.context.WebAssembly = undefined;
    if (feature === 'secure') f.context.isSecureContext = false;
    const result = await f.api.checkCompatibility();
    assert.equal(result.ok, false);
    const code = { graphics: 'unsupported_graphics', wasm: 'unsupported_wasm', secure: 'insecure_context' }[feature];
    assert.equal(result.code, code);
    assert.equal(f.scripts.length, 0);
    assert.equal(f.pendingGrants.length, 0);
    assert.equal(f.modelStarts(), 0);
  }
});

test('concurrent compatibility calls share one model startup and release it once', async t => {
  const f = fixture();
  t.after(() => f.cleanup());
  const first = f.api.checkCompatibility();
  const second = f.api.checkCompatibility();
  assert.equal(first, second);
  const [one, two] = await Promise.all([first, second]);
  assert.equal(one.code, 'ready');
  assert.equal(two.code, 'ready');
  assert.equal(f.modelStarts(), 1);
  assert.equal(f.disposedModels(), 1);
});

test('failed model initialization disposes any available detector and allows a clean retry', async t => {
  const f = fixture();
  t.after(() => f.cleanup());
  const original = f.tracker.init;
  f.tracker.init = async function () { this.detector = f.detector; throw new Error('Model file unavailable'); };
  const failed = await f.api.checkCompatibility();
  assert.equal(failed.code, 'model_failed');
  assert.match(failed.message, /Model file unavailable/);
  assert.equal(f.disposedModels(), 1);
  assert.equal(f.tracker.detector, null);
  f.tracker.init = original;
  const retry = await f.api.checkCompatibility();
  assert.equal(retry.code, 'ready');
  assert.equal(f.disposedModels(), 2);
  assert.equal(f.pendingGrants.length, 0);
});

test('a timed-out model cannot overlap a new check and is disposed if it completes late', async t => {
  const f = fixture();
  t.after(() => f.cleanup());
  let finish;
  f.tracker.init = () => new Promise(resolve => { finish = () => { f.tracker.detector = f.detector; resolve(f.detector); }; });
  const first = f.api.checkCompatibility();
  await settle();
  const deadline = [...f.timers.values()].find(timer => timer.delay === 45000);
  assert.ok(deadline);
  deadline.callback();
  assert.equal((await first).code, 'timeout');
  assert.equal((await f.api.checkCompatibility()).code, 'busy');
  assert.equal(f.disposedModels(), 0);
  finish();
  await settle();
  assert.equal(f.disposedModels(), 1);
  assert.equal(f.tracker.detector, null);
  assert.equal(f.pendingGrants.length, 0);
});

test('compatibility checks do not dispose a model while camera setup is in progress', async t => {
  const f = fixture();
  t.after(() => f.cleanup());
  await f.adapter.start();
  f.nodes.get('#consent').listeners.click();
  await settle();
  assert.equal(f.pendingGrants.length, 1);
  const result = await f.api.checkCompatibility();
  assert.equal(result.code, 'busy');
  assert.equal(f.disposedModels(), 0);
  assert.equal(f.modelStarts(), 0);
});
