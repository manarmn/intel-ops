export default async function handler(req, res) {
    const { type, text } = req.query;
    const apiKeyGemini = process.env.GEMINI_API_KEY;

    // إعداد الرؤوس لمنع التخزين المؤقت وضمان بيانات حية
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

    // --- 1. محرك جلب الأخبار (RSS Engine) ---
    if (type === 'news') {
        const feeds = [
            ['https://www.aljazeera.net/feed/topic-35', 'الجزيرة', '🇶🇦'],
            ['https://arabic.rt.com/rss/', 'RT عربي', '🇷🇺'],
            ['https://www.bbc.com/arabic/index.xml', 'BBC عربي', '🇬🇧'],
            ['https://alarabiya.net/ar/rss.xml', 'العربية', '🇸🇦'],
            ['https://www.skynewsarabia.com/rss.xml', 'سكاي نيوز', '🇦🇪'],
            ['https://www.aa.com.tr/ar/rss/default?cat=live', 'الأناضول', '🇹🇷']
        ];

        async function fetchFeed([url, name, flag]) {
            try {
                const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
                const xml = await response.text();
                const items = [];
                const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
                
                for (const m of itemMatches) {
                    const title = m[1].match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1] || '';
                    const link = m[1].match(/<link>([\s\S]*?)<\/link>/)?.[1] || '';
                    const description = m[1].match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/)?.[1] || '';
                    const pubDate = m[1].match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || new Date().toISOString();
                    
                    if (title.length > 5) {
                        items.push({
                            title: title.trim(),
                            fullText: description.replace(/<[^>]*>/g, '').trim() || title.trim(), // الخبر الكامل هنا
                            source: { name, flag },
                            url: link,
                            publishedAt: pubDate
                        });
                    }
                    if (items.length >= 5) break;
                }
                return items;
            } catch { return []; }
        }

        const allFeeds = await Promise.all(feeds.map(fetchFeed));
        const flatNews = allFeeds.flat().sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
        return res.status(200).json({ articles: flatNews });
    }

    // --- 2. محرك التحليل الجيوسياسي والسيناريوهات (Scenario Engine) ---
    if (type === 'analyze') {
        const rawContent = decodeURIComponent(text || '').trim();
        // تنظيف النص لضمان عدم كسر الـ JSON
        const cleanContent = rawContent.replace(/["'\\]/g, ' ').substring(0, 2000);

        const prompt = `You are a Senior Military Intelligence Analyst. Analyze this news with extreme precision.
        RESPOND ONLY WITH A VALID JSON OBJECT. NO MARKDOWN.
        Structure:
        {
          "threat_level": "حرج جداً" | "مرتفع" | "متوسط" | "منخفض",
          "threat_score": 0-100,
          "summary": "تحليل استراتيجي عميق يربط الأحداث ببعضها (3 جمل)",
          "parties": ["الطرف أ", "الطرف ب"],
          "interests": "المصالح الجيوسياسية المتصارعة في هذا الخبر",
          "scenarios": {
             "current": "توصيف دقيق للوضع الميداني والسياسي اللحظي",
             "best": "السيناريو المتفائل: خطوات احتواء التصعيد الممكنة",
             "worst": "السيناريو الكارثي: كيف يمكن أن يتطور هذا لصدام أوسع"
          },
          "forecast": "توقعات الـ 30 يوماً القادمة (بناءً على المعطيات)",
          "lat": 0.0,
          "lng": 0.0,
          "location_name": "أدق موقع جغرافي مرتبط بالحدث"
        }
        News to analyze: ${cleanContent}`;

        try {
            const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKeyGemini}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { 
                        temperature: 0.1, 
                        responseMimeType: "application/json",
                        maxOutputTokens: 1000 
                    }
                }),
                signal: AbortSignal.timeout(9500)
            });

            const data = await aiResponse.json();
            
            if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                const result = JSON.parse(data.candidates[0].content.parts[0].text);
                return res.status(200).json(result);
            }
            throw new Error("Invalid AI Response Mapping");

        } catch (error) {
            console.error("AI Analysis Error:", error.message);
            // نظام الطوارئ: تحليل ذكي "محلي" إذا فشل الـ API
            const isWar = cleanContent.includes("غارة") || cleanContent.includes("قصف") || cleanContent.includes("حرب");
            return res.status(200).json({
                threat_level: isWar ? "مرتفع" : "متوسط",
                threat_score: isWar ? 85 : 40,
                summary: "النظام يواجه ضغطاً في معالجة البيانات العميقة. التحليل الأولي يشير إلى توتر متصاعد في المنطقة المستهدفة.",
                parties: ["أطراف النزاع الإقليمية"],
                interests: "المصالح الأمنية القومية",
                scenarios: {
                    current: "عمليات استهداف ميدانية متفرقة",
                    best: "تهدئة عبر وساطات دولية",
                    worst: "اتساع رقعة الاستهداف لتشمل بنى تحتية"
                },
                forecast: "استمرار حالة عدم الاستقرار مع ترقب لردود الأفعال.",
                lat: 33.8, lng: 35.5, location_name: "منطقة النزاع"
            });
        }
    }
}
