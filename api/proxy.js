export default async function handler(req, res) {
    const { type, q = 'الشرق الأوسط', text } = req.query;
    const apiKeyGNews = process.env.GNEWS_API_KEY;
    const apiKeyGroq = process.env.GROQ_API_KEY;
    const apiKeyGemini = process.env.GEMINI_API_KEY;
    const apiKeyGuardian = process.env.GUARDIAN_API_KEY || 'test';

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');

    // دالة جلب RSS (ممتازة كما هي)
    async function fetchRSS(url, sourceName, sourceFlag, lang = 'ar') {
        try {
            const resp = await fetch(url, {
                signal: AbortSignal.timeout(7000),
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)', 'Accept': 'application/rss+xml, application/xml, text/xml, */*' }
            });
            if (!resp.ok) return [];
            const xml = await resp.text();
            const items = [];
            const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
            let match;
            while ((match = itemRegex.exec(xml)) !== null && items.length < 6) {
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
            // قائمة المصادر (قمت بتصحيحها وتنظيمها)
            const feeds = [
                ['https://www.aljazeera.net/feed/topic-35', 'الجزيرة', '🇶🇦', 'ar'],
                ['https://arabic.rt.com/rss/', 'RT عربي', '🇷🇺', 'ar'],
                ['https://www.bbc.com/arabic/index.xml', 'BBC عربي', '🇬🇧', 'ar'],
                ['https://alarabiya.net/ar/rss.xml', 'العربية', '🇸🇦', 'ar'],
                ['https://www.france24.com/ar/rss', 'فرانس 24', '🇫🇷', 'ar'],
                ['https://www.skynewsarabia.com/rss.xml', 'سكاي نيوز عربية', '🇦🇪', 'ar'],
                ['https://www.almayadeen.net/rss', 'الميادين', '🇱🇧', 'ar'],
                ['https://www.tasnimnews.com/ar/rss', 'تسنيم', '🇮🇷', 'ar'],
                ['https://www.aa.com.tr/ar/rss/default?cat=live', 'الأناضول', '🇹🇷', 'ar'],
                ['https://www.rudaw.net/arabic/rss', 'روداو', '🇮🇶', 'ar'],
                ['https://shafaq.com/ar/rss.xml', 'شفق نيوز', '🇮🇶', 'ar'],
                ['https://sana.sy/feed/', 'سانا سوريا', '🇸🇾', 'ar'],
                ['https://almasirah.net/rss.xml', 'المسيرة', '🇾🇪', 'ar']
            ];

            const results = await Promise.allSettled(feeds.map(f => fetchRSS(f[0], f[1], f[2], f[3])));
            results.forEach(r => { if (r.status === 'fulfilled') allArticles.push(...r.value); });

            // GNews & Guardian جلب تكميلي
            try {
                const gnResp = await fetch(`https://gnews.io/api/v4/search?q=${encodeURIComponent(q)}&lang=ar&max=5&apikey=${apiKeyGNews}`);
                if (gnResp.ok) {
                    const gnData = await gnResp.json();
                    gnData.articles?.forEach(a => allArticles.push({ title: a.title, publishedAt: a.publishedAt, source: { name: a.source.name, flag: '📰' }, url: a.url, lang: 'ar' }));
                }
            } catch(e){}

            // إزالة التكرار والفرز
            const seen = new Set();
            const unique = allArticles.filter(a => {
                const key = a.title.substring(0, 25);
                if (seen.has(key)) return false;
                seen.add(key); return true;
            }).sort((a,b) => new Date(b.publishedAt) - new Date(a.publishedAt));

            return res.status(200).json({ articles: unique });
        }

        if (type === 'analyze') {
            const decodedText = decodeURIComponent(text || '').replace(/["\\`%&+#]/g, ' ').trim();
            const prompt = `أنت محلل جيوسياسي خبير. حلل هذا الخبر وأجب بـ JSON نقي فقط وبدون علامات ديسكورد:
            {"threat_level":"حرج","threat_score":85,"summary":"تحليل دقيق","parties":["طرف1"],"interests":"دوافع","scenarios":{"current":"..","best":"..","worst":".."},"forecast":"توقعات","lat":33.3,"lng":44.4,"location_name":"المكان"}
            الخبر: "${decodedText}"`;

            // المحاولة مع Groq أولاً (أسرع)
            if (apiKeyGroq) {
                try {
                    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKeyGroq}` },
                        body: JSON.stringify({
                            model: 'llama-3.3-70b-versatile',
                            messages: [{ role: 'user', content: prompt }],
                            response_format: { type: 'json_object' }
                        })
                    });
                    if (r.ok) {
                        const d = await r.json();
                        const p = JSON.parse(d.choices[0].message.content);
                        p._source = 'groq';
                        return res.status(200).json(p);
                    }
                } catch(e) {}
            }

            // محرك Gemini الاحتياطي (تم تصحيح أسماء الموديلات)
            if (apiKeyGemini) {
                for (const model of ['gemini-1.5-flash', 'gemini-2.0-flash']) {
                    try {
                        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKeyGemini}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
                        });
                        const d = await r.json();
                        let raw = d.candidates[0].content.parts[0].text;
                        const m = raw.match(/\{[\s\S]*\}/);
                        if (m) {
                            const p = JSON.parse(m[0]);
                            p._source = 'gemini';
                            return res.status(200).json(p);
                        }
                    } catch(e) { continue; }
                }
            }
            return res.status(502).json({ error: "فشل التحليل الاستراتيجي" });
        }
    } catch(error) {
        return res.status(500).json({ error: "فشل في محرك Proxy", details: error.message });
    }
}
