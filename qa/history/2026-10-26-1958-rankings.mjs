import { ranking, loadComparisons } from '/home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/compare.mjs';
import fs from 'node:fs';
for (const d of process.argv.slice(2)) { const labels = JSON.parse(fs.readFileSync(d + '/results.json')).results.map(r => r.label); const c = loadComparisons(d);
  console.log(d.split('/').slice(1, 4).join('/'), c.length, ranking(labels, c).map(r => `${r.label} ${r.w}-${r.l}-${r.t}`).join(' > ')); }
