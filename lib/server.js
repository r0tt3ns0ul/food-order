const crypto = require('node:crypto');

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const COOKIE_NAME = 'food_admin_session';

function json(res, status, data) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(status).end(JSON.stringify(data));
}

function envReady() {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

async function db(path, options = {}) {
  if (!envReady()) throw new Error('Supabase is not configured');
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    console.error('Supabase error:', response.status, data);
    const error = new Error('Database request failed');
    error.status = response.status;
    throw error;
  }
  return data;
}

function sign(value) {
  return crypto.createHmac('sha256', process.env.SESSION_SECRET || '')
    .update(value).digest('base64url');
}

function createSession() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function validSession(req) {
  const cookieHeader = req.headers.cookie || '';
  const cookies = Object.fromEntries(cookieHeader.split(';').map(part => {
    const i = part.indexOf('=');
    return i < 0 ? [part.trim(), ''] : [part.slice(0, i).trim(), decodeURIComponent(part.slice(i + 1).trim())];
  }));
  const value = cookies[COOKIE_NAME];
  if (!value || !process.env.SESSION_SECRET) return false;
  const [payload, signature] = value.split('.');
  if (!payload || !signature) return false;
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return Number(data.exp) > Date.now();
  } catch { return false; }
}

function requireAdmin(req, res) {
  if (!validSession(req)) {
    json(res, 401, { error: 'Нужно войти в админ-панель.' });
    return false;
  }
  return true;
}

async function telegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw new Error('Telegram is not configured');
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
  });
  const result = await response.json();
  if (!response.ok || !result.ok) {
    console.error('Telegram sendMessage failed:', result);
    throw new Error('Telegram rejected message');
  }
  return result.result;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

module.exports = { json, db, requireAdmin, createSession, COOKIE_NAME, telegram, escapeHtml };
