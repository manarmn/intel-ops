export default async function handler(req, res) {
    const { type, text } = req.query;
    const apiKeyGemini = process.env.GEMINI_API_KEY;

    // إعداد الرؤوس لضمان عدم الكاش وجلب بيانات طازجة
    res.setHeader('Cache-Control', 'no-store, max-age=0');

    if (type === 'news') {
        const feeds = [
            ['https://www.aljazeera.net/feed/topic-35', 'الجزيرة', '🇶🇦'],
            ['https://arabic.rt.com/rss/', 'RT عربي', '🇷🇺'],
            ['https://www.skynewsarabia.com/rss.xml', 'سكاي نيوز', '🇦🇪'],
            ['https://www.alarabiya.net/ar/rss.xml', 'العربية', '🇸🇦'],
            ['https://www.france24.com/ar/rss', 'فرانس 24', '🇫🇷']
        ];

        const newsPromises = feeds.map(async ([url, name, flag]) => {
            try {
                const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
                const xml = await response.text();
                // استخراج الأخبار مع الوصف الكامل لضمان ظهور الخبر كاملاً
                const items = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
                return Array.from(items).map(m => ({
                    title: m[1].match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1] || '',
                    description: m[1].match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/)?.[1]?.replace(/<[^>]*>/g, '') || '',
                    source: { name, flag },
                    publishedAt: m[1].match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || new Date().toISOString()
                })).slice(0, 5);
            } catch { return []; }
        });

        const allNews = (await Promise.all(newsPromises)).flat()
            .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
        return res.status(200).json({ articles: allNews });
    }

    if (type === 'analyze') {
        const cleanContent = decodeURIComponent(text || '').substring(0, 3000);

        const prompt = `أنت رئيس وحدة التحليل في وكالة استخبارات جيوسياسية. حلل الخبر التالي بأسلوب استراتيجي معمق.
        يجب أن يكون الرد JSON فقط بالتنسيق التالي:
        {
          "threat_level": "حرج جداً" | "مرتفع" | "متوسط",
          "threat_score": 0-100,
          "summary": "تحليل استخباراتي يربط الخبر بالصراع الإقليمي وتوازنات القوى (حد أدنى 4 جمل)",
          "parties": ["الأطراف المباشرة والفاعلين الدوليين من خلف الستار"],
          "interests": "تحليل عميق للمصالح القومية والاقتصادية المتصادمة",
          "scenarios": {
             "current": "توصيف جيوسياسي دقيق للحالة الراهنة وموازين القوى",
             "best": "مسار خفض التصعيد: الشروط والمحفزات المطلوبة لنجاح التهدئة",
             "worst": "مسار التصعيد الشامل: نقاط الانفجار المحتملة وتأثيرها على خطوط الإمداد والأمن الإقليمي"
          },
          "forecast": "تقدير موقف استشرافي لـ 30 يوماً القادمة بناءً على التاريخ العسكري للمنطقة",
          "lat": 0.0, "lng": 0.0, "location_name": "الموقع الاستراتيجي الأدق"
        }
        الخبر: ${cleanContent}`;

        try {
            const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKeyGemini}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.2, responseMimeType: "application/json" }
                })
            });

            const data = await aiResponse.json();
            return res.status(200).json(JSON.parse(data.candidates[0].content.parts[0].text));
        } catch (e) {
            return res.status(500).json({ error: "فشل في إنتاج تحليل استراتيجي" });
        }
    }
}
