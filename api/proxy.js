export default async function handler(req, res) {
    const { type, q = 'الشرق الأوسط', text } = req.query;
    const apiKeyGNews = process.env.GNEWS_API_KEY;
    const apiKeyGroq = process.env.GROQ_API_KEY;
    const apiKeyGemini = process.env.GEMINI_API_KEY;
    const apiKeyNews = process.env.NEWS_API_KEY;

    // منع الـ cache على كل الردود
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');

    try {

        // ===== جلب الأخبار =====
        if (type === 'news') {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
            try {
                const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&language=ar&sortBy=publishedAt&pageSize=15&apiKey=${apiKeyNews}`;
                const response = await fetch(url);
                const data = await response.json();
                if (response.ok && data.articles?.length > 0) {
                    return res.status(200).json({
                        articles: data.articles.map(a => ({
                            title: a.title,
                            publishedAt: a.publishedAt,
                            source: { name: a.source?.name || 'مجهول' },
                            url: a.url
                        }))
                    });
                }
            } catch (e) {}
            const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(q)}&lang=ar&max=10&sortby=publishedAt&apikey=${apiKeyGNews}&_=${Date.now()}`;
            const response = await fetch(url);
            if (!response.ok) return res.status(502).json({ error: "فشل جميع مصادر الأخبار" });
            return res.status(200).json(await response.json());
        }

        // ===== تحليل الخبر =====
        if (type === 'analyze') {
            const decodedText = decodeURIComponent(text || '').replace(/["\\`]/g, ' ').trim();
            if (!decodedText.trim()) return res.status(400).json({ error: "النص فارغ" });

            const prompt = `أنت محلل جيوسياسي استراتيجي خبير. حلل هذا الخبر بعمق واجب بـ JSON نقي فقط:
{
  "threat_level": "حرج أو مرتفع أو متوسط أو منخفض",
  "threat_score": 75,
  "summary": "تحليل استراتيجي من 3 جمل",
  "parties": ["الطرف الأول", "الطرف الثاني"],
  "interests": "المصالح والدوافع الحقيقية في جملتين",
  "scenarios": {
    "current": "الوضع الراهن في جملة",
    "best": "أفضل سيناريو محتمل في جملة",
    "worst": "أسوأ سيناريو محتمل في جملة"
  },
  "forecast": "التوقعات خلال 30 يوماً في جملتين",
  "lat": 33.3,
  "lng": 44.4,
  "location_name": "اسم المكان"
}
الخبر: "${decodedText}"`;

            // Groq أولاً
            if (apiKeyGroq) {
                try {
                    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKeyGroq}` },
                        body: JSON.stringify({
                            model: 'llama-3.3-70b-versatile',
                            messages: [
                                { role: 'system', content: 'أنت محلل جيوسياسي. ترد بـ JSON نقي فقط بدون أي نص خارجه.' },
                                { role: 'user', content: prompt }
                            ],
                            temperature: 0.3,
                            max_tokens: 1000,
                            response_format: { type: 'json_object' }
                        })
                    });
                    if (response.ok) {
                        const data = await response.json();
                        const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');
                        parsed.lat = parseFloat(parsed.lat) || 30.0;
                        parsed.lng = parseFloat(parsed.lng) || 45.0;
                        parsed.threat_score = parseInt(parsed.threat_score) || 50;
                        parsed._source = 'groq';
                        return res.status(200).json(parsed);
                    }
                } catch (e) {}
            }

            // Gemini كبديل
            if (apiKeyGemini) {
                for (const model of ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash-lite']) {
                    try {
                        const response = await fetch(
                            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKeyGemini}`,
                            {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    contents: [{ parts: [{ text: prompt }] }],
                                    generationConfig: { temperature: 0.3, maxOutputTokens: 1000 }
                                })
                            }
                        );
                        const data = await response.json();
                        if (response.ok && data.candidates?.length > 0) {
                            let aiRaw = data.candidates[0]?.content?.parts?.[0]?.text || '';
                            aiRaw = aiRaw.replace(/```json/gi, '').replace(/```/g, '').trim();
                            const jsonMatch = aiRaw.match(/\{[\s\S]*\}/);
                            if (jsonMatch) {
                                const parsed = JSON.parse(jsonMatch[0]);
                                parsed.lat = parseFloat(parsed.lat) || 30.0;
                                parsed.lng = parseFloat(parsed.lng) || 45.0;
                                parsed.threat_score = parseInt(parsed.threat_score) || 50;
                                parsed._source = 'gemini';
                                return res.status(200).json(parsed);
                            }
                        }
                    } catch (e) { continue; }
                }
            }

            return res.status(502).json({ error: "فشل جميع محركات التحليل" });
        }

        return res.status(400).json({ error: "نوع الطلب غير معروف" });

    } catch (error) {
        return res.status(500).json({ error: "فشل النظام", details: error.message });
    }
}
