export default async function handler(req, res) {
    const { type, q = 'الشرق الأوسط', text } = req.query;

    try {
        // جزء جلب الأخبار
        if (type === 'news') {
            const apiKey = process.env.GNEWS_API_KEY;
            const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(q)}&lang=ar&max=10&apikey=${apiKey}`;
            const response = await fetch(url);
            const data = await response.json();
            return res.status(200).json(data);
        }

        // جزء تحليل الذكاء الاصطناعي (Gemini)
        if (type === 'analyze') {
            const apiKey = process.env.GEMINI_API_KEY;
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
            
            const prompt = `بصفتك محلل استخبارات عسكرية، حلل الخبر التالي: "${text}". 
            يجب أن يكون الرد كود JSON فقط بدون أي نصوص إضافية، بالتنسيق التالي:
            {"threat_level": "عالي/متوسط/منخفض", "intel_summary": "تحليل موجز", "scenarios": ["سيناريو 1", "سيناريو 2"]}`;

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });

            const data = await response.json();
            let aiRaw = data.candidates[0].content.parts[0].text;
            
            // تنظيف النص لضمان أنه JSON صحيح
            const cleanJson = aiRaw.replace(/```json|```/g, '').trim();
            return res.status(200).json(JSON.parse(cleanJson));
        }
    } catch (error) {
        return res.status(500).json({ error: "خطأ في النظام", details: error.message });
    }
}
