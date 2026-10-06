import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function loadBusiness(file = process.env.BUSINESS_CONFIG || path.join(root, 'business.config.json')) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function loadEnv(env = process.env) {
  return {
    whatsappToken: env.WHATSAPP_TOKEN || '',
    phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID || '',
    appSecret: env.WHATSAPP_APP_SECRET || '',
    verifyToken: env.WHATSAPP_VERIFY_TOKEN || '',
    graphVersion: env.GRAPH_API_VERSION || 'v23.0',
    port: Number(env.PORT || 3000),
    adminToken: env.ADMIN_TOKEN || '',
    dataFile: path.resolve(root, env.DATA_FILE || './data/leads.json'),
    dryRun: env.DRY_RUN === '1',
  };
}

export function missingEnv(cfg) {
  const need = { WHATSAPP_TOKEN: cfg.whatsappToken, WHATSAPP_PHONE_NUMBER_ID: cfg.phoneNumberId,
    WHATSAPP_APP_SECRET: cfg.appSecret, WHATSAPP_VERIFY_TOKEN: cfg.verifyToken, ADMIN_TOKEN: cfg.adminToken };
  return Object.entries(need).filter(([, v]) => !v).map(([k]) => k);
}
