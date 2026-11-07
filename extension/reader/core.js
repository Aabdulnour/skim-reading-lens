/* Skim local sentence selection. Original sentences are always preserved. */
(function(root){
  'use strict';
  const LIMIT = 24000;
  const STOP = new Set('a an and are as at be been being but by can could did do does for from had has have how i if in into is it its may me more my of on or our should so some than that the their them there these they this to too was we were what when where which who why will with would you your'.split(' '));
  const words = s => (s.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)||[]);
  const tokens = s => words(s.toLowerCase()).filter(w=>w.length>2 && !STOP.has(w));
  function splitSentences(text) {
    let pieces;
    if(typeof Intl !== 'undefined' && Intl.Segmenter) pieces = Array.from(new Intl.Segmenter('en',{granularity:'sentence'}).segment(text),x=>({text:x.segment,start:x.index}));
    else { pieces=[]; const re=/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g; let m; while((m=re.exec(text)))pieces.push({text:m[0],start:m.index}); }
    return pieces.map((p,i)=>{const left=p.text.length-p.text.trimStart().length; const clean=p.text.trim();return {id:'s'+i,text:clean,start:p.start+left,end:p.start+left+clean.length,index:i};}).filter(p=>p.text);
  }
  function describe(sentence,goal,topicTokens,frequency) {
    const t=sentence.text, n=words(t).length, tags=[];
    let score = n>=7&&n<=42 ? 2.2 : n<4 ? -2 : 0.4;
    const caution = /\b(but|however|unless|except|only if|not|never|cannot|can't|risk|limitation|uncertain|unreliable|trade.?off|without|no guarantee)\b/i.test(t);
    const action = /\b(start|try|test|build|use|choose|check|measure|keep|avoid|ask|compare|ship|must|should|recommend|next step)\b/i.test(t);
    const evidence = /\d|\b(data|measured|study|research|evidence|according|tested|results?)\b/i.test(t);
    const direct = /\b(answer|best|recommend|means|because|key|point|worth|focus|goal|works?|important|need|rather)\b/i.test(t);
    if(caution)tags.push('Caveat');
    if(action)tags.push('Action');
    if(evidence)tags.push('Detail');
    if(!tags.length)tags.push('Main point');
    score += goal==='caveat' ? (caution?6:0) : goal==='action' ? (action?5:0) : goal==='evidence' ? (evidence?5:0) : (direct?2.4:0)+(action?0.9:0)+(caution?0.8:0);
    let matches=0; const own=new Set(tokens(t)); topicTokens.forEach(w=>{if(own.has(w)){matches++;score+=3;}});
    let weight=0; own.forEach(w=>weight+=Math.min(3,frequency[w]||0)); score+=Math.min(2,weight/Math.max(1,own.size));
    if(/^(in (today's|conclusion|summary)|it's (important|worth)|it is (important|worth)|there are (many|several)|generally speaking|when it comes to|in order to|as we (navigate|explore))/i.test(t))score-=1.8;
    score-=sentence.index*0.025;
    let reason=matches ? 'Matches your focus words in the original text.' : goal==='caveat'&&caution ? 'Contains a qualification, exception, or limitation.' : goal==='action'&&action ? 'Contains a concrete action or recommendation.' : goal==='evidence'&&evidence ? 'Contains a number or an evidence cue. Not independently verified.' : direct ? 'Contains answer or explanation cues.' : 'Highest local sentence score for this paragraph.';
    return {...sentence,score:Math.round(score*100)/100,tags,reason};
  }
  function analyze(input,goal='answer',topic=''){
    const text=String(input||'').replace(/\r\n?/g,'\n').slice(0,LIMIT).trim();
    const chunks=text.split(/\n\s*\n|\n(?=\s*(?:[-*•]|\d+[.)])\s)/).map(s=>s.trim()).filter(Boolean);
    if(chunks.length>80)chunks.splice(79,chunks.length-79,chunks.slice(79).join('\n\n'));
    const frequency={}; for(const w of tokens(text))frequency[w]=(frequency[w]||0)+1;
    const topicTokens=tokens(String(topic||'').slice(0,180));
    const paragraphs=chunks.map((text,i)=>{const sentences=splitSentences(text).map(s=>describe(s,goal,topicTokens,frequency));const pick=[...sentences].sort((a,b)=>b.score-a.score)[0];return{id:'p'+i,text,sentences,pick};});
    return {paragraphs,wordCount:words(text).length,focusWords:paragraphs.reduce((n,p)=>n+words(p.pick?.text||'').length,0),text,goal,topic};
  }
  const api={analyze,splitSentences,words,LIMIT};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.SkimCore=api;
})(typeof window!=='undefined'?window:globalThis);
