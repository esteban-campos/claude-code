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
import { readFile, appendFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PORT = Number(process.env.PORT) || 4321;
const REPO = process.env.REPO || process.cwd();
const HERE = dirname(fileURLToPath(import.meta.url));
const HTML = join(HERE, 'eliptica-timer.html');
// Archivo donde se acumulan las ideas capturadas durante el ejercicio.
// Claude Code puede leerlo directamente para trabajar sobre ellas.
const IDEAS_FILE = process.env.IDEAS_FILE || join(REPO, 'ideas-eliptica.md');

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); } });
  });
}

async function appendIdea({ text, at, ts }) {
  const line = `- [ ] (${at || '--:--:--'}) ${String(text).replace(/\n/g, ' ')}  <!-- ${ts || ''} -->\n`;
  try {
    await appendFile(IDEAS_FILE, line, 'utf8');
    return { ok: true, file: IDEAS_FILE.replace(REPO + '/', '') };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

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

  if (url.pathname === '/idea' && req.method === 'POST') {
    const body = await readBody(req);
    if (!body.text || !String(body.text).trim()) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, error: 'idea vacía' }));
    }
    const result = await appendIdea(body);
    res.writeHead(result.ok ? 200 : 500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(result));
  }

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
