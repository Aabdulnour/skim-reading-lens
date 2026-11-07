const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname,'../overlay.js'),'utf8');
function overlayFixture({extension = false, preferences = {}, sites = ['https://example.com/*'], removeThrows = false} = {}) {
  const timers = new Map(); let nextTimer=0;
  const docEvents = new Map(), winEvents = new Map(), storedEvents = new Set(), observers = [];
  const data={skimPreferences:{goal:'answer',paused:false,compact:false,...preferences},skimSites:[...sites]};
  const calls={saved:[],dom:[]};
  function events(obj) {
    obj.listeners=new Map();
    obj.addEventListener=(name,fn)=>{if(!obj.listeners.has(name))obj.listeners.set(name,new Set());obj.listeners.get(name).add(fn);};
    obj.removeEventListener=(name,fn)=>obj.listeners.get(name)?.delete(fn);
    obj.emit=async(name,event={})=>{for(const fn of obj.listeners.get(name)||[]) await fn(event);};
  }
  class Element {
    constructor(tag='div', parent=null, blocked=false){this.tagName=tag.toUpperCase();this.parentElement=parent;this.blocked=blocked;this.isConnected=true;this.children=[];this.dataset={};this.style={cssText:''};this.attributes={};this.textContent='';this.value='';this.classList={state:{},toggle:(name,value)=>{this.classList.state[name]=value;}};events(this);}
    closest(selector) {
      if (selector.includes('contenteditable') || selector.includes('input')) {for(let el=this;el;el=el.parentElement)if(el.blocked || ['INPUT','TEXTAREA','SELECT'].includes(el.tagName))return el;return null;}
      const tags=selector.split(',').map(s=>s.toUpperCase());for(let el=this;el;el=el.parentElement)if(tags.includes(el.tagName))return el;return null;
    }
    getClientRects(){return [{left:100,right:700,top:250,bottom:280,width:600,height:30}];}
    append(...items){this.children.push(...items);calls.dom.push(...items);}
    remove(){this.isConnected=false;this.removed=true;}
    setAttribute(name,value){this.attributes[name]=value;}
    attachShadow(){const map=Object.fromEntries(['.card','.cue','.peek','select','.pause','.minimize','.close'].map(key=>[key,new Element(key==='select'?'select':'div')]));const shadow={innerHTML:'',querySelector(key){return map[key];},map};this.shadow=shadow;return shadow;}
  }
  const paragraph = new Element('p');
  const textValues=['Keep the page exactly as it is. ','However, offline support is not included. ','Open Settings to choose your next step.'];
  paragraph.nodes=textValues.map(nodeValue=>({nodeValue,parentElement:paragraph}));
  const documentElement=new Element('html');
  const document={
    hidden:false,documentElement,
    createElement(tag){return new Element(tag);},
    createTreeWalker(element){let i=0;return {nextNode(){return element.nodes[i++]||null;}};},
    createRange(){return {setStart(node,offset){this.startNode=node;this.start=offset;},setEnd(node,offset){this.endNode=node;this.end=offset;},toString(){return this.startNode.nodeValue.slice(this.start,this.end);},getClientRects(){return [{left:100,right:700,top:250,bottom:280,width:600,height:30}];}};},
    elementFromPoint(){return paragraph;}
  };
  events(document);const window={};events(window);
  const CSS={highlights:new Map()};
  class Highlight{constructor(...ranges){this.ranges=ranges;}}
  class MutationObserver{constructor(fn){this.fn=fn;observers.push(this);}observe(element){this.element=element;}disconnect(){this.element=null;}}
  const chrome=extension ? {
    runtime:{id:'test',async sendMessage(message){calls.saved.push(message);return {ok:true};}},
    storage:{local:{async get(){return data;}},onChanged:{addListener(fn){storedEvents.add(fn);},removeListener(fn){if(removeThrows)throw new Error('Extension context invalidated');storedEvents.delete(fn);}}}
  } : undefined;
  const context=vm.createContext({document,window,Element,NodeFilter:{SHOW_TEXT:4},CSS,Highlight,MutationObserver,chrome,
    location:{protocol:'https:',hostname:'example.com'},innerHeight:900,innerWidth:1200,
    crypto:{randomUUID(){return 'test';}},getComputedStyle(){return {display:'block',visibility:'visible',opacity:'1'};},
    setTimeout(fn){const id=++nextTimer;timers.set(id,fn);return id;},clearTimeout(id){timers.delete(id);},
    Intl,console
  });
  async function run(){return await vm.runInContext(source,context);}
  async function flush(){for(const [id,fn]of[...timers]){timers.delete(id);await fn();}}
  async function move(element=paragraph){await document.emit('pointermove',{target:element,clientX:300,clientY:260,composedPath(){return [element];}});await flush();}
  function picked(){return [...CSS.highlights.values()][0]?.ranges.map(range=>range.toString()).join('')||'';}
  function shadow(){return documentElement.children.find(el=>el.dataset.skimPointer && !el.removed)?.shadow;}
  async function changeStored(changes){for(const fn of storedEvents)fn(changes,'local');}
  return {run,flush,move,picked,shadow,context,Element,document,window,paragraph,CSS,observers,data,calls,storedEvents,changeStored};
}
async function testOverlay(){
  const unsupported=await vm.runInNewContext(source,{});
  assert.equal(unsupported.active,false);assert.match(unsupported.error,/CSS Highlight/);
  let removed=false;
  const stopped=await vm.runInNewContext(source,{__skimPointerOverlay:{destroy(){removed=true;}}});
  assert.equal(stopped.active,false);assert.equal(removed,true);
  const a=overlayFixture();
  assert.equal((await a.run()).active,true);
  const nodesBefore=[...a.paragraph.nodes];
  await a.move();
  assert.equal(a.picked(),'Keep the page exactly as it is.');
  assert.equal(a.shadow().querySelector('.peek').textContent,a.picked());
  const select=a.shadow().querySelector('select');select.value='caveat';await select.emit('change');
  assert.equal(a.picked(),'However, offline support is not included.');
  assert.deepEqual(a.paragraph.nodes,nodesBefore,'no source DOM wrappers or replacements');
  assert.equal(a.paragraph.nodes.map(n=>n.nodeValue).join(''),'Keep the page exactly as it is. However, offline support is not included. Open Settings to choose your next step.');
  select.value='action';await select.emit('change');
  assert.equal(a.picked(),'Open Settings to choose your next step.');
  a.paragraph.nodes[2].nodeValue='You must enable local mode before the next step.';
  a.observers[0].fn();await a.flush();
  assert.equal(a.picked(),'You must enable local mode before the next step.');
  a.paragraph.nodes[2].nodeValue='There are 4 reading goals available in the dock.';
  select.value='evidence';await select.emit('change');
  assert.equal(a.picked(),'There are 4 reading goals available in the dock.');
  const pause=a.shadow().querySelector('.pause');await pause.emit('click');assert.equal(a.picked(),'');
  await a.move();assert.equal(a.picked(),'');
  await pause.emit('click');await a.move();assert.notEqual(a.picked(),'');
  const mini=a.shadow().querySelector('.minimize');await mini.emit('click');assert.equal(a.shadow().querySelector('.card').classList.state.compact,true);
  a.context.__skimAutoLaunch=true;assert.equal((await a.run()).active,true);assert.ok(a.context.__skimPointerOverlay);
  const input=new a.Element('input');await a.document.emit('keydown',{key:'Escape',defaultPrevented:false,composedPath(){return [input];}});
  assert.ok(a.context.__skimPointerOverlay,'Escape inside typing fields is not intercepted');
  await a.document.emit('keydown',{key:'Escape',defaultPrevented:false,composedPath(){return [a.paragraph];}});
  assert.equal(a.context.__skimPointerOverlay,undefined);assert.equal(a.picked(),'');assert.equal(a.shadow(),undefined);
  console.log('PASS dock: exact source ranges, four-goal selection, streamed text refresh, pause/minimize, automatic idempotence, typing-safe Escape and cleanup');

  const paused=overlayFixture({extension:true,preferences:{paused:true}});
  assert.equal((await paused.run()).active,false);assert.equal(paused.calls.dom.length,0);
  const forgotten=overlayFixture({extension:true,sites:[]});forgotten.context.__skimAutoLaunch=true;
  assert.equal((await forgotten.run()).active,false);assert.equal(forgotten.calls.dom.length,0);
  const b=overlayFixture({extension:true,removeThrows:true});
  await b.run();await b.move();
  await b.changeStored({skimPreferences:{newValue:{paused:true}}});
  assert.equal(b.context.__skimPointerOverlay,undefined);assert.equal(b.shadow(),undefined);assert.equal(b.picked(),'');
  const c=overlayFixture({extension:true});await c.run();
  await c.changeStored({skimSites:{oldValue:['https://example.com/*'],newValue:[]}});
  assert.equal(c.shadow(),undefined);
  console.log('PASS dock: global pause, unremembered-site guard, forgotten-site shutdown, cleanup after invalidated extension context');

  const cache=overlayFixture({extension:true});cache.context.__skimAutoLaunch=true;await cache.run();await cache.move();
  await cache.window.emit('pagehide',{persisted:true});
  assert.ok(cache.context.__skimPointerOverlay,'cached page keeps a restorable dock');
  assert.equal(cache.picked(),'');await cache.move();assert.equal(cache.picked(),'','cached state cannot keep highlighting');
  await cache.window.emit('pageshow',{persisted:true});await cache.move();assert.notEqual(cache.picked(),'');
  await cache.window.emit('pagehide',{persisted:true});
  cache.data.skimPreferences.paused=true;
  await cache.window.emit('pageshow',{persisted:true});
  assert.equal(cache.shadow(),undefined,'resume rechecks global pause');
  const revoked=overlayFixture({extension:true});revoked.context.__skimAutoLaunch=true;await revoked.run();
  await revoked.window.emit('pagehide',{persisted:true});revoked.data.skimSites=[];
  await revoked.window.emit('pageshow',{persisted:true});assert.equal(revoked.shadow(),undefined);
  const leave=overlayFixture();await leave.run();await leave.window.emit('pagehide',{persisted:false});assert.equal(leave.shadow(),undefined);
  console.log('PASS dock: Back/Forward cache restoration revalidates pause and remembered-site settings; normal navigation tears down');
}
module.exports={testOverlay,overlayFixture};
