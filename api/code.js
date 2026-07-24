const vm = require('vm');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { language, code } = req.body;
  if (!language || !code) return res.status(400).json({ error: 'Missing language or code' });

  try {
    if (language === 'python' || language === 'c' || language === 'cpp' || language === 'java') {
      const result = await callPiston(language, code);
      return res.status(200).json({ run: result });
    }
    return res.status(400).json({ run: { stdout: '', stderr: `Unsupported: ${language}`, code: 1 } });
  } catch (err) {
    return res.status(200).json({ run: { stdout: '', stderr: err.message, code: 1 } });
  }
};

function callPiston(language, code) {
  return new Promise((resolve, reject) => {
    const files = [{ name: getFileName(language), content: code }];
    const body = JSON.stringify({ language, files });

    const options = {
      hostname: 'piston.k8s.ory.sh',
      path: '/api/v2/piston/execute',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 30000,
    };

    const req = https.request(options, (resp) => {
      let data = '';
      resp.on('data', chunk => data += chunk);
      resp.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.message) {
            resolve({ stdout: '', stderr: json.message, code: 1 });
          } else {
            resolve({
              stdout: json.run?.stdout || '',
              stderr: json.run?.stderr || '',
              code: json.run?.code ?? 1,
            });
          }
        } catch (e) {
          resolve({ stdout: '', stderr: 'Failed to parse response', code: 1 });
        }
      });
    });

    req.on('error', (err) => {
      resolve({ stdout: '', stderr: 'Piston API unreachable: ' + err.message, code: 1 });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ stdout: '', stderr: 'Execution timed out (30s)', code: 1 });
    });

    req.write(body);
    req.end();
  });
}

function getFileName(lang) {
  const names = { c: 'main.c', cpp: 'main.cpp', java: 'Main.java', python: 'main.py' };
  return names[lang] || 'main.txt';
}
