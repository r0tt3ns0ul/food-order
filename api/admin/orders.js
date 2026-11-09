const { json, db, requireAdmin, telegram, escapeHtml } = require('../../lib/server');

const LABELS = {
  new: 'Новый',
  accepted: 'Принят',
  cooking: 'Готовится',
  ready: 'Готов',
  completed: 'Выдан',
  cancelled: 'Отменён'
};

module.exports = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    if (req.method === 'GET') {
      const orders = await db('orders?select=*&order=created_at.desc&limit=200');
      return json(res, 200, { orders: orders || [] });
    }
    if (req.method === 'PATCH') {
      const id = String(req.body?.id || '');
      const status = String(req.body?.status || '');
      if (!/^[0-9a-f-]{36}$/i.test(id) || !LABELS[status]) return json(res, 400, { error: 'Некорректный заказ или статус.' });
      const rows = await db(`orders?id=eq.${id}&select=order_number,pc_number,status`);
      if (!rows?.length) return json(res, 404, { error: 'Заказ не найден.' });
      const result = await db(`orders?id=eq.${id}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ status, updated_at: new Date().toISOString() })
      });
      const order = result?.[0];
      try {
        await telegram(`🔔 <b>ОБНОВЛЕНИЕ ЗАКАЗА #${escapeHtml(order.order_number)}</b>\n🖥 ПК-${escapeHtml(order.pc_number)}\nНовый статус: <b>${LABELS[status]}</b>`);
      } catch (e) { console.error('Telegram status update failed:', e); }
      return json(res, 200, { order });
    }
    res.setHeader('Allow', 'GET, PATCH');
    return json(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: 'Не удалось загрузить или обновить заказы.' });
  }
};
