import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { recordReveal } from './record-reveal.mjs';
import { easternDate } from '../design/phase-one/date-core.mjs';
export async function runFetch(args=process.argv.slice(2), options={}) {
  const dateArg=args.find(a=>a.startsWith('--date='));
  if (args.some(a=>a!=='--force'&&!a.startsWith('--date='))) throw new Error('Use --date=YYYY-MM-DD --force');
  if (dateArg&&!args.includes('--force')) throw new Error('Historical capture requires --date=YYYY-MM-DD --force');
  const root=options.root||process.cwd(), now=options.now||new Date();
  const date=dateArg?dateArg.slice(7):easternDate(now);
  let report,failed=false;
  try { report=await recordReveal({...options,root,now,date,forceRefresh:args.includes('--force')}); }
  catch(error) { failed=true; report=error.report||{targetDate:date,runAt:new Date(now).toISOString(),capture:'failed',validation:'not-passed',error:error.message}; }
  Object.assign(report,{backfill:!!dateArg,build:'not-run',deployment:'not-configured',notification:'not-configured',schedule:process.env.REVEAL_SCHEDULE==='enabled'?'enabled':'not-enabled'});
  const file=path.join(root,'design/phase-one/record-status.json');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify(report,null,2));fs.renameSync(file+'.tmp',file);
  console.log(JSON.stringify(report,null,2));
  return {report,failed};
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){const {failed}=await runFetch();if(failed)process.exitCode=1;}
