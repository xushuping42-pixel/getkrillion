// 答案匹配：规范化 + 同义词 + 单复数 + 防双计
const ARTICLES = /^(a|an|the)\s+/;

export function normalize(s){
  return String(s == null ? '' : s)
    .toLowerCase()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
    .replace(/&/g,' and ')
    .replace(/['\u2018\u2019\u0060\u00b4]/g,'')
    .replace(/[-_/]/g,' ')
    .replace(/[^a-z0-9\s]/g,' ')
    .replace(/\s+/g,' ').trim()
    .replace(ARTICLES,'')
    .trim();
}

export function singular(s){
  if (s.length <= 3) return s;
  if (/ies$/.test(s)) return s.slice(0,-3) + 'y';
  if (/(?:ches|shes|xes|zes|sses)$/.test(s)) return s.slice(0,-2);
  if (/s$/.test(s) && !/ss$/.test(s)) return s.slice(0,-1);
  return s;
}

// 每题建一次索引：主词 + 同义词 → 同一个 idx
export function buildIndex(prompt){
  const map = new Map();
  const put = (str, idx) => {
    const k = normalize(str);
    if (!k) return;
    if (!map.has(k)) map.set(k, idx);
    const ks = singular(k);
    if (ks && !map.has(ks)) map.set(ks, idx);
  };
  (prompt.a || []).forEach((row, idx) => {
    put(row[0], idx);
    (row[2] || []).forEach(syn => put(syn, idx));
  });
  return map;
}

export function match(prompt, input, index){
  const raw = normalize(input);
  if (!raw) return { hit:false };
  let idx = index.get(raw);
  if (idx === undefined) idx = index.get(singular(raw));
  if (idx === undefined) return { hit:false };
  const w = idx + 1;                    // 第几热门，1 = 最热
  return { hit:true, idx, score: Math.max(5, 100 - w), text: prompt.a[idx][0] };
}
