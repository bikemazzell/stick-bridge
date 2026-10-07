import { spawn } from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = path.join(ROOT, 'e2e', 'shots');
const BRAVE = '/usr/bin/brave-browser-stable';

fs.mkdirSync(SHOTS, { recursive: true });

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

function waitForHttp(url, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tryFetch = async () => {
      try {
        const res = await fetch(url);
        if (res.ok) return resolve();
      } catch {}
      if (Date.now() > deadline) return reject(new Error(`timeout waiting for ${url}`));
      setTimeout(tryFetch, 300);
    };
    tryFetch();
  });
}

function killTree(proc) {
  if (!proc || proc.exitCode !== null) return;
  try {
    proc.kill('SIGTERM');
  } catch {}
  setTimeout(() => {
    try {
      proc.kill('SIGKILL');
    } catch {}
  }, 3000);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let browserProc = null;
let previewProc = null;
let puppeteer = null;
const failures = [];
const scenarioErrors = new Map();

async function newPage(browser, name) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  const errors = [];
  scenarioErrors.set(name, errors);
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  return { page, errors };
}

function check(name, cond, detail = '') {
  if (cond) {
    console.log(`  PASS ${name}`);
  } else {
    console.log(`  FAIL ${name} ${detail}`);
    failures.push(name);
  }
}

async function waitState(page, predicate, timeoutMs = 60000, label = 'state') {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const st = await page.evaluate(() => window.__game && window.__game.getState());
    if (st && predicate(st)) return st;
    await sleep(200);
  }
  throw new Error(`timeout waiting for ${label}`);
}

async function run() {
  const { execSync } = await import('node:child_process');
  execSync('npm run build', { cwd: ROOT, stdio: 'inherit' });

  const cdpPort = await freePort();
  browserProc = spawn(BRAVE, [
    '--headless=new',
    `--remote-debugging-port=${cdpPort}`,
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    `--user-data-dir=/tmp/opencode/brave-e2e-${cdpPort}`,
    'about:blank',
  ], { stdio: 'ignore' });

  await waitForHttp(`http://127.0.0.1:${cdpPort}/json/version`);

  const previewPort = await freePort();
  previewProc = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', String(previewPort), '--strictPort'], { cwd: ROOT, stdio: 'ignore', detached: false });
  await waitForHttp(`http://127.0.0.1:${previewPort}`, 30000);
  const BASE = `http://127.0.0.1:${previewPort}`;

  puppeteer = (await import('puppeteer-core')).default;
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${cdpPort}`, defaultViewport: null });

  // S1: menu loads clean
  {
    console.log('S1: load menu');
    const { page, errors } = await newPage(browser, 'S1');
    await page.goto(BASE + '/', { waitUntil: 'load' });
    await page.waitForSelector('[data-screen="menu"]', { timeout: 10000 });
    const hasCanvas = await page.evaluate(() => !!document.getElementById('game'));
    check('S1 canvas exists', hasCanvas);
    await sleep(1500);
    check('S1 no console errors', errors.length === 0, errors.join(' | '));
    await page.close();
  }

  // S2: weak flat bridge must collapse and show result
  {
    console.log('S2: flat budget 30 collapses');
    const { page, errors } = await newPage(browser, 'S2');
    await page.goto(BASE + '/?seed=e2e-flat&type=flat&budget=30&speed=4', { waitUntil: 'load' });
    await waitState(page, (s) => s.state === 'result', 60000, 'result screen');
    await page.waitForSelector('[data-screen="result"]:not(.hidden)', { timeout: 10000 });
    const st = await page.evaluate(() => window.__game.getState());
    check('S2 collapsed reason', st.resultReason === 'collapsed', JSON.stringify(st.resultReason));
    check('S2 brokeBy populated', !!st.brokeBy, JSON.stringify(st.brokeBy));
    check('S2 broke under something heavy', st.brokeBy && st.brokeBy.massKg >= 4, JSON.stringify(st.brokeBy));
    check('S2 no console errors', errors.length === 0, errors.join(' | '));
    await page.screenshot({ path: path.join(SHOTS, 'flat.png') });

    // S5: replay same seed -> testing again -> collapses again
    console.log('S5: replay keeps seed');
    await page.click('[data-action="replay"]');
    await waitState(page, (s) => s.state === 'testing', 20000, 'testing after replay');
    const cfg = await page.evaluate(() => window.__game.getConfig());
    check('S5 same seed', cfg && cfg.seed === 'e2e-flat', JSON.stringify(cfg));
    const st2 = await waitState(page, (s) => s.state === 'result', 60000, 'result after replay');
    check('S5 collapses again', st2.resultReason === 'collapsed' && !!st2.brokeBy);
    check('S5 no console errors', errors.length === 0, errors.join(' | '));
    await page.close();
  }

  // S3: strong truss + skip to human
  {
    console.log('S3: truss budget 200 carries human');
    const { page, errors } = await newPage(browser, 'S3');
    await page.goto(BASE + '/?seed=e2e-truss&type=truss&budget=200&speed=4', { waitUntil: 'load' });
    await waitState(page, (s) => s.state === 'testing', 20000, 'testing');
    await page.evaluate(() => window.__game.skipToWalker(5));
    const t0 = Date.now();
    let brokeBy = null;
    let crossedHuman = false;
    while (Date.now() - t0 < 30000) {
      const st = await page.evaluate(() => window.__game.getState());
      if (st.brokeBy) brokeBy = st.brokeBy;
      if (st.state === 'result') break;
      if (st.heaviestCrossedKg >= 70) { crossedHuman = true; break; }
      await sleep(250);
    }
    check('S3 human crossed or survived', crossedHuman || (!brokeBy), `brokeBy=${JSON.stringify(brokeBy)}`);
    check('S3 no console errors', errors.length === 0, errors.join(' | '));
    await page.screenshot({ path: path.join(SHOTS, 'truss.png') });
    await page.close();
  }

  // S4: suspension HUD updates
  {
    console.log('S4: suspension hud updates');
    const { page, errors } = await newPage(browser, 'S4');
    await page.goto(BASE + '/?seed=e2e-susp&type=suspension&budget=100&speed=6', { waitUntil: 'load' });
    await waitState(page, (s) => s.state === 'testing', 20000, 'testing');
    const seen = new Set();
    const t0 = Date.now();
    while (Date.now() - t0 < 45000 && seen.size < 2) {
      const txt = await page.evaluate(() => {
        const el = document.querySelector('[data-hud="walker"]');
        return el ? el.textContent : '';
      });
      if (txt) seen.add(txt);
      await sleep(500);
    }
    check('S4 walker hud updated >= 2 values', seen.size >= 2, [...seen].join(' ; '));
    const stress = await page.evaluate(() => {
      const el = document.querySelector('[data-hud="stress"]');
      return el ? el.textContent : '';
    });
    check('S4 stress format', /^\d+%$/.test(stress), stress);
    const sticks = await page.evaluate(() => {
      const el = document.querySelector('[data-hud="sticks"]');
      return el ? el.textContent : '';
    });
    check('S4 sticks format', /^\d+\/\d+ sticks$/.test(sticks) && !sticks.includes('undefined'), sticks);
    check('S4 no console errors', errors.length === 0, errors.join(' | '));
    await page.screenshot({ path: path.join(SHOTS, 'suspension.png') });
    await page.close();
  }

  // S6: day/night cycle changes pixels
  {
    console.log('S6: day/night differs');
    const { page, errors } = await newPage(browser, 'S6');
    await page.goto(BASE + '/?seed=e2e-cycle&type=truss&budget=200&speed=1', { waitUntil: 'load' });
    await waitState(page, (s) => s.state === 'testing', 20000, 'testing');
    const a = await page.evaluate(() => document.getElementById('game').toDataURL());
    await sleep(5000);
    const b = await page.evaluate(() => document.getElementById('game').toDataURL());
    check('S6 canvas pixels changed', a !== b);
    check('S6 no console errors', errors.length === 0, errors.join(' | '));
    await page.close();
  }

  await browser.disconnect();
}

try {
  await run();
} catch (err) {
  console.error('E2E fatal:', err.message);
  failures.push(`fatal: ${err.message}`);
} finally {
  killTree(previewProc);
  killTree(browserProc);
}

if (failures.length > 0) {
  console.error(`\nE2E FAILED (${failures.length}): ${failures.join(', ')}`);
  process.exit(1);
}
console.log('\nE2E PASSED: all scenarios green');
process.exit(0);
