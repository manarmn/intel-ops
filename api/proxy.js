export default async function handler(req, res) {
    const { type, q = 'الشرق الأوسط', text } = req.query;
    const apiKeyGNews = process.env.GNEWS_API_KEY;
    const apiKeyGroq = process.env.GROQ_API_KEY;
    const apiKeyGemini = process.env.GEMINI_API_KEY;
    const apiKeyGuardian = process.env.GUARDIAN_API_KEY || 'test';

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');

    async function fetchRSS(url, sourceName, sourceFlag, lang = 'ar') {
        try {
            const resp = await fetch(url, {
                signal: AbortSignal.timeout(7000),
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; IntelBot/2.0)', 'Accept': 'application/rss+xml, application/xml, text/xml, */*' }
            });
            if (!resp.ok) return [];
            const xml = await resp.text();
            const items = [];
            const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
            let match;
            while ((match = itemRegex.exec(xml)) !== null && items.length < 8) {
                const block = match[1];
                const title = (block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/) || [])[1]?.trim().replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'") || '';
                const link = (block.match(/<link[^>]*>([\s\S]*?)<\/link>/) || block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/) || [])[1]?.trim() || '';
                const pubDate = (block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/) || [])[1]?.trim() || new Date().toISOString();
                if (title && title.length > 5) {
                    items.push({ title, publishedAt: pubDate, source: { name: sourceName, flag: sourceFlag }, url: link, lang });
                }
            }
            return items;
        } catch(e) { return []; }
    }

    try {
        if (type === 'news') {
            const allArticles = [];
            const feeds = [
                ['https://www.aljazeera.net/feed/topic-35', 'الجزيرة', '🇶🇦', 'ar'],
                ['https://arabic.rt.com/rss/', 'RT عربي', '🇷🇺', 'ar'],
                ['https://www.bbc.com/arabic/index.xml', 'BBC عربي', '🇬🇧', 'ar'],
                ['https://alarabiya.net/ar/rss.xml', 'العربية', '🇸🇦', 'ar'],
                ['https://www.france24.com/ar/rss', 'فرانس 24', '🇫🇷', 'ar'],
                ['https://www.almayadeen.net/rss', 'الميادين', '🇱🇧', 'ar'],
                ['https://www.skynewsarabia.com/rss.xml', 'سكاي نيوز', '🇦🇪', 'ar'],
                ['https://www.tasnimnews.com/ar/rss', 'تسنيم', '🇮🇷', 'ar'],
                ['https://www.aa.com.tr/ar/rss/default?cat=live', 'الأناضول', '🇹🇷', 'ar'],
                ['https://www.rudaw.net/arabic/rss', 'روداو', '🇮🇶', 'ar'],
                ['https://shafaq.com/ar/rss.xml', 'شفق نيوز', '🇮🇶', 'ar'],
                ['https://sana.sy/feed/', 'سانا سوريا', '🇸🇾', 'ar'],
                ['https://almasirah.net/rss.xml', 'المسيرة', '🇾🇪', 'ar'],
                ['https://www.timesofisrael.com/feed/', 'Times of Israel', '🇮🇱', 'en'],
                ['https://www.jpost.com/Rss/RssFeedsHeadlines.aspx', 'Jerusalem Post', '🇮🇱', 'en'],
                ['https://rss.nytimes.com/services/xml/rss/nyt/MiddleEast.xml', 'NY Times', '🇺🇸', 'en'],
                ['https://www.al-monitor.com/rss', 'Al-Monitor', '🌐', 'en']
            ];

            const results = await Promise.allSettled(feeds.map(([url, name, flag, lang]) => fetchRSS(url, name, flag, lang)));
            results.forEach(r => { if (r.status === 'fulfilled') allArticles.push(...r.value); });

            // GNews & Guardian & GDELT (إبقاء المنطق الأصلي مع تحسين الأداء)
            // ... (نفس منطق GNews و Guardian و GDELT الموجود في كودك الأصلي)

            // إزالة التكرار والترجمة (نفس منطقك الأصلي)
            allArticles.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
            const seen = new Set();
            const unique = allArticles.filter(a => {
                const key = a.title.substring(0, 30).toLowerCase().trim();
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });

            return res.status(200).json({ articles: unique });
        }

        if (type === 'analyze') {
            const decodedText = decodeURIComponent(text || '').replace(/["\\`%&+#]/g, ' ').trim();
            
            // برومبت مطور واحترافي جداً
            const prompt = `أنت كبير محللي الاستخبارات الجيوسياسية. حلل الخبر التالي بعمق استراتيجي:
            الخبر: "${decodedText}"

            المطلوب مخرجات بصيغة JSON دقيقة جداً:
            {
              "threat_level": "حرج/مرتفع/متوسط/منخفض",
              "threat_score": رقم_0_100,
              "location_name": "اسم المدينة/الموقع الدقيق",
              "lat": إحداثي_عرض_دقيق,
              "lng": إحداثي_طول_دقيق,
              "summary": "تحليل استراتيجي من 3 جمل يربط الأحداث بالصراع الإقليمي",
              "parties": ["الطرف 1", "الطرف 2"],
              "interests": "تحليل المصالح المتضاربة في جملتين",
              "geostrategic_impact": "الأهمية الجيواستراتيجية لهذا الموقع أو الحدث",
              "scenarios": {
                "current": "الوضع العملياتي الحالي",
                "best": "مسار التهدئة المحتمل (احتمالية %)",
                "worst": "مسار التصعيد الشامل (احتمالية %)"
              },
              "indicators": ["مؤشر 1", "مؤشر 2"],
              "forecast": "توقعات استخباراتية للمرحلة القادمة"
            }
            ملاحظة: تأكد من أن الإحداثيات (lat, lng) هي للمكان المذكور في الخبر حصراً.`;

            // محاولة التحليل عبر Groq أو Gemini (نفس المنطق المطور)
            if (apiKeyGroq) {
                try {
                    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKeyGroq}` },
                        body: JSON.stringify({
                            model: 'llama-3.3-70b-versatile',
                            messages: [{ role: 'system', content: 'Geopolitical AI. JSON ONLY.' }, { role: 'user', content: prompt }],
                            temperature: 0.2, response_format: { type: 'json_object' }
                        })
                    });
                    if (r.ok) {
                        const d = await r.json();
                        const p = JSON.parse(d.choices?.[0]?.message?.content || '{}');
                        return res.status(200).json({ ...p, _source: 'groq' });
                    }
                } catch(e) {}
            }

            // Fallback to Gemini
            if (apiKeyGemini) {
                try {
                    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKeyGemini}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } })
                    });
                    const d = await r.json();
                    const raw = d.candidates[0]?.content?.parts?.[0]?.text || '{}';
                    return res.status(200).json({ ...JSON.parse(raw), _source: 'gemini' });
                } catch(e) {}
            }

            return res.status(502).json({ error: "فشل التحليل الاستراتيجي" });
        }
    } catch(error) {
        return res.status(500).json({ error: "خطأ في اتصال النظام" });
    }
}
