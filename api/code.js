const https = require('https');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { language, code } = req.body;
  if (!language || !code) return res.status(400).json({ error: 'Missing language or code' });

  const files = [{ name: getFileName(language), content: code }];
  const body = JSON.stringify({ language, files: files });

  try {
    const result = await new Promise((resolve, reject) => {
      const r = https.request({
        hostname: 'emkc.org',
        path: '/api/v2/piston/execute',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        timeout: 30000,
      }, (resp) => {
        let data = '';
        resp.on('data', c => data += c);
        resp.on('end', () => {
          try {
            const j = JSON.parse(data);
            if (j.message) {
              resolve({ stdout: '', stderr: j.message, code: 1 });
            } else {
              resolve({
                stdout: j.run?.stdout || '',
                stderr: j.run?.stderr || '',
                code: j.run?.code ?? 1,
              });
            }
          } catch (e) {
            resolve({ stdout: '', stderr: 'Parse error', code: 1 });
          }
        });
      });
      r.on('error', err => resolve({ stdout: '', stderr: 'API unreachable: ' + err.message, code: 1 }));
      r.on('timeout', () => { r.destroy(); resolve({ stdout: '', stderr: 'Timeout (30s)', code: 1 }); });
      r.write(body);
      r.end();
    });

    return res.status(200).json({ run: result });
  } catch (err) {
    return res.status(200).json({ run: { stdout: '', stderr: err.message, code: 1 } });
  }
};

function getFileName(lang) {
  return { c: 'main.c', cpp: 'main.cpp', java: 'Main.java', python: 'main.py' }[lang] || 'main.txt';
}
