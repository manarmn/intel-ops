export default async function handler(req, res) {
    const { type, q = 'الشرق الأوسط', text } = req.query;
    const apiKeyGNews = process.env.GNEWS_API_KEY;
    const apiKeyGemini = process.env.GEMINI_API_KEY;

    try {
        if (type === 'news') {
            const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(q)}&lang=ar&max=10&apikey=${apiKeyGNews}`;
            const response = await fetch(url);
            const data = await response.json();
            return res.status(200).json(data);
        }

        if (type === 'analyze') {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKeyGemini}`;
            
            const prompt = `أنت محلل جيوسياسي محترف. حلل الخبر التالي: "${text}". 
            يجب أن يكون ردك بصيغة JSON "نقية" فقط (بدون Markdown) تحتوي على:
            {
              "threat_level": "حرج/مرتفع/متوسط",
              "summary": "تحليل استراتيجي عميق",
              "lat": "إحداثيات العرض للموقع المرتبط بالخبر (رقم فقط)",
              "lng": "إحداثيات الطول للموقع المرتبط بالخبر (رقم فقط)",
              "location_name": "اسم الدولة أو المدينة"
            }`;

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });

            const data = await response.json();
            let aiRaw = data.candidates[0].content.parts[0].text;
            // تنظيف صارم لأي زوائد نصية
            const jsonClean = aiRaw.match(/\{[\s\S]*\}/)[0];
            return res.status(200).json(JSON.parse(jsonClean));
        }
    } catch (error) {
        return res.status(500).json({ error: "فشل النظام", details: error.message });
    }
}
