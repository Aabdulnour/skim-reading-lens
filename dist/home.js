'use strict';
(() => {
  const nodes=[...document.querySelectorAll('[data-preview]')];if(!window.SkimCore||!nodes.length)return;
  const original=nodes.map(node=>node.textContent);let goal='caveat',active=1,pending;
  function render(){nodes.forEach((node,i)=>{node.replaceChildren();node.classList.toggle('active',i===active);const paragraph=SkimCore.analyze(original[i],goal).paragraphs[0];if(!paragraph||i!==active){node.textContent=original[i];return;}const chosen=paragraph.pick;if(!chosen||typeof chosen.start!=='number'){node.textContent=original[i];return;}node.append(document.createTextNode(original[i].slice(0,chosen.start)));const mark=document.createElement('span');mark.className='picked';mark.textContent=original[i].slice(chosen.start,chosen.end);node.append(mark,document.createTextNode(original[i].slice(chosen.end)));});}
  nodes.forEach((node,i)=>{node.tabIndex=0;node.addEventListener('pointerenter',()=>{clearTimeout(pending);pending=setTimeout(()=>{active=i;render();},240);});node.addEventListener('pointerleave',()=>clearTimeout(pending));node.addEventListener('focus',()=>{active=i;render();});});
  document.querySelectorAll('[data-demo-goal]').forEach(button=>button.addEventListener('click',()=>{goal=button.dataset.demoGoal;document.querySelectorAll('[data-demo-goal]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));render();}));render();
})();
