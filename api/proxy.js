export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const NEWS_KEY = process.env.NEWS_API_KEY;
  const GEMINI_KEY = process.env.GEMINI_API_KEY;

  const { type, q, text } = req.query;

  // إرجاع المفاتيح للواجهة
  if (type === 'keys') {
    return res.json({ gemini: GEMINI_KEY ? true : false, news: NEWS_KEY ? true : false });
  }

  // جلب الأخبار
  if (type === 'news') {
    const query = q || 'Iran OR Israel OR Iraq OR Gaza OR Lebanon OR "Middle East"';
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&sortBy=publishedAt&pageSize=30&language=ar&apiKey=${NEWS_KEY}`;
    
    try {
      const response = await fetch(url);
      const data = await response.json();
      return res.json(data);
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // تحليل Gemini
  if (type === 'analyze') {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: decodeURIComponent(text) }] }],
            generationConfig: { maxOutputTokens: 800, temperature: 0.3 }
          })
        }
      );
      const data = await response.json();
      return res.json(data);
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(400).json({ error: 'نوع الطلب غير معروف' });
}
