export default async function handler(req, res) {
    const { type, q = 'الشرق الأوسط', text } = req.query;

    try {
        if (type === 'news') {
            const apiKey = process.env.GNEWS_API_KEY;
            const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(q)}&lang=ar&max=15&apikey=${apiKey}`;
            const response = await fetch(url);
            const data = await response.json();
            return res.status(200).json(data);
        }

        if (type === 'analyze') {
            const apiKey = process.env.GEMINI_API_KEY;
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
            
            const prompt = `أنت محلل استخبارات عسكرية. حلل هذا الخبر: "${text}". 
            يجب أن يكون ردك بصيغة JSON فقط كالتالي:
            {"threat_level": "عالي", "intel_summary": "تحليل موجز", "scenarios": ["سيناريو 1", "سيناريو 2"]}`;

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });

            const data = await response.json();
            let aiRaw = data.candidates[0].content.parts[0].text;
            
            // تحديث: نظام تنظيف البيانات لضمان عدم حدوث الخطأ الظاهر في صورك
            const jsonMatch = aiRaw.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return res.status(200).json(JSON.parse(jsonMatch[0]));
            }
            throw new Error("Invalid format");
        }
    } catch (error) {
        return res.status(500).json({ error: "API_ERROR", details: error.message });
    }
}
