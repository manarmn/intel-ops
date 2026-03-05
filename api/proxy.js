export default async function handler(req, res) {
    const { type, q = 'الشرق الأوسط', text } = req.query;
    const apiKeyGemini = process.env.GEMINI_API_KEY;
    const apiKeyGroq = process.env.GROQ_API_KEY;
    const apiKeyGNews = process.env.GNEWS_API_KEY;

    // إعدادات الذاكرة المؤقتة لمنع التكرار البطارئ
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

    // دالة جلب RSS احترافية مع معالجة الأخطاء
    async function fetchRSS(url, sourceName, sourceFlag) {
        try {
            const resp = await fetch(url, { 
                signal: AbortSignal.timeout(5000),
                headers: { 'User-Agent': 'Mozilla/5.0 (NewsBot/2.0)' }
            });
            if (!resp.ok) return [];
            const xml = await resp.text();
            const items = [];
            const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
            let match;
            while ((match = itemRegex.exec(xml)) !== null && items.length < 5) {
                const block = match[1];
                const title = (block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/) || [])[1]?.trim() || '';
                const link = (block.match(/<link[^>]*>([\s\S]*?)<\/link>/) || [])[1]?.trim() || '';
                const pubDate = (block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/) || [])[1]?.trim() || new Date().toISOString();
                if (title.length > 10) {
                    items.push({ title, publishedAt: pubDate, source: { name: sourceName, flag: sourceFlag }, url: link, lang: 'ar' });
                }
            }
            return items;
        } catch (e) { return []; }
    }

    try {
        if (type === 'news') {
            const feeds = [
                ['https://www.aljazeera.net/feed/topic-35', 'الجزيرة', '🇶🇦'],
                ['https://arabic.rt.com/rss/', 'RT عربي', '🇷🇺'],
                ['https://www.bbc.com/arabic/index.xml', 'BBC عربي', '🇬🇧'],
                ['https://alarabiya.net/ar/rss.xml', 'العربية', '🇸🇦'],
                ['https://www.skynewsarabia.com/rss.xml', 'سكاي نيوز', '🇦🇪'],
                ['https://www.aa.com.tr/ar/rss/default?cat=live', 'الأناضول', '🇹🇷'],
                ['https://www.tasnimnews.com/ar/rss', 'تسنيم', '🇮🇷']
            ];

            const results = await Promise.allSettled(feeds.map(f => fetchRSS(f[0], f[1], f[2])));
            const allArticles = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
            
            // ترتيب حسب الأحدث وإزالة التكرار
            const unique = Array.from(new Map(allArticles.map(a => [a.title.substring(0, 30), a])).values())
                                .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

            return res.status(200).json({ articles: unique });
        }

        if (type === 'analyze') {
            const decodedText = decodeURIComponent(text || '').trim();
            if (!decodedText) return res.status(400).json({ error: "النص مفقود" });

            // برومبت احترافي يضمن إجابة جيوسياسية دقيقة
            const prompt = `أنت محلل استخبارات جيوسياسي استراتيجي. قم بتحليل الخبر التالي بدقة متناهية.
يجب أن يكون الرد JSON نقي فقط، بدون مقدمات أو علامات متميزة:
{
  "threat_level": "حرج/مرتفع/متوسط/منخفض",
  "threat_score": 0-100,
  "summary": "تحليل استراتيجي من 3 جمل يوضح الأبعاد الخفية",
  "parties": ["الأطراف الفاعلة الرئيسية"],
  "interests": "المصالح الجيوسياسية المتضاربة باختصار",
  "scenarios": {
    "current": "توصيف دقيق للوضع الراهن",
    "best": "أفضل مسار دبلماسي ممكن",
    "worst": "احتمالات التصعيد العسكري أو الاقتصادي"
  },
  "forecast": "توقعاتك للـ 30 يوماً القادمة بناءً على المعطيات",
  "lat": 0.0,
  "lng": 0.0,
  "location_name": "الموقع الجغرافي الأدق للحدث"
}
الخبر: ${decodedText}`;

            // محاولة التحليل باستخدام Gemini 1.5 Flash (الأسرع والأدق في معالجة العربية)
            try {
                const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKeyGemini}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { temperature: 0.3, maxOutputTokens: 1000, responseMimeType: "application/json" }
                    }),
                    signal: AbortSignal.timeout(9000) // البقاء تحت حدود الـ 10 ثواني لـ Vercel
                });

                if (!aiResponse.ok) throw new Error("AI API Failed");

                const data = await aiResponse.json();
                let rawContent = data.candidates[0].content.parts[0].text;
                
                // تنظيف الـ JSON المستلم
                const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const finalAnalysis = JSON.parse(jsonMatch[0]);
                    return res.status(200).json(finalAnalysis);
                }
            } catch (aiErr) {
                // إذا فشل Gemini، ننتقل فوراً إلى Groq كخيار احترافي بديل
                if (apiKeyGroq) {
                    const groqResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKeyGroq}` },
                        body: JSON.stringify({
                            model: 'llama-3.3-70b-versatile',
                            messages: [{ role: 'user', content: prompt }],
                            response_format: { type: 'json_object' }
                        })
                    });
                    if (groqResp.ok) {
                        const groqData = await groqResp.json();
                        return res.status(200).json(JSON.parse(groqData.choices[0].message.content));
                    }
                }
                throw aiErr;
            }
        }
    } catch (error) {
        console.error("Critical Error:", error.message);
        return res.status(500).json({ 
            error: "فشل التحليل الاستراتيجي", 
            details: "تجاوز الخادم الوقت المسموح للتحليل المعمق. حاول مع نص أقصر أو أعد المحاولة." 
        });
    }
}
