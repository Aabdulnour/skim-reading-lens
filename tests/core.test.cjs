const test=require('node:test');
const assert=require('node:assert/strict');
const {analyze,splitSentences,LIMIT}=require('../dist/core.js');
test('selected text and offsets are exact substrings, including negation and decimals',()=>{
const text='The cost is $15.50 per month. Do not launch unless the tests pass. Keep the caveat.';
const result=analyze(text,'caveat');const p=result.paragraphs[0];assert.equal(p.pick.text,'Do not launch unless the tests pass.');
for(const s of p.sentences)assert.equal(p.text.slice(s.start,s.end),s.text);
assert.ok(p.sentences.some(s=>s.text.includes('$15.50')));
});
test('goals select meaningfully different original sentences',()=>{const t='Use the basic plan for a small test. However, it does not include offline mode. The plan costs $15.50 per month.';assert.equal(analyze(t,'action').paragraphs[0].pick.text,'Use the basic plan for a small test.');assert.equal(analyze(t,'caveat').paragraphs[0].pick.text,'However, it does not include offline mode.');assert.equal(analyze(t,'evidence').paragraphs[0].pick.text,'The plan costs $15.50 per month.');});
test('focus words change selection without generating text',()=>{const t='The camera stays in the browser. The local server can enable Jev for sentence selection.';assert.match(analyze(t,'answer','camera browser').paragraphs[0].pick.text,/camera/);});
test('source markup remains literal input to the selector',()=>{const t='<script>alert(1)</script> is literal text. Never execute pasted content.';const r=analyze(t,'caveat');assert.ok(r.text.includes('<script>'));assert.ok(t.includes(r.paragraphs[0].pick.text));});
test('paragraphs stay in source order and blank input is safe',()=>{assert.equal(analyze(' \n ').paragraphs.length,0);const r=analyze('First paragraph.\n\nSecond paragraph.');assert.deepEqual(r.paragraphs.map(p=>p.text),['First paragraph.','Second paragraph.']);});
test('large input is bounded and has no invalid sentence offsets',()=>{const r=analyze(('A bounded sentence about the camera.\n\n').repeat(2000));assert.ok(r.text.length<=LIMIT);assert.ok(r.paragraphs.length<=80);for(const p of r.paragraphs)for(const s of p.sentences)assert.equal(p.text.slice(s.start,s.end),s.text);});
test('single sentence does not require an AI choice',()=>{const r=analyze('Keep the original wording.');assert.equal(r.paragraphs[0].sentences.length,1);assert.equal(r.paragraphs[0].pick.text,'Keep the original wording.');});
test('non-Latin text is retained without claiming language understanding',()=>{const t='هذا نص عربي. لا تحذف السياق.';const r=analyze(t);assert.equal(r.text,t);assert.ok(t.includes(r.paragraphs[0].pick.text));});

test('paragraph cap merges overflow without losing source content',()=>{const t=Array.from({length:100},(_,i)=>'Unique passage '+i+'.').join('\n\n');const r=analyze(t);assert.equal(r.paragraphs.length,80);assert.ok(r.paragraphs.at(-1).text.includes('Unique passage 99.'));});
