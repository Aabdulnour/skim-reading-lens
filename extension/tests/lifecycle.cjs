const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const clone = value => JSON.parse(JSON.stringify(value));
function event() {
  const listeners = new Set();
  return {listeners, addListener(fn){listeners.add(fn);}, removeListener(fn){listeners.delete(fn);}, async emit(...args){await Promise.all([...listeners].map(fn => fn(...args))); await new Promise(resolve => setImmediate(resolve));}};
}
function workerFixture(initial = {}) {
  const data = clone(initial.data || {});
  const session = clone(initial.session || {});
  const grants = new Set(initial.grants || []);
  const registered = new Map();
  const calls = {scripts: [], creates: [], queries: [], registration: [], permissionRequests: [], options: 0};
  const onMessage = event(), onInstalled = event(), onStartup = event(), onRemoved = event(), onChanged = event();
  const chrome = {
    storage: {
      local: {async get(keys) {if (!keys) return clone(data); return Object.fromEntries([].concat(keys).filter(k=>Object.hasOwn(data,k)).map(k => [k,clone(data[k])]));},
        async set(values) {const changes={}; for (const [key,value] of Object.entries(values)) {changes[key]={oldValue: data[key], newValue: clone(value)}; data[key]=clone(value);} for(const fn of onChanged.listeners) fn(changes,'local');}},
      session: {async get(){return clone(session);}, async set(values){Object.assign(session,clone(values));}, async remove(keys){for(const key of [].concat(keys)) delete session[key];}},
      onChanged
    },
    runtime: {id:'fixture-id',onMessage,onInstalled,onStartup,getURL(value){return 'chrome-extension://fixture-id/' + value;},getManifest(){return {version:require('../manifest.json').version};},async openOptionsPage(){calls.options++;}},
    permissions: {
      onRemoved,async getAll(){return {origins:[...grants]};},
      async contains({origins}){return origins.every(site => grants.has(site) || grants.has(site.split('//')[0]+'//*/*') || grants.has('*://*/*'));},
      async request(args){calls.permissionRequests.push(clone(args)); if(initial.denyPermission) return false; for(const site of args.origins || []) grants.add(site); return true;},
      async remove({origins}){for(const site of origins) grants.delete(site); for(const fn of onRemoved.listeners) fn({origins}); return true;}
    },
    scripting: {
      async getRegisteredContentScripts({ids}){return ids.filter(id=>registered.has(id)).map(id=>clone(registered.get(id)));},
      async registerContentScripts(items){for(const item of items){if(registered.has(item.id)) throw new Error('Duplicate registration'); registered.set(item.id,clone(item));}calls.registration.push('register');},
      async updateContentScripts(items){for(const item of items){if(!registered.has(item.id)) throw new Error('Missing registration');registered.set(item.id,clone(item));}calls.registration.push('update');},
      async unregisterContentScripts({ids}){for(const id of ids) registered.delete(id);calls.registration.push('unregister');},
      async executeScript(args){calls.scripts.push(clone(args));
        if(args.files?.[0]==='extract.js') return [{result:initial.extractError ? {error:'Selection is editable'} : {text:'a'.repeat(25000),title:'Article',kind:'selection'}}];
        return [{result:args.files ? {active:true} : false}];}
    },
    tabs: {
      async query(args){calls.queries.push(clone(args));return [{id:7,url:initial.url || 'https://example.com/article'}];},
      async create(args){calls.creates.push(clone(args));if(initial.failOpen) throw new Error('Opening tab failed');return {id:8};}
    }
  };
  const context = vm.createContext({chrome, URL, console});
  context.importScripts = file => vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
  vm.runInContext(fs.readFileSync(path.join(root,'service-worker.js'),'utf8'), context, {filename:'service-worker.js'});
  function message(value, sender = {id:chrome.runtime.id,url:chrome.runtime.getURL('popup.html')}) {
    return new Promise(resolve => {
      let accepted=false;
      for(const fn of onMessage.listeners) if(fn(value,sender,resolve)===true) accepted=true;
      if(!accepted) resolve(undefined);
    });
  }
  chrome.runtime.sendMessage = value => message(value);
  return {chrome,data,session,grants,registered,calls,message,context,onInstalled,onStartup,onRemoved};
}
async function testLifecycle() {
  const a = workerFixture();
  await a.onInstalled.emit({reason:'install'});
  assert.equal(a.calls.creates.length,1);
  assert.equal(a.calls.creates[0].url,'chrome-extension://fixture-id/welcome.html');
  assert.equal(a.registered.size,0);
  assert.equal(a.grants.size,0);
  const ungranted = await a.message({type:'skim:remember',site:'https://example.com/*'});
  assert.equal(ungranted.ok,false);
  assert.equal(a.registered.size,0);
  const wildcard = await a.message({type:'skim:remember',site:'https://*/*'});
  assert.equal(wildcard.ok,false);
  const hostile = await a.message({type:'skim:remember',site:'https://example.com/*'}, {id:a.chrome.runtime.id,url:'https://example.com/article'});
  assert.equal(hostile.ok,false);
  assert.equal(await a.message({type:'skim:get-state'}, {id:'another-extension',url:'https://example.com'}),undefined);
  a.grants.add('https://example.com/*');
  a.grants.add('https://second.example/*');
  await Promise.all([
    a.message({type:'skim:remember',site:'https://example.com/*'}),
    a.message({type:'skim:remember',site:'https://second.example/*'})
  ]);
  assert.deepEqual(a.data.skimSites,['https://example.com/*','https://second.example/*']);
  const declaration = a.registered.get('skim-remembered-sites');
  assert.equal(declaration.persistAcrossSessions,true);
  assert.deepEqual(declaration.matches,a.data.skimSites);
  assert.deepEqual(declaration.js,['auto.js','overlay.js']);
  assert.equal(declaration.allFrames,false);
  await a.message({type:'skim:remember',site:'https://example.com/*'});
  assert.equal(a.registered.size,1);
  assert.equal(a.data.skimSites.length,2);
  console.log('PASS lifecycle: first-install onboarding, no initial grants, exact-site validation, sender checks, serialized opt-ins, persistent idempotent registrations');

  await a.message({type:'skim:set-preferences',changes:{goal:'caveat',compact:true}});
  await a.message({type:'skim:set-preferences',changes:{paused:true}});
  assert.equal(a.data.skimPreferences.paused,true);
  assert.equal(a.registered.size,0);
  assert.equal(a.data.skimSites.length,2);
  await a.message({type:'skim:set-preferences',changes:{paused:false}});
  assert.equal(a.registered.size,1);
  assert.deepEqual(a.calls.queries.at(-1),{url:a.data.skimSites});
  assert.deepEqual(a.calls.scripts.at(-1).files,['auto.js','overlay.js']);
  a.registered.clear();
  await a.onInstalled.emit({reason:'update'});
  assert.equal(a.calls.creates.length,1,'updates do not open onboarding again');
  assert.equal(a.registered.size,1,'updates recover registration');
  assert.equal(a.data.skimPreferences.goal,'caveat');
  a.registered.clear();
  await a.onStartup.emit();
  assert.equal(a.registered.size,1,'browser startup recovers registration');
  a.grants.delete('https://second.example/*');
  await a.onRemoved.emit({origins:['https://second.example/*']});
  assert.deepEqual(a.data.skimSites,['https://example.com/*']);
  assert.deepEqual(a.registered.get('skim-remembered-sites').matches,['https://example.com/*']);
  await a.message({type:'skim:forget',site:'https://example.com/*'});
  assert.equal(a.grants.size,0);assert.equal(a.registered.size,0);
  assert.deepEqual(a.data.skimSites,[]);
  console.log('PASS lifecycle: global pause/resume, update/startup recovery, external revocation, forget removes registration and grant');

  const broad=workerFixture({data:{skimSites:['https://example.com/*']},grants:['https://*/*']});
  const broadResult=await broad.message({type:'skim:forget',site:'https://example.com/*'});
  assert.match(broadResult.warning,/broader access/);
  assert.equal(broad.data.skimSites.length,0);
  const clear=await broad.message({type:'skim:forget-all'});
  assert.deepEqual(Array.from(clear.grants),[]);
  assert.equal(broad.grants.size,0);
  console.log('PASS lifecycle: broader Chrome grants are disclosed and remove-all revokes them');
}
module.exports = {workerFixture,testLifecycle};
