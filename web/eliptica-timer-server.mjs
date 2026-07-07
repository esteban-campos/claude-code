#!/usr/bin/env node
// Servidor local (sin dependencias) para el temporizador Elíptica + Claude Code.
// Sirve el HTML y expone /commits?since=<ISO> con los commits reales del repo git,
// para que el contador de commits del temporizador sea en vivo.
//
// Uso:
//   node web/eliptica-timer-server.mjs           # repo = directorio actual, puerto 4321
//   PORT=8080 REPO=/ruta/al/repo node web/eliptica-timer-server.mjs
//
// Luego abre:  http://localhost:4321

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PORT = Number(process.env.PORT) || 4321;
const REPO = process.env.REPO || process.cwd();
const HTML = join(dirname(fileURLToPath(import.meta.url)), 'eliptica-timer.html');

function countCommits(sinceISO) {
  return new Promise((resolve) => {
    // Cuenta commits en HEAD creados desde `sinceISO` (hora local del repo).
    const args = ['-C', REPO, 'log', '--since', sinceISO, '--pretty=%H'];
    execFile('git', args, { timeout: 5000 }, (err, stdout) => {
      if (err) return resolve({ count: 0, error: String(err.message || err) });
      const hashes = stdout.split('\n').map(s => s.trim()).filter(Boolean);
      resolve({ count: hashes.length, hashes });
    });
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (url.pathname === '/commits') {
    const since = url.searchParams.get('since') || new Date(Date.now() - 3600e3).toISOString();
    const data = await countCommits(since);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(data));
  }

  if (url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/eliptica-timer.html') {
    try {
      const html = await readFile(HTML);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(html);
    } catch (e) {
      res.writeHead(500); return res.end('No se encontró eliptica-timer.html');
    }
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`\n  🚴 Elíptica + Claude Code`);
  console.log(`  Repo git:  ${REPO}`);
  console.log(`  Abre:      http://localhost:${PORT}\n`);
});
