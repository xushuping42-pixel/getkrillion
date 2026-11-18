import { recordReveal } from './record-reveal.mjs';
const result = await recordReveal({ ...(process.argv[2] ? { date: process.argv[2] } : {}) });
console.log(JSON.stringify(result, null, 2));
console.log('Only local design records are updated. Production data is unchanged.');
