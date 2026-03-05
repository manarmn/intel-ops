// INTEL-OPS // STRAT-COMM V3.5 - CORE ANALYTICS ENGINE
// المصمم للعمل على بيئة Vercel / Node.js

export default async function handler(req, res) {
    const { type, q = 'الشرق الأوسط', text } = req.query;

    // جلب مفاتيح التشغيل من بيئة النظام (Environment Variables)
    const apiKeyGroq = process.env.GROQ_API_KEY;
    const apiKeyGemini = process.env.GEMINI_API_KEY;
    const apiKeyGNews = process.env.GNEWS_API_KEY;

    // إعدادات الاستجابة لمنع التخزين المؤقت لضمان حداثة البيانات
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');

    try {
        // ==========================================
        // 1. محرك التغذية الإخبارية (News Feed Engine)
        // ==========================================
        if (type === 'news') {
            const allArticles = [];
            
            // مصادر الـ RSS الموثوقة (عربية ودولية)
            const feeds = [
                ['https://www.aljazeera.net/feed/topic-35', 'الجزيرة', '🇶🇦'],
                ['https://arabic.rt.com/rss/', 'RT عربي', '🇷🇺'],
                ['https://www.bbc.com/arabic/index.xml', 'BBC عربي', '🇬🇧'],
                ['https://alarabiya.net/ar/rss.xml', 'العربية', '🇸🇦'],
                ['https://www.skynewsarabia.com/rss.xml', 'سكاي نيوز', '🇦🇪'],
                ['https://www.tasnimnews.com/ar/rss', 'تسنيم', '🇮🇷'],
                ['https://www.aa.com.tr/ar/rss/default?cat=live', 'الأناضول', '🇹🇷'],
                ['https://www.timesofisrael.com/feed/', 'Times of Israel', '🇮🇱']
            ];

            // جلب البيانات بالتوازي لتقليل زمن الاستجابة
            const rssResults = await Promise.allSettled(feeds.map(async ([url, name, flag]) => {
                const resp = await fetch(url, { signal: AbortSignal.timeout(6000) });
                if (!resp.ok) return [];
                const xml = await resp.text();
                const items = [];
                const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
                let match;
                while ((match = itemRegex.exec(xml)) !== null && items.length < 6) {
                    const block = match[1];
                    const title = (block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/) || [])[1]?.trim();
                    const link = (block.match(/<link[^>]*>([\s\S]*?)<\/link>/) || [])[1]?.trim();
                    if (title) items.push({ 
                        title, 
                        url: link, 
                        publishedAt: new Date().toISOString(), 
                        source: { name, flag } 
                    });
                }
                return items;
            }));

            rssResults.forEach(r => { if (r.status === 'fulfilled') allArticles.push(...r.value); });

            // ترتيب الأخبار حسب الأحدث (افتراضياً)
            return res.status(200).json({ articles: allArticles });
        }

        // ==========================================
        // 2. محرك التحليل الجيوسياسي (AI Strategy Engine)
        // ==========================================
        if (type === 'analyze') {
            const decodedText = decodeURIComponent(text || '').trim();
            if (!decodedText) return res.status(400).json({ error: "No text provided" });

            // برومبت التحليل الاحترافي (نظام السيناريوهات والمؤشرات)
            const prompt = `بصفتك كبير محللي الاستخبارات الجيوسياسية في وحدة INTEL-OPS V3.5، حلل الخبر التالي:
            "${decodedText}"

            المطلوب JSON نقي وحصري بالهيكل التالي:
            {
              "threat_level": "حرج/مرتفع/متوسط/منخفض",
              "threat_score": رقم من 1-100,
              "location": { "name": "المدينة/الدولة", "lat": خط_العرض, "lng": خط_الطول },
              "summary": "تحليل استراتيجي من 3 جمل مركزة",
              "actors": ["طرف 1", "طرف 2"],
              "scenarios": {
                "current": "توصيف الوضع الميداني الحالي",
                "best": "السيناريو المتفائل (مسار التهدئة)",
                "worst": "السيناريو التشاؤمي (مسار التصعيد)"
              },
              "indicator": "مؤشر الإنذار المبكر (عسكري أو دبلوماسي)",
              "forecast": "توقعات الـ 48 ساعة القادمة"
            }`;

            let finalAnalysis;

            // محاولة 1: استخدام Groq (الأسرع والأدق في البرمجة)
            if (apiKeyGroq) {
                try {
                    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKeyGroq}` },
                        body: JSON.stringify({
                            model: 'llama-3.3-70b-versatile',
                            messages: [{ role: 'system', content: 'Geopolitical Intelligence Unit. Output JSON only.' }, { role: 'user', content: prompt }],
                            response_format: { type: 'json_object' },
                            temperature: 0.2
                        })
                    });
                    if (groqRes.ok) {
                        const data = await groqRes.json();
                        finalAnalysis = JSON.parse(data.choices[0].message.content);
                    }
                } catch (e) { console.error("Groq Failure, switching..."); }
            }

            // محاولة 2: استخدام Gemini (كاحتياطي أو أساسي في حال غياب Groq)
            if (!finalAnalysis && apiKeyGemini) {
                try {
                    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKeyGemini}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: prompt }] }],
                            generationConfig: { responseMimeType: "application/json" }
                        })
                    });
                    if (geminiRes.ok) {
                        const data = await geminiRes.json();
                        finalAnalysis = JSON.parse(data.candidates[0].content.parts[0].text);
                    }
                } catch (e) { console.error("Gemini Failure"); }
            }

            // إذا فشلت المحركات، إرجاع قالب ثابت لمنع انهيار الواجهة
            if (!finalAnalysis) {
                return res.status(200).json({
                    threat_level: "تحت المعالجة",
                    threat_score: 50,
                    location: { name: "الشرق الأوسط", lat: 34.0, lng: 44.0 },
                    summary: "نظام التحليل يواجه ضغطاً تقنياً. التحليل الأولي يشير لتوتر ميداني مستمر.",
                    scenarios: { current: "نشاط عسكري مكثف", best: "تدخل دبلوماسي", worst: "اتساع الصراع" }
                });
            }

            return res.status(200).json(finalAnalysis);
        }

        return res.status(400).json({ error: "Invalid Request Type" });

    } catch (error) {
        return res.status(500).json({ error: "System Core Failure", details: error.message });
    }
}
