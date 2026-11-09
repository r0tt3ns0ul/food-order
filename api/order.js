const crypto = require('node:crypto');
const { json, db, telegram, escapeHtml } = require('../lib/server');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
    const pcNumber = String(req.body?.pcNumber || '').trim();
    const rows = req.body?.items;
    if (!/^[0-9]{1,5}$/.test(pcNumber)) return json(res, 400, { error: 'Укажи корректный номер ПК.' });
    if (!Array.isArray(rows) || rows.length < 1 || rows.length > 30) return json(res, 400, { error: 'Корзина пуста.' });

    const ids = [...new Set(rows.map(x => String(x.id || '')))];
    const products = await db(`products?select=id,name,price,available&id=in.(${ids.map(encodeURIComponent).join(',')})`);
    const normalized = [];
    for (const row of rows) {
      const p = products.find(x => x.id === row.id && x.available);
      const quantity = Number(row.quantity);
      if (!p || !Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
        return json(res, 400, { error: 'Один из товаров больше не доступен. Обнови меню.' });
      }
      normalized.push({ id: p.id, name: p.name, price: Number(p.price), quantity });
    }
    const total = normalized.reduce((s, p) => s + p.price * p.quantity, 0);
    const orderNumber = crypto.randomBytes(4).toString('hex').toUpperCase();
    const inserted = await db('orders', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify([{
        order_number: orderNumber,
        pc_number: pcNumber,
        items: normalized,
        total,
        status: 'new'
      }])
    });
    const order = inserted?.[0];
    const message = [
      '🍔 <b>НОВЫЙ ЗАКАЗ</b>',
      `🧾 Заказ: <b>#${orderNumber}</b>`,
      `🖥 Компьютер: <b>ПК-${escapeHtml(pcNumber)}</b>`,
      '',
      ...normalized.map(p => `• ${escapeHtml(p.name)} × ${p.quantity} — ${(p.price * p.quantity).toLocaleString('ru-RU')} ₸`),
      '',
      `💰 <b>ИТОГО: ${total.toLocaleString('ru-RU')} ₸</b>`,
      '🟡 Статус: Новый'
    ].join('\n');
    try {
      const sent = await telegram(message);
      if (order?.id) {
        await db(`orders?id=eq.${order.id}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ telegram_message_id: sent.message_id })
        });
      }
    } catch (e) {
      console.error('Order saved but Telegram notification failed:', e);
      return json(res, 502, { error: 'Заказ сохранён, но Telegram не принял уведомление. Позови администратора.' });
    }
    return json(res, 200, { ok: true, orderNumber });
  } catch (e) {
    console.error('Order API error:', e);
    return json(res, 500, { error: 'Не удалось оформить заказ. Проверь настройки базы данных.' });
  }
};
