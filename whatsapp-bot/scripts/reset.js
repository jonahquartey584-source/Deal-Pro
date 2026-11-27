// Forget the WhatsApp login for a profile, so the next start shows a fresh QR / pairing code.
//   npm run reset             -> default profile
//   npm run reset -- business -> business profile
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readProfileArg } from '../src/login.js';

const here = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const profile = readProfileArg(process.argv.slice(2));
const dir = path.join(here, '.wwebjs_auth', profile ? `session-${profile}` : 'session');
fs.rmSync(dir, { recursive: true, force: true });
fs.rmSync(path.join(here, '.wwebjs_cache'), { recursive: true, force: true });
console.log(`Login for profile "${profile || 'default'}" cleared. Also remove the old entry on your phone: WhatsApp → Linked devices.`);
