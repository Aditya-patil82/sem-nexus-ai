const https = require('https');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, apikey, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { path } = req.query;
  const supabaseUrl = `https://dogwowlefobsmhjuujrr.supabase.co/auth/v1/${path}`;

  const headers = {
    'Content-Type': 'application/json',
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvZ3dvd2xlZm9ic21oanV1anJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4NzExMTgsImV4cCI6MjEwMDQ0NzExOH0.ElxtZOVq1kDh8QmIZCz-I8swGQqj3Lf0xoazouAA0-4',
  };

  if (req.headers.authorization) {
    headers['Authorization'] = req.headers.authorization;
  }

  try {
    const body = JSON.stringify(req.body);

    const result = await new Promise((resolve, reject) => {
      const url = new URL(supabaseUrl);
      const r = https.request({
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: req.method,
        headers: { ...headers, 'Content-Length': Buffer.byteLength(body || '') },
      }, (resp) => {
        let data = '';
        resp.on('data', chunk => data += chunk);
        resp.on('end', () => resolve({ status: resp.statusCode, data }));
      });
      r.on('error', reject);
      if (body) r.write(body);
      r.end();
    });

    return res.status(result.status).json(JSON.parse(result.data));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
