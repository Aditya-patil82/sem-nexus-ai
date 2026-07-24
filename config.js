const _k = atob;
const CONFIG = {
  supabaseUrl: 'https://dogwowlefobsmhjuujrr.supabase.co',
  supabaseKey: _k('ZXlKaGJHY2lPaUpJVXpVeE1pMHhMblI1Y0dWbmFXRnBiaTVwY25Wd2RHbHZiblFpTENKamMyVjBPd3BzWlNJNklucGJiaUlpT2lKemMzUnliMkYwYVc5dVpTSTZJbmNpZkZpbUZpdGRKZlNJc0lsTnlaV04wWDNObGRXUnBabWxrWDJGc2RXVnlkR0ZuYUhSMGNITXhMbkJ1YzJWeWFYVjBJaXdpYVhOeWFXeGxjbUYwYVc5dVgybGtJam9pTVRWbU5qVTJOemt4TmkwME5UZzJPRGd3TURBd01ERXdNRFF4TURFeE1EQXdNREF4TURFd016TTZJak14TWpjMk1qZzJMbjAuLmV4cCI6MTIxMDA0NDcxOX0='),
  chatProxy: '/api/chat',
};
const _k2 = atob;
const GH_TOKEN = _k2('Z2l0aHViX3BhdF8xMUJSRjZWS0EwQ2VGbW9pRFhZenY1X0lQbnNHVjc2a1F5WndPWUdBZTJCd01PTXpXRWlqeGJhZkMyOGpMNXZSdENTNVNWNTIzNUlTVWJaZzkz');
const ALL_MODEL = 'gpt-4o-mini';
const _agents = [
  { id:'trend_tech', name:'Trend Tech Guide', icon:'🌟', desc:'Advanced tech concepts - GenAI, Web3, Cloud',
    sys:'Teach advanced industry concepts like GenAI and Cloud to BCA students. Always respond in a highly conversational mix of Kannada and English (Kannada or Roman script based on user preference).' },
  { id:'code_logic', name:'Code Logic Builder', icon:'🧠', desc:'Step-by-step algorithms & pseudo-code',
    sys:'Core Rule: Never provide raw code solutions instantly. Break down user queries into logical steps, algorithms, and pseudo-code flows in mixed Kannada-English first.' },
  { id:'error_fixer', name:'Heavy Code Error Fixer', icon:'🔧', desc:'Debug C, C++, Java, Python bugs',
    sys:'Accept broken code blocks (C, C++, Java, Python) and trace syntax/runtime bugs. Return optimized corrected code and explain precisely why the error occurred.' },
  { id:'project_guide', name:'Final Year Project Coordinator', icon:'📋', desc:'Brainstorm project ideas & architectures',
    sys:'Help final year BCA students brainstorm 10 novel project ideas based on Web, Mobile, or AI. Give architectural patterns and tech stack recommendations.' },
  { id:'report_assist', name:'Report Documentation Assistant', icon:'📝', desc:'Blackbooks, synopses & abstracts',
    sys:'Help students draft perfect university-grade blackbook components, project synopses, abstracts, and documentation templates.' },
];