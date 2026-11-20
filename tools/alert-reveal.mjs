import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { easternDate } from '../design/phase-one/date-core.mjs';
import { validRecords } from './record-reveal.mjs';
export async function alertReveal({root=process.cwd(),now=new Date(),env=process.env,fetchImpl=fetch,log=console.log,prepareOnly=false}={}) {
  const date=easternDate(now),directory=path.join(root,'design/phase-one');
  const records=validRecords(root);
  if (records.some(record=>record.date===date)) return [];
  const hour=Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'2-digit',hourCycle:'h23'}).format(new Date(now)));
  let report={};try{report=JSON.parse(fs.readFileSync(path.join(directory,'record-status.json'),'utf8'));}catch{}
  if(report.targetDate!==date)report={targetDate:date,validationStep:'no-current-report',lastSuccessfulDate:records.at(-1)?.date||null};
  const stateFile=path.join(directory,'alert-state.json');let state={};try{state=JSON.parse(fs.readFileSync(stateFile,'utf8'));}catch{}
  const save=()=>{fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(stateFile+'.tmp',JSON.stringify(state,null,2));fs.renameSync(stateFile+'.tmp',stateFile);};
  const sent=[];
  for(const [threshold,label]of [[2,'warning'],[6,'ACTION NEEDED'],[12,'ACTION NEEDED — 12:00']]){
    if(hour<threshold)continue;
    const key=date+'-'+threshold;if(state[key]?.sentAt)continue;
    if(threshold===12)log('Official API response (first 500 characters): '+(report.rawResponsePrefix||'(no response)').slice(0,500));
    if(!env.RESEND_API_KEY||!env.ALERT_EMAIL_FROM||!env.ALERT_EMAIL_TO)throw new Error('Email not sent: configure RESEND_API_KEY, ALERT_EMAIL_FROM and ALERT_EMAIL_TO GitHub Secrets');
    const from=env.ALERT_EMAIL_FROM,to=env.ALERT_EMAIL_TO.split(',').map(s=>s.trim()).filter(Boolean);
    const configuration=createHash('sha256').update(JSON.stringify({from,to})).digest('hex');
    if(!state[key]?.payload){
      const text=['Eastern date: '+date,'UTC time: '+new Date(now).toISOString(),'Missing snapshot threshold: '+threshold+':00 ET','Validation step: '+(report.validationStep||'unknown'),'Error: '+(report.error||'No complete snapshot'),'HTTP status: '+(report.httpStatus??'no response'),'Prompt count: '+(report.promptCount??0),'Answer counts per prompt: '+JSON.stringify(report.answerCounts||[]),'Last successful date: '+(report.lastSuccessfulDate||'none'),threshold===12?'API response: '+(report.rawResponsePrefix||'(no response)').slice(0,500):''].filter(Boolean).join('\n');
      state[key]={configuration,payload:{subject:'[Krillion '+label+'] Missing snapshot '+date,text}};save();
    }
    if(state[key].configuration!==configuration)throw new Error('Pending email configuration changed; reconcile the pending alert before retrying');
    if(prepareOnly)continue;
    let response;try{response=await fetchImpl('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'krillion-snapshot-'+key},body:JSON.stringify({from,to,...state[key].payload}),signal:AbortSignal.timeout(15000)});}catch{throw new Error('Email provider request failed; delivery is unconfirmed');}
    const result=await response.json().catch(()=>({}));if(!response.ok||!result.id)throw new Error('Email provider did not confirm acceptance: HTTP '+response.status);
    state[key].sentAt=new Date(now).toISOString();state[key].messageId=result.id;save();sent.push(key);
  }
  return sent;
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){try{console.log('Accepted email alerts:',await alertReveal({prepareOnly:process.argv.includes('--prepare-only')}));}catch(e){console.error(e.message);process.exitCode=1;}}
