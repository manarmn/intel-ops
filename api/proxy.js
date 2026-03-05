export default async function handler(req, res) {
    const { type, q = 'الشرق الأوسط', text } = req.query;
    const apiKeyGNews = process.env.GNEWS_API_KEY;
    const apiKeyGroq = process.env.GROQ_API_KEY;
    const apiKeyGemini = process.env.GEMINI_API_KEY;
    const apiKeyGuardian = process.env.GUARDIAN_API_KEY || 'test';

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');

    try {

        if (type === 'news') {
            const allArticles = [];

            // ===== RSS Feeds - مقسمة لمجموعات للسرعة =====
            const rssFeeds = [
                // عربية أساسية - الأسرع
                { url: 'https://www.aljazeera.net/feed/topic-35', source: 'الجزيرة', flag: '🇶🇦', lang: 'ar' },
                { url: 'https://arabic.rt.com/rss/', source: 'RT عربي', flag: '🇷🇺', lang: 'ar' },
                { url: 'https://www.bbc.com/arabic/index.xml', source: 'BBC عربي', flag: '🇬🇧', lang: 'ar' },
                { url: 'https://alarabiya.net/ar/rss.xml', source: 'العربية', flag: '🇸🇦', lang: 'ar' },
                { url: 'https://www.france24.com/ar/rss', source: 'فرانس 24', flag: '🇫🇷', lang: 'ar' },
                { url: 'https://www.independentarabia.com/rss.xml', source: 'إندبندنت عربي', flag: '🌍', lang: 'ar' },
                { url: 'https://aawsat.com/home/rss', source: 'الشرق الأوسط', flag: '🗞️', lang: 'ar' },
                { url: 'https://www.skynewsarabia.com/rss.xml', source: 'سكاي نيوز عربية', flag: '🇦🇪', lang: 'ar' },
                { url: 'https://www.almayadeen.net/rss', source: 'الميادين', flag: '🇱🇧', lang: 'ar' },
                // إيرانية
                { url: 'https://www.irna.ir/rss.xml', source: 'IRNA إيران', flag: '🇮🇷', lang: 'ar' },
                { url: 'https://www.tasnimnews.com/ar/rss', source: 'تسنيم', flag: '🇮🇷', lang: 'ar' },
                { url: 'https://www.mehrnews.com/rss', source: 'مهر نيوز', flag: '🇮🇷', lang: 'ar' },
                // تركية
                { url: 'https://www.aa.com.tr/ar/rss/default?cat=live', source: 'الأناضول', flag: '🇹🇷', lang: 'ar' },
                { url: 'https://www.trtarabi.com/rss', source: 'TRT عربي', flag: '🇹🇷', lang: 'ar' },
                // عراقية
                { url: 'https://www.rudaw.net/arabic/rss', source: 'روداو', flag: '🇮🇶', lang: 'ar' },
                { url: 'https://www.alsumaria.tv/rss', source: 'السومرية', flag: '🇮🇶', lang: 'ar' },
                { url: 'https://shafaq.com/ar/rss.xml', source: 'شفق نيوز', flag: '🇮🇶', lang: 'ar' },
                { url: 'https://www.baghdadtoday.news/rss.xml', source: 'بغداد اليوم', flag: '🇮🇶', lang: 'ar' },
                // خليجية
                { url: 'https://www.alwatan.com.sa/rss.xml', source: 'الوطن السعودية', flag: '🇸🇦', lang: 'ar' },
                { url: 'https://okaz.com.sa/rss.xml', source: 'عكاظ', flag: '🇸🇦', lang: 'ar' },
                { url: 'https://www.alayam.com/rss', source: 'الأيام البحرين', flag: '🇧🇭', lang: 'ar' },
                // سورية
                { url: 'https://sana.sy/feed/', source: 'سانا سوريا', flag: '🇸🇾', lang: 'ar' },
                { url: 'https://orient-news.net/feed/', source: 'أورينت سوريا', flag: '🇸🇾', lang: 'ar' },
                // يمنية
                { url: 'https://www.sabanews.net/rss.xml', source: 'سبأ اليمن', flag: '🇾🇪', lang: 'ar' },
                { url: 'https://almasirah.net/rss.xml', source: 'المسيرة اليمن', flag: '🇾🇪', lang: 'ar' },
                // عبرية - ستُترجم
                { url: 'https://www.timesofisrael.com/feed/', source: 'Times of Israel', flag: '🇮🇱', lang: 'en' },
                { url: 'https://www.jpost.com/Rss/RssFeedsHeadlines.aspx', source: 'Jerusalem Post', flag: '🇮🇱', lang: 'en' },
                // دولية - ستُترجم
                { url: 'https://feeds.reuters.com/reuters/worldNews', source: 'Reuters', flag: '🌐', lang: 'en' },
                { url: 'https://www.al-monitor.com/rss', source: 'Al-Monitor', flag: '🌐', lang: 'en' },
            ];

            // جلب كل المصادر بالتوازي مع timeout أعلى
            const rssPromises = rssFeeds.map(async (feed) => {
                try {
                    const rssUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}&count=6&api_key=free`;
                    const resp = await fetch(rssUrl, { signal: AbortSignal.timeout(8000) });
                    if (!resp.ok) return [];
                    const data = await resp.json();
                    if (data.status !== 'ok' || !data.items?.length) return [];
                    return data.items.map(item => ({
                        title: item.title?.trim() || '',
                        publishedAt: item.pubDate || new Date().toISOString(),
                        source: { name: feed.source, flag: feed.flag },
                        url: item.link || '',
                        lang: feed.lang
                    })).filter(a => a.title && a.title.length > 5);
                } catch (e) { return []; }
            });

            const rssResults = await Promise.allSettled(rssPromises);
            rssResults.forEach(r => { if (r.status === 'fulfilled') allArticles.push(...r.value); });

            // The Guardian
            try {
                const guardianUrl = `https://content.guardianapis.com/search?q=middle+east+OR+iran+OR+israel+OR+iraq+OR+saudi+OR+syria&section=world&page-size=10&order-by=newest&api-key=${apiKeyGuardian}`;
                const gResp = await fetch(guardianUrl, { signal: AbortSignal.timeout(5000) });
                if (gResp.ok) {
                    const gData = await gResp.json();
                    gData.response?.results?.forEach(item => {
                        allArticles.push({
                            title: item.webTitle,
                            publishedAt: item.webPublicationDate,
                            source: { name: 'The Guardian', flag: '🇬🇧' },
                            url: item.webUrl,
                            lang: 'en'
                        });
                    });
                }
            } catch (e) {}

            // GNews
            try {
                const gnewsUrl = `https://gnews.io/api/v4/search?q=${encodeURIComponent(q)}&lang=ar&max=5&sortby=publishedAt&apikey=${apiKeyGNews}&_=${Date.now()}`;
                const gnResp = await fetch(gnewsUrl, { signal: AbortSignal.timeout(5000) });
                if (gnResp.ok) {
                    const gnData = await gnResp.json();
                    gnData.articles?.forEach(a => allArticles.push({
                        title: a.title, publishedAt: a.publishedAt,
                        source: { name: a.source?.name || 'GNews', flag: '📰' },
                        url: a.url, lang: 'ar'
                    }));
                }
            } catch (e) {}

            if (allArticles.length === 0) return res.status(502).json({ error: "فشل جميع مصادر الأخبار" });

            // إزالة التكرار بدون أي فلتر
            allArticles.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
            const seen = new Set();
            const unique = allArticles.filter(a => {
                if (!a.title || a.title.length < 5) return false;
                const key = a.title.substring(0, 20).toLowerCase().trim();
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });

            // ترجمة كل العناوين غير العربية دفعة واحدة كبيرة
            const toTranslate = unique.filter(a => {
                const ar = (a.title.match(/[\u0600-\u06FF]/g) || []).length;
                return ar === 0 && a.title.length > 3;
            });

            if (toTranslate.length > 0 && apiKeyGroq) {
                try {
                    // دفعة واحدة لكل العناوين
                    const tResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKeyGroq}` },
                        body: JSON.stringify({
                            model: 'llama-3.3-70b-versatile',
                            messages: [{
                                role: 'user',
                                content: `ترجم هذه العناوين الإخبارية للعربية بدقة. أجب بـ JSON فقط هكذا: {"t":["ترجمة1","ترجمة2",...]}\nالعناوين:\n${toTranslate.slice(0,20).map((a,i)=>`${i+1}. ${a.title}`).join('\n')}`
                            }],
                            temperature: 0.1,
                            max_tokens: 1500,
                            response_format: { type: 'json_object' }
                        })
                    });
                    if (tResp.ok) {
                        const tData = await tResp.json();
                        const translations = JSON.parse(tData.choices?.[0]?.message?.content || '{}').t || [];
                        toTranslate.slice(0,20).forEach((a, i) => {
                            if (translations[i] && translations[i].length > 3) {
                                a.title = translations[i];
                                a.lang = 'ar';
                            }
                        });
                    }
                } catch(e) {}
            }

            // إعادة الترتيب النهائي وإرجاع كل الأخبار
            unique.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
            return res.status(200).json({ articles: unique });
        }

        if (type === 'analyze') {
            const decodedText = decodeURIComponent(text || '').replace(/["\\`%&+#]/g, ' ').trim();
            if (!decodedText.trim()) return res.status(400).json({ error: "النص فارغ" });

            const prompt = `أنت محلل جيوسياسي استراتيجي خبير. حلل هذا الخبر وأجب بـ JSON نقي فقط:
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
                            temperature: 0.3, max_tokens: 1000,
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

            if (apiKeyGemini) {
                for (const model of ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash-lite']) {
                    try {
                        const response = await fetch(
                            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKeyGemini}`,
                            { method: 'POST', headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3, maxOutputTokens: 1000 } }) }
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
