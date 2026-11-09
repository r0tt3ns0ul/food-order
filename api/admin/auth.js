const { json, createSession, COOKIE_NAME } = require('../../lib/server');
const crypto = require('node:crypto');

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const { requireAdmin } = require('../../lib/server');
    if (!requireAdmin(req, res)) return;
    return json(res, 200, { ok: true });
  }
  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`);
    return json(res, 200, { ok: true });
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  const expected = process.env.ADMIN_PASSWORD || '';
  const provided = String(req.body?.password || '');
  if (!expected || !process.env.SESSION_SECRET) return json(res, 500, { error: 'Не заданы ADMIN_PASSWORD и SESSION_SECRET в Vercel.' });
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return json(res, 401, { error: 'Неверный пароль.' });

  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${createSession()}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800`);
  return json(res, 200, { ok: true });
};
