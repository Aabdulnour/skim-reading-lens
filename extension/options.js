'use strict';
const status = document.getElementById('status');
const pause = document.getElementById('pause');
const goal = document.getElementById('goal');
const compact = document.getElementById('compact');
const forgetAll = document.getElementById('forget-all');
let state = null;
function say(text, error = false) { status.textContent = text; status.classList.toggle('error', error); }
async function request(message) {
  const result = await chrome.runtime.sendMessage(message);
  if (!result?.ok) throw new Error(result?.error || 'Chrome could not save this change.');
  return result;
}
function render(value) {
  state = value;
  pause.setAttribute('aria-pressed', String(value.preferences.paused));
  pause.textContent = value.preferences.paused ? 'Resume' : 'Pause';
  goal.value = value.preferences.goal; compact.checked = value.preferences.compact;
  document.getElementById('count').textContent = value.sites.length + (value.sites.length === 1 ? ' site' : ' sites');
  document.getElementById('version').textContent = 'Skim Reading Lens · ' + value.version;
  const list = document.getElementById('sites'); list.replaceChildren();
  const origins = [...new Set([...value.sites, ...value.grants])].sort();
  if (!origins.length) {
    const empty = document.createElement('p'); empty.className = 'empty';
    empty.textContent = 'No sites remembered. Skim runs only when you click Start here.';
    list.append(empty);
  }
  for (const site of origins) {
    const row = document.createElement('div'); row.className = 'site-row';
    const detail = document.createElement('div');
    const name = document.createElement('span'); name.className = 'site-name'; name.textContent = site;
    const kind = document.createElement('span'); kind.className = 'site-kind';
    kind.textContent = value.sites.includes(site) ? 'Remembered for automatic activation' : 'Additional access granted in Chrome';
    detail.append(name, kind); row.append(detail);
    if (SkimSettings.validSite(site)) {
      const button = document.createElement('button'); button.className = 'quiet-button'; button.type = 'button'; button.textContent = 'Forget';
      button.setAttribute('aria-label', 'Forget ' + site);
      button.addEventListener('click', async () => {
        button.disabled = true;
        try { const result = await request({type: 'skim:forget', site}); render(result); say(result.warning || 'Forgot the site and removed its access.'); }
        catch (error) { say(error.message, true); button.disabled = false; }
      });
      row.append(button);
    }
    list.append(row);
  }
  forgetAll.disabled = !origins.length;
}
async function change(changes, message) {
  try {
    await request({type: 'skim:set-preferences', changes});
    render(await request({type: 'skim:get-state'}));
    if (message) say(message);
  } catch (error) { say(error.message, true); if (state) render(state); }
}
pause.addEventListener('click', () => { if (state) change({paused: !state.preferences.paused}, state.preferences.paused ? 'Resumed on your remembered sites.' : 'Open lenses are stopped. Your remembered sites are kept.'); });
goal.addEventListener('change', () => change({goal: goal.value}, 'Reading goal saved.'));
compact.addEventListener('change', () => change({compact: compact.checked}, 'Dock preference saved.'));
forgetAll.addEventListener('click', async () => {
  forgetAll.disabled = true;
  try { render(await request({type: 'skim:forget-all'})); say('All remembered sites and permanent site access have been removed.'); }
  catch (error) { say(error.message, true); forgetAll.disabled = false; }
});
document.getElementById('clear-imports').addEventListener('click', async () => {
  try {
    const data = await chrome.storage.session.get(null);
    const keys = Object.keys(data).filter(key => key.startsWith('skim-import-'));
    if (keys.length) await chrome.storage.session.remove(keys);
    say('Waiting imports cleared. Close an open reader tab to clear the text it already loaded.');
  } catch (_) { say('Chrome could not clear waiting imports. Closing the browser session also clears them.', true); }
});
(async () => {
  if (!globalThis.chrome?.runtime?.id) {
    document.querySelectorAll('button,select,input').forEach(element => { element.disabled = true; });
    say('Settings are available inside the installed Skim extension.');
    return;
  }
  try { render(await request({type: 'skim:get-state'})); }
  catch (error) { say(error.message, true); }
})();
