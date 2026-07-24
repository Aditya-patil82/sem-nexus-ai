const https = require('https');

const GH_TOKEN = process.env.GH_TOKEN || '';
const MODEL = 'gpt-4o-mini';

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
  if (!GH_TOKEN) return res.status(500).json({ error: 'GitHub token not configured' });

  const { agentId, messages } = req.body;
  if (!agentId || !messages) return res.status(400).json({ error: 'Missing agentId or messages' });

  const agent = AGENTS[agentId];
  if (!agent) return res.status(400).json({ error: 'Unknown agent' });

  const apiMessages = [{ role: 'system', content: agent.sys }, ...messages];
  const body = JSON.stringify({ model: MODEL, messages: apiMessages, stream: true, max_tokens: 2048, temperature: 0.7 });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const options = {
    hostname: 'models.inference.ai.azure.com',
    path: '/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GH_TOKEN}`,
      'api-key': GH_TOKEN,
      'Content-Length': Buffer.byteLength(body),
    },
    timeout: 60000,
  };

  const apiReq = https.request(options, (apiRes) => {
    apiRes.on('data', (chunk) => { res.write(chunk); });
    apiRes.on('end', () => { res.end(); });
  });

  apiReq.on('error', (err) => {
    if (!res.headersSent) { res.status(500).json({ error: err.message }); }
    else { res.write(`data: {"error":"${err.message}"}\n\n`); res.end(); }
  });

  apiReq.on('timeout', () => {
    apiReq.destroy();
    if (!res.headersSent) { res.status(504).json({ error: 'Timed out' }); }
    else { res.end(); }
  });

  apiReq.write(body);
  apiReq.end();
  req.on('close', () => { apiReq.destroy(); });
};