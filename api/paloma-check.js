
const { json, requireAdmin } = require('../lib/server');

const BASE = 'https://connect.paloma365.com/platform/v1';

async function palomaGet(path) {
  const key = process.env.PALOMA_AUTHKEY;

  if (!key) throw new Error('PALOMA_AUTHKEY is not configured');

  const response = await fetch(`${BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: 'application/json'
    }
  });

  const data = await response.json();

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: data.error || data
    };
  }

  return { ok: true, data };
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  if (!requireAdmin(req, res)) return;

  try {
    const [me, account, locations, categories, items] =
      await Promise.all([
        palomaGet('/me'),
        palomaGet('/account'),
        palomaGet('/locations?limit=10'),
        palomaGet('/categories?limit=10'),
        palomaGet('/items?limit=10')
      ]);

    return json(res, 200, {
      connection: me,
      account,
      locations,
      categories,
      items
    });
  } catch (error) {
    console.error('Paloma check failed:', error.message);
    return json(res, 500, {
      error: 'Не удалось проверить подключение Paloma365'
    });
  }
};
