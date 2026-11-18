import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { easternDate } from '../design/phase-one/date-core.mjs';

export async function notifyFailure({ webhook, report = {}, runUrl = '', stage = '', test = false, fetchImpl = fetch } = {}) {
  if (!webhook) throw new Error('WECHAT_WEBHOOK Secret is not configured; no WeChat message was sent');
  let endpoint;
  try { endpoint = new URL(webhook); } catch { throw new Error('Invalid WeChat webhook configuration'); }
  if (endpoint.protocol !== 'https:' || endpoint.hostname !== 'qyapi.weixin.qq.com' || endpoint.pathname !== '/cgi-bin/webhook/send' || !endpoint.searchParams.get('key')) throw new Error('Use a WeCom group robot HTTPS webhook');
  const content = [test ? 'Krillion 更新提醒：测试消息' : 'Krillion 每日更新失败', `美东日期：${report.targetDate || easternDate()}`, stage ? `失败环节：${stage}` : '', `采集：${report.capture || 'unknown'}；校验：${report.validation || 'unknown'}；构建：${report.build || 'unknown'}；部署：${report.deployment || 'unknown'}`, report.httpStatus ? `数据源 HTTP：${report.httpStatus}` : '', '上次有效答案会保留实际日期。', runUrl ? `运行日志：${runUrl}` : ''].filter(Boolean).join('\n');
  let response;
  try { response = await fetchImpl(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ msgtype: 'text', text: { content } }), signal: AbortSignal.timeout(15000) }); }
  catch { throw new Error('WeChat notification request failed; webhook was not logged'); }
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.errcode !== 0) throw new Error('WeChat robot did not confirm notification delivery');
  return true;
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const file = 'design/phase-one/record-status.json';
  const report = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  if (process.env.GITHUB_ACTIONS === 'true') report.targetDate = easternDate();
  await notifyFailure({ webhook: process.env.WECHAT_WEBHOOK, report, stage: process.env.REVEAL_FAILURE_STAGE, test: process.env.NOTIFICATION_TEST === 'true', runUrl: process.env.GITHUB_RUN_ID ? `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : '' });
  console.log('WeChat robot confirmed delivery.');
}
