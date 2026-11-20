import fs from 'node:fs';
import path from 'node:path';
import { validateReveal } from './reveal-data.mjs';
import { easternDate } from '../design/phase-one/date-core.mjs';

export function completeSnapshot(snapshot, day) {
  const prompts = validateReveal(snapshot, day);
  for (const prompt of snapshot.prompts) {
    const names = prompt.answers.map(row => row.answer.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' '));
    if (new Set(names).size !== names.length) throw new Error('Duplicate answer in ' + prompt.id);
  }
  return prompts;
}
export function readSnapshot(file, day) {
  const snapshot = JSON.parse(fs.readFileSync(file, 'utf8'));
  completeSnapshot(snapshot, day);
  if (snapshot.source !== 'https://krillion.io/api/reveal?date=' + day || !Number.isFinite(Date.parse(snapshot.fetchedAt))) throw new Error('Invalid snapshot provenance');
  return snapshot;
}
export function validRecords(root) {
  const dir = path.resolve(root, 'design/phase-one/records');
  const records = [];
  if (fs.existsSync(dir)) for (const name of fs.readdirSync(dir)) {
    if (!/^\d{4}-\d{2}-\d{2}\.json$/.test(name)) continue;
    try { records.push(readSnapshot(path.join(dir, name), name.slice(0,10))); } catch { /* Invalid files never count as a successful capture. */ }
  }
  const accepted=[];
  for (const snapshot of records.sort((a,b)=>a.date.localeCompare(b.date))) {
    const previous=accepted.at(-1),total=count(snapshot);
    if (!previous || (total>=count(previous)*0.1 && total<=count(previous)*1.9)) accepted.push(snapshot);
  }
  return accepted;
}
const count = snapshot => snapshot.prompts.reduce((n,p) => n+p.answers.length,0);
function atomicSnapshot(file, snapshot) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file + '.tmp', JSON.stringify(snapshot));
  readSnapshot(file + '.tmp', snapshot.date);
  fs.renameSync(file + '.tmp', file);
}
export async function recordReveal({ root=process.cwd(), now=new Date(), date=easternDate(now), fetchImpl=fetch, forceRefresh=false }={}) {
  const today=easternDate(now);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10)!==date || date>today) throw new Error('Use an available Eastern calendar date');
  const directory=path.resolve(root,'design/phase-one'), record=path.join(directory,'records',date+'.json'), latest=path.join(directory,'reveal-snapshot.json');
  let current;
  try { const value=JSON.parse(fs.readFileSync(latest,'utf8')); current=readSnapshot(latest,value.date); } catch {}
  const records=validRecords(root);
  const previous=[...records,...(current?[current]:[])].filter(s=>s.date<date).sort((a,b)=>b.date.localeCompare(a.date))[0];
  const last=[...records,...(current?[current]:[])].sort((a,b)=>b.date.localeCompare(a.date))[0];
  const report={targetDate:date,runAt:new Date(now).toISOString(),httpStatus:null,promptCount:0,answerCounts:[],lastSuccessfulDate:last?.date||null,validationStep:'cache'};
  function checkSize(snapshot) {
    if (previous && (count(snapshot)<count(previous)*0.1 || count(snapshot)>count(previous)*1.9)) throw new Error('Answer total differs from previous edition by more than 90%');
  }
  let snapshot,selectedFile;
  for (const file of forceRefresh?[]:[record,...(current?.date===date?[latest]:[])]) {
    try { snapshot=readSnapshot(file,date); checkSize(snapshot); selectedFile=file; break; } catch { snapshot=null; }
  }
  const cached=!!snapshot;
  try {
    if (!snapshot) {
      const source='https://krillion.io/api/reveal?date='+date;
      report.validationStep='request';
      const response=await fetchImpl(source,{signal:AbortSignal.timeout(20000),headers:{Accept:'application/json'}});
      report.httpStatus=response.status;
      const raw=typeof response.text==='function'?await response.text():JSON.stringify(await response.json?.());
      report.rawResponsePrefix=String(raw??'').slice(0,500);
      let data;
      try { data=JSON.parse(raw); } catch { /* HTTP failures still report the original status. */ }
      report.promptCount=Array.isArray(data?.prompts)?data.prompts.length:0;
      report.answerCounts=Array.isArray(data?.prompts)?data.prompts.map(p=>Array.isArray(p?.answers)?p.answers.length:0):[];
      report.validationStep='http';
      if (response.status!==200) throw new Error('Official reveal unavailable: HTTP '+response.status);
      report.validationStep='content-type';
      if (!response.headers.get('content-type')?.toLowerCase().includes('application/json')) throw new Error('Official response is not JSON');
      report.validationStep='json'; if (!data) throw new Error('Invalid JSON response');
      report.validationStep='date'; if (data.date!==date) throw new Error('Reveal date does not match requested Eastern date');
      report.validationStep='prompts'; if (!Array.isArray(data.prompts)||data.prompts.length!==7) throw new Error('Reveal must contain seven complete prompts');
      report.validationStep='answers'; if (data.prompts.some(p=>!Array.isArray(p?.answers)||!p.answers.length)) throw new Error('Each prompt needs answers');
      report.validationStep='scores'; if (data.prompts.some(p=>!p.answers.some(a=>typeof a?.score==='number'&&Number.isFinite(a.score)))) throw new Error('Each prompt needs a numeric score');
      report.validationStep='duplicates';
      for (const p of data.prompts) { const names=p.answers.map(a=>String(a?.answer??'').normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ')); if (new Set(names).size!==names.length) throw new Error('Duplicate answer in '+p.id); }
      report.validationStep='schema'; const prompts=completeSnapshot(data,date);
      snapshot={date,source,fetchedAt:new Date(now).toISOString(),prompts};
      report.validationStep='answer-total'; checkSize(snapshot);
    }
    // No writes to records/ occur until every publication gate above has passed.
    if (current && current.date!==date) {
      const old=path.join(directory,'records',current.date+'.json');
      if (!fs.existsSync(old)) atomicSnapshot(old,current);
    }
    if (selectedFile!==record || !cached) atomicSnapshot(record,snapshot);
    if (!current || date>current.date || (date===current.date&&!cached)) atomicSnapshot(latest,snapshot);
    return {...report,promptCount:snapshot.prompts.length,answerCounts:snapshot.prompts.map(p=>p.answers.length),capture:cached?'already-recorded':'saved',validation:'passed',validationStep:'complete',fetchedAt:snapshot.fetchedAt,prompts:7,answers:count(snapshot)};
  } catch(error) { error.httpStatus=report.httpStatus; error.report={...report,capture:'failed',validation:'not-passed',error:error.message}; throw error; }
}
