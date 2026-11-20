import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { recordReveal } from '../tools/record-reveal.mjs';
import { runFetch } from '../tools/fetch.mjs';
import { alertReveal } from '../tools/alert-reveal.mjs';
import { renderStatus } from '../tools/build-status.mjs';
function workspace(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'krillion-hourly-'));t.after(()=>{const resolved=fs.realpathSync(root);assert.equal(path.dirname(resolved),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(resolved).startsWith('krillion-hourly-'));fs.rmSync(resolved,{recursive:true,force:true});});return root;}
const reveal=(date,n=2)=>({date,prompts:Array.from({length:7},(_,i)=>({id:'p'+i,text:'Prompt '+i,answers:Array.from({length:n},(_,j)=>({answer:'Answer '+j,score:100,tier:'krillion',aliases:[]}))}))});
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
const recordFile=(root,date)=>path.join(root,'design/phase-one/records',date+'.json');
for(const [name,stage,alter]of [
 ['http','http',d=>[d,503]],['prompt-count','prompts',d=>{d.prompts.pop();return[d]}],
 ['empty-answers','answers',d=>{d.prompts[0].answers=[];return[d]}],
 ['missing-score','scores',d=>{d.prompts[0].answers.forEach(a=>delete a.score);return[d]}],
 ['duplicate-name','duplicates',d=>{d.prompts[0].answers[1].answer='  ANSWER 0 ';return[d]}],
 ['wrong-date','date',d=>{d.date='2026-11-18';return[d]}]
])test('publication gate rejects '+name+' without writing records',async t=>{
 const root=workspace(t);const [data,status=200]=alter(reveal('2026-11-19'));
 await assert.rejects(recordReveal({root,now:'2026-11-19T07:00:00Z',fetchImpl:async()=>response(data,status)}),e=>{assert.equal(e.report.validationStep,stage);assert.ok(Object.hasOwn(e.report,'httpStatus'));assert.ok(Object.hasOwn(e.report,'answerCounts'));return true;});
 assert.equal(fs.existsSync(recordFile(root,'2026-11-19')),false);
});
test('answer totals reject both >90% loss and >90% increase; forced writes keep old data on failure',async t=>{
 for(const [before,after]of [[20,1],[1,2]]){const root=workspace(t);await recordReveal({root,now:'2026-11-18T07:00:00Z',fetchImpl:async()=>response(reveal('2026-11-18',before))});const original=fs.readFileSync(path.join(root,'design/phase-one/reveal-snapshot.json'));await assert.rejects(recordReveal({root,now:'2026-11-19T07:00:00Z',forceRefresh:true,fetchImpl:async()=>response(reveal('2026-11-19',after))}),e=>e.report.validationStep==='answer-total');assert.ok(original.equals(fs.readFileSync(path.join(root,'design/phase-one/reveal-snapshot.json'))));assert.equal(fs.existsSync(recordFile(root,'2026-11-19')),false);}
});
test('seven consecutive days create seven records, each hourly rerun is request-free',async t=>{
 const root=workspace(t);let calls=0;
 for(let i=0;i<7;i++){const date=new Date(Date.UTC(2026,10,12+i)).toISOString().slice(0,10);const options={root,now:date+'T08:00:00Z',fetchImpl:async()=>{calls++;return response(reveal(date));}};await recordReveal(options);assert.equal((await recordReveal(options)).capture,'already-recorded');}
 assert.equal(calls,7);assert.equal(fs.readdirSync(path.dirname(recordFile(root,'2026-11-18'))).length,7);
});
test('historical CLI requires force and never moves latest backwards',async t=>{
 const root=workspace(t);await assert.rejects(runFetch(['--date=2026-11-18'],{root}));
 await recordReveal({root,now:'2026-11-19T08:00:00Z',fetchImpl:async()=>response(reveal('2026-11-19'))});
 const result=await runFetch(['--date=2026-11-18','--force'],{root,now:'2026-11-19T08:00:00Z',fetchImpl:async()=>response(reveal('2026-11-18'))});assert.equal(result.failed,false);assert.equal(JSON.parse(fs.readFileSync(path.join(root,'design/phase-one/reveal-snapshot.json'))).date,'2026-11-19');
});
const env={RESEND_API_KEY:'unit-test-token',ALERT_EMAIL_FROM:'test@example.test',ALERT_EMAIL_TO:'ops@example.test'};
function failure(root){const dir=path.join(root,'design/phase-one');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'record-status.json'),JSON.stringify({targetDate:'2026-11-19',httpStatus:503,promptCount:6,answerCounts:[1,2,3,4,5,6],lastSuccessfulDate:'2026-11-18',validationStep:'http',error:'HTTP 503',rawResponsePrefix:'x'.repeat(500)}));}
test('02/06/12 Eastern emails send once each with diagnostics; noon logs 500 response characters',async t=>{
 const root=workspace(t);failure(root);const calls=[],logs=[];const fetchImpl=async(url,o)=>{calls.push({url,...o});return response({id:'mail-'+calls.length});};
 for(const [time,expected]of [['06:59',0],['07:17',1],['08:17',1],['11:17',2],['17:17',3],['18:17',3]]){await alertReveal({root,now:'2026-11-19T'+time+':00Z',env,fetchImpl,log:s=>logs.push(s)});assert.equal(calls.length,expected);}
 for(const call of calls){const email=JSON.parse(call.body);for(const value of ['2026-11-19','UTC time:','503','6','[1,2,3,4,5,6]','2026-11-18','Validation step: http'])assert.ok(email.text.includes(value));assert.ok(call.headers['Idempotency-Key']);}
 assert.ok(logs.some(s=>s.endsWith('x'.repeat(500))));
 const persisted=fs.readFileSync(path.join(root,'design/phase-one/alert-state.json'),'utf8');assert.ok(!persisted.includes('ops@example.test')&&!persisted.includes('test@example.test')&&!persisted.includes('unit-test-token'));
});
test('provider failure never marks sent and retry keeps identical payload/idempotency key',async t=>{
 const root=workspace(t);failure(root);const bodies=[];
 const attempt=async(url,options)=>{bodies.push(options.body);return response(bodies.length===1?{error:'down'}:{id:'accepted'},bodies.length===1?503:200);};
 await assert.rejects(alertReveal({root,now:'2026-11-19T07:17:00Z',env,fetchImpl:attempt}));
 await alertReveal({root,now:'2026-11-19T08:17:00Z',env,fetchImpl:attempt});assert.equal(bodies[0],bodies[1]);
});
test('missing email configuration fails explicitly; complete current snapshot suppresses alerts',async t=>{
 const root=workspace(t);failure(root);await assert.rejects(alertReveal({root,now:'2026-11-19T07:17:00Z',env:{}}),/configure RESEND/);
 await recordReveal({root,now:'2026-11-19T08:00:00Z',fetchImpl:async()=>response(reveal('2026-11-19'))});assert.deepEqual(await alertReveal({root,now:'2026-11-19T18:00:00Z',env:{},fetchImpl:()=>{throw Error('unexpected mail');}}),[]);
 const html=renderStatus({root,now:'2026-11-19T18:00:00Z'});assert.equal((html.match(/<li class=/g)||[]).length,14);assert.ok(html.includes('content="noindex,follow"'));assert.ok(html.includes('2026-11-19T08:00:00.000Z'));assert.ok(html.includes('03:00:00 ET'));
});

test('prepare-only persists a stable pending message before any network send',async t=>{
 const root=workspace(t);failure(root);let calls=0;
 const fetchImpl=async()=>{calls++;return response({id:'accepted'});};
 await alertReveal({root,now:'2026-11-19T07:17:00Z',env,fetchImpl,prepareOnly:true});assert.equal(calls,0);
 const prepared=JSON.parse(fs.readFileSync(path.join(root,'design/phase-one/alert-state.json')));assert.ok(prepared['2026-11-19-2'].payload);assert.ok(!prepared['2026-11-19-2'].sentAt);
 await alertReveal({root,now:'2026-11-19T08:17:00Z',env,fetchImpl});assert.equal(calls,1);
});

test('status build clock comes from the persisted run, keeping CI and Cloudflare output identical',t=>{
 const root=workspace(t);failure(root);const file=path.join(root,'design/phase-one/record-status.json');const report=JSON.parse(fs.readFileSync(file));report.runAt='2026-11-19T08:17:00.000Z';fs.writeFileSync(file,JSON.stringify(report));
 const a=renderStatus({root}),b=renderStatus({root});assert.equal(a,b);assert.ok(a.includes('Last automated check: 2026-11-19T08:17:00.000Z'));assert.equal((a.match(/<li class=/g)||[]).length,14);
});
