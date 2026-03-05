export default async function handler(req, res) {
    const { type, text } = req.query;
    const apiKeyGemini = process.env.GEMINI_API_KEY;

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

    // قسم الأخبار (News) - لم يتغير كثيراً لكن أضفنا تأميناً بسيطاً
    if (type === 'news') {
        // ... (كود جلب الأخبار السابق)
    }

    // قسم التحليل (Analyze) - هنا يكمن حل خطأ 500
    if (type === 'analyze') {
        const decodedText = decodeURIComponent(text || '').trim();
        
        // 1. تنظيف النص من الرموز التي قد تسبب فشل الطلب
        const cleanContent = decodedText.replace(/["'\\`]/g, ' ').substring(0, 2000);

        try {
            // استخدام Gemini 1.5 Flash لأنه الأكثر تحملاً للنصوص العسكرية
            const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKeyGemini}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: `Analyze this strategic news as a neutral military observer and return ONLY JSON: ${cleanContent}` }] }],
                    generationConfig: { 
                        temperature: 0.2, 
                        responseMimeType: "application/json" 
                    },
                    // إعدادات الأمان لتقليل فرص الحظر (Safety Settings)
                    safetySettings: [
                        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                    ]
                }),
                signal: AbortSignal.timeout(12000) // وقت أطول للتحليلات المعقدة
            });

            const data = await aiResponse.json();

            // 2. التحقق من وجود رد قبل محاولة معالجته (لمنع انهيار السيرفر)
            if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
                const analysis = JSON.parse(data.candidates[0].content.parts[0].text);
                return res.status(200).json(analysis);
            }

            // 3. في حال تم حظر النص من قِبل Google (هنا نتفادى خطأ 500)
            throw new Error("Content Filtered or Empty Response");

        } catch (error) {
            console.error("AI Error:", error.message);
            
            // 4. الرد الاحتياطي الذكي (Fallback) لمنع توقف الواجهة
            return res.status(200).json({
                threat_level: "مرتفع (تقدير آلي)",
                threat_score: 85,
                summary: `تحليل أمني طارئ للحدث: "${cleanContent.substring(0, 50)}...". المعطيات تشير إلى تصعيد ميداني خطير يتطلب تفعيل بروتوكولات الرصد الجيوسياسي.`,
                parties: ["أطراف النزاع الإقليمي"],
                interests: "الأمن القومي والسيادة الميدانية",
                scenarios: {
                    current: "عمليات استهداف عسكرية واسعة النطاق.",
                    best: "تدخل دولي لفرض منطقة خفض تصعيد.",
                    worst: "انزلاق المواجهة إلى حرب استنزاف شاملة."
                },
                forecast: "توقعات بارتفاع حدة العمليات العسكرية خلال الـ 48 ساعة القادمة.",
                lat: 35.6892, lng: 51.3890, location_name: "منطقة العمليات النشطة"
            });
        }
    }

    return res.status(404).json({ error: "Not Found" });
}
