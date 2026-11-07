'use strict';
const readButton = document.getElementById('read');
const pointerButton = document.getElementById('pointer');
const rememberButton = document.getElementById('remember');
const pauseButton = document.getElementById('pause-all');
const status = document.getElementById('status');
let currentTab = null, currentSite = null, currentState = null;
function say(text, error = false) { status.textContent = text; status.classList.toggle('error', error); }
function friendly(error) {
  if (/Cannot access|Missing host|extensions gallery|chrome:\/\/|web store/i.test(error.message || '')) return 'Chrome protects this page. Try an article or a ChatGPT conversation.';
  return error.message || 'Chrome could not complete this action. Try again on a regular webpage.';
}
async function activeTab() {
  const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
  if (!tab?.id || !SkimSettings.siteForURL(tab.url)) throw new Error('Open a regular website first. Browser settings and extension pages are protected.');
  const url = new URL(tab.url);
  if (url.hostname === 'chromewebstore.google.com' || (url.hostname === 'chrome.google.com' && url.pathname.startsWith('/webstore'))) throw new Error('Chrome protects the Web Store. Try an article or a ChatGPT conversation.');
  return tab;
}
async function request(message) {
  const result = await chrome.runtime.sendMessage(message);
  if (!result?.ok) throw new Error(result?.error || 'Skim could not save this change.');
  return result;
}
function showActive(active) {
  pointerButton.setAttribute('aria-pressed', String(active));
  pointerButton.querySelector('span').textContent = active ? 'Stop on this page' : 'Start here';
}
function showState(state) {
  currentState = state;
  const remembered = Boolean(currentSite && state.sites.includes(currentSite));
  rememberButton.setAttribute('aria-pressed', String(remembered));
  rememberButton.textContent = remembered ? 'Forget' : 'Allow';
  rememberButton.disabled = !currentSite;
  pauseButton.setAttribute('aria-pressed', String(state.preferences.paused));
  pauseButton.textContent = state.preferences.paused ? 'Resume lens everywhere' : 'Pause lens everywhere';
  pointerButton.disabled = state.preferences.paused;
  if (state.preferences.paused) showActive(false);
  document.getElementById('permission-note').textContent = remembered
    ? 'Automatic on this site. Forget removes the saved site and its access.'
    : 'Chrome asks before you grant access. Forget the site anytime.';
}
readButton.addEventListener('click', async () => {
  readButton.disabled = true;
  say('Preparing this page…');
  let importKey;
  try {
    const tab = await activeTab();
    const [result] = await chrome.scripting.executeScript({target: {tabId: tab.id}, files: ['extract.js']});
    const data = result?.result;
    if (data?.error) throw new Error(data.error);
    if (!data?.text?.trim()) throw new Error('No readable article found. Select some page text, then try again.');
    importKey = 'skim-import-' + crypto.randomUUID();
    const existing = await chrome.storage.session.get(null);
    const stale = Object.keys(existing).filter(key => key.startsWith('skim-import-'));
    if (stale.length) await chrome.storage.session.remove(stale);
    await chrome.storage.session.set({[importKey]: {text: data.text.slice(0, 24000), title: data.title, source: 'Current tab'}});
    await chrome.tabs.create({url: chrome.runtime.getURL('reader/index.html') + '#import=' + encodeURIComponent(importKey)});
    say('Opened your ' + data.kind + '.');
  } catch (error) {
    if (importKey) await chrome.storage.session.remove(importKey).catch(() => {});
    say(friendly(error), true);
  } finally { readButton.disabled = false; }
});
pointerButton.addEventListener('click', async () => {
  pointerButton.disabled = true;
  try {
    const tab = await activeTab();
    const [result] = await chrome.scripting.executeScript({target: {tabId: tab.id}, files: ['overlay.js']});
    if (result?.result?.error) throw new Error(result.result.error);
    const active = Boolean(result?.result?.active);
    showActive(active);
    say(active ? 'Move back to the page and pause over a paragraph. The dock is at the top.' : 'Stopped on this page. Remembered sites still start on the next visit.');
  } catch (error) { say(friendly(error), true); }
  finally { pointerButton.disabled = currentState?.preferences.paused === true; }
});
rememberButton.addEventListener('click', async () => {
  if (!currentSite) return;
  rememberButton.disabled = true;
  try {
    if (currentState?.sites.includes(currentSite)) {
      const next = await request({type: 'skim:forget', site: currentSite});
      showState(next); showActive(false);
      say(next.warning || 'Forgot this site and removed its access. Start here still works when you choose it.');
    } else {
      // Keep this the first asynchronous call in the user's click handler.
      const granted = await chrome.permissions.request({origins: [currentSite]});
      if (!granted) { say('No access granted. Start here still works for one page.'); return; }
      const next = await request({type: 'skim:remember', site: currentSite});
      showState(next);
      if (!next.preferences.paused) {
        const [result] = await chrome.scripting.executeScript({target: {tabId: currentTab.id}, files: ['auto.js', 'overlay.js']});
        if (result?.result?.error) throw new Error(result.result.error);
        showActive(Boolean(result?.result?.active));
      }
      say(next.preferences.paused ? 'Remembered. Skim will return here when you resume the lens.' : 'Remembered. Skim will return on your next visit to this site.');
    }
  } catch (error) { say(friendly(error), true); }
  finally { rememberButton.disabled = !currentSite; }
});
pauseButton.addEventListener('click', async () => {
  pauseButton.disabled = true;
  try {
    const paused = currentState?.preferences.paused !== true;
    await request({type: 'skim:set-preferences', changes: {paused}});
    showState(await request({type: 'skim:get-state'}));
    if (!paused && currentTab) {
      try {
        const [result] = await chrome.scripting.executeScript({target: {tabId: currentTab.id}, func: () => Boolean(globalThis.__skimPointerOverlay)});
        showActive(Boolean(result?.result));
      } catch (_) { /* A navigation can make the earlier tab unavailable. */ }
    }
    say(paused ? 'All page lenses are stopped. Your remembered sites are kept.' : 'Resumed. Skim returns on your remembered sites.');
  } catch (error) { say(friendly(error), true); }
  finally { pauseButton.disabled = false; }
});
document.getElementById('settings').addEventListener('click', () => chrome.runtime.openOptionsPage().catch(error => say(friendly(error), true)));
document.getElementById('webcam').addEventListener('click', () => chrome.tabs.create({url: 'https://skim-attention-lab-anthony.aabdulnour01.chatgpt.site/lab.html'}).catch(error => say(friendly(error), true)));
(async () => {
  try {
    currentTab = await activeTab();
    currentSite = SkimSettings.siteForURL(currentTab.url);
    document.getElementById('site-label').textContent = new URL(currentTab.url).hostname;
    const [result] = await chrome.scripting.executeScript({target: {tabId: currentTab.id}, func: () => Boolean(globalThis.__skimPointerOverlay)});
    showActive(Boolean(result?.result));
  } catch (_) { /* Settings and practice stay available on protected pages. */ }
  try { showState(await request({type: 'skim:get-state'})); }
  catch (error) { say(friendly(error), true); }
})();
