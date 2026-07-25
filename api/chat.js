const https = require('https');

const MODEL = 'openai/gpt-4o-mini';
const BASE_URL = 'https://pollinations.ai';

const AGENTS = {
  trend_tech: { sys: 'Teach advanced industry concepts like GenAI and Cloud to BCA students. Always respond in a conversational mix of Kannada and English.' },
  code_logic: { sys: 'Core Rule: Never provide raw code solutions instantly. Break down user queries into logical steps, algorithms, and pseudo-code flows in mixed Kannada-English first.' },
  error_fixer: { sys: 'Accept broken code blocks (C, C++, Java, Python) and trace syntax/runtime bugs. Return optimized corrected code and explain precisely why the error occurred.' },
  project_guide: { sys: 'Help final year BCA students brainstorm 10 novel project ideas based on Web, Mobile, or AI. Give architectural patterns and tech stack recommendations.' },
  report_assist: { sys: 'Help students draft perfect university-grade blackbook components, project synopses, abstracts, and documentation templates.' },
};

function httpRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request({ ...options, followRedirects: true }, (res) => {
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
      hostname: 'pollinations.ai',
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 60000,
      protocol: 'https:',
    }, body);

    if (result.status !== 200) {
      return res.status(result.status).json({ error: 'Pollinations AI error', status: result.status });
    }

    const parsed = JSON.parse(result.data);
    const content = parsed.message || parsed.final_answer || parsed.Answer || parsed.content || '';
    res.status(200).json({ content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};