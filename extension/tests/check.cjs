/* Behavioral Node fixtures. Actual Chrome UI/permission validation is a separate check. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {workerFixture,testLifecycle} = require('./lifecycle.cjs');
const {testOverlay} = require('./overlay.cjs');
const root = path.resolve(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
assert.equal(manifest.manifest_version,3);
assert.equal(manifest.version,JSON.parse(fs.readFileSync(path.join(root,'../package.json'),'utf8')).version);
assert.deepEqual([...manifest.permissions].sort(),['activeTab','scripting','storage']);
assert.deepEqual([...manifest.optional_host_permissions].sort(),['http://*/*','https://*/*']);
assert.equal(manifest.host_permissions,undefined);
assert.equal(manifest.content_scripts,undefined);
assert.equal(manifest.background.service_worker,'service-worker.js');
assert.equal(manifest.options_page,'options.html');
assert.equal(manifest.content_security_policy.extension_pages,"script-src 'self'; object-src 'none'");
for(const file of ['popup.js','extract.js','overlay.js','settings.js','service-worker.js','auto.js','options.js','welcome.js']) {
  const source=fs.readFileSync(path.join(root,file),'utf8');new vm.Script(source,{filename:file});
  assert.equal(/\b(?:fetch|XMLHttpRequest|WebSocket|eval)\s*\(/.test(source),false,file+' has no network or dynamic-code calls');
  if(file==='service-worker.js') assert.deepEqual([...source.matchAll(/importScripts\(([^)]*)\)/g)].map(m=>m[1]),["'settings.js'"]);
  else assert.equal(/\bimportScripts\s*\(/.test(source),false);
}
console.log('PASS manifest: only required local permissions, optional host declarations, bundled runtime, MV3 CSP, syntax, no network/eval');
function popup(options={}) {
  function element(){return {textContent:'',disabled:false,attrs:{},listeners:{},classList:{toggle(){}},addEventListener(name,handler){this.listeners[name]=handler;},setAttribute(name,value){this.attrs[name]=value;},querySelector(){return this.span||(this.span={textContent:''});}};}
  const elements=Object.fromEntries(['read','pointer','status','webcam','settings','remember','pause-all','site-label','permission-note'].map(id=>[id,element()]));
  const fixture=workerFixture({...options,session:{'skim-import-old':{text:'old'},unrelated:'keep'}});
  const context=vm.createContext({
    chrome:fixture.chrome,crypto:{randomUUID(){return 'test-uuid';}},URL,
    document:{getElementById(id){return elements[id];}}
  });
  vm.runInContext(fs.readFileSync(path.join(root,'settings.js'),'utf8'),context);
  vm.runInContext(fs.readFileSync(path.join(root,'popup.js'),'utf8'),context);
  return {...fixture,elements,ready:()=>new Promise(resolve=>setImmediate(resolve))};
}
// Exercise the extractor's rendered-text traversal, including inline whitespace.
function extractFixture({selected = false, latest = false, editable = false, long = false} = {}) {
  class Element {
    constructor(tag, parent = null, excluded = false){this.tagName = tag;this.parentElement = parent;this.excluded = excluded;this.nodes = [];this.nodeType = 1;}
    closest(selector){
      if(selector.includes('script') || selector.includes('contenteditable')) {for(let el=this;el;el=el.parentElement) if(el.excluded) return el; return null;}
      const tags=selector.split(',').map(t=>t.toUpperCase());
      for(let el=this;el;el=el.parentElement) if(tags.includes(el.tagName)) return el;
      return null;
    }
    getClientRects(){return [{}];}
  }
  const article = new Element('ARTICLE'), paragraph = new Element('P',article), first = new Element('STRONG',paragraph), last = new Element('EM',paragraph), hidden = new Element('SPAN',paragraph,true), field = new Element('INPUT',paragraph,true);
  const text = (value,parent) => ({nodeValue:value,parentElement:parent,nodeType:3});
  const left=text(long?'x'.repeat(25000):'Keep',first), space=text(' ',paragraph), right=text('the space.',last);
  paragraph.nodes = [left,space,text('SECRET',hidden),right,text('PASSWORD',field)];
  article.nodes = paragraph.nodes;
  const assistant = new Element('DIV'); assistant.nodes=[text('Latest assistant answer.',assistant)];
  if(editable) first.excluded=true;
  const range = {commonAncestorContainer:left, startContainer:left, endContainer:left, startOffset:0,endOffset:4,intersectsNode(node){return node===left;}};
  // The root for a single text-node selection is its parent.
  first.nodes=[left];
  const result=vm.runInNewContext(fs.readFileSync(path.join(root,'extract.js'),'utf8'),{
    Element, Node:{ELEMENT_NODE:1},NodeFilter:{SHOW_TEXT:4},
    getComputedStyle(){return {display:'block',visibility:'visible',opacity:'1'};},
    window:{getSelection(){return selected ? {isCollapsed:false,rangeCount:1,anchorNode:left,focusNode:left,getRangeAt(){return range;}} : {isCollapsed:true};}},
    document:{title:'Test article',createTreeWalker(root){let i=0;return {nextNode(){return root.nodes[i++] || null;}};},querySelectorAll(selector){if(selector.includes('data-message')) return latest?[assistant]:[];if(selector.includes('article'))return [article];return [paragraph];}}
  });
  return result;
}

(async()=>{
  const original=extractFixture();
  assert.equal(original.text,'Keep the space.');assert.equal(original.kind,'article');
  assert.equal(extractFixture({selected:true}).text,'Keep');
  assert.equal(extractFixture({latest:true}).text,'Latest assistant answer.');
  assert.match(extractFixture({selected:true,editable:true}).error,/editable/);
  assert.equal(extractFixture({long:true}).text.length,24000);
  console.log('PASS extraction: inline whitespace, hidden/input exclusion, selection, assistant precedence, editable rejection, size cap');

  const good=popup();await good.ready();
  assert.equal(good.calls.scripts.every(call=>!call.files),true,'opening popup does not read page text');
  assert.equal(good.calls.permissionRequests.length,0,'opening popup never asks for host access');
  await good.elements.read.listeners.click();
  assert.equal(good.session['skim-import-test-uuid'].text.length,24000);
  assert.equal(good.session['skim-import-test-uuid'].source,'Current tab');
  assert.equal(good.session['skim-import-old'],undefined);assert.equal(good.session.unrelated,'keep');
  assert.equal(good.calls.creates[0].url,'chrome-extension://fixture-id/reader/index.html#import=skim-import-test-uuid');
  await good.elements.webcam.listeners.click();
  assert.equal(good.calls.creates[1].url,'https://skim-attention-lab-anthony.aabdulnour01.chatgpt.site/lab.html');
  console.log('PASS popup: no extraction on open, bounded import, abandoned-import cleanup, fixed webcam URL with no text');

  const failure=popup({failOpen:true});await failure.ready();await failure.elements.read.listeners.click();
  assert.equal(failure.session['skim-import-test-uuid'],undefined);assert.equal(failure.session.unrelated,'keep');
  assert.match(failure.elements.status.textContent,/failed/);
  const refused=popup({extractError:true});await refused.ready();await refused.elements.read.listeners.click();
  assert.equal(refused.calls.creates.length,0);assert.equal(refused.session['skim-import-test-uuid'],undefined);
  for(const url of ['chrome://extensions','https://chromewebstore.google.com/detail/test']) {
    const restricted=popup({url});await restricted.ready();await restricted.elements.read.listeners.click();
    assert.equal(restricted.calls.scripts.length,0);assert.equal(restricted.calls.creates.length,0);
    assert.equal(restricted.elements.remember.disabled,true);
  }
  console.log('PASS popup: failed-tab cleanup, extractor rejection, protected-page refusal');

  const denied=popup({denyPermission:true});await denied.ready();await denied.elements.remember.listeners.click();
  assert.deepEqual(denied.calls.permissionRequests,[{origins:['https://example.com/*']}]);
  assert.equal(denied.registered.size,0);assert.equal(denied.grants.size,0);
  assert.match(denied.elements.status.textContent,/No access/);
  await denied.elements.pointer.listeners.click();
  assert.deepEqual(denied.calls.scripts.at(-1).files,['overlay.js']);
  assert.equal(denied.calls.permissionRequests.length,1,'one-off mode makes no host request');

  const remember=popup();await remember.ready();await remember.elements.remember.listeners.click();
  assert.equal(remember.elements.remember.textContent,'Forget');
  assert.deepEqual(remember.data.skimSites,['https://example.com/*']);
  assert.deepEqual(remember.calls.scripts.at(-1).files,['auto.js','overlay.js']);
  await remember.elements.remember.listeners.click();
  assert.equal(remember.elements.remember.textContent,'Allow');
  assert.deepEqual(remember.data.skimSites,[]);assert.equal(remember.grants.size,0);assert.equal(remember.registered.size,0);
  console.log('PASS popup: permission denial keeps one-off usable, exact-site allow, immediate automatic lens, and forget revocation');

  await testLifecycle();
  await testOverlay();
  console.log('Chrome install UI, real permission prompts, and Chrome Web Store review remain separate from these Node fixtures.');
})().catch(error=>{console.error(error);process.exitCode=1;});
