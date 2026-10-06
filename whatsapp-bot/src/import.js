/* Send the opening template to leads in a CSV file (columns: phone,name[,source]).
   Only include people who agreed to be contacted on WhatsApp.
   Usage: npm run import -- leads.csv */
import fs from 'node:fs';
import { loadEnv } from './config.js';

export function parseCsv(text) {
  const rows = text.split(/\r?\n/).map(r => r.split(',').map(c => c.trim().replace(/^"|"$/g, ''))).filter(r => r[0]);
  const header = rows[0].map(h => h.toLowerCase());
  const body = header.includes('phone') ? rows.slice(1) : rows;
  const col = n => (header.includes('phone') ? header.indexOf(n) : ['phone', 'name', 'source'].indexOf(n));
  return body.map(r => ({ phone: r[col('phone')], name: r[col('name')] || '', source: r[col('source')] || 'import' }));
}

if (process.argv[1]?.endsWith('import.js')) {
  const file = process.argv[2];
  if (!file) { console.error('Usage: npm run import -- leads.csv'); process.exit(1); }
  const cfg = loadEnv();
  const leads = parseCsv(fs.readFileSync(file, 'utf8'));
  const res = await fetch(`http://localhost:${cfg.port}/admin/outreach`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ leads }),
  });
  console.log(JSON.stringify(await res.json(), null, 2));
}
