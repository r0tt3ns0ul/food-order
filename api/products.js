const { json, db } = require('../lib/server');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  try {
    const products = await db('products?select=id,name,description,category,price,image_url,available,sort_order&available=eq.true&order=sort_order.asc,name.asc');
    return json(res, 200, { products: products || [] });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: 'Не удалось загрузить меню. Проверь настройки базы данных.' });
  }
};
