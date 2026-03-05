export default async function handler(req, res) {
    const { type, q = 'الشرق الأوسط', text } = req.query;
    const apiKeyGNews = process.env.GNEWS_API_KEY;
    const apiKeyGemini = process.env.GEMINI_API_KEY;

    try {

        // ===== جلب الأخبار =====
        if (type === 'news') {
            const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(q)}&lang=ar&max=10&apikey=${apiKeyGNews}`;
            const response = await fetch(url);

            if (!response.ok) {
                return res.status(502).json({ error: "فشل GNews API", status: response.status });
            }

            const data = await response.json();
            return res.status(200).json(data);
        }

        // ===== تحليل الخبر =====
        if (type === 'analyze') {

            // ✅ إصلاح 1: فك تشفير النص القادم من الفرونت
            const decodedText = decodeURIComponent(text || '');

            if (!decodedText.trim()) {
                return res.status(400).json({ error: "النص فارغ" });
            }

            if (!apiKeyGemini) {
                return res.status(500).json({ error: "مفتاح Gemini غير موجود في البيئة" });
            }

            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-8b:generateContent?key=${apiKeyGemini}`;

            const prompt = `أنت محلل جيوسياسي محترف. حلل الخبر التالي: "${decodedText}".
يجب أن يكون ردك بصيغة JSON نقية فقط بدون أي نص إضافي أو Markdown أو backticks، يحتوي على هذه الحقول فقط:
{
  "threat_level": "حرج أو مرتفع أو متوسط أو منخفض",
  "summary": "تحليل استراتيجي مختصر بالعربية",
  "lat": 33.3,
  "lng": 44.4,
  "location_name": "اسم المدينة أو الدولة"
}
ملاحظة: lat و lng يجب أن تكون أرقاماً حقيقية وليس نصاً.`;

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.3,
                        maxOutputTokens: 512,
                    }
                })
            });

            if (!response.ok) {
                const errBody = await response.text();
                return res.status(502).json({ error: "فشل Gemini API", status: response.status, details: errBody });
            }

            const data = await response.json();

            // ✅ إصلاح 2: التحقق من وجود candidates قبل الوصول إليها
            if (!data.candidates || data.candidates.length === 0) {
                return res.status(502).json({ error: "Gemini لم يرجع نتائج", raw: data });
            }

            let aiRaw = data.candidates[0]?.content?.parts?.[0]?.text || '';

            // ✅ إصلاح 3: تنظيف شامل (يزيل ```json و ``` وأي نص قبل/بعد الـ JSON)
            aiRaw = aiRaw
                .replace(/```json/gi, '')
                .replace(/```/g, '')
                .trim();

            const jsonMatch = aiRaw.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                return res.status(502).json({ error: "لم يتم استخراج JSON", raw: aiRaw });
            }

            const parsed = JSON.parse(jsonMatch[0]);

            // ✅ إصلاح 4: ضمان أن lat/lng أرقام وليس نصوص
            parsed.lat = parseFloat(parsed.lat) || 30.0;
            parsed.lng = parseFloat(parsed.lng) || 45.0;

            return res.status(200).json(parsed);
        }

        return res.status(400).json({ error: "نوع الطلب غير معروف" });

    } catch (error) {
        console.error('[INTEL-OPS ERROR]', error);
        return res.status(500).json({
            error: "فشل النظام",
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}
