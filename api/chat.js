const http = require('http');
const https = require('https');

const MODEL = 'meta-llama/Llama-3-70b-Instruct';
const BASE_URL = 'https://duckduckgo.com';

const AGENTS = {
  trend_tech: { sys: 'Teach advanced technology concepts like Cloud and AI to BCA students in simple mixed Kannada-English.' },
  code_logic: { sys: 'Break down coding issues into algorithms and pseudo-code flows instead of rendering raw script blocks instantly.' },
  error_fixer: { sys: 'Accept broken scripts (C, C++, Java, Python) and display corrected variables with diagnostic code annotations.' },
  project_guide: { sys: 'Suggest 10 novel academic graduation projects with structured system architectures and stack selections.' },
  report_assist: { sys: 'Generate clean university blackbook layout templates, abstracts, and functional requirement charts.' },
};

function httpRequest(options, body) {
  return new Promise((resolve, reject) => {
    const proto = options.protocol === 'https:' ? https : http;
    const req = proto.request({ ...options, followRedirects: true }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, data, headers: res.headers }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
    if (body) req.write(body);
    req.end();
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { agentId, messages } = req.body;
  if (!agentId || !messages) return res.status(400).json({ error: 'Missing agentId or messages' });

  const agent = AGENTS[agentId];
  if (!agent) return res.status(400).json({ error: 'Unknown agent' });

  const apiMessages = [
    { role: 'system', content: agent.sys },
    ...messages.map(m => ({ role: m.role, content: m.content })),
  ];

  const body = JSON.stringify({ model: MODEL, messages: apiMessages });

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-cache');

  try {
    const result = await httpRequest({
      hostname: 'duckduckgo.com',
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-agent': 'duckduckgo-android-app',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 60000,
      protocol: 'https:',
    }, body);

    if (result.status !== 200) {
      return res.status(result.status).json({ error: 'DuckDuckGo AI error', status: result.status });
    }

    const parsed = JSON.parse(result.data);
    const content = parsed.message || parsed.final_answer || parsed.Answer || parsed.content || '';
    res.status(200).json({ content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};