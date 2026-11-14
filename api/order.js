
const crypto = require('node:crypto');
const { json, db, telegram, escapeHtml } = require('../lib/server');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  try {
    const name = String(req.body?.name || '').trim();
    const phone = String(req.body?.phone || '').trim();
    const pcNumber = String(req.body?.pcNumber || '').trim();
    const description = String(req.body?.description || '').trim();

    if (name.length < 2 || name.length > 60) {
      return json(res, 400, { error: 'Проверь имя. Нужно от 2 до 60 символов.' });
    }

    if (!/^\+?[0-9\s()\-]{7,20}$/.test(phone)) {
      return json(res, 400, { error: 'Проверь номер телефона.' });
    }

    if (!/^[0-9]{1,5}$/.test(pcNumber)) {
      return json(res, 400, { error: 'Укажи корректный номер компьютера.' });
    }

    if (description.length < 3 || description.length > 1500) {
      return json(res, 400, { error: 'Опиши заказ (от 3 до 1500 символов).' });
    }

    const orderNumber = crypto.randomBytes(4).toString('hex').toUpperCase();

    const inserted = await db('orders', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify([{
        order_number: orderNumber,
        pc_number: pcNumber,
        customer_name: name,
        phone,
        description,
        items: [],
        total: 0,
        status: 'new'
      }])
    });

    const order = inserted?.[0];

    if (!order) {
      throw new Error('Order was not saved');
    }

    const message = [
      '🍔 <b>НОВЫЙ ЗАКАЗ FOOD CLUB</b>',
      `🧾 Заказ: <b>#${orderNumber}</b>`,
      `👤 Имя: ${escapeHtml(name)}`,
      `📞 Телефон: ${escapeHtml(phone)}`,
      `🖥 Компьютер: <b>ПК-${escapeHtml(pcNumber)}</b>`,
      '',
      '📝 <b>СОСТАВ ЗАКАЗА:</b>',
      escapeHtml(description),
      '',
      '🟡 Статус: Новый'
    ].join('\n');

    try {
      const sent = await telegram(message);

      if (order.id) {
        await db(`orders?id=eq.${encodeURIComponent(order.id)}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({
            telegram_message_id: sent.message_id
          })
        });
      }
    } catch (error) {
      console.error('Telegram notification failed:', error);
      return json(res, 502, {
        error: 'Заказ сохранён, но Telegram не принял уведомление. Позови администратора.'
      });
    }

    return json(res, 200, {
      ok: true,
      orderNumber
    });

  } catch (error) {
    console.error('Order API error:', error);
    return json(res, 500, {
      error: 'Не удалось оформить заказ. Попробуй ещё раз.'
    });
  }
};
