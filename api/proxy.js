export default async function handler(req, res) {
    const { type, q = 'الشرق الأوسط', text } = req.query;
    const apiKeyGNews = process.env.GNEWS_API_KEY;
    const apiKeyGemini = process.env.GEMINI_API_KEY;
    const apiKeyNews = process.env.NEWS_API_KEY;

    try {

        // ===== جلب الأخبار =====
        if (type === 'news') {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

            try {
                const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&language=ar&sortBy=publishedAt&pageSize=15&apiKey=${apiKeyNews}`;
                const response = await fetch(url);
                const data = await response.json();
                if (response.ok && data.articles && data.articles.length > 0) {
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

            // GNews كبديل
            const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(q)}&lang=ar&max=10&sortby=publishedAt&apikey=${apiKeyGNews}&_=${Date.now()}`;
            const response = await fetch(url);
            if (!response.ok) return res.status(502).json({ error: "فشل جميع مصادر الأخبار" });
            return res.status(200).json(await response.json());
        }

        // ===== تحليل الخبر =====
        if (type === 'analyze') {
            const decodedText = decodeURIComponent(text || '');
            if (!decodedText.trim()) return res.status(400).json({ error: "النص فارغ" });
            if (!apiKeyGemini) return res.status(500).json({ error: "مفتاح Gemini غير موجود" });

            // Prompt مضغوط جداً لضمان JSON قصير لا يُقطع
            const prompt = `حلل هذا الخبر جيوسياسياً وأجب بـ JSON فقط بهذا الشكل الحرفي:
{"threat_level":"X","summary":"Y","lat":0.0,"lng":0.0,"location_name":"Z"}
حيث X = حرج أو مرتفع أو متوسط أو منخفض
حيث Y = جملة واحدة فقط لا تزيد عن 20 كلمة
حيث lat,lng = إحداثيات المكان الرئيسي في الخبر
الخبر: "${decodedText}"
لا تكتب أي شيء خارج الـ JSON.`;

            const models = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash-lite'];
            let response = null;
            let data = null;

            for (const model of models) {
                try {
                    response = await fetch(
                        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKeyGemini}`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                contents: [{ parts: [{ text: prompt }] }],
                                generationConfig: { temperature: 0.1, maxOutputTokens: 200 }
                            })
                        }
                    );
                    data = await response.json();
                    if (response.ok && data.candidates?.length > 0) break;
                } catch (e) { continue; }
            }

            if (!response?.ok || !data?.candidates?.length) {
                return res.status(502).json({ error: "فشل Gemini API - استنفدت الحصة اليومية", details: JSON.stringify(data) });
            }

            let aiRaw = data.candidates[0]?.content?.parts?.[0]?.text || '';
            aiRaw = aiRaw.replace(/```json/gi, '').replace(/```/g, '').trim();

            const jsonMatch = aiRaw.match(/\{[\s\S]*?\}/);
            if (!jsonMatch) return res.status(502).json({ error: "لم يتم استخراج JSON", raw: aiRaw });

            const parsed = JSON.parse(jsonMatch[0]);
            parsed.lat = parseFloat(parsed.lat) || 30.0;
            parsed.lng = parseFloat(parsed.lng) || 45.0;

            return res.status(200).json(parsed);
        }

        return res.status(400).json({ error: "نوع الطلب غير معروف" });

    } catch (error) {
        return res.status(500).json({ error: "فشل النظام", details: error.message });
    }
}
