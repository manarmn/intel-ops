export default async function handler(req, res) {
    const { type, q = 'الشرق الأوسط', text } = req.query;
    const apiKeyGNews = process.env.GNEWS_API_KEY;
    const apiKeyGemini = process.env.GEMINI_API_KEY;
    const apiKeyNews = process.env.NEWS_API_KEY;

    try {

        // ===== جلب الأخبار =====
        if (type === 'news') {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

            // NewsAPI أولاً (100 طلب/يوم - أحدث وأكثر)
            try {
                const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&language=ar&sortBy=publishedAt&pageSize=15&apiKey=${apiKeyNews}`;
                const response = await fetch(url);
                const data = await response.json();

                if (response.ok && data.articles && data.articles.length > 0) {
                    // تحويل صيغة NewsAPI لتتوافق مع GNews
                    const normalized = {
                        articles: data.articles.map(a => ({
                            title: a.title,
                            publishedAt: a.publishedAt,
                            source: { name: a.source?.name || 'مجهول' },
                            url: a.url
                        }))
                    };
                    return res.status(200).json(normalized);
                }
            } catch (e) {
                console.warn('NewsAPI failed, falling back to GNews:', e.message);
            }

            // GNews كبديل
            const ts = Date.now();
            const fallbackUrl = `https://gnews.io/api/v4/search?q=${encodeURIComponent(q)}&lang=ar&max=10&sortby=publishedAt&apikey=${apiKeyGNews}&_=${ts}`;
            const fallbackRes = await fetch(fallbackUrl);
            if (!fallbackRes.ok) {
                return res.status(502).json({ error: "فشل جميع مصادر الأخبار" });
            }
            const fallbackData = await fallbackRes.json();
            return res.status(200).json(fallbackData);
        }

        // ===== تحليل الخبر =====
        if (type === 'analyze') {

            const decodedText = decodeURIComponent(text || '');

            if (!decodedText.trim()) {
                return res.status(400).json({ error: "النص فارغ" });
            }

            if (!apiKeyGemini) {
                return res.status(500).json({ error: "مفتاح Gemini غير موجود في البيئة" });
            }

            const prompt = `أنت محلل جيوسياسي. حلل هذا الخبر: "${decodedText}".
رد بـ JSON نقي فقط بدون أي نص خارجه:
{"threat_level":"حرج أو مرتفع أو متوسط أو منخفض","summary":"تحليل لا يتجاوز 40 كلمة","lat":33.3,"lng":44.4,"location_name":"اسم المكان"}`;

            const models = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash-lite'];
            let response = null;
            let data = null;

            for (const model of models) {
                try {
                    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKeyGemini}`;
                    response = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: prompt }] }],
                            generationConfig: { temperature: 0.2, maxOutputTokens: 400 }
                        })
                    });
                    data = await response.json();
                    if (response.ok && data.candidates && data.candidates.length > 0) break;
                } catch (e) { continue; }
            }

            if (!response?.ok || !data?.candidates?.length) {
                return res.status(502).json({ error: "فشل Gemini API", details: JSON.stringify(data) });
            }

            let aiRaw = data.candidates[0]?.content?.parts?.[0]?.text || '';
            aiRaw = aiRaw.replace(/```json/gi, '').replace(/```/g, '').trim();

            const jsonMatch = aiRaw.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                return res.status(502).json({ error: "لم يتم استخراج JSON", raw: aiRaw });
            }

            const parsed = JSON.parse(jsonMatch[0]);
            parsed.lat = parseFloat(parsed.lat) || 30.0;
            parsed.lng = parseFloat(parsed.lng) || 45.0;

            return res.status(200).json(parsed);
        }

        return res.status(400).json({ error: "نوع الطلب غير معروف" });

    } catch (error) {
        console.error('[INTEL-OPS ERROR]', error);
        return res.status(500).json({ error: "فشل النظام", details: error.message });
    }
}
