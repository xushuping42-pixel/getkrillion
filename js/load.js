// js/load.js —— 正式 → 演示 → 缓存 → 内嵌迷你题库，永不白屏
const TTL = 4000;

const MINI_BANK = { version: 1, prompts: [
  { id:'mini-1', cat:'Animals',  p:'Name an animal that lives in the ocean.',
    a:[['shark',1,['great white shark']],['whale',2,['blue whale']],['dolphin',3,[]],['octopus',4,[]],['jellyfish',5,[]]] },
  { id:'mini-2', cat:'Geography', p:'Name a country in Europe.',
    a:[['france',1,[]],['germany',2,[]],['italy',3,[]],['spain',4,[]],['norway',5,[]]] },
  { id:'mini-3', cat:'Food',      p:'Name a type of pizza topping.',
    a:[['pepperoni',1,[]],['mushroom',2,[]],['cheese',3,['mozzarella']],['olive',4,[]],['pineapple',5,[]]] },
  { id:'mini-4', cat:'Movies & TV', p:'Name a movie that won Best Picture.',
    a:[['titanic',1,[]],['gladiator',2,[]],['oppenheimer',3,[]],['rocky',4,[]],['parasite',5,[]]] },
  { id:'mini-5', cat:'Music',     p:'Name a musical instrument.',
    a:[['guitar',1,[]],['piano',2,[]],['drums',3,[]],['violin',4,[]],['flute',5,[]]] },
  { id:'mini-6', cat:'Sports',    p:'Name an NBA team.',
    a:[['lakers',1,['la lakers','los angeles lakers']],['celtics',2,['boston celtics']],['warriors',3,['golden state warriors']],['bulls',4,['chicago bulls']],['knicks',5,['new york knicks']]] },
  { id:'mini-7', cat:'Trivia',    p:'Name a color of the rainbow.',
    a:[['red',1,[]],['blue',2,[]],['green',3,[]],['yellow',4,[]],['violet',5,['purple']]] }
]};

const CACHE_K = 'kril:bank';

async function fetchJSON(url){
  const res = await fetch(url, { cache: 'no-cache', signal: AbortSignal.timeout(TTL) });
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (!res.ok) throw new Error('http ' + res.status);
  if (!ct.includes('application/json')) throw new Error('not json: ' + ct);   // Pages 回 200 的 index.html
  const data = await res.json();
  if (!data || !Array.isArray(data.prompts) || data.prompts.length < 7) throw new Error('bad bank');
  return data;
}

export async function loadBank(){
  const urls = window.KRIL_DEMO === true
    ? ['./data/prompts.demo.json', './data/prompts.json']
    : ['./data/prompts.json'];

  for (const url of urls){
    try{
      const bank = await fetchJSON(url);
      try{ localStorage.setItem(CACHE_K, JSON.stringify({ t: Date.now(), bank })); }catch{}
      return { bank, mode: url.indexOf('demo') > -1 ? 'demo' : 'live' };
    }catch(e){ /* 换下一个 */ }
  }

  try{
    const raw = localStorage.getItem(CACHE_K);
    if (raw){
      const { bank } = JSON.parse(raw);
      if (bank && Array.isArray(bank.prompts) && bank.prompts.length >= 7) return { bank, mode: 'cached' };
    }
  }catch{}

  return { bank: MINI_BANK, mode: 'fallback' };
}
