import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import validator from 'validator';
import { config } from './config.js';
import db from './db.js';
import { generateResponse } from './services/ai.js';
import { searchWeb } from './services/search.js';
import { ingestDocument, queryDocument } from './services/rag.js';
import { toolCatalog, runTool } from './services/tools.js';
import { runSandboxedCode } from './services/sandbox.js';
import { generateSecurityAdvice } from './services/security.js';

const app = express();
const uploadDir = path.join(process.cwd(), 'server', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${randomUUID()}-${file.originalname}`)
});

const upload = multer({
  storage,
  limits: { fileSize: Number(config.uploadLimitMb) * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'text/plain',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/csv',
      'image/jpeg',
      'image/png',
      'image/webp'
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(pdf|txt|csv|docx|png|jpg|jpeg|webp)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type.'));
    }
  }
});

app.use(cors({ origin: config.clientUrl, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(rateLimit({ windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false }));

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded;
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const safeGuard = (prompt) => {
  const forbidden = [
    'steal credentials',
    'bypass authentication',
    'unauthorized access',
    'ddos',
    'malware',
    'credential theft',
    'phishing',
    'password spray',
    'exploit real systems',
    'account takeover'
  ];
  const normalized = String(prompt || '').toLowerCase();
  return forbidden.some((phrase) => normalized.includes(phrase));
};

const getUserById = (userId) => db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(userId);

app.get('/api/health', (_req, res) => res.json({ ok: true, name: 'NexusAI', provider: config.aiProvider }));

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!validator.isEmail(email || '')) return res.status(400).json({ error: 'A valid email is required.' });
    if (!password || String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(String(email).toLowerCase());
    if (existing) return res.status(409).json({ error: 'Account already exists.' });

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = db.prepare('INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)').run(String(email).toLowerCase(), String(name || 'User'), passwordHash).lastInsertRowid;
    const token = jwt.sign({ id: userId, email: String(email).toLowerCase(), name: String(name || 'User') }, config.jwtSecret, { expiresIn: '7d' });
    return res.status(201).json({ token, user: { id: userId, email: String(email).toLowerCase(), name: String(name || 'User') } });
  } catch (error) {
    return res.status(500).json({ error: 'Unable to create account.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const row = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).toLowerCase());
    if (!row) return res.status(401).json({ error: 'Invalid credentials.' });
    const valid = await bcrypt.compare(password || '', row.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials.' });
    const token = jwt.sign({ id: row.id, email: row.email, name: row.name }, config.jwtSecret, { expiresIn: '7d' });
    return res.json({ token, user: { id: row.id, email: row.email, name: row.name } });
  } catch (error) {
    return res.status(500).json({ error: 'Login failed.' });
  }
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = getUserById(req.user.id);
  return res.json({ user });
});

app.get('/api/settings', authMiddleware, (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings WHERE user_id = ?').all(req.user.id);
  const settings = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return res.json({ settings });
});

app.put('/api/settings', authMiddleware, (req, res) => {
  const updates = req.body || {};
  const stmt = db.prepare('INSERT INTO settings (id, user_id, key, value) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP');
  for (const [key, value] of Object.entries(updates)) {
    stmt.run(randomUUID(), req.user.id, key, typeof value === 'string' ? value : JSON.stringify(value));
  }
  return res.json({ ok: true });
});

app.post('/api/chat', authMiddleware, async (req, res) => {
  const { message, conversationId } = req.body || {};
  if (!message || !String(message).trim()) return res.status(400).json({ error: 'Message is required.' });

  if (safeGuard(message)) {
    return res.status(400).json({ error: 'This application only supports defensive, authorized, and safe security workflows. Please ask about secure coding, defensive analysis, or CTF/lab education.' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const response = await generateResponse({
      prompt: message,
      userId: req.user.id,
      conversationId: conversationId || randomUUID(),
      provider: config.aiProvider
    });

    const chunks = response.text.match(/.{1,90}/g) || [response.text];
    for (const chunk of chunks) {
      res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunk })}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ type: 'done', citations: response.citations || [] })}\n\n`);
    res.end();
  } catch (error) {
    res.write(`data: ${JSON.stringify({ type: 'error', text: error.message || 'Chat failed.' })}\n\n`);
    res.end();
  }
});

app.post('/api/research', authMiddleware, async (req, res) => {
  const { query } = req.body || {};
  if (!query || !String(query).trim()) return res.status(400).json({ error: 'A search query is required.' });

  try {
    const result = await searchWeb({ query, provider: config.searchProvider, userId: req.user.id });
    return res.json({ answer: result.summary, sources: result.sources });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Search failed.' });
  }
});

app.get('/api/documents', authMiddleware, (req, res) => {
  const docs = db.prepare('SELECT * FROM documents WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  return res.json({ documents: docs });
});

app.post('/api/documents/upload', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    const file = req.file;
    const docId = randomUUID();
    db.prepare('INSERT INTO documents (id, user_id, filename, mime_type, size_bytes, status) VALUES (?, ?, ?, ?, ?, ?)')
      .run(docId, req.user.id, file.originalname, file.mimetype, file.size, 'indexing');

    const chunks = await ingestDocument({ documentId: docId, filePath: file.path, originalName: file.originalname, mimeType: file.mimetype, userId: req.user.id });
    db.prepare('UPDATE documents SET status = ? WHERE id = ?').run(chunks.length > 0 ? 'indexed' : 'failed', docId);

    return res.status(201).json({ ok: true, documentId: docId, chunks: chunks.length });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Document processing failed.' });
  }
});

app.post('/api/documents/query', authMiddleware, async (req, res) => {
  const { query, documentId } = req.body || {};
  if (!query || !String(query).trim()) return res.status(400).json({ error: 'Query is required.' });
  try {
    const answer = await queryDocument({ userId: req.user.id, documentId, query });
    return res.json(answer);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Document query failed.' });
  }
});

app.post('/api/create', authMiddleware, async (req, res) => {
  const { kind = 'text', input = '' } = req.body || {};
  if (!input.trim()) return res.status(400).json({ error: 'Input is required.' });

  const taskResponses = {
    text: 'Here is a polished response crafted for your request.\n\n' + String(input).slice(0, 300),
    summary: 'Summary:\n- Main point: ' + String(input).slice(0, 120) + '\n- Key takeaway: The content is actionable and concise.',
    rewrite: 'Rewritten version:\n' + String(input).replace(/\s+/g, ' ').slice(0, 300),
    brainstorm: 'Brainstorm ideas:\n1. Start with the highest value user need\n2. Validate with a small experiment\n3. Iteratively refine based on feedback',
    json: JSON.stringify({ prompt: String(input), output: { status: 'ready', fields: ['title', 'summary', 'next_steps'] } }, null, 2),
    analysis: 'Data analysis summary:\n- Volume is moderate\n- Most signals are concentrated in the highest-priority segment\n- Recommendation: focus on the most impactful actions first.'
  };

  const output = taskResponses[kind] || taskResponses.text;
  return res.json({ output });
});

app.post('/api/code/execute', authMiddleware, async (req, res) => {
  const { code, language = 'javascript' } = req.body || {};
  if (!code || !String(code).trim()) return res.status(400).json({ error: 'Code is required.' });

  try {
    const result = await runSandboxedCode({ code, language, timeout: config.maxCodeExecutionMs });
    return res.json({ output: result.output, ok: result.ok, error: result.error || null });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Code execution failed.' });
  }
});

app.post('/api/security-lab', authMiddleware, async (req, res) => {
  const { prompt = '' } = req.body || {};
  if (safeGuard(prompt)) {
    return res.status(400).json({ error: 'The Security Lab only supports defensive, authorized security guidance and local lab exercises.' });
  }

  const advice = generateSecurityAdvice(prompt || 'Provide a secure coding review and defensive recommendations.');
  return res.json({ output: advice });
});

app.get('/api/agent/tools', authMiddleware, (_req, res) => res.json({ tools: toolCatalog }));

app.post('/api/agent/tool-run', authMiddleware, async (req, res) => {
  const { toolName, input } = req.body || {};
  try {
    const result = await runTool({ toolName, input, userId: req.user.id });
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Tool execution failed.' });
  }
});

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'Uploaded file exceeds the configured size limit.' });
  }
  return res.status(500).json({ error: 'Unhandled server error.' });
});

const port = config.port;
app.listen(port, () => {
  console.log(`NexusAI server listening on http://localhost:${port}`);
});

export default app;
