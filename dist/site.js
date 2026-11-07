'use strict';
(() => {
  const config = window.SKIM_RELEASE || {};
  const store = typeof config.chromeWebStoreUrl === 'string' && /^https:\/\/chromewebstore\.google\.com\/detail\/[^\s]+$/.test(config.chromeWebStoreUrl) ? config.chromeWebStoreUrl : null;
  if (store) {
    document.querySelectorAll('[data-install-link]').forEach(link => {link.href=store;link.textContent='Add to Chrome ↗';});
    document.querySelectorAll('[data-release-note]').forEach(node => {node.textContent='Available on the Chrome Web Store. Updates arrive through Chrome.';});
    document.querySelectorAll('[data-store-pending]').forEach(node => {node.hidden=true;});
    document.querySelectorAll('[data-store-live]').forEach(node => {node.hidden=false;});
  }
  const repo = typeof config.sourceRepositoryUrl==='string' && /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/.test(config.sourceRepositoryUrl) ? config.sourceRepositoryUrl : null;
  if(repo) document.querySelectorAll('[data-repository-link]').forEach(link=>{link.href=repo;link.hidden=false;});
  const email = typeof config.supportEmail==='string' && /^[^\s@?&]+@[^\s@?&]+\.[^\s@?&]+$/.test(config.supportEmail) ? config.supportEmail : null;
  if(email){document.querySelectorAll('[data-support-link]').forEach(link=>{link.href='mailto:'+encodeURIComponent(email);link.textContent=email;link.hidden=false;});document.querySelectorAll('[data-support-pending]').forEach(node=>{node.hidden=true;});}
  document.querySelectorAll('[data-copy]').forEach(button=>button.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(button.dataset.copy);button.textContent='Copied';}catch(_){button.textContent='Select and copy the address';}}));
  document.querySelector('#download-report')?.addEventListener('click',()=>{
    const body=`SKIM READING LENS FEEDBACK\nVersion: ${config.version||'unknown'}\n\nWhat I expected:\n\nWhat happened:\n\nSteps to reproduce:\n1.\n2.\n3.\n\nChrome version (chrome://version):\nOperating system:\nSite name (optional, omit private URLs):\nLens goal:\nOne-off or remembered site:\n\nAttach a screenshot only after removing private page content.\nNo browsing history, page text, or account details were collected to make this file.\n`;
    const url=URL.createObjectURL(new Blob([body],{type:'text/plain;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download='skim-feedback.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    const status=document.querySelector('#report-status');if(status)status.textContent='Template downloaded. Nothing was sent.';
  });
})();
