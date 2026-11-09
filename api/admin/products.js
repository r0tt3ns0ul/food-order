const { json, db, requireAdmin } = require('../../lib/server');

module.exports = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    if (req.method === 'GET') {
      const products = await db('products?select=*&order=sort_order.asc,created_at.desc');
      return json(res, 200, { products: products || [] });
    }
    if (req.method === 'POST') {
      const p = req.body || {};
      const name = String(p.name || '').trim();
      const category = String(p.category || '').trim();
      const price = Number(p.price);
      if (!name || !category || !Number.isInteger(price) || price < 0 || name.length > 100) {
        return json(res, 400, { error: 'Проверь название, категорию и цену.' });
      }
      const row = {
        name, category, price,
        description: String(p.description || '').slice(0, 300),
        image_url: String(p.image_url || '').trim().slice(0, 1000) || null,
        available: p.available !== false,
        sort_order: Number.isInteger(Number(p.sort_order)) ? Number(p.sort_order) : 100
      };
      const result = await db('products', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify([row]) });
      return json(res, 201, { product: result?.[0] });
    }
    if (req.method === 'PATCH') {
      const id = String(req.body?.id || '');
      if (!/^[0-9a-f-]{36}$/i.test(id)) return json(res, 400, { error: 'Некорректный ID товара.' });
      const p = req.body || {};
      const patch = {};
      for (const key of ['name','category','description','image_url','available','sort_order','price']) {
        if (p[key] !== undefined) patch[key] = p[key];
      }
      if (patch.price !== undefined && (!Number.isInteger(Number(patch.price)) || Number(patch.price) < 0)) return json(res, 400, { error: 'Некорректная цена.' });
      if (patch.name !== undefined) patch.name = String(patch.name).trim();
      if (patch.category !== undefined) patch.category = String(patch.category).trim();
      if (patch.description !== undefined) patch.description = String(patch.description).slice(0,300);
      if (patch.image_url !== undefined) patch.image_url = String(patch.image_url).trim() || null;
      const result = await db(`products?id=eq.${id}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(patch) });
      return json(res, 200, { product: result?.[0] || null });
    }
    if (req.method === 'DELETE') {
      const id = String(req.query?.id || '');
      if (!/^[0-9a-f-]{36}$/i.test(id)) return json(res, 400, { error: 'Некорректный ID товара.' });
      await db(`products?id=eq.${id}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
      return json(res, 200, { ok: true });
    }
    res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
    return json(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: 'Ошибка работы с меню. Проверь таблицу Supabase.' });
  }
};
