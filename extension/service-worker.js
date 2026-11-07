/* Local lifecycle and optional-site permissions only. No page text enters this worker. */
importScripts('settings.js');
'use strict';
const settings = SkimSettings;
let work = Promise.resolve();
function serial(task) {
  const result = work.then(task, task);
  work = result.catch(() => {});
  return result;
}
async function readState() {
  const data = await chrome.storage.local.get(['skimPreferences', 'skimSites']);
  return {preferences: settings.preferences(data.skimPreferences), sites: settings.sites(data.skimSites)};
}
async function publicState() {
  const state = await readState();
  const grants = await chrome.permissions.getAll();
  return {...state, grants: (grants.origins || []).filter(origin => /^https?:\/\//.test(origin)), version: chrome.runtime.getManifest().version};
}
async function reconcile() {
  const state = await readState();
  const checks = await Promise.all(state.sites.map(async site => await chrome.permissions.contains({origins: [site]}) ? site : null));
  const allowed = checks.filter(Boolean);
  if (allowed.length !== state.sites.length) await chrome.storage.local.set({skimSites: allowed});
  const registered = await chrome.scripting.getRegisteredContentScripts({ids: [settings.scriptId]});
  if (state.preferences.paused || !allowed.length) {
    if (registered.length) await chrome.scripting.unregisterContentScripts({ids: [settings.scriptId]});
    return;
  }
  const declaration = {id: settings.scriptId, matches: allowed, js: ['auto.js', 'overlay.js'], runAt: 'document_idle', allFrames: false, persistAcrossSessions: true};
  if (registered.length) await chrome.scripting.updateContentScripts([declaration]);
  else await chrome.scripting.registerContentScripts([declaration]);
}
async function activateRemembered() {
  const state = await readState();
  if (state.preferences.paused || !state.sites.length) return;
  const tabs = await chrome.tabs.query({url: state.sites});
  await Promise.allSettled(tabs.filter(tab => Number.isInteger(tab.id)).map(tab => chrome.scripting.executeScript({target: {tabId: tab.id}, files: ['auto.js', 'overlay.js']})));
}
async function handle(message, isUI) {
  if (message?.type === 'skim:set-preferences') {
    const state = await readState();
    const changes = message.changes || {};
    const next = settings.preferences({...state.preferences,
      ...(settings.goals.includes(changes.goal) ? {goal: changes.goal} : {}),
      ...(typeof changes.compact === 'boolean' ? {compact: changes.compact} : {}),
      ...(isUI && typeof changes.paused === 'boolean' ? {paused: changes.paused} : {})
    });
    await chrome.storage.local.set({skimPreferences: next});
    if (state.preferences.paused !== next.paused) {
      await reconcile();
      if (!next.paused) await activateRemembered();
    }
    return {ok: true, preferences: next};
  }
  if (!isUI) return {ok: false, error: 'Open Skim to change site access.'};
  if (message?.type === 'skim:get-state') {
    await reconcile();
    return {ok: true, ...await publicState()};
  }
  if (message?.type === 'skim:remember') {
    const site = message.site;
    if (!settings.validSite(site)) return {ok: false, error: 'This is not a supported website.'};
    if (!await chrome.permissions.contains({origins: [site]})) return {ok: false, error: 'Chrome has not granted access to this site. You can still use Start here.'};
    const state = await readState();
    if (!state.sites.includes(site) && state.sites.length >= 100) return {ok: false, error: 'You have reached 100 remembered sites. Forget one in Settings first.'};
    await chrome.storage.local.set({skimSites: settings.sites([...state.sites, site])});
    await reconcile();
    return {ok: true, ...await publicState()};
  }
  if (message?.type === 'skim:forget') {
    const site = message.site;
    if (!settings.validSite(site)) return {ok: false, error: 'This is not a supported website.'};
    const state = await readState();
    // Stop automatic behavior before withdrawing access. Open lenses see this change.
    await chrome.storage.local.set({skimSites: state.sites.filter(item => item !== site)});
    await reconcile();
    await chrome.permissions.remove({origins: [site]});
    const stillGranted = await chrome.permissions.contains({origins: [site]});
    return {ok: true, warning: stillGranted ? 'Automatic mode is off. Chrome still grants broader access; use Remove all site access in Settings to revoke it.' : '', ...await publicState()};
  }
  if (message?.type === 'skim:forget-all') {
    await chrome.storage.local.set({skimSites: []});
    await reconcile();
    const grants = await chrome.permissions.getAll();
    if (grants.origins?.length) await chrome.permissions.remove({origins: grants.origins});
    return {ok: true, ...await publicState()};
  }
  return {ok: false, error: 'Unknown Skim action.'};
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || !String(message?.type || '').startsWith('skim:')) return false;
  const isUI = typeof sender.url === 'string' && sender.url.startsWith(chrome.runtime.getURL(''));
  serial(() => handle(message, isUI)).then(respond, () => respond({ok: false, error: 'Chrome could not save this change. Try again, or check Skim’s site access in Chrome.'}));
  return true;
});
chrome.runtime.onInstalled.addListener(details => {
  serial(async () => {
    const state = await readState();
    await chrome.storage.local.set({skimPreferences: state.preferences, skimSites: state.sites});
    await reconcile();
    if (details.reason === 'install') await chrome.tabs.create({url: chrome.runtime.getURL('welcome.html')});
  }).catch(() => {});
});
chrome.runtime.onStartup.addListener(() => serial(reconcile).catch(() => {}));
chrome.permissions.onRemoved.addListener(() => serial(reconcile).catch(() => {}));
