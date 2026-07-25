const https = require('https');
const http = require('http');

const MODEL = 'meta-llama/Llama-3-70b-Instruct';
const BASE_URL = 'https://duckduckgo.com';
const FALLBACK_URL = 'https://allorigins.win';

const AGENTS = {
  trend_tech: { sys: 'Teach advanced industry concepts like GenAI and Cloud to BCA students. Always respond in a highly conversational mix of Kannada and English (Kannada or Roman script based on user preference).' },
  code_logic: { sys: 'Core Rule: Never provide raw code solutions instantly. Break down user queries into logical steps, algorithms, and pseudo-code flows in mixed Kannada-English first.' },
  error_fixer: { sys: 'Accept broken code blocks (C, C++, Java, Python) and trace syntax/runtime bugs. Return optimized corrected code and explain precisely why the error occurred.' },
  project_guide: { sys: 'Help final year BCA students brainstorm 10 novel project ideas based on Web, Mobile, or AI. Give architectural patterns and tech stack recommendations.' },
  report_assist: { sys: 'Help students draft perfect university-grade blackbook components, project synopses, abstracts, and documentation templates.' },
};

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

  const options = {
    hostname: 'duckduckgo.com',
    path: '/',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-agent': 'duckduckgo-android-app',
      'Content-Length': Buffer.byteLength(body),
    },
    timeout: 60000,
  };

  try {
    const result = await new Promise((resolve, reject) => {
      const proto = options.port === 443 ? https : http;
      const apiReq = proto.request(options, (apiRes) => {
        let data = '';
        apiRes.on('data', (chunk) => { data += chunk; });
        apiRes.on('end', () => resolve({ status: apiRes.statusCode, data }));
      });
      apiReq.on('error', reject);
      apiReq.on('timeout', () => { apiReq.destroy(); reject(new Error('Request timed out')); });
      apiReq.write(body);
      apiReq.end();
    });

    if (result.status !== 200) {
      return res.status(result.status).json({ error: 'DuckDuckGo AI error', details: result.data });
    }

    const parsed = JSON.parse(result.data);
    const content = parsed.message || parsed.final_answer || parsed.Answer || parsed.content || '';
    res.status(200).json({ content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};