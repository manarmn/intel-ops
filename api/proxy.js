export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const NEWS_KEY = process.env.NEWS_API_KEY;
  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  const type = req.query.type;

  if (type === 'news') {
    const q = req.query.q || 'Iran OR Israel OR Iraq OR Gaza OR Lebanon';
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&sortBy=publishedAt&pageSize=30&language=ar&apiKey=${NEWS_KEY}`;
    try {
      const r = await fetch(url);
      const d = await r.json();
      return res.json(d);
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (type === 'analyze') {
    const text = decodeURIComponent(req.query.text || '');
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text }] }],
          generationConfig: { maxOutputTokens: 800, temperature: 0.3 }
        })
      });
      const d = await r.json();
      return res.json(d);
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(400).json({ error: 'unknown type' });
}
