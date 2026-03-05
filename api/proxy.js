export default async function handler(req, res) {
  // إعدادات السماح بالوصول (CORS) لكي يعمل الكود من أي متصفح
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  // التعامل مع طلبات التأكد من الاتصال
  if (req.method === 'OPTIONS') return res.status(200).end();

  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  const GNEWS_KEY = process.env.GNEWS_API_KEY;
  const { type, text } = req.query;

  // التحقق من وجود المفاتيح في Vercel
  if (!GEMINI_KEY || !GNEWS_KEY) {
    return res.status(500).json({ error: "مفاتيح API مفقودة في إعدادات Vercel" });
  }

  // --- 1. جلب الأخبار العاجلة والآنية ---
  if (type === 'news') {
    // استعلام محسن لجلب أخبار عاجلة وحرب من الشرق الأوسط
    const q = '(Iran OR Israel OR Gaza OR Lebanon) AND (عاجل OR انفجار OR هجوم OR تصعيد)';
    // أضفنا &sortby=publishedAt لجلب أحدث الأخبار أولاً
    const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(q)}&lang=ar&max=30&sortby=publishedAt&apikey=${GNEWS_KEY}`;
    
    try {
      const r = await fetch(url);
      const d = await r.json();

      if (d.errors) return res.status(400).json({ error: d.errors[0] });

      const articles = (d.articles || []).map(a => ({
        title: a.title,
        description: a.description,
        url: a.url,
        urlToImage: a.image,
        publishedAt: a.publishedAt,
        source: { name: a.source?.name || 'مصدر غير معروف' }
      }));

      return res.status(200).json({ status: 'ok', articles });
    } catch(e) {
      return res.status(500).json({ error: "فشل جلب الأخبار: " + e.message });
    }
  }

  // --- 2. محرك التحليل الاستخباراتي (OSINT Engine) ---
  if (type === 'analyze') {
    const newsContent = decodeURIComponent(text || '');
    if (!newsContent) return res.status(400).json({ error: 'لا يوجد نص للتحليل' });

    // البرومبت الاحترافي الذي يحول Gemini لمحلل استخبارات
    const prompt = `
      بصفتك محلل استخبارات OSINT، حلل هذا الخبر: "${newsContent}"
      أريد النتيجة بصيغة JSON حصراً باللغة العربية تحتوي على:
      1. credibility: نسبة المصداقية (0-100) والسبب.
      2. threat_level: مستوى التهديد (منخفض، متوسط، مرتفع، حرج).
      3. intel_analysis: تحليل سياسي للخبر في سطر واحد.
      4. scenarios: (متفائل، متشائم، المرجح).
      5. verification: كيف نتأكد من الخبر (مثلاً مراقبة رادار الطيران أو صور الأقمار الصناعية).
    `;

    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { 
            response_mime_type: "application/json", // يضمن استلام JSON فقط
            temperature: 0.2 // لزيادة دقة التحليل
          }
        })
      });
      const d = await r.json();
      
      // تحويل النص المستلم من Gemini إلى كائن JSON حقيقي
      const analysisJson = JSON.parse(d.candidates[0].content.parts[0].text);
      return res.status(200).json(analysisJson);
    } catch(e) {
      return res.status(500).json({ error: "خطأ في محرك التحليل: " + e.message });
    }
  }

  return res.status(400).json({ error: 'نوع الطلب غير مدعوم' });
}
