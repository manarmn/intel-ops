export default async function handler(req, res) {
    const { type, q = 'الشرق الأوسط', text } = req.query;
    const apiKeyGNews = process.env.GNEWS_API_KEY;
    const apiKeyGroq = process.env.GROQ_API_KEY;
    const apiKeyGemini = process.env.GEMINI_API_KEY;
    const apiKeyGuardian = process.env.GUARDIAN_API_KEY || 'test'; // مجاني بدون مفتاح
    const apiKeyNews = process.env.NEWS_API_KEY;

    // منع الـ cache
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');

    try {

        // ===== جلب الأخبار =====
        if (type === 'news') {

            const allArticles = [];

            // ===== 1. RSS Feeds (مصادر عربية مباشرة) =====
            const rssFeeds = [
                { url: 'https://www.aljazeera.net/feed/topic-35', source: 'الجزيرة' },
                { url: 'https://arabic.rt.com/rss/', source: 'RT عربي' },
                { url: 'https://www.bbc.com/arabic/index.xml', source: 'BBC عربي' },
                { url: 'https://alarabiya.net/ar/rss.xml', source: 'العربية' },
                { url: 'https://www.france24.com/ar/rss', source: 'فرانس 24' },
                { url: 'https://al-ain.com/rss', source: 'العين' },
                { url: 'https://www.independentarabia.com/rss.xml', source: 'إندبندنت عربي' },
                { url: 'https://aawsat.com/home/rss', source: 'الشرق الأوسط' },
                // مصادر إقليمية
                { url: 'https://www.almayadeen.net/rss', source: 'الميادين' },
                { url: 'https://www.irna.ir/rss.xml', source: 'IRNA إيران' },
                { url: 'https://www.rudaw.net/arabic/rss', source: 'روداو كردستان' },
                { url: 'https://www.alsumaria.tv/rss', source: 'السومرية العراق' },
            ];

            // جلب RSS بالتوازي
            const rssPromises = rssFeeds.map(async (feed) => {
                try {
                    // استخدام rss2json API مجاني لتحويل RSS لـ JSON
                    const rssUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}&count=5`;
                    const resp = await fetch(rssUrl, { signal: AbortSignal.timeout(5000) });
                    if (!resp.ok) return [];
                    const data = await resp.json();
                    if (data.status !== 'ok' || !data.items?.length) return [];
                    return data.items.map(item => ({
                        title: item.title?.trim() || '',
                        publishedAt: item.pubDate || new Date().toISOString(),
                        source: { name: feed.source },
                        url: item.link || '',
                        lang: 'ar'
                    })).filter(a => a.title);
                } catch (e) { return []; }
            });

            const rssResults = await Promise.allSettled(rssPromises);
            rssResults.forEach(r => { if (r.status === 'fulfilled') allArticles.push(...r.value); });

            // ===== 2. The Guardian API (دولي - سيُترجم) =====
            try {
                const guardianUrl = `https://content.guardianapis.com/search?q=middle+east+OR+iran+OR+israel+OR+iraq+OR+saudi&section=world&page-size=10&order-by=newest&api-key=${apiKeyGuardian}`;
                const gResp = await fetch(guardianUrl, { signal: AbortSignal.timeout(5000) });
                if (gResp.ok) {
                    const gData = await gResp.json();
                    if (gData.response?.results?.length) {
                        gData.response.results.forEach(item => {
                            allArticles.push({
                                title: item.webTitle,
                                publishedAt: item.webPublicationDate,
                                source: { name: 'The Guardian' },
                                url: item.webUrl,
                                lang: 'en'
                            });
                        });
                    }
                }
            } catch (e) {}

            // ===== 3. GNews كبديل إضافي =====
            try {
                const gnewsUrl = `https://gnews.io/api/v4/search?q=${encodeURIComponent(q)}&lang=ar&max=5&sortby=publishedAt&apikey=${apiKeyGNews}&_=${Date.now()}`;
                const gnResp = await fetch(gnewsUrl, { signal: AbortSignal.timeout(5000) });
                if (gnResp.ok) {
                    const gnData = await gnResp.json();
                    if (gnData.articles?.length) {
                        gnData.articles.forEach(a => {
                            allArticles.push({ ...a, lang: 'ar' });
                        });
                    }
                }
            } catch (e) {}

            if (allArticles.length === 0) {
                return res.status(502).json({ error: "فشل جميع مصادر الأخبار" });
            }

            // ترتيب من الأحدث للأقدم
            allArticles.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

            // إزالة التكرار
            const seen = new Set();
            const unique = allArticles.filter(a => {
                const key = a.title.substring(0, 30);
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });

            // ترجمة العناوين الإنجليزية بـ Groq
            const toTranslate = unique.filter(a => a.lang === 'en').slice(0, 8);
            if (toTranslate.length > 0 && apiKeyGroq) {
                try {
                    const translateResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKeyGroq}` },
                        body: JSON.stringify({
                            model: 'llama-3.3-70b-versatile',
                            messages: [{
                                role: 'user',
                                content: `ترجم هذه العناوين الإخبارية للعربية. أجب بـ JSON فقط: {"translations": ["ترجمة1", "ترجمة2", ...]}\nالعناوين:\n${toTranslate.map((a, i) => `${i + 1}. ${a.title}`).join('\n')}`
                            }],
                            temperature: 0.1,
                            max_tokens: 800,
                            response_format: { type: 'json_object' }
                        })
                    });
                    if (translateResp.ok) {
                        const tData = await translateResp.json();
                        const translations = JSON.parse(tData.choices?.[0]?.message?.content || '{}').translations || [];
                        toTranslate.forEach((a, i) => {
                            if (translations[i]) a.title = translations[i];
                            a.lang = 'ar';
                        });
                    }
                } catch (e) {}
            }

            return res.status(200).json({ articles: unique.slice(0, 20) });
        }

        // ===== تحليل الخبر =====
        if (type === 'analyze') {
            const decodedText = decodeURIComponent(text || '').replace(/["\\`%&+#]/g, ' ').trim();
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
                                { role: 'system', content: 'أنت محلل جيوسياسي. ترد بـ JSON نقي فقط.' },
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
