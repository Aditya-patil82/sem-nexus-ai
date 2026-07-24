const https = require('https');

const COMPILERS = {
  python: 'cpython-3.12.7',
  c: 'gcc-14.2.0-c',
  cpp: 'gcc-14.2.0-pp',
  java: 'openjdk-jdk-22+36',
};

const TEMPLATES = {
  python: null,
  c: null,
  cpp: null,
  java: null,
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { language, code } = req.body;
  if (!language || !code) return res.status(400).json({ error: 'Missing language or code' });

  const compiler = COMPILERS[language];
  if (!compiler) return res.status(400).json({ run: { stdout: '', stderr: `Unsupported: ${language}`, code: 1 } });

  const body = JSON.stringify({ compiler, code, 'compiler-option-raw': false, 'runtime-option-raw': true });

  try {
    const result = await new Promise((resolve, reject) => {
      const r = https.request({
        hostname: 'wandbox.org',
        path: '/api/compile.json',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        timeout: 30000,
      }, (resp) => {
        let data = '';
        resp.on('data', c => data += c);
        resp.on('end', () => {
          try {
            const j = JSON.parse(data);
            const stdout = j.program_output || j.program_message || '';
            const stderr = j.program_error || j.compiler_error || j.compiler_message || '';
            const code = j.status === '0' ? 0 : 1;
            resolve({ stdout, stderr, code });
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
