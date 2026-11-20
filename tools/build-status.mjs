import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { easternDate } from '../design/phase-one/date-core.mjs';
import { validRecords } from './record-reveal.mjs';
export function renderStatus({root=process.cwd(),now=new Date()}={}) {
 const today=easternDate(now),records=new Map(validRecords(root).map(s=>[s.date,s]));
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const cells=[];
 for(let offset=13;offset>=0;offset--){const day=new Date(Date.parse(today+'T12:00:00Z')-offset*86400000).toISOString().slice(0,10),s=records.get(day);const time=s?new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date(s.fetchedAt)):null;cells.push('<li class="'+(s?'ok':'missing')+'"><strong>'+day+'</strong><span>'+(s?'Complete · 7 prompts':'Missing snapshot')+'</span>'+(s?'<time datetime="'+esc(s.fetchedAt)+'">'+time+' ET</time><small>'+esc(s.fetchedAt)+' UTC</small>':'<span>fetchedAt: —</span>')+'</li>');}
 return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,follow"><title>Snapshot status — Krillion Fieldnotes</title><style>body{margin:0;background:#101815;color:#edf2e9;font:16px/1.5 system-ui}main{max-width:1100px;margin:auto;padding:40px 20px}a{color:#b5da8c}ul{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:12px;padding:0;list-style:none}li{padding:14px;border:1px solid #69766b;border-top:5px solid #ad675e;border-radius:8px;overflow-wrap:anywhere}.ok{border-top-color:#a6cf80}li>*{display:block}small,span,time{font-size:12px}h1{font-size:30px}@media(max-width:800px){ul{grid-template-columns:repeat(2,minmax(0,1fr))}}</style></head><body><main><a href="/">← Latest recorded answers</a><h1>Snapshot status</h1><p>Last 14 Eastern dates through '+today+'. Green = a complete validated record; red = missing or invalid. Fetched times show Eastern Time and UTC.</p><p>Page generated: '+esc(new Date(now).toISOString())+'. Static status refreshes on the hourly workflow, not in real time.</p><ul aria-label="Last fourteen days">'+cells.join('')+'</ul></main></body></html>';
}
export function buildStatus(options={}){const root=options.root||process.cwd();fs.mkdirSync(path.join(root,'status'),{recursive:true});fs.writeFileSync(path.join(root,'status/index.html'),renderStatus(options));}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)buildStatus();
