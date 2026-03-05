export default async function handler(req, res) {
    const { type, q = 'الشرق الأوسط', text } = req.query;
    const apiKeyGNews = process.env.GNEWS_API_KEY;
    const apiKeyGroq = process.env.GROQ_API_KEY;
    const apiKeyGemini = process.env.GEMINI_API_KEY;
    const apiKeyGuardian = process.env.GUARDIAN_API_KEY || 'test';

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');

    // دالة لقراءة RSS مباشرة بدون خدمة وسيطة
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

            const feeds = [
                // عربية أساسية
                ['https://www.aljazeera.net/feed/topic-35', 'الجزيرة', '🇶🇦', 'ar'],
                ['https://arabic.rt.com/rss/', 'RT عربي', '🇷🇺', 'ar'],
                ['https://www.bbc.com/arabic/index.xml', 'BBC عربي', '🇬🇧', 'ar'],
                ['https://alarabiya.net/ar/rss.xml', 'العربية', '🇸🇦', 'ar'],
                ['https://www.france24.com/ar/rss', 'فرانس 24', '🇫🇷', 'ar'],
                ['https://www.independentarabia.com/rss.xml', 'إندبندنت عربي', '🌍', 'ar'],
                ['https://aawsat.com/home/rss', 'الشرق الأوسط', '🗞️', 'ar'],
                ['https://www.skynewsarabia.com/rss.xml', 'سكاي نيوز عربية', '🇦🇪', 'ar'],
                ['https://www.almayadeen.net/rss', 'الميادين', '🇱🇧', 'ar'],
                // إيرانية
                ['https://www.irna.ir/rss.xml', 'IRNA إيران', '🇮🇷', 'ar'],
                ['https://www.tasnimnews.com/ar/rss', 'تسنيم', '🇮🇷', 'ar'],
                ['https://www.mehrnews.com/rss', 'مهر نيوز', '🇮🇷', 'ar'],
                // تركية
                ['https://www.aa.com.tr/ar/rss/default?cat=live', 'الأناضول', '🇹🇷', 'ar'],
                ['https://www.trtarabi.com/rss', 'TRT عربي', '🇹🇷', 'ar'],
                // عراقية
                ['https://www.rudaw.net/arabic/rss', 'روداو', '🇮🇶', 'ar'],
                ['https://www.alsumaria.tv/rss', 'السومرية', '🇮🇶', 'ar'],
                ['https://shafaq.com/ar/rss.xml', 'شفق نيوز', '🇮🇶', 'ar'],
                ['https://www.baghdadtoday.news/rss.xml', 'بغداد اليوم', '🇮🇶', 'ar'],
                // خليجية
                ['https://www.alwatan.com.sa/rss.xml', 'الوطن السعودية', '🇸🇦', 'ar'],
                ['https://okaz.com.sa/rss.xml', 'عكاظ', '🇸🇦', 'ar'],
                ['https://www.alayam.com/rss', 'الأيام البحرين', '🇧🇭', 'ar'],
                // سورية
                ['https://sana.sy/feed/', 'سانا سوريا', '🇸🇾', 'ar'],
                ['https://orient-news.net/feed/', 'أورينت سوريا', '🇸🇾', 'ar'],
                // يمنية
                ['https://www.sabanews.net/rss.xml', 'سبأ اليمن', '🇾🇪', 'ar'],
                ['https://almasirah.net/rss.xml', 'المسيرة', '🇾🇪', 'ar'],
                // عبرية ستُترجم
                ['https://www.timesofisrael.com/feed/', 'Times of Israel', '🇮🇱', 'en'],
                ['https://www.jpost.com/Rss/RssFeedsHeadlines.aspx', 'Jerusalem Post', '🇮🇱', 'en'],
                // دولية ستُترجم
                ['https://feeds.reuters.com/reuters/worldNews', 'Reuters', '🌐', 'en'],
                ['https://feeds.reuters.com/Reuters/worldNews', 'Reuters World', '🌐', 'en'],
                ['https://rsshub.app/ap/topics/apf-intlnews', 'Associated Press', '🌐', 'en'],
                ['https://apnews.com/hub/world-news?format=rss', 'AP News', '🌐', 'en'],
                ['https://www.al-monitor.com/rss', 'Al-Monitor', '🌐', 'en'],
                ['https://rss.nytimes.com/services/xml/rss/nyt/MiddleEast.xml', 'NY Times', '🌐', 'en'],
                ['https://www.economist.com/middle-east-and-africa/rss.xml', 'The Economist', '🌐', 'en'],
                ['https://foreignpolicy.com/feed/', 'Foreign Policy', '🌐', 'en'],
            ];

            // جلب كل المصادر بالتوازي الكامل
            const results = await Promise.allSettled(
                feeds.map(([url, name, flag, lang]) => fetchRSS(url, name, flag, lang))
            );
            results.forEach(r => { if (r.status === 'fulfilled') allArticles.push(...r.value); });

            // The Guardian
            try {
                const gResp = await fetch(
                    `https://content.guardianapis.com/search?q=middle+east+OR+iran+OR+israel+OR+iraq&section=world&page-size=10&order-by=newest&api-key=${apiKeyGuardian}`,
                    { signal: AbortSignal.timeout(5000) }
                );
                if (gResp.ok) {
                    const gData = await gResp.json();
                    gData.response?.results?.forEach(item => allArticles.push({
                        title: item.webTitle, publishedAt: item.webPublicationDate,
                        source: { name: 'The Guardian', flag: '🇬🇧' }, url: item.webUrl, lang: 'en'
                    }));
                }
            } catch(e) {}

            // GNews
            try {
                const gnResp = await fetch(
                    `https://gnews.io/api/v4/search?q=${encodeURIComponent(q)}&lang=ar&max=5&sortby=publishedAt&apikey=${apiKeyGNews}&_=${Date.now()}`,
                    { signal: AbortSignal.timeout(5000) }
                );
                if (gnResp.ok) {
                    const gnData = await gnResp.json();
                    gnData.articles?.forEach(a => allArticles.push({
                        title: a.title, publishedAt: a.publishedAt,
                        source: { name: a.source?.name || 'GNews', flag: '📰' }, url: a.url, lang: 'ar'
                    }));
                }
            } catch(e) {}

            // ===== GDELT Project - أضخم قاعدة أخبار في العالم =====
            try {
                const gdeltUrl = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent('middle east OR iran OR israel OR iraq OR saudi OR syria')}&mode=artlist&maxrecords=20&format=json&sort=datedesc&sourcelang=arabic`;
                const gdResp = await fetch(gdeltUrl, { signal: AbortSignal.timeout(7000) });
                if (gdResp.ok) {
                    const gdData = await gdResp.json();
                    gdData.articles?.forEach(a => {
                        if (a.title && a.title.length > 5) {
                            allArticles.push({
                                title: a.title,
                                publishedAt: a.seendate ? new Date(a.seendate.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6Z')).toISOString() : new Date().toISOString(),
                                source: { name: a.domain || 'GDELT', flag: '🌍' },
                                url: a.url || '',
                                lang: 'ar'
                            });
                        }
                    });
                }
            } catch(e) {}

            // GDELT إنجليزي أيضاً (سيُترجم)
            try {
                const gdeltEnUrl = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent('middle east iran israel iraq')}&mode=artlist&maxrecords=15&format=json&sort=datedesc&sourcelang=english`;
                const gdEnResp = await fetch(gdeltEnUrl, { signal: AbortSignal.timeout(7000) });
                if (gdEnResp.ok) {
                    const gdEnData = await gdEnResp.json();
                    gdEnData.articles?.forEach(a => {
                        if (a.title && a.title.length > 5) {
                            allArticles.push({
                                title: a.title,
                                publishedAt: a.seendate ? new Date(a.seendate.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6Z')).toISOString() : new Date().toISOString(),
                                source: { name: a.domain || 'GDELT', flag: '🌍' },
                                url: a.url || '',
                                lang: 'en'
                            });
                        }
                    });
                }
            } catch(e) {}

            if (allArticles.length === 0) return res.status(502).json({ error: "فشل جميع مصادر الأخبار" });

            // إزالة التكرار
            allArticles.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
            const seen = new Set();
            const unique = allArticles.filter(a => {
                if (!a.title || a.title.length < 5) return false;
                const key = a.title.substring(0, 20).toLowerCase().trim();
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });

            // ترجمة كل العناوين غير العربية دفعة واحدة
            const toTranslate = unique.filter(a => (a.title.match(/[\u0600-\u06FF]/g) || []).length === 0);
            if (toTranslate.length > 0 && apiKeyGroq) {
                try {
                    const tResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKeyGroq}` },
                        body: JSON.stringify({
                            model: 'llama-3.3-70b-versatile',
                            messages: [{ role: 'user', content: `ترجم هذه العناوين للعربية. JSON فقط: {"t":["ترجمة1","ترجمة2",...]}\n${toTranslate.slice(0,25).map((a,i)=>`${i+1}. ${a.title}`).join('\n')}` }],
                            temperature: 0.1, max_tokens: 2000,
                            response_format: { type: 'json_object' }
                        })
                    });
                    if (tResp.ok) {
                        const tData = await tResp.json();
                        const tr = JSON.parse(tData.choices?.[0]?.message?.content || '{}').t || [];
                        toTranslate.slice(0,25).forEach((a, i) => { if (tr[i]) { a.title = tr[i]; a.lang = 'ar'; } });
                    }
                } catch(e) {}
            }

            unique.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
            return res.status(200).json({ articles: unique });
        }

        if (type === 'analyze') {
            const decodedText = decodeURIComponent(text || '').replace(/["\\`%&+#]/g, ' ').trim();
            if (!decodedText.trim()) return res.status(400).json({ error: "النص فارغ" });

            const prompt = `أنت محلل جيوسياسي استراتيجي خبير. حلل هذا الخبر وأجب بـ JSON نقي فقط:
{"threat_level":"حرج أو مرتفع أو متوسط أو منخفض","threat_score":75,"summary":"تحليل من 3 جمل","parties":["طرف1","طرف2"],"interests":"المصالح في جملتين","scenarios":{"current":"الوضع الراهن","best":"أفضل سيناريو","worst":"أسوأ سيناريو"},"forecast":"التوقعات 30 يوماً","lat":33.3,"lng":44.4,"location_name":"المكان"}
الخبر: "${decodedText}"`;

            if (apiKeyGroq) {
                try {
                    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKeyGroq}` },
                        body: JSON.stringify({
                            model: 'llama-3.3-70b-versatile',
                            messages: [
                                { role: 'system', content: 'محلل جيوسياسي. JSON نقي فقط.' },
                                { role: 'user', content: prompt }
                            ],
                            temperature: 0.3, max_tokens: 1000,
                            response_format: { type: 'json_object' }
                        })
                    });
                    if (r.ok) {
                        const d = await r.json();
                        const p = JSON.parse(d.choices?.[0]?.message?.content || '{}');
                        p.lat = parseFloat(p.lat) || 30.0;
                        p.lng = parseFloat(p.lng) || 45.0;
                        p.threat_score = parseInt(p.threat_score) || 50;
                        p._source = 'groq';
                        return res.status(200).json(p);
                    }
                } catch(e) {}
            }

            if (apiKeyGemini) {
                for (const model of ['gemini-2.5-flash', 'gemini-2.0-flash-lite']) {
                    try {
                        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKeyGemini}`,
                            { method: 'POST', headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3, maxOutputTokens: 1000 } }) });
                        const d = await r.json();
                        if (r.ok && d.candidates?.length) {
                            let raw = d.candidates[0]?.content?.parts?.[0]?.text || '';
                            raw = raw.replace(/```json/gi,'').replace(/```/g,'').trim();
                            const m = raw.match(/\{[\s\S]*\}/);
                            if (m) {
                                const p = JSON.parse(m[0]);
                                p.lat = parseFloat(p.lat) || 30.0; p.lng = parseFloat(p.lng) || 45.0;
                                p.threat_score = parseInt(p.threat_score) || 50; p._source = 'gemini';
                                return res.status(200).json(p);
                            }
                        }
                    } catch(e) { continue; }
                }
            }
            return res.status(502).json({ error: "فشل التحليل" });
        }

        return res.status(400).json({ error: "نوع الطلب غير معروف" });
    } catch(error) {
        return res.status(500).json({ error: "فشل النظام", details: error.message });
    }
}
