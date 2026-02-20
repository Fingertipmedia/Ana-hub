#!/usr/bin/env node
/**
 * Ana Hub Backend – Express server
 * Simple, self-hosted dashboard backend.
 */

import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { config } from 'dotenv';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

// Determine __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment from .env if present
config({ path: path.resolve(__dirname, '../.env') });

// Load configuration from config directory (non-secret)
const configDir = path.resolve(__dirname, '../config');
function loadJSON(file, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(path.join(configDir, file), 'utf8'));
  } catch (e) {
    return fallback;
  }
}

const MODELS = loadJSON('models.json');
const SYNC = loadJSON('sync.json', { pollInterval: 60, repo: '' });
const SECRETS_PATH = path.join(configDir, 'secrets.json');
let SECRETS = {};
try {
  SECRETS = JSON.parse(fs.readFileSync(SECRETS_PATH, 'utf8'));
} catch (e) {
  console.warn('secrets.json not found or invalid; some features disabled');
}

// Initialize DB
const dbPath = path.resolve(__dirname, '../kanban.db');
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

// Ensure boards exist (seed if empty)
const existingBoards = db.prepare('SELECT COUNT(*) AS c FROM boards').get();
if (existingBoards.c === 0) {
  const insertBoard = db.prepare('INSERT INTO boards (name, slug, description) VALUES (?, ?, ?)');
  insertBoard.run('Wealth Analytica', 'wealth-analytica', 'Board for Wealth Analytica company');
  insertBoard.run('BAV Futures', 'bav-futures', 'Board for BAV Futures');
  insertBoard.run('Prostate Cancer', 'prostate-cancer', 'Board for Prostate Cancer UK');
  console.log('Seeded default boards');
}

// Express setup
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
// Serve dashboard static files
app.use('/static', express.static(path.resolve(__dirname, '../dashboard/static')));
app.get('/', (req, res) => res.sendFile(path.resolve(__dirname, '../dashboard/index.html')));

// Internal sync endpoint (only accept from localhost)
app.post('/api/sync/apply', (req, res) => {
  if (req.socket.remoteAddress !== '127.0.0.1' && req.socket.remoteAddress !== '::1') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const payload = req.body;
  try {
    applyEvent(payload);
    res.json({ ok: true });
  } catch (err) {
    console.error('Sync apply error:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

const DASHBOARD_PORT = SECRETS.dashboard?.port || 3000;
const BIND = SECRETS.dashboard?.bind || '127.0.0.1';

// ---------- Health ----------
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---------- Token Usage (stub) ----------
app.get('/api/tokens', (req, res) => {
  res.json({
    models: MODELS.available.map(m => ({ model: m, tokens: 0 })),
    lastUpdated: new Date().toISOString()
  });
});

// ---------- Settings ----------
app.get('/api/settings/models', (req, res) => {
  res.json(MODELS);
});

app.post('/api/settings/models', (req, res) => {
  const { default: def, fallbackChain } = req.body;
  if (def) MODELS.default = def;
  if (Array.isArray(fallbackChain)) MODELS.fallbackChain = fallbackChain;
  res.json({ ok: true, models: MODELS });
});

// ---------- Boards ----------
app.get('/api/kanban/boards', (req, res) => {
  const boards = db.prepare('SELECT * FROM boards ORDER BY name').all();
  res.json(boards);
});

app.get('/api/kanban/board/:slug', (req, res) => {
  const board = db.prepare('SELECT * FROM boards WHERE slug = ?').get(req.params.slug);
  if (!board) return res.status(404).json({ error: 'Board not found' });
  const cards = db.prepare('SELECT * FROM cards WHERE board_id = ? ORDER BY updated_at DESC').all(board.id);
  res.json({ board, cards });
});

app.post('/api/kanban/board/:slug/cards', (req, res) => {
  const board = db.prepare('SELECT * FROM boards WHERE slug = ?').get(req.params.slug);
  if (!board) return res.status(404).json({ error: 'Board not found' });
  const { title, description, column = 'todo', agent, tokens, start_at, end_at, tags } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  const insert = db.prepare(`
    INSERT INTO cards (board_id, title, description, column, agent, tokens, start_at, end_at, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const info = db.prepare('SELECT last_insert_rowid() AS id').get();
  const cardId = info.id;
  insert.run(board.id, title, description || '', column, agent || null, tokens || 0, start_at || null, end_at || null, tags || '');
  const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(cardId);
  res.json(card);
});

app.patch('/api/kanban/card/:id', (req, res) => {
  const { column, agent, tokens, end_at, tags } = req.body;
  const update = db.prepare(`
    UPDATE cards SET column = COALESCE(?, column),
                    agent = COALESCE(?, agent),
                    tokens = COALESCE(?, tokens),
                    end_at = COALESCE(?, end_at),
                    tags = COALESCE(?, tags),
                    updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  update.run(column, agent, tokens, end_at, tags, req.params.id);
  const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id);
  res.json(card);
});

app.delete('/api/kanban/card/:id', (req, res) => {
  db.prepare('DELETE FROM cards WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---------- Comments ----------
app.post('/api/kanban/card/:id/comments', (req, res) => {
  const { author, content, source } = req.body;
  if (!author || !content) return res.status(400).json({ error: 'Author and content required' });
  const insert = db.prepare('INSERT INTO comments (card_id, author, content, source) VALUES (?, ?, ?, ?)');
  const info = db.prepare('SELECT last_insert_rowid() AS id').get();
  insert.run(req.params.id, author, content, source || 'web');
  res.json({ id: info.id });
});

app.get('/api/kanban/card/:id/comments', (req, res) => {
  const comments = db.prepare('SELECT * FROM comments WHERE card_id = ? ORDER BY created_at ASC').all(req.params.id);
  res.json(comments);
});

// ---------- Documents (stub) ----------
app.get('/api/documents', (req, res) => {
  const docRoot = path.resolve(__dirname, '../documents');
  res.json({ root: docRoot, placeholder: true });
});

// ---------- Chat Sessions (stub) ----------
app.get('/api/chat/sessions', (req, res) => {
  res.json({ sessions: [] });
});

// ---------- Skills (stub) ----------
app.get('/api/skills', (req, res) => {
  const skillsDir = path.resolve(__dirname, '../skills');
  res.json({ skillsDir, placeholder: true });
});

// ---------- GitHub Sync (Webhook stub) ----------
// (Polling is handled by external sync service)
// Apply an event to the local DB (only via internal, localhost)
function applyEvent(payload) {
  const { type, timestamp, data, source } = payload;
  switch (type) {
    case 'card:create':
      db.prepare(`
        INSERT INTO cards (board_id, title, description, column, agent, tokens, start_at, end_at, tags, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        data.board_id, data.title, data.description || '', data.column, data.agent || null,
        data.tokens || 0, data.start_at || null, data.end_at || null, data.tags || '',
        timestamp, timestamp
      );
      break;
    case 'card:update':
      db.prepare(`
        UPDATE cards SET column = COALESCE(?, column),
                        agent = COALESCE(?, agent),
                        tokens = COALESCE(?, tokens),
                        end_at = COALESCE(?, end_at),
                        tags = COALESCE(?, tags),
                        updated_at = ?
        WHERE id = ?
      `).run(
        data.column, data.agent, data.tokens, data.end_at, data.tags,
        timestamp, data.id
      );
      break;
    case 'card:comment':
      db.prepare('INSERT INTO comments (card_id, author, content, source, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(data.card_id, data.author, data.content, source || 'sync', timestamp);
      break;
    case 'board:share':
      const token = uuidv4();
      db.prepare('INSERT INTO board_shares (board_id, token) VALUES (?, ?)').run(data.board_id, token);
      break;
    default:
      console.warn('Unknown event type:', type);
  }
}

// Webhook endpoint (optional push from GitHub)
app.post('/webhook/github', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.get('X-Hub-Signature-256');
  // TODO: verify signature using SECRETS.github.webhookSecret
  const event = req.get('X-GitHub-Event');
  const payload = JSON.parse(req.body.toString('utf8'));
  console.log(`Received webhook: ${event}`);
  res.status(202).send('OK');
});

// ---------- Start ----------
app.listen(DASHBOARD_PORT, BIND, () => {
  console.log(`Ana Hub backend listening on ${BIND}:${DASHBOARD_PORT}`);
});