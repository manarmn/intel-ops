export default async function handler(req, res) {
    const { type, q = 'الشرق الأوسط', text } = req.query;
    const apiKeyGNews = process.env.GNEWS_API_KEY;
    const apiKeyGemini = process.env.GEMINI_API_KEY;

    try {

        // ===== جلب الأخبار =====
        if (type === 'news') {
            // إضافة sortby + timestamp لكسر الـ cache وضمان أحدث الأخبار
            const ts = Date.now();
            const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(q)}&lang=ar&max=10&sortby=publishedAt&apikey=${apiKeyGNews}&_=${ts}`;
            
            const response = await fetch(url, {
                headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
            });

            if (!response.ok) {
                return res.status(502).json({ error: "فشل GNews API", status: response.status });
            }

            const data = await response.json();

            // منع Vercel من تخزين الأخبار
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
            res.setHeader('Pragma', 'no-cache');

            return res.status(200).json(data);
        }

        // ===== تحليل الخبر =====
        if (type === 'analyze') {

            const decodedText = decodeURIComponent(text || '');

            if (!decodedText.trim()) {
                return res.status(400).json({ error: "النص فارغ" });
            }

            if (!apiKeyGemini) {
                return res.status(500).json({ error: "مفتاح Gemini غير موجود في البيئة" });
            }

            const prompt = `أنت محلل جيوسياسي محترف. حلل الخبر التالي: "${decodedText}".
يجب أن يكون ردك بصيغة JSON نقية فقط بدون أي نص إضافي أو Markdown أو backticks، يحتوي على هذه الحقول فقط:
{
  "threat_level": "حرج أو مرتفع أو متوسط أو منخفض",
  "summary": "تحليل استراتيجي مختصر بالعربية لا يتجاوز 100 كلمة",
  "lat": 33.3,
  "lng": 44.4,
  "location_name": "اسم المدينة أو الدولة"
}
ملاحظة: lat و lng يجب أن تكون أرقاماً حقيقية وليس نصاً.`;

            const models = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash-lite'];
            let response = null;
            let data = null;
            let lastError = null;

            for (const model of models) {
                try {
                    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKeyGemini}`;
                    response = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: prompt }] }],
                            generationConfig: { temperature: 0.3, maxOutputTokens: 1024 }
                        })
                    });
                    data = await response.json();
                    // نجح النموذج وأرجع نتائج
                    if (response.ok && data.candidates && data.candidates.length > 0) break;
                    lastError = data;
                } catch (e) {
                    lastError = e.message;
                    continue;
                }
            }

            if (!response || !response.ok || !data?.candidates?.length) {
                return res.status(502).json({ 
                    error: "فشل Gemini API - جميع النماذج استنفدت حصتها",
                    details: JSON.stringify(lastError)
                });
            }

            let aiRaw = data.candidates[0]?.content?.parts?.[0]?.text || '';

            // تنظيف شامل
            aiRaw = aiRaw
                .replace(/```json/gi, '')
                .replace(/```/g, '')
                .trim();

            const jsonMatch = aiRaw.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                return res.status(502).json({ error: "لم يتم استخراج JSON", raw: aiRaw });
            }

            const parsed = JSON.parse(jsonMatch[0]);
            parsed.lat = parseFloat(parsed.lat) || 30.0;
            parsed.lng = parseFloat(parsed.lng) || 45.0;

            return res.status(200).json(parsed);
        }

        return res.status(400).json({ error: "نوع الطلب غير معروف" });

    } catch (error) {
        console.error('[INTEL-OPS ERROR]', error);
        return res.status(500).json({
            error: "فشل النظام",
            details: error.message
        });
    }
}
