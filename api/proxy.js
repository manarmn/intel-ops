export default async function handler(req, res) {
    const { type, q = 'الشرق الأوسط', text } = req.query;
    
    // جلب مفاتيح البيئة من Vercel
    const apiKeyGemini = process.env.GEMINI_API_KEY;
    const apiKeyGroq = process.env.GROQ_API_KEY;
    const apiKeyGNews = process.env.GNEWS_API_KEY;
    const apiKeyGuardian = process.env.GUARDIAN_API_KEY || 'test';

    // إعدادات الذاكرة المؤقتة لضمان السرعة
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');

    // --- 1. دالة جلب RSS (محسنة) ---
    async function fetchRSS(url, sourceName, sourceFlag) {
        try {
            const resp = await fetch(url, {
                signal: AbortSignal.timeout(6000),
                headers: { 
                    'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/2.1)',
                    'Accept': 'application/rss+xml, application/xml, text/xml, */*' 
                }
            });
            if (!resp.ok) return [];
            const xml = await resp.text();
            const items = [];
            const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
            let match;
            
            while ((match = itemRegex.exec(xml)) !== null && items.length < 8) {
                const block = match[1];
                const title = (block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/) || [])[1]
                    ?.trim()
                    .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'") || '';
                
                const link = (block.match(/<link[^>]*>([\s\S]*?)<\/link>/) || block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/) || [])[1]?.trim() || '';
                const pubDate = (block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/) || [])[1]?.trim() || new Date().toISOString();
                
                if (title && title.length > 10) {
                    items.push({ 
                        title, 
                        publishedAt: pubDate, 
                        source: { name: sourceName, flag: sourceFlag }, 
                        url: link, 
                        lang: 'ar' 
                    });
                }
            }
            return items;
        } catch(e) { return []; }
    }

    try {
        // --- 2. قسم جلب الأخبار (News) ---
        if (type === 'news') {
            const feeds = [
                ['https://www.aljazeera.net/feed/topic-35', 'الجزيرة', '🇶🇦'],
                ['https://arabic.rt.com/rss/', 'RT عربي', '🇷🇺'],
                ['https://www.bbc.com/arabic/index.xml', 'BBC عربي', '🇬🇧'],
                ['https://alarabiya.net/ar/rss.xml', 'العربية', '🇸🇦'],
                ['https://www.france24.com/ar/rss', 'فرانس 24', '🇫🇷'],
                ['https://www.skynewsarabia.com/rss.xml', 'سكاي نيوز', '🇦🇪'],
                ['https://www.almayadeen.net/rss', 'الميادين', '🇱🇧'],
                ['https://www.tasnimnews.com/ar/rss', 'تسنيم', '🇮🇷'],
                ['https://www.aa.com.tr/ar/rss/default?cat=live', 'الأناضول', '🇹🇷'],
                ['https://www.rudaw.net/arabic/rss', 'روداو', '🇮🇶'],
                ['https://sana.sy/feed/', 'سانا سوريا', '🇸🇾'],
                ['https://almasirah.net/rss.xml', 'المسيرة', '🇾🇪']
            ];

            const results = await Promise.allSettled(feeds.map(f => fetchRSS(f[0], f[1], f[2])));
            let allArticles = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);

            // تصفية العناوين المكررة بناءً على أول 30 حرف
            const seen = new Set();
            const unique = allArticles.filter(a => {
                const key = a.title.substring(0, 30);
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });

            unique.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
            return res.status(200).json({ articles: unique });
        }

        // --- 3. قسم التحليل الجيوسياسي (Analyze) ---
        if (type === 'analyze') {
            const decodedText = decodeURIComponent(text || '').replace(/["'<>]/g, '').trim().substring(0, 1500);
            if (!decodedText) return res.status(400).json({ error: "النص فارغ" });

            const prompt = `أنت محلل جيوسياسي استراتيجي. حلل الخبر التالي بدقة استخباراتية.
            يجب أن يكون الرد JSON نقي فقط (بدون markdown):
            {
              "threat_level": "حرج/مرتفع/متوسط/منخفض",
              "threat_score": 85,
              "summary": "تحليل استراتيجي من 3 جمل",
              "parties": ["طرف1", "طرف2"],
              "interests": "المصالح المتضاربة",
              "scenarios": {"current": "..", "best": "..", "worst": ".."},
              "forecast": "توقعات 30 يوماً",
              "lat": 33.8, "lng": 35.5,
              "location_name": "اسم المكان بدقة"
            }
            الخبر: "${decodedText}"`;

            // محاولة التحليل - نظام الـ Failover
            try {
                // المحاولة الأولى: Gemini (الأفضل للعربية)
                const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKeyGemini}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { temperature: 0.2, maxOutputTokens: 1000 }
                    }),
                    signal: AbortSignal.timeout(9000) // البقاء تحت الـ 10 ثواني لتجنب 502 Vercel
                });

                const data = await aiResponse.json();
                if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                    let raw = data.candidates[0].content.parts[0].text;
                    const jsonStart = raw.indexOf('{');
                    const jsonEnd = raw.lastIndexOf('}');
                    if (jsonStart !== -1 && jsonEnd !== -1) {
                        return res.status(200).json(JSON.parse(raw.substring(jsonStart, jsonEnd + 1)));
                    }
                }
                throw new Error("Gemini format error");

            } catch (err) {
                // المحاولة الثانية: Groq (إذا فشل Gemini)
                if (apiKeyGroq) {
                    try {
                        const groqResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKeyGroq}` },
                            body: JSON.stringify({
                                model: 'llama-3.3-70b-versatile',
                                messages: [{ role: 'user', content: prompt }],
                                response_format: { type: 'json_object' }
                            }),
                            signal: AbortSignal.timeout(8000)
                        });
                        const groqData = await groqResp.json();
                        return res.status(200).json(JSON.parse(groqData.choices[0].message.content));
                    } catch (e) {
                        throw new Error("Both AI engines failed");
                    }
                }
                throw err;
            }
        }

        return res.status(400).json({ error: "نوع الطلب غير معروف" });

    } catch (error) {
        console.error("Critical Proxy Error:", error.message);
        // منع الـ 500 والـ 502 بإرجاع رد "آمن" يوضح المشكلة للمستخدم
        return res.status(200).json({
            threat_level: "تحذير",
            threat_score: 50,
            summary: "حدث ضغط كبير على محرك التحليل. يرجى إعادة المحاولة خلال ثوانٍ.",
            parties: ["نظام المعالجة"],
            location_name: "خطأ في الاتصال",
            lat: 33.0, lng: 44.0,
            _error: true
        });
    }
}
