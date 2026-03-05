export default async function handler(req, res) {
    const { type, q = 'الشرق الأوسط', text } = req.query;

    try {
        // 1. جلب الأخبار من GNews
        if (type === 'news') {
            const apiKey = process.env.GNEWS_API_KEY;
            const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(q)}&lang=ar&max=15&apikey=${apiKey}`;
            const response = await fetch(url);
            const data = await response.json();
            return res.status(200).json(data);
        }

        // 2. تحليل الاستخبارات عبر Gemini 1.5 Flash
        if (type === 'analyze') {
            const apiKey = process.env.GEMINI_API_KEY;
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
            
            const prompt = `حلل هذا الخبر استخباراتياً: "${text}". 
            يجب أن يكون الرد كود JSON فقط بدون أي علامات Markdown أو نصوص خارج الأقواس. 
            البنية: {"threat_level": "حرج/عالي/متوسط", "intel_summary": "تحليل عميق", "scenarios": ["سيناريو 1", "سيناريو 2"]}`;

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });

            const data = await response.json();
            let aiRaw = data.candidates[0].content.parts[0].text;
            
            // استخراج كود JSON فقط وتجاهل أي نص زائد
            const jsonMatch = aiRaw.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return res.status(200).json(JSON.parse(jsonMatch[0]));
            }
            throw new Error("تنسيق غير صالح");
        }
    } catch (error) {
        return res.status(500).json({ error: "خطأ في المعالجة", details: error.message });
    }
}
