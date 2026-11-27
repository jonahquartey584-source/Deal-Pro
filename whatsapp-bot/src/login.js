// Everything to do with linking the bot to a WhatsApp account (personal or Business).
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import QRCode from 'qrcode';
import puppeteer from 'puppeteer';

/**
 * Each WhatsApp number gets its own profile: its own login, settings and learned style.
 *   npm start               -> profile "default" (config.json, style.json)
 *   npm start -- business   -> profile "business" (config.business.json, style.business.json)
 */
export function profilePaths(here, profile) {
  const suffix = profile ? `.${profile}` : '';
  return {
    profile: profile || 'default',
    config: path.join(here, `config${suffix}.json`),
    style: path.join(here, `style${suffix}.json`),
    qrImage: path.join(here, `link-qr${suffix}.png`),
    schedule: path.join(here, `schedule${suffix}.json`),
    leads: path.join(here, `leads${suffix}.json`),
    authDir: path.join(here, '.wwebjs_auth'),
    clientId: profile || undefined,
  };
}

/** Valid profile names: letters, digits, dash, underscore. */
export function readProfileArg(argv) {
  const arg = argv.find((a) => !a.startsWith('-'));
  if (!arg) return '';
  if (!/^[\w-]{1,32}$/.test(arg)) throw new Error(`"${arg}" isn't a valid profile name (use letters, numbers, - or _).`);
  return arg.toLowerCase();
}

/**
 * A user agent for the real Chrome that will run, on this computer's platform.
 * The library's default pretends to be Chrome 101 from 2022, and WhatsApp can refuse to
 * link devices that report an outdated browser.
 */
export async function currentUserAgent(executablePath) {
  let major = '147';
  try {
    const browser = await puppeteer.launch({
      headless: true,
      executablePath,
      args: process.env.CHROME_NO_SANDBOX ? ['--no-sandbox'] : [],
    });
    const version = await browser.version(); // e.g. "HeadlessChrome/146.0.7680.31"
    await browser.close();
    major = version.match(/\/(\d+)\./)?.[1] ?? major;
  } catch {
    // fall back to the default above
  }
  const platform =
    process.platform === 'darwin'
      ? 'Macintosh; Intel Mac OS X 10_15_7'
      : process.platform === 'win32'
        ? 'Windows NT 10.0; Win64; x64'
        : 'X11; Linux x86_64';
  return `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`;
}

/** Save the QR as a big PNG and open it (macOS Preview), so it's easy to scan. */
export async function saveAndOpenQr(qr, file) {
  await QRCode.toFile(file, qr, { width: 640, margin: 4, errorCorrectionLevel: 'M' });
  if (process.platform === 'darwin' && !process.env.NO_OPEN) {
    execFile('open', [file], () => {});
  }
  return file;
}

export function removeQrImage(file) {
  fs.rmSync(file, { force: true });
}

/** Digits only, with a leading 0 turned into the UK code if no country code was given. */
export function normalisePhone(raw) {
  let d = String(raw ?? '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0') && d.length === 11) d = '44' + d.slice(1); // UK mobile written as 07…
  return d;
}
