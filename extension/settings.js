/* Shared, bounded settings. This file makes no network or Chrome API calls. */
(() => {
  'use strict';
  const goals = ['answer', 'action', 'caveat', 'evidence'];
  const defaults = Object.freeze({goal: 'answer', paused: false, compact: false});
  function preferences(value) {
    const input = value && typeof value === 'object' ? value : {};
    return {goal: goals.includes(input.goal) ? input.goal : defaults.goal, paused: input.paused === true, compact: input.compact === true};
  }
  function siteForURL(value) {
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) return null;
      // Chrome host permissions cover all ports for this scheme and hostname.
      return `${url.protocol}//${url.hostname}/*`;
    } catch (_) { return null; }
  }
  function validSite(value) {
    return typeof value === 'string' && value.length <= 300 && value.endsWith('/*') && !value.slice(0, -2).includes('*') && siteForURL(value) === value;
  }
  function sites(value) {
    return [...new Set(Array.isArray(value) ? value.filter(validSite) : [])].slice(0, 100).sort();
  }
  globalThis.SkimSettings = Object.freeze({goals, defaults, preferences, siteForURL, validSite, sites, scriptId: 'skim-remembered-sites'});
})();
