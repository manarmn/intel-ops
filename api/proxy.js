// config for Vercel serverless function - معدل للخطة المجانية
export const config = {
  runtime: 'nodejs',
  maxDuration: 30, // نحتاج 30 ثانية للتحليل
};

export default async function handler(req, res) {
  // إعدادات CORS والأمان
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { type, q = 'الشرق الأوسط', text } = req.query;
  
  // مفاتيح API
  const apiKeyGNews = process.env.GNEWS_API_KEY;
  const apiKeyGroq = process.env.GROQ_API_KEY;
  const apiKeyGemini = process.env.GEMINI_API_KEY;
  const apiKeyGuardian = process.env.GUARDIAN_API_KEY;
  const apiKeyNews = process.env.NEWS_API_KEY;

  // دالة مبسطة لقراءة RSS
  async function fetchRSS(url, sourceName, sourceFlag, lang = 'ar') {
    try {
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 5000
      });
      if (!resp.ok) return [];
      
      const xml = await resp.text();
      const items = [];
      const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
      let match;
      
      while ((match = itemRegex.exec(xml)) !== null && items.length < 5) {
        const block = match[1];
        const titleMatch = block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
        if (!titleMatch) continue;
        
        const title = titleMatch[1].trim().replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        if (title.length < 5) continue;
        
        items.push({
          title,
          publishedAt: new Date().toISOString(),
          source: { name: sourceName, flag: sourceFlag },
          lang
        });
      }
      return items;
    } catch(e) {
      return [];
    }
  }

  try {
    // ==================== NEWS ====================
    if (type === 'news') {
      const allArticles = [];

      // أهم المصادر فقط (لتوفير الوقت)
      const feeds = [
        ['https://arabic.rt.com/rss/', 'RT عربي', '🇷🇺', 'ar'],
        ['https://www.aljazeera.net/feed/topic-35', 'الجزيرة', '🇶🇦', 'ar'],
        ['https://www.bbc.com/arabic/index.xml', 'BBC عربي', '🇬🇧', 'ar'],
        ['https://alarabiya.net/ar/rss.xml', 'العربية', '🇸🇦', 'ar'],
        ['https://www.skynewsarabia.com/rss.xml', 'سكاي نيوز', '🇦🇪', 'ar'],
        ['https://www.aa.com.tr/ar/rss/default?cat=live', 'الأناضول', '🇹🇷', 'ar'],
        ['https://www.rudaw.net/arabic/rss', 'روداو', '🇮🇶', 'ar'],
        ['https://www.timesofisrael.com/feed/', 'Times of Israel', '🇮🇱', 'en'],
        ['https://feeds.reuters.com/reuters/worldNews', 'Reuters', '🌐', 'en']
      ];

      const results = await Promise.allSettled(
        feeds.map(([url, name, flag, lang]) => fetchRSS(url, name, flag, lang))
      );
      
      results.forEach(r => {
        if (r.status === 'fulfilled') allArticles.push(...r.value);
      });

      // ترجمة العناوين الإنجليزية
      const toTranslate = allArticles.filter(a => a.lang === 'en').slice(0, 5);
      if (toTranslate.length > 0 && apiKeyGroq) {
        try {
          const titlesList = toTranslate.map(a => a.title).join('\n');
          const tResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json', 
              'Authorization': `Bearer ${apiKeyGroq}` 
            },
            body: JSON.stringify({
              model: 'llama-3.3-70b-versatile',
              messages: [{ 
                role: 'user', 
                content: `ترجم هذه العناوين للعربية. رد بـ JSON فقط: {"t":["ترجمة1","ترجمة2"]}\n${titlesList}`
              }],
              temperature: 0.1,
              max_tokens: 500,
              response_format: { type: 'json_object' }
            })
          });
          
          if (tResp.ok) {
            const tData = await tResp.json();
            const translations = JSON.parse(tData.choices?.[0]?.message?.content || '{}').t || [];
            toTranslate.forEach((item, i) => {
              if (translations[i]) item.title = translations[i];
            });
          }
        } catch(e) {}
      }

      // ترتيب وإزالة التكرار
      allArticles.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
      const seen = new Set();
      const unique = allArticles.filter(a => {
        const key = a.title.substring(0, 30);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      return res.status(200).json({ articles: unique.slice(0, 20) });
    }

    // ==================== ANALYZE ====================
    if (type === 'analyze') {
      const decodedText = decodeURIComponent(text || '').trim();
      if (!decodedText) {
        return res.status(400).json({ error: "النص فارغ" });
      }

      // تبسيط prompt لتسريع الاستجابة
      const prompt = `حلل هذا الخبر بدقة:
"${decodedText}"

أعطني JSON:
{
  "threat_level": "حرج/مرتفع/متوسط/منخفض",
  "threat_score": رقم,
  "summary": "تحليل في جملتين",
  "parties": ["طرف1", "طرف2"],
  "location_name": "المكان",
  "lat": 30.0,
  "lng": 45.0
}`;

      // استخدام Groq فقط (الأسرع)
      if (apiKeyGroq) {
        try {
          const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json', 
              'Authorization': `Bearer ${apiKeyGroq}` 
            },
            body: JSON.stringify({
              model: 'llama-3.3-70b-versatile',
              messages: [
                { role: 'system', content: 'محلل. JSON فقط.' },
                { role: 'user', content: prompt }
              ],
              temperature: 0.2,
              max_tokens: 600, // تقليل tokens للسرعة
              response_format: { type: 'json_object' }
            })
          });

          if (r.ok) {
            const d = await r.json();
            const content = d.choices?.[0]?.message?.content || '{}';
            const p = JSON.parse(content);
            
            p.lat = parseFloat(p.lat) || 30.0;
            p.lng = parseFloat(p.lng) || 45.0;
            p.threat_score = parseInt(p.threat_score) || 50;
            p._source = 'groq';
            
            return res.status(200).json(p);
          }
        } catch (e) {
          console.error('Groq error:', e.message);
        }
      }

      // إذا فشل Groq، جرب Gemini سريعاً
      if (apiKeyGemini) {
        try {
          const r = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKeyGemini}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.2, maxOutputTokens: 500 }
              })
            }
          );

          if (r.ok) {
            const d = await r.json();
            const raw = d.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const jsonMatch = raw.match(/\{[\s\S]*\}/);
            
            if (jsonMatch) {
              const p = JSON.parse(jsonMatch[0]);
              p.lat = parseFloat(p.lat) || 30.0;
              p.lng = parseFloat(p.lng) || 45.0;
              p.threat_score = parseInt(p.threat_score) || 50;
              p._source = 'gemini';
              
              return res.status(200).json(p);
            }
          }
        } catch (e) {}
      }

      return res.status(502).json({ error: "فشل التحليل" });
    }

    return res.status(400).json({ error: "نوع غير معروف" });
    
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: "خطأ في النظام" });
  }
}
