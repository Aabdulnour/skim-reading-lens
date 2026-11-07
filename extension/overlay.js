/* Local pointer lens. Source text is never wrapped, replaced, uploaded, or saved. */
(async () => {
  'use strict';
  const automatic = globalThis.__skimAutoLaunch === true;
  delete globalThis.__skimAutoLaunch;
  if (globalThis.__skimPointerOverlay) {
    if (automatic) return {active: true};
    globalThis.__skimPointerOverlay.destroy();
    return {active: false};
  }
  if (globalThis.__skimPointerStarting) return globalThis.__skimPointerStarting;
  const start = (async () => {
    if (!globalThis.CSS?.highlights || typeof Highlight !== 'function') {
      return {active: false, error: 'The lens needs a recent Chrome with the CSS Highlight API. You can still use the quiet reader.'};
    }
    const goals = ['answer', 'action', 'caveat', 'evidence'];
    let preferences = {goal: 'answer', paused: false, compact: false};
    let remembered = [];
    const extension = Boolean(globalThis.chrome?.runtime?.id && globalThis.chrome?.storage?.local);
    const site = /^https?:$/.test(location.protocol) ? location.protocol + '//' + location.hostname + '/*' : null;
    if (extension) {
      try {
        const data = await chrome.storage.local.get(['skimPreferences', 'skimSites']);
        const saved = data.skimPreferences || {};
        preferences = {goal: goals.includes(saved.goal) ? saved.goal : 'answer', paused: saved.paused === true, compact: saved.compact === true};
        remembered = Array.isArray(data.skimSites) ? data.skimSites : [];
      } catch (_) {
        return {active: false, error: 'Skim could not read its settings. Reload the page and try again.'};
      }
    }
    if (preferences.paused) return {active: false, error: 'The lens is paused everywhere. Resume it from Skim’s popup or Settings.'};
    if (automatic && (!extension || !site || !remembered.includes(site))) return {active: false};
    if (globalThis.__skimPointerOverlay) return {active: true};
    const unique = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(12)), value => value.toString(16).padStart(2, '0')).join('');
    const name = 'skim-pointer-' + unique;
    const excluded = 'input,textarea,select,button,[contenteditable]:not([contenteditable="false"]),[hidden],[aria-hidden="true"],script,style,noscript,svg,canvas';
    const editable = 'input,textarea,select,[contenteditable]:not([contenteditable="false"])';
    const style = document.createElement('style');
    style.textContent = '::highlight(' + name + '){background-color:#d7ee8b;color:#273126;text-decoration:underline;text-decoration-color:#9bb456;text-underline-offset:3px;}';
    const host = document.createElement('div');
    host.dataset.skimPointer = 'true';
    host.style.cssText = 'all:initial!important;position:fixed!important;left:50%!important;top:12px!important;transform:translateX(-50%)!important;z-index:2147483647!important;display:block!important;max-width:calc(100vw - 24px)!important;';
    const shadow = host.attachShadow({mode: 'open'});
    shadow.innerHTML = '<style>:host{all:initial}.card{box-sizing:border-box;width:550px;max-width:calc(100vw - 24px);font:12px/1.5 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#273126;color:#f5f7eb;border:1px solid #47533e;border-radius:14px;box-shadow:0 8px 35px #17200b30;overflow:hidden}.bar{display:flex;align-items:center;gap:10px;padding:9px 12px}.brand{display:flex;align-items:center;gap:6px;font-size:17px;font-weight:750;letter-spacing:-.7px;padding:0 5px 0 0}.dot{width:5px;height:5px;background:#cde990;border-radius:50%}.mode{color:#becab0;font-size:9px;white-space:nowrap;letter-spacing:.3px}.goal-field{margin-left:auto;display:flex;align-items:center;gap:7px}.goal-field span{font-size:9px;color:#becab0}select{color:#eef5e2;background:#3b4832;border:1px solid #5b6b4b;border-radius:5px;padding:5px;font:11px system-ui;max-width:115px}button{font:11px system-ui;cursor:pointer;border:0;border-radius:5px;background:transparent;color:#e8eedc;padding:5px 6px;white-space:nowrap}button:hover{background:#46543a}button:focus-visible,select:focus-visible{outline:2px solid #d7ee8b;outline-offset:2px}.icon{font-size:16px;line-height:1;padding:4px 6px}.pause{font-size:10px}.pause[aria-pressed="true"]{color:#e9c98b}.detail{border-top:1px solid #47533e;padding:9px 15px 11px}.cue{color:#b8c7a8;font-size:9px;letter-spacing:.2px}.peek{font-size:12px;line-height:1.5;margin:5px 0 0;color:#f4f6ea;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}.peek:empty{display:none}.compact{width:auto}.compact .goal-field,.compact .detail{display:none}.compact .mode{margin-right:4px}.compact .bar{gap:7px}.compact .pause{margin-left:auto}@media(max-width:520px){.bar{gap:5px;padding:9px}.mode{display:none}.goal-field{gap:3px}.goal-field span{display:none}.card{max-width:calc(100vw - 24px)}select{max-width:110px}.detail{padding:9px 12px}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}}</style><section class="card" role="region" aria-label="Skim pointer reading lens"><div class="bar"><div class="brand">skim<span class="dot"></span></div><span class="mode">POINTER LENS</span><label class="goal-field"><span>Look for</span><select aria-label="What should Skim highlight?"><option value="answer">The answer</option><option value="action">Next steps</option><option value="caveat">The catch</option><option value="evidence">Key details</option></select></label><button class="pause" type="button" aria-pressed="false">Pause</button><button class="minimize icon" type="button" aria-label="Minimize the dock" title="Minimize the dock">−</button><button class="close icon" type="button" aria-label="Stop Skim on this page" title="Stop until this page reloads">×</button></div><div class="detail"><div class="cue" role="status" aria-live="polite">Pause your pointer over a paragraph.</div><p class="peek"></p></div></section>';
    document.documentElement.append(style, host);
    const card = shadow.querySelector('.card'), cue = shadow.querySelector('.cue'), peek = shadow.querySelector('.peek');
    const goalSelect = shadow.querySelector('select'), pauseButton = shadow.querySelector('.pause'), minimizeButton = shadow.querySelector('.minimize');
    let goal = preferences.goal, compact = preferences.compact, paused = false, frozen = false;
    let timer = 0, refreshTimer = 0, scrollTimer = 0, target = null, destroyed = false, lastPointer = null;
    let lastContent = '', lastReason = '';
    function visible(element) {
      if (!(element instanceof Element) || element.closest(excluded)) return false;
      for (let el = element; el; el = el.parentElement) {
        const computed = getComputedStyle(el);
        if (computed.display === 'none' || computed.visibility !== 'visible' || Number(computed.opacity) === 0) return false;
      }
      return element.getClientRects().length > 0;
    }
    function clear() {
      clearTimeout(timer); clearTimeout(refreshTimer);
      CSS.highlights.delete(name);
      lastContent = ''; lastReason = ''; peek.textContent = '';
      cue.textContent = paused ? 'Paused on this page. Resume when ready.' : 'Pause your pointer over a paragraph.';
    }
    function rangesFor(nodes, start, end) {
      const ranges = [];
      for (const item of nodes) {
        const from = Math.max(start, item.start), to = Math.min(end, item.end);
        if (from >= to) continue;
        const range = document.createRange();
        range.setStart(item.node, from - item.start); range.setEnd(item.node, to - item.start);
        ranges.push(range);
      }
      return ranges;
    }
    function fullyOnScreen(range) {
      const rects = [...range.getClientRects()].filter(rect => rect.width > 0 && rect.height > 0);
      if (!rects.length) return !range.toString().trim();
      return rects.every(rect => rect.top >= 0 && rect.bottom <= innerHeight && rect.left >= 0 && rect.right <= innerWidth);
    }
    function rank(sentence, index) {
      let score = Math.min(sentence.length, 180) / 180 - index * .06;
      const caveat = /\b(but|however|unless|except|risk|caveat|limitation|cannot|does not|only if|not included)\b/i.test(sentence);
      const action = /\b(should|must|recommend|start|choose|try|avoid|need to|next step|install|open|enable|click)\b/i.test(sentence);
      const evidence = /\d|\b(research|study|measured|data|source|according to)\b/i.test(sentence);
      let reason = 'a possible main point';
      if (goal === 'answer') { score += index === 0 ? 2.5 : 0; score += action ? 1.4 : 0; score += caveat ? 1.1 : 0; }
      if (goal === 'action') { score += action ? 6 : 0; reason = action ? 'a possible next step' : 'a sentence to consider'; }
      if (goal === 'caveat') { score += caveat ? 7 : 0; reason = caveat ? 'a possible caveat' : 'a sentence to consider'; }
      if (goal === 'evidence') { score += evidence ? 6 : 0; reason = evidence ? 'a concrete detail' : 'a sentence to consider'; }
      if (sentence.length < 25) score -= 3;
      if (sentence.length > 500) score -= 2;
      if (/^(certainly|absolutely|great question|in conclusion|as an ai)\b/i.test(sentence)) score -= 5;
      return {score, reason};
    }
    function highlight(element) {
      refreshTimer = 0;
      if (destroyed || paused || frozen || !element?.isConnected || !visible(element)) { clear(); return; }
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const nodes = [];
      let text = '', node, count = 0;
      while ((node = walker.nextNode()) && count++ < 400 && text.length < 5000) {
        if (!visible(node.parentElement)) continue;
        const value = node.nodeValue.slice(0, 5000 - text.length);
        nodes.push({node, start: text.length, end: text.length + value.length});
        text += value;
      }
      const segments = typeof Intl.Segmenter === 'function'
        ? [...new Intl.Segmenter(undefined, {granularity: 'sentence'}).segment(text)].map(item => ({text: item.segment, start: item.index}))
        : [...text.matchAll(/[^.!?]+(?:[.!?]+|$)/g)].map(item => ({text: item[0], start: item.index}));
      const choices = segments.map((item, index) => {
        const trimStart = item.text.length - item.text.trimStart().length, content = item.text.trim();
        const ranges = rangesFor(nodes, item.start + trimStart, item.start + trimStart + content.length);
        return {content, ranges, ...rank(content, index)};
      }).filter(item => item.content.length >= 12 && item.ranges.length && item.ranges.every(fullyOnScreen));
      choices.sort((a, b) => b.score - a.score);
      const pick = choices[0];
      CSS.highlights.delete(name);
      if (!pick) { clear(); return; }
      CSS.highlights.set(name, new Highlight(...pick.ranges));
      if (lastContent !== pick.content || lastReason !== pick.reason) {
        cue.textContent = 'Exact wording · ' + pick.reason + ' · check the context';
        peek.textContent = pick.content; lastContent = pick.content; lastReason = pick.reason;
      }
    }
    const observer = new MutationObserver(() => {
      if (!refreshTimer && target && !paused) refreshTimer = setTimeout(() => highlight(target), 180);
    });
    function selectTarget(element) {
      if (destroyed || frozen) return;
      const next = element instanceof Element && !element.closest(excluded) ? element.closest('p,li,blockquote,h1,h2,h3,h4,h5,h6') : null;
      if (next === target) return;
      clear(); observer.disconnect(); target = next;
      if (target && !paused) {
        observer.observe(target, {characterData: true, childList: true, subtree: true});
        timer = setTimeout(() => highlight(next), 260);
      }
    }
    function move(event) {
      if (frozen) return;
      if (event.composedPath().includes(host)) return;
      lastPointer = {x: event.clientX, y: event.clientY};
      if (!paused) selectTarget(event.target);
    }
    function reset() { target = null; observer.disconnect(); clear(); }
    function scroll() {
      reset(); clearTimeout(scrollTimer);
      if (lastPointer && !paused && !frozen) scrollTimer = setTimeout(() => {
        if (!destroyed && !paused && !frozen) selectTarget(document.elementFromPoint(lastPointer.x, lastPointer.y));
      }, 180);
    }
    function blur() { clearTimeout(scrollTimer); reset(); }
    function key(event) {
      const element = event.composedPath()[0];
      if (event.key === 'Escape' && !event.defaultPrevented && !(element instanceof Element && element.closest(editable))) destroy();
    }
    function save(changes) {
      if (!extension) return;
      Promise.resolve().then(() => chrome.runtime.sendMessage({type: 'skim:set-preferences', changes})).then(result => {
        if (!result?.ok && !destroyed) cue.textContent = 'This choice works here, but Chrome could not save it.';
      }).catch(() => { if (!destroyed) cue.textContent = 'This choice works here. Reload this page after an extension update.'; });
    }
    function setGoal(value, persist = false) {
      goal = goals.includes(value) ? value : 'answer'; goalSelect.value = goal;
      if (target && !paused) highlight(target);
      if (persist) save({goal});
    }
    function setCompact(value, persist = false) {
      compact = value; card.classList.toggle('compact', compact);
      minimizeButton.textContent = compact ? '+' : '−';
      minimizeButton.setAttribute('aria-label', compact ? 'Expand the dock' : 'Minimize the dock');
      minimizeButton.title = compact ? 'Expand the dock' : 'Minimize the dock';
      if (persist) save({compact});
    }
    function storageChanged(changes, area) {
      if (area !== 'local') return;
      if (changes.skimPreferences) {
        const next = changes.skimPreferences.newValue || {};
        if (next.paused === true) { destroy(); return; }
        setGoal(next.goal); setCompact(next.compact === true);
      }
      if (changes.skimSites && site) {
        const before = changes.skimSites.oldValue || [], after = changes.skimSites.newValue || [];
        if (before.includes(site) && !after.includes(site)) destroy();
        remembered = after;
      }
    }
    function visibility() { if (document.hidden) blur(); }
    function pagehide(event) {
      if (event.persisted) { frozen = true; blur(); }
      else destroy();
    }
    async function pageshow(event) {
      if (!event.persisted || destroyed) return;
      if (extension) {
        try {
          const data = await chrome.storage.local.get(['skimPreferences', 'skimSites']);
          if (destroyed) return;
          const next = data.skimPreferences || {}, sites = Array.isArray(data.skimSites) ? data.skimSites : [];
          if (next.paused === true || ((automatic || remembered.includes(site)) && !sites.includes(site))) { destroy(); return; }
          remembered = sites;
          setGoal(next.goal); setCompact(next.compact === true);
        } catch (_) { destroy(); return; }
      }
      frozen = false;
    }
    function destroy() {
      if (destroyed) return;
      destroyed = true; clearTimeout(scrollTimer); reset();
      document.removeEventListener('pointermove', move, true);
      document.removeEventListener('scroll', scroll, true);
      document.removeEventListener('keydown', key, true);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('blur', blur);
      window.removeEventListener('resize', blur);
      window.removeEventListener('pagehide', pagehide);
      window.removeEventListener('pageshow', pageshow);
      window.removeEventListener('popstate', blur);
      window.removeEventListener('hashchange', blur);
      // Chrome can invalidate an old content-script context after an update.
      // DOM cleanup must still finish when that extension API is unavailable.
      if (extension) { try { chrome.storage.onChanged.removeListener(storageChanged); } catch (_) {} }
      style.remove(); host.remove();
      delete globalThis.__skimPointerOverlay;
      if (typeof CustomEvent === 'function') document.dispatchEvent(new CustomEvent('skim-lens-state', {detail: {active: false}}));
    }
    goalSelect.addEventListener('change', () => setGoal(goalSelect.value, true));
    pauseButton.addEventListener('click', () => {
      paused = !paused;
      pauseButton.setAttribute('aria-pressed', String(paused)); pauseButton.textContent = paused ? 'Resume' : 'Pause';
      reset();
    });
    minimizeButton.addEventListener('click', () => setCompact(!compact, true));
    shadow.querySelector('.close').addEventListener('click', destroy);
    document.addEventListener('pointermove', move, true);
    document.addEventListener('scroll', scroll, {capture: true, passive: true});
    document.addEventListener('keydown', key, true);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('blur', blur);
    window.addEventListener('resize', blur);
    window.addEventListener('pagehide', pagehide);
    window.addEventListener('pageshow', pageshow);
    window.addEventListener('popstate', blur);
    window.addEventListener('hashchange', blur);
    if (extension) chrome.storage.onChanged.addListener(storageChanged);
    setGoal(goal); setCompact(compact);
    globalThis.__skimPointerOverlay = {destroy, automatic};
    if (typeof CustomEvent === 'function') document.dispatchEvent(new CustomEvent('skim-lens-state', {detail: {active: true}}));
    return {active: true};
  })();
  globalThis.__skimPointerStarting = start;
  try { return await start; }
  finally { if (globalThis.__skimPointerStarting === start) delete globalThis.__skimPointerStarting; }
})()
