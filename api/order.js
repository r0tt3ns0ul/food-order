const MENU = [
  { id: 'burger', name: 'Классический бургер', price: 1600 },
  { id: 'cheese', name: 'Чизбургер', price: 1800 },
  { id: 'doner', name: 'Донер', price: 1700 },
  { id: 'chicken-doner', name: 'Донер с курицей', price: 1500 },
  { id: 'fries', name: 'Картофель фри', price: 700 },
  { id: 'nuggets', name: 'Наггетсы', price: 1100 },
  { id: 'cola', name: 'Coca-Cola', price: 500 },
  { id: 'water', name: 'Вода', price: 300 }
];

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    return res.status(500).json({ error: 'Сервер не настроен: отсутствуют настройки Telegram.' });
  }

  try {
    const body = req.body || {};
    const pcNumber = String(body.pcNumber || '').trim();
    if (!/^[0-9]{1,5}$/.test(pcNumber)) {
      return res.status(400).json({ error: 'Укажи корректный номер компьютера.' });
    }
    if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 30) {
      return res.status(400).json({ error: 'Корзина пуста или содержит слишком много позиций.' });
    }

    const normalized = [];
    const seen = new Set();
    for (const row of body.items) {
      const product = MENU.find(p => p.id === row.id);
      const quantity = Number(row.quantity);
      if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 50 || seen.has(product.id)) {
        return res.status(400).json({ error: 'Некорректный состав заказа.' });
      }
      seen.add(product.id);
      normalized.push({ ...product, quantity });
    }

    const total = normalized.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const orderNumber = `${Date.now().toString().slice(-8)}`;
    const lines = [
      '🍔 <b>НОВЫЙ ЗАКАЗ</b>',
      `🧾 Заказ: <b>#${orderNumber}</b>`,
      `🖥 Компьютер: <b>ПК-${escapeHtml(pcNumber)}</b>`,
      '',
      ...normalized.map(item => `• ${escapeHtml(item.name)} × ${item.quantity} — ${(item.price * item.quantity).toLocaleString('ru-RU')} ₸`),
      '',
      `💰 <b>ИТОГО: ${total.toLocaleString('ru-RU')} ₸</b>`
    ];

    const tg = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: lines.join('\n'),
        parse_mode: 'HTML'
      })
    });
    const result = await tg.json();
    if (!tg.ok || !result.ok) {
      console.error('Telegram sendMessage failed:', result);
      return res.status(502).json({ error: 'Telegram не принял заказ. Попробуй позже.' });
    }
    return res.status(200).json({ ok: true, orderNumber });
  } catch (error) {
    console.error('Order API error:', error);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера.' });
  }
};
