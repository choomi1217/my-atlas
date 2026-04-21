#!/usr/bin/env node
/**
 * Generate resume PDFs (자소서 + 경력기술서) from HTML using Playwright.
 *
 * Usage:
 *   node scripts/generate-resume-pdf.mjs
 *
 * Output:
 *   frontend/public/resume/조영미_자소서.pdf
 *   frontend/public/resume/조영미_경력기술서.pdf
 */
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const resumeDir = path.join(projectRoot, 'frontend', 'public', 'resume');

const playwrightEntry = path.join(projectRoot, 'qa', 'node_modules', 'playwright', 'index.mjs');
const { chromium } = await import(playwrightEntry);

const targets = [
  { html: 'intro.html', pdf: '조영미_자소서.pdf' },
  { html: 'index.html', pdf: '조영미_경력기술서.pdf' },
];

async function resolveExecutablePath() {
  const fs = await import('fs');
  const cacheDir = path.join(process.env.HOME, 'Library', 'Caches', 'ms-playwright');
  if (!fs.existsSync(cacheDir)) return undefined;
  const dirs = fs.readdirSync(cacheDir)
    .filter((d) => d.startsWith('chromium_headless_shell-'))
    .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
  for (const dir of dirs) {
    const candidate = path.join(cacheDir, dir, 'chrome-headless-shell-mac-arm64', 'chrome-headless-shell');
    if (fs.existsSync(candidate)) return candidate;
    const x64Candidate = path.join(cacheDir, dir, 'chrome-headless-shell-mac', 'chrome-headless-shell');
    if (fs.existsSync(x64Candidate)) return x64Candidate;
  }
  return undefined;
}

const executablePath = await resolveExecutablePath();
if (executablePath) {
  console.log(`Using executable: ${executablePath}`);
}
const browser = await chromium.launch({ executablePath });
const context = await browser.newContext();
const page = await context.newPage();

for (const { html, pdf } of targets) {
  const url = `file://${path.join(resumeDir, html)}`;
  console.log(`→ ${url}`);
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.emulateMedia({ media: 'print' });
  await page.pdf({
    path: path.join(resumeDir, pdf),
    format: 'A4',
    printBackground: true,
    margin: { top: '14mm', bottom: '14mm', left: '12mm', right: '12mm' },
  });
  console.log(`  ✓ ${pdf}`);
}

await browser.close();
console.log('Done.');
