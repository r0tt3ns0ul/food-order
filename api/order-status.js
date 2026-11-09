const { json, db } = require('../lib/server');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  const number = String(req.query?.number || '').trim().toUpperCase();
  if (!/^[A-F0-9]{8}$/.test(number)) return json(res, 400, { error: 'Проверь номер заказа.' });
  try {
    const rows = await db(`orders?select=order_number,pc_number,items,total,status,created_at&order_number=eq.${number}&limit=1`);
    if (!rows?.length) return json(res, 404, { error: 'Заказ не найден.' });
    return json(res, 200, { order: rows[0] });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: 'Не удалось проверить статус заказа.' });
  }
};
