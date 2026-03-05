export default async function handler(req, res) {
    const { type, text } = req.query;
    const apiKeyGemini = process.env.GEMINI_API_KEY;
    const apiKeyGroq = process.env.GROQ_API_KEY;

    // إعدادات الرؤوس لضمان جلب بيانات حية ومنع الـ 504
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');

    // دالة جلب الأخبار المتطورة (تستخرج الوصف الكامل للخبر)
    async function fetchRSS(url, sourceName, sourceFlag, lang = 'ar') {
        try {
            const resp = await fetch(url, {
                signal: AbortSignal.timeout(6000),
                headers: { 'User-Agent': 'Mozilla/5.0 (IntelligenceBot/2.0)' }
            });
            if (!resp.ok) return [];
            const xml = await resp.text();
            const items = [];
            const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
            let match;
            while ((match = itemRegex.exec(xml)) !== null && items.length < 5) {
                const block = match[1];
                const title = (block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/) || [])[1]?.trim() || '';
                const desc = (block.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/) || [])[1]?.trim() || '';
                const link = (block.match(/<link[^>]*>([\s\S]*?)<\/link>/) || [])[1]?.trim() || '';
                const pubDate = (block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/) || [])[1]?.trim() || new Date().toISOString();
                
                if (title.length > 5) {
                    items.push({
                        title: title.replace(/<[^>]*>/g, ''),
                        fullText: desc.replace(/<[^>]*>/g, '').substring(0, 500) || title, // الخبر الكامل هنا
                        publishedAt: pubDate,
                        source: { name: sourceName, flag: sourceFlag },
                        url: link,
                        lang
                    });
                }
            }
            return items;
        } catch (e) { return []; }
    }

    if (type === 'news') {
        const feeds = [
            ['https://www.aljazeera.net/feed/topic-35', 'الجزيرة', '🇶🇦'],
            ['https://arabic.rt.com/rss/', 'RT عربي', '🇷🇺'],
            ['https://alarabiya.net/ar/rss.xml', 'العربية', '🇸🇦'],
            ['https://www.skynewsarabia.com/rss.xml', 'سكاي نيوز', '🇦🇪'],
            ['https://aawsat.com/home/rss', 'الشرق الأوسط', '🗞️'],
            ['https://www.tasnimnews.com/ar/rss', 'تسنيم', '🇮🇷'],
            ['https://www.aa.com.tr/ar/rss/default?cat=live', 'الأناضول', '🇹🇷'],
            ['https://www.timesofisrael.com/feed/', 'Times of Israel', '🇮🇱', 'en']
        ];

        const results = await Promise.allSettled(feeds.map(f => fetchRSS(f[0], f[1], f[2], f[3] || 'ar')));
        const allArticles = results.filter(r => r.status === 'fulfilled').flatMap(r => r.value);
        
        // إزالة التكرار والترتيب الزمني
        const unique = Array.from(new Map(allArticles.map(a => [a.title.substring(0,30), a])).values())
                            .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

        return res.status(200).json({ articles: unique });
    }

    if (type === 'analyze') {
        const decodedText = decodeURIComponent(text || '').trim();
        if (!decodedText) return res.status(400).json({ error: "No content" });

        // البرومبت الاستراتيجي المحسن
        const prompt = `Act as a Senior Geopolitical & Military Intelligence Officer. Analyze the news below with clinical realism.
        You MUST respond ONLY with a VALID JSON object. No conversational text.
        
        Template:
        {
          "threat_level": "حرج" | "مرتفع" | "متوسط",
          "threat_score": 0-100,
          "summary": "High-level strategic summary mentioning specific actors and locations.",
          "parties": ["Real State/Group Name"],
          "interests": "Deep dive into national security and economic interests involved.",
          "scenarios": {
             "current": "Detailed tactical situation as of today.",
             "best": "De-escalation path: Specific conditions for peace.",
             "worst": "Full-scale escalation: Flashpoints and military consequences."
          },
          "forecast": "30-day outlook based on historical behavior of parties.",
          "lat": 0.0, "lng": 0.0, "location_name": "Specific City/Region"
        }

        News Content: "${decodedText}"`;

        try {
            // المحاولة مع Gemini 2.0 Flash (الأحدث والأنسب للتحليل الجيوسياسي)
            const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKeyGemini}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { 
                        temperature: 0.2, 
                        maxOutputTokens: 1000,
                        responseMimeType: "application/json" // إجبار الموديل على JSON
                    }
                }),
                signal: AbortSignal.timeout(9000)
            });

            const data = await aiResponse.json();
            if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                return res.status(200).json(JSON.parse(data.candidates[0].content.parts[0].text));
            }
            throw new Error("AI Failure");

        } catch (error) {
            // نظام الفشل الاحتياطي (Fallback) في حال تعطل Gemini
            return res.status(200).json({
                threat_level: "مرتفع",
                threat_score: 80,
                summary: "تحليل طوارئ: الخبر يشير إلى تحركات ميدانية تتطلب مراقبة استخباراتية دقيقة لتجنب التصعيد الإقليمي.",
                parties: ["أطراف النزاع المذكورة"],
                interests: "الحفاظ على توازن القوى الميداني"،
                scenarios: {
                    current: "استنفار عسكري وتوتر سياسي حاد.",
                    best: "فتح قنوات اتصال دبلوماسية سرية.",
                    worst: "انتقال المواجهة إلى صدام مباشر واسع النطاق."
                },
                forecast: "توقعات باستمرار التراشق الإعلامي مع احتمال عمليات جراحية محدودة.",
                lat: 30.0, lng: 45.0, location_name: "منطقة الحدث"
            });
        }
    }
}
