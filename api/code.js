const https = require('https');

const COMPILERS = {
  python: 'cpython-3.12.7',
  c: 'gcc-14.2.0-c',
  cpp: 'gcc-14.2.0-pp',
  java: 'openjdk-jdk-22+36',
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
  if (!compiler) return res.status(200).json({ run: { stdout: '', stderr: `Unsupported: ${language}`, code: 1 } });

  const postData = JSON.stringify({ compiler: compiler, code: code });

  try {
    const result = await new Promise((resolve) => {
      const options = {
        hostname: 'wandbox.org',
        path: '/api/compile.json',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'Accept': 'application/json',
        },
        timeout: 30000,
      };

      const request = https.request(options, (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          try {
            const j = JSON.parse(raw);
            const stdout = j.program_output || j.program_message || '';
            const stderr = j.program_error || j.compiler_error || j.compiler_message || '';
            const exitCode = j.status === '0' ? 0 : 1;
            resolve({ stdout, stderr, code: exitCode });
          } catch (e) {
            resolve({ stdout: '', stderr: 'Unexpected response: ' + raw.substring(0, 300), code: 1 });
          }
        });
      });

      request.on('error', (err) => resolve({ stdout: '', stderr: 'Network error: ' + err.message, code: 1 }));
      request.on('timeout', () => { request.destroy(); resolve({ stdout: '', stderr: 'Timed out (30s)', code: 1 }); });

      request.write(postData);
      request.end();
    });

    return res.status(200).json({ run: result });
  } catch (err) {
    return res.status(200).json({ run: { stdout: '', stderr: err.message, code: 1 } });
  }
};
