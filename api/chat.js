const https = require('https');

const STAGES = [
  { model: 'nvidia/nemotron-3-ultra-550b-a55b:free', token: process.env.STAGE1_TOKEN || '', timeout: 4000 },
  { model: 'nvidia/nemotron-3-super-120b-a12b:free', token: process.env.STAGE2_TOKEN || '', timeout: 4000 },
  { model: 'openai/gpt-oss-20b:free', token: process.env.STAGE3_TOKEN || '', timeout: 4000 },
  { model: 'inclusionai/ling-3.0-flash:free', token: process.env.STAGE4_TOKEN || '', timeout: 4000 },
];

const AGENTS = {
  trend_tech: { sys: 'Teach cutting-edge industry concepts like GenAI, Cloud, and Web3 to BCA students. Always respond in a highly conversational, easy-to-understand mix of simple Kannada and English.' },
  code_logic: { sys: 'Core Rule: Never provide raw copy-paste code snippets immediately. Break down user queries into logical steps, algorithms, and pseudo-code flows first in mixed Kannada-English.' },
  error_fixer: { sys: 'Act as an expert software debugger. Accept broken code blocks (C, C++, Java, Python) and syntax/runtime bugs. Return the optimized corrected code and explain precisely why the error occurred.' },
  project_guide: { sys: 'Help final-year BCA students brainstorm 10 novel, trend-aligned project ideas based on Web, Mobile Apps, or AI. Give architectural patterns and tech stack recommendations.' },
  report_assist: { sys: 'Help students draft official university-grade blackbook documentation components, project synopses, abstracts, and detailed system requirements templates.' },
};

function requestStage(stage, apiMessages) {
  return new Promise((resolve, reject) => {
    if (!stage.token) return reject(new Error(`${stage.model} has no token configured`));
    const body = JSON.stringify({ model: stage.model, messages: apiMessages, stream: false, max_tokens: 2048, temperature: 0.7 });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), stage.timeout);

    const req = https.request({
      hostname: 'openrouter.ai',
      path: '/api/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${stage.token}`,
        'HTTP-Referer': 'https://semnexusweb.vercel.app',
        'Content-Length': Buffer.byteLength(body),
      },
      signal: controller.signal,
      timeout: stage.timeout,
    }, (res) => {
      clearTimeout(timer);
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`Stage ${stage.model} HTTP ${res.statusCode}`));
        resolve(data);
      });
    });

    req.on('error', (err) => { clearTimeout(timer); reject(err); });
    req.on('timeout', () => { req.destroy(); reject(new Error(`Stage ${stage.model} timed out`)); });
    req.write(body);
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

  let lastError = null;
  for (const stage of STAGES) {
    try {
      const raw = await requestStage(stage, apiMessages);
      const parsed = JSON.parse(raw);
      const content = parsed.choices?.[0]?.message?.content || '';
      if (content) return res.status(200).json({ content });
    } catch (err) {
      lastError = err;
      continue;
    }
  }

  res.status(502).json({ error: 'All 4 failover stages exhausted', detail: lastError?.message || 'No response' });
};