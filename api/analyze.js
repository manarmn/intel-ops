export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { text } = req.query;
  if (!text) return res.status(400).json({ error: 'النص مطلوب' });
  const txt = decodeURIComponent(text).replace(/["\\`]/g,' ').trim();
  const GROQ = process.env.GROQ_API_KEY;
  const GEMINI = process.env.GEMINI_API_KEY;

  const prompt = `أنت محلل جيوسياسي خبير من طراز هنري كيسنجر. حلل هذا الخبر بدقة تامة واذكر أسماء حقيقية فقط.

قواعد صارمة:
- اذكر دول وأشخاص وأماكن حقيقية من الخبر
- لا تستخدم "المنطقة" أو "الدول المعنية"
- الموقع: مدينة أو دولة حقيقية من الخبر مع إحداثياتها الدقيقة
- JSON نقي فقط بلا نص آخر

{
  "threat_level": "حرج|مرتفع|متوسط|منخفض",
  "threat_score": 0-100,
  "summary": "3 جمل تحليلية دقيقة بأسماء وأماكن حقيقية",
  "parties": ["اسم حقيقي 1", "اسم حقيقي 2"],
  "interests": "المصالح الحقيقية لكل طرف",
  "scenarios": {
    "current": "وصف الوضع الراهن بالتفصيل",
    "best": "أفضل سيناريو واقعي",
    "worst": "أسوأ سيناريو واقعي"
  },
  "forecast": "توقعات محددة خلال 30 يوماً",
  "lat": إحداثية_دقيقة,
  "lng": إحداثية_دقيقة,
  "location_name": "اسم المدينة أو الدولة الحقيقية"
}

الخبر: "${txt}"`;

  // Groq سريع أولاً
  if (GROQ) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ}` },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: 'محلل جيوسياسي خبير. JSON نقي فقط.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.2, max_tokens: 900,
          response_format: { type: 'json_object' }
        }), signal: AbortSignal.timeout(10000)
      });
      if (r.ok) {
        const d = await r.json();
        const p = JSON.parse(d.choices?.[0]?.message?.content || '{}');
        if (p.threat_level) {
          p.lat = parseFloat(p.lat) || 33.3;
          p.lng = parseFloat(p.lng) || 44.4;
          p.threat_score = Math.min(100, Math.max(0, parseInt(p.threat_score)||50));
          p._source = 'groq';
          return res.status(200).json(p);
        }
      }
    } catch(e) {}
  }

  // Gemini بديل
  if (GEMINI) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 900 }
          }), signal: AbortSignal.timeout(15000) }
      );
      const d = await r.json();
      if (r.ok && d.candidates?.length) {
        let raw = d.candidates[0]?.content?.parts?.[0]?.text || '';
        raw = raw.replace(/```json|```/g, '').trim();
        const m = raw.match(/\{[\s\S]*\}/);
        if (m) {
          const p = JSON.parse(m[0]);
          if (p.threat_level) {
            p.lat = parseFloat(p.lat) || 33.3;
            p.lng = parseFloat(p.lng) || 44.4;
            p.threat_score = Math.min(100, Math.max(0, parseInt(p.threat_score)||50));
            p._source = 'gemini';
            return res.status(200).json(p);
          }
        }
      }
    } catch(e) {}
  }

  // Groq كبير كآخر محاولة
  if (GROQ) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: 'محلل جيوسياسي خبير. JSON نقي فقط.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.2, max_tokens: 1400,
          response_format: { type: 'json_object' }
        }), signal: AbortSignal.timeout(40000)
      });
      if (r.ok) {
        const d = await r.json();
        const p = JSON.parse(d.choices?.[0]?.message?.content || '{}');
        if (p.threat_level) {
          p.lat = parseFloat(p.lat) || 33.3;
          p.lng = parseFloat(p.lng) || 44.4;
          p.threat_score = Math.min(100, Math.max(0, parseInt(p.threat_score)||50));
          p._source = 'groq';
          return res.status(200).json(p);
        }
      }
    } catch(e) {}
  }

  return res.status(502).json({ error: 'فشل التحليل' });
}
