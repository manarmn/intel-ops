export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  const GNEWS_KEY = process.env.GNEWS_API_KEY;
  const type = req.query.type;

  if (type === 'news') {
    const q = 'Iran OR Israel OR Iraq OR Gaza OR Lebanon OR "Middle East"';
    const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(q)}&lang=ar&max=30&sortby=publishedAt&token=${GNEWS_KEY}`;
    try {
      const r = await fetch(url);
      const d = await r.json();
      // تحويل تنسيق GNews لتنسيق NewsAPI
      const articles = (d.articles || []).map(a => ({
        title: a.title,
        description: a.description,
        url: a.url,
        urlToImage: a.image,
        publishedAt: a.publishedAt,
        source: { name: a.source?.name || 'مجهول' }
      }));
      return res.json({ status: 'ok', articles });
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
