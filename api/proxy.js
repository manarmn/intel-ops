export default async function handler(req, res) {
    const { type, q = 'الشرق الأوسط', text } = req.query;

    try {
        // الجزء الأول: جلب الأخبار من GNews
        if (type === 'news') {
            const apiKey = process.env.GNEWS_API_KEY;
            const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(q)}&lang=ar&max=15&apikey=${apiKey}`;
            const response = await fetch(url);
            const data = await response.json();
            return res.status(200).json(data);
        }

        // الجزء الثاني: تحليل الذكاء الاصطناعي عبر Gemini 1.5 Flash
        if (type === 'analyze') {
            const apiKey = process.env.GEMINI_API_KEY;
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
            
            const prompt = `بصفتك محلل OSINT محترف، حلل الخبر التالي: "${text}". 
            يجب أن يكون الرد بصيغة JSON حصراً وباللغة العربية، يحتوي على العناوين التالية:
            {
              "threat_level": "منخفض/متوسط/عالي/حرج",
              "credibility": "نسبة مئوية",
              "intel_summary": "تحليل موجز وعميق للابعاد الاستراتيجية",
              "scenarios": ["سيناريو 1 (قريب)", "سيناريو 2 (متوسط)", "سيناريو 3 (بعيد)"],
              "osint_check": "ما هي المصادر الميدانية التي يجب مراقبتها للتأكد؟"
            }
            ملاحظة: اكتب بجرأة استخباراتية وتجنب العبارات الدبلوماسية.`;

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });

            const data = await response.json();
            const aiRaw = data.candidates[0].content.parts[0].text;
            // تنظيف النص من أي علامات Markdown قد يضيفها Gemini
            const cleanJson = aiRaw.replace(/```json|```/g, '').trim();
            return res.status(200).json(JSON.parse(cleanJson));
        }
    } catch (error) {
        return res.status(500).json({ error: "فشل النظام في معالجة الطلب", details: error.message });
    }
}
