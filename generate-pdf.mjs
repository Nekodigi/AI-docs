/**
 * AI駆動開発 実践ガイド — PDF Generator
 *
 * Puppeteer で各 .page 要素を個別スクリーンショットし、
 * pdf-lib で A4 PDF に組み立てる。
 *
 * Usage:
 *   node generate-pdf.mjs           — 1回生成
 *   node generate-pdf.mjs --watch   — ファイル変更を監視して自動再生成
 */

import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { watch } from 'node:fs';
import { resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { PDFDocument } from 'pdf-lib';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Constants ────────────────────────────────────────────────
const HTML_FILE = 'ai-driven-development.html';
const OUTPUT_PDF = 'ai-driven-development.pdf';
const PREVIEW_IMG = 'images/preview.png';
const PORT = 3456;

// A4 at 96 DPI (px)
const A4_WIDTH = 794;
const A4_HEIGHT = 1123;

// A4 in PDF points (1pt = 1/72 in)
const A4_PT_W = 595.28;
const A4_PT_H = 841.89;

const DEVICE_SCALE_FACTOR = 2; // 192 DPI equivalent

// ── MIME types ───────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

// ── Local HTTP server ────────────────────────────────────────
function startServer() {
  return new Promise((resolvePromise) => {
    const server = createServer(async (req, res) => {
      try {
        const urlPath = decodeURIComponent(req.url.split('?')[0]);
        const filePath = resolve(__dirname, urlPath === '/' ? HTML_FILE : urlPath.slice(1));

        // Prevent directory traversal
        if (!filePath.startsWith(__dirname)) {
          res.writeHead(403);
          res.end();
          return;
        }

        const data = await readFile(filePath);
        const ext = extname(filePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    server.listen(PORT, '127.0.0.1', () => {
      console.log(`  Local server running on http://127.0.0.1:${PORT}`);
      resolvePromise(server);
    });
  });
}

// ── PDF generation ───────────────────────────────────────────
async function generatePdf(browser) {
  const page = await browser.newPage();
  await page.setViewport({
    width: A4_WIDTH,
    height: A4_HEIGHT,
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
  });

  // Load page and wait for resources
  console.log('  Loading HTML and waiting for resources...');
  await page.goto(`http://127.0.0.1:${PORT}/`, {
    waitUntil: 'networkidle0',
    timeout: 60_000,
  });

  // Wait for fonts
  await page.evaluate(() => document.fonts.ready);

  // Wait for all images to load
  await page.evaluate(async () => {
    const images = Array.from(document.querySelectorAll('img'));
    await Promise.all(
      images.map(
        (img) =>
          img.complete ||
          new Promise((r) => {
            img.addEventListener('load', r, { once: true });
            img.addEventListener('error', r, { once: true });
          })
      )
    );
  });

  // Extra buffer for rendering
  await new Promise((r) => setTimeout(r, 2000));

  // Prepare for capture
  console.log('  Capturing pages...');

  // Hide export bar
  await page.evaluate(() => {
    const bar = document.querySelector('.export-bar');
    if (bar) bar.style.display = 'none';
  });

  // Remove wrapper padding/gap for clean capture
  await page.evaluate(() => {
    const wrapper = document.querySelector('.pages-wrapper');
    if (wrapper) {
      wrapper.style.padding = '0';
      wrapper.style.gap = '0';
    }
  });

  // Remove box-shadow (can bleed into element screenshots)
  await page.evaluate(() => {
    document.querySelectorAll('.page').forEach((el) => {
      el.style.boxShadow = 'none';
    });
  });

  // Get all .page elements
  const pageElements = await page.$$('.page');
  console.log(`  Found ${pageElements.length} pages`);

  const screenshots = [];

  for (let i = 0; i < pageElements.length; i++) {
    const el = pageElements[i];

    const box = await el.boundingBox();
    if (!box) {
      console.warn(`  [!] Page ${i + 1}: could not get bounding box, skipping`);
      continue;
    }

    // Use clip-based page screenshot for pixel-perfect A4 capture
    const png = await page.screenshot({
      type: 'png',
      clip: {
        x: box.x,
        y: box.y,
        width: A4_WIDTH,
        height: A4_HEIGHT,
      },
    });
    screenshots.push(png);
    process.stdout.write(`  Captured page ${i + 1}/${pageElements.length}\r`);
  }
  console.log(`  Captured all ${screenshots.length} pages     `);

  // Build PDF
  console.log('  Building PDF...');
  const pdfDoc = await PDFDocument.create();

  pdfDoc.setTitle('AI駆動開発 実践ガイド');
  pdfDoc.setAuthor('Olienttech');
  pdfDoc.setSubject('高専生のためのAI駆動開発 実践ガイド');
  pdfDoc.setCreator('Puppeteer + pdf-lib');
  pdfDoc.setCreationDate(new Date());

  for (const png of screenshots) {
    const image = await pdfDoc.embedPng(png);
    const pdfPage = pdfDoc.addPage([A4_PT_W, A4_PT_H]);
    pdfPage.drawImage(image, {
      x: 0,
      y: 0,
      width: A4_PT_W,
      height: A4_PT_H,
    });
  }

  const pdfBytes = await pdfDoc.save();
  await writeFile(resolve(__dirname, OUTPUT_PDF), pdfBytes);
  console.log(`  Saved: ${OUTPUT_PDF} (${(pdfBytes.length / 1024 / 1024).toFixed(1)} MB)`);

  // Save preview image (first page)
  await mkdir(resolve(__dirname, 'images'), { recursive: true });
  await writeFile(resolve(__dirname, PREVIEW_IMG), screenshots[0]);
  console.log(`  Saved: ${PREVIEW_IMG}`);

  await page.close();
}

// ── Main ─────────────────────────────────────────────────────
async function main() {
  const isWatch = process.argv.includes('--watch');

  console.log('\n=== AI駆動開発 実践ガイド — PDF Generator ===\n');

  // 1. Start local server
  console.log('[1] Starting local server...');
  const server = await startServer();

  // 2. Launch browser
  console.log('[2] Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--allow-file-access-from-files',
      '--font-render-hinting=none',
      '--disable-lcd-text',
      '--force-color-profile=srgb',
    ],
  });

  try {
    // Initial generation
    console.log('\n[3] Generating PDF...');
    await generatePdf(browser);
    console.log('\n=== Done! ===\n');

    if (!isWatch) return;

    // ── Watch mode ─────────────────────────────────────────
    console.log('[Watch] Monitoring file changes... (Ctrl+C to stop)\n');

    let debounceTimer = null;
    let isGenerating = false;

    const triggerRegenerate = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        if (isGenerating) return;
        isGenerating = true;
        console.log(`\n[Watch] Change detected — regenerating PDF...`);
        try {
          await generatePdf(browser);
          console.log('[Watch] Done! Waiting for changes...\n');
        } catch (err) {
          console.error('[Watch] Error:', err.message);
        }
        isGenerating = false;
      }, 500);
    };

    // Watch HTML file
    watch(resolve(__dirname, HTML_FILE), triggerRegenerate);

    // Watch images directory
    watch(resolve(__dirname, 'images'), { recursive: true }, (event, filename) => {
      // Ignore our own output
      if (filename === 'preview.png') return;
      triggerRegenerate();
    });

    // Keep process alive
    await new Promise(() => {});
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error('\n[ERROR]', err);
  process.exit(1);
});
