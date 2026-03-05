// config for Vercel serverless function
export const config = {
  runtime: 'nodejs', // استخدام Node.js runtime للأفضلية مع الـ RSS
  maxDuration: 30, // الحد الأقصى 30 ثانية (مناسب لـ Hobby plan)
};

export default async function handler(req, res) {
  // إعدادات CORS والأمان
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  
  // معالجة طلب OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { type, q = 'الشرق الأوسط', text } = req.query;
  const apiKeyGNews = process.env.GNEWS_API_KEY;
  const apiKeyGroq = process.env.GROQ_API_KEY;
  const apiKeyGemini = process.env.GEMINI_API_KEY;
  const apiKeyGuardian = process.env.GUARDIAN_API_KEY || 'test';
  const apiKeyNews = process.env.NEWS_API_KEY;

  // دالة مساعدة للتأخير (للـ retry)
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

  // دالة لقراءة RSS مع تحسينات وإعادة محاولة
  async function fetchRSS(url, sourceName, sourceFlag, lang = 'ar', retries = 2) {
    for (let i = 0; i <= retries; i++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        
        const resp = await fetch(url, {
          signal: controller.signal,
          headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/rss+xml, application/xml, text/xml, */*'
          }
        });
        
        clearTimeout(timeoutId);
        
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        
        const xml = await resp.text();
        if (!xml || xml.length < 50) throw new Error('استجابة فارغة');
        
        const items = [];
        const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
        let match;
        
        while ((match = itemRegex.exec(xml)) !== null && items.length < 8) {
          const block = match[1];
          
          // استخراج العنوان (معالجة CDATA)
          let title = '';
          const titleMatch = block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
          if (titleMatch) {
            title = titleMatch[1]
              .trim()
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'")
              .replace(/\s+/g, ' ');
          }
          
          if (!title || title.length < 8 || title.includes('بحث') || title.includes('بحث')) continue;
          
          // استخراج الرابط
          let link = '';
          const linkMatch = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || 
                           block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i);
          if (linkMatch) link = linkMatch[1].trim();
          
          // استخراج التاريخ
          let pubDate = new Date().toISOString();
          const dateMatch = block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) ||
                           block.match(/<dc:date[^>]*>([\s\S]*?)<\/dc:date>/i);
          if (dateMatch) {
            try {
              pubDate = new Date(dateMatch[1]).toISOString();
            } catch (e) {
              // تجاهل خطأ التاريخ
            }
          }
          
          items.push({
            title,
            publishedAt: pubDate,
            source: { name: sourceName, flag: sourceFlag },
            url: link,
            lang
          });
        }
        
        if (items.length > 0) return items;
        
      } catch (e) {
        console.error(`RSS fetch error (${url}):`, e.message);
        if (i < retries) await delay(1000 * (i + 1));
      }
    }
    return [];
  }

  try {
    if (type === 'news') {
      const startTime = Date.now();
      const allArticles = [];

      // قائمة المصادر RSS مع أولوية للمصادر السريعة
      const feeds = [
        // مصادر عربية سريعة (موثوقة)
        ['https://arabic.rt.com/rss/', 'RT عربي', '🇷🇺', 'ar'],
        ['https://www.aljazeera.net/feed/topic-35', 'الجزيرة', '🇶🇦', 'ar'],
        ['https://www.bbc.com/arabic/index.xml', 'BBC عربي', '🇬🇧', 'ar'],
        ['https://alarabiya.net/ar/rss.xml', 'العربية', '🇸🇦', 'ar'],
        ['https://www.france24.com/ar/rss', 'فرانس 24', '🇫🇷', 'ar'],
        ['https://www.skynewsarabia.com/rss.xml', 'سكاي نيوز', '🇦🇪', 'ar'],
        ['https://www.almayadeen.net/rss', 'الميادين', '🇱🇧', 'ar'],
        ['https://www.aa.com.tr/ar/rss/default?cat=live', 'الأناضول', '🇹🇷', 'ar'],
        ['https://www.trtarabi.com/rss', 'TRT عربي', '🇹🇷', 'ar'],
        ['https://www.rudaw.net/arabic/rss', 'روداو', '🇮🇶', 'ar'],
        ['https://www.alsumaria.tv/rss', 'السومرية', '🇮🇶', 'ar'],
        ['https://shafaq.com/ar/rss.xml', 'شفق نيوز', '🇮🇶', 'ar'],
        ['https://www.irna.ir/rss.xml', 'IRNA', '🇮🇷', 'ar'],
        ['https://www.tasnimnews.com/ar/rss', 'تسنيم', '🇮🇷', 'ar'],
        ['https://sana.sy/feed/', 'سانا', '🇸🇾', 'ar'],
        ['https://www.sabanews.net/rss.xml', 'سبأ', '🇾🇪', 'ar'],
        ['https://almasirah.net/rss.xml', 'المسيرة', '🇾🇪', 'ar'],
        ['https://www.independentarabia.com/rss.xml', 'إندبندنت', '🌍', 'ar'],
        ['https://aawsat.com/home/rss', 'الشرق الأوسط', '🗞️', 'ar'],
        ['https://orient-news.net/feed/', 'أورينت', '🇸🇾', 'ar'],
        // مصادر إنجليزية للترجمة
        ['https://www.timesofisrael.com/feed/', 'Times of Israel', '🇮🇱', 'en'],
        ['https://www.jpost.com/Rss/RssFeedsHeadlines.aspx', 'Jerusalem Post', '🇮🇱', 'en'],
        ['https://feeds.reuters.com/reuters/worldNews', 'Reuters', '🌐', 'en'],
        ['https://rss.nytimes.com/services/xml/rss/nyt/MiddleEast.xml', 'NY Times', '🌐', 'en'],
        ['https://www.economist.com/middle-east-and-africa/rss.xml', 'The Economist', '🌐', 'en'],
        ['https://foreignpolicy.com/feed/', 'Foreign Policy', '🌐', 'en']
      ];

      // جلب المصادر بشكل متوازي مع تحديد المهلة
      const fetchPromises = feeds.map(([url, name, flag, lang]) => 
        fetchRSS(url, name, flag, lang)
          .catch(() => []) // منع فشل مصدر من إيقاف الكل
      );

      const results = await Promise.allSettled(fetchPromises);
      
      results.forEach(result => {
        if (result.status === 'fulfilled' && Array.isArray(result.value)) {
          allArticles.push(...result.value);
        }
      });

      // The Guardian API
      if (apiKeyGuardian && apiKeyGuardian !== 'test') {
        try {
          const gResp = await fetch(
            `https://content.guardianapis.com/search?q=middle%20east%20OR%20iran%20OR%20israel%20OR%20iraq&section=world&page-size=8&order-by=newest&api-key=${apiKeyGuardian}`,
            { signal: AbortSignal.timeout(5000) }
          );
          if (gResp.ok) {
            const gData = await gResp.json();
            gData.response?.results?.forEach(item => {
              if (item.webTitle && item.webTitle.length > 10) {
                allArticles.push({
                  title: item.webTitle,
                  publishedAt: item.webPublicationDate,
                  source: { name: 'The Guardian', flag: '🇬🇧' },
                  url: item.webUrl,
                  lang: 'en'
                });
              }
            });
          }
        } catch (e) {
          console.error('Guardian API error:', e.message);
        }
      }

      // GNews API
      if (apiKeyGNews) {
        try {
          const gnResp = await fetch(
            `https://gnews.io/api/v4/search?q=${encodeURIComponent(q)}&lang=ar&max=6&sortby=publishedAt&apikey=${apiKeyGNews}&_=${Date.now()}`,
            { signal: AbortSignal.timeout(5000) }
          );
          if (gnResp.ok) {
            const gnData = await gnResp.json();
            gnData.articles?.forEach(a => {
              if (a.title && a.title.length > 8) {
                allArticles.push({
                  title: a.title,
                  publishedAt: a.publishedAt,
                  source: { name: a.source?.name || 'GNews', flag: '📰' },
                  url: a.url,
                  lang: 'ar'
                });
              }
            });
          }
        } catch (e) {
          console.error('GNews API error:', e.message);
        }
      }

      // NewsAPI كبديل
      if (apiKeyNews && allArticles.length < 15) {
        try {
          const newsResp = await fetch(
            `https://newsapi.org/v2/everything?q=${encodeURIComponent('middle east OR iran OR israel')}&language=ar&pageSize=8&sortBy=publishedAt&apiKey=${apiKeyNews}`,
            { signal: AbortSignal.timeout(5000) }
          );
          if (newsResp.ok) {
            const newsData = await newsResp.json();
            newsData.articles?.forEach(a => {
              if (a.title && a.title.length > 8) {
                allArticles.push({
                  title: a.title,
                  publishedAt: a.publishedAt,
                  source: { name: a.source?.name || 'NewsAPI', flag: '📰' },
                  url: a.url,
                  lang: 'ar'
                });
              }
            });
          }
        } catch (e) {
          console.error('NewsAPI error:', e.message);
        }
      }

      // GDELT Project للمزيد من المصادر
      if (allArticles.length < 20) {
        try {
          const gdeltUrl = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent('middle east OR iran OR israel OR iraq OR syria OR lebanon')}&mode=artlist&maxrecords=12&format=json&sort=datedesc&sourcelang=arabic&timespan=1d`;
          const gdResp = await fetch(gdeltUrl, { signal: AbortSignal.timeout(6000) });
          if (gdResp.ok) {
            const gdData = await gdResp.json();
            gdData.articles?.forEach(a => {
              if (a.title && a.title.length > 8) {
                let pubDate = new Date().toISOString();
                if (a.seendate) {
                  try {
                    pubDate = new Date(
                      a.seendate.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6Z')
                    ).toISOString();
                  } catch (e) {}
                }
                allArticles.push({
                  title: a.title,
                  publishedAt: pubDate,
                  source: { name: a.domain || 'GDELT', flag: '🌍' },
                  url: a.url || '',
                  lang: 'ar'
                });
              }
            });
          }
        } catch (e) {
          console.error('GDELT error:', e.message);
        }
      }

      if (allArticles.length === 0) {
        return res.status(502).json({ 
          error: "فشل جميع مصادر الأخبار",
          message: "حاول مرة أخرى بعد قليل"
        });
      }

      // ترتيب حسب التاريخ (الأحدث أولاً)
      allArticles.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

      // إزالة التكرارات بذكاء
      const seen = new Map();
      const unique = allArticles.filter(a => {
        if (!a.title || a.title.length < 6) return false;
        
        // تنظيف العنوان للمقارنة
        const cleanTitle = a.title
          .substring(0, 40)
          .toLowerCase()
          .replace(/[^\w\s]/g, '')
          .trim();
        
        if (!cleanTitle || seen.has(cleanTitle)) return false;
        
        // تجنب العناوين المتكررة من نفس المصدر
        const key = cleanTitle + '_' + (a.source?.name || '');
        if (seen.has(key)) return false;
        
        seen.set(cleanTitle, true);
        seen.set(key, true);
        return true;
      });

      // تحديد الأخبار التي تحتاج ترجمة (الإنجليزية فقط)
      const toTranslate = unique
        .filter(a => a.lang === 'en' && (!a.title.match(/[\u0600-\u06FF]/)))
        .slice(0, 12); // حد أقصى 12 خبر للترجمة

      // ترجمة باستخدام Groq
      if (toTranslate.length > 0 && apiKeyGroq) {
        try {
          const titlesList = toTranslate.map((a, i) => `${i + 1}. ${a.title}`).join('\n');
          
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
                content: `ترجم هذه العناوين الإخبارية إلى العربية الفصحى. كن دقيقاً وحافظ على المعنى.
رد فقط بـ JSON بهذا التنسيق: {"translations": ["ترجمة1", "ترجمة2", ...]}

العناوين:
${titlesList}`
              }],
              temperature: 0.1,
              max_tokens: 1500,
              response_format: { type: 'json_object' }
            })
          });

          if (tResp.ok) {
            const tData = await tResp.json();
            const content = tData.choices?.[0]?.message?.content || '{}';
            const translations = JSON.parse(content).translations || [];
            
            toTranslate.forEach((item, i) => {
              if (translations[i] && translations[i].length > 5) {
                item.title = translations[i];
                item.lang = 'ar';
              }
            });
          }
        } catch (e) {
          console.error('Translation error:', e.message);
          // إذا فشلت الترجمة، نبقي العناوين الأصلية
        }
      }

      // الترتيب النهائي
      unique.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

      // إحصائيات للـ response
      const stats = {
        total: unique.length,
        sources: [...new Set(unique.map(a => a.source?.name))].length,
        time_ms: Date.now() - startTime
      };

      return res.status(200).json({ 
        articles: unique.slice(0, 30), // حد أقصى 30 خبر
        stats 
      });
    }

    if (type === 'analyze') {
      const decodedText = decodeURIComponent(text || '')
        .replace(/["\\`%&+#<>]/g, ' ')
        .trim();
      
      if (!decodedText || decodedText.length < 10) {
        return res.status(400).json({ error: "النص قصير جداً للتحليل" });
      }

      // تحسين الـ prompt لنتائج أكثر دقة
      const prompt = `أنت محلل جيوسياسي خبير. حلل هذا الخبر بدقة وواقعية.

تعليمات صارمة:
- استخرج الموقع الجغرافي الحقيقي (مدينة/دولة) المذكور في الخبر
- حدد مستوى التهديد بدقة: حرج (خطر وجودي)، مرتفع (تصعيد كبير)، متوسط (توتر)، منخفض (تطور عادي)
- اذكر الأطراف المعنية بأسمائها الحقيقية
- قدم توقعات واقعية خلال 30 يوماً

الخبر: "${decodedText}"

أجب بـ JSON فقط:
{
  "threat_level": "حرج أو مرتفع أو متوسط أو منخفض",
  "threat_score": (0-100),
  "summary": "تحليل في 3 جمل مع ذكر الأسماء الحقيقية",
  "parties": ["اسم حقيقي 1", "اسم حقيقي 2"],
  "interests": "المصالح الحقيقية لكل طرف",
  "scenarios": {
    "current": "الوضع الراهن",
    "best": "أفضل سيناريو واقعي",
    "worst": "أسوأ سيناريو واقعي"
  },
  "forecast": "توقعات 30 يوماً",
  "lat": (رقم عشري),
  "lng": (رقم عشري),
  "location_name": "المدينة/الدولة الحقيقية"
}`;

      // محاولة Groq أولاً
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
                { role: 'system', content: 'محلل جيوسياسي خبير. رد بـ JSON فقط.' },
                { role: 'user', content: prompt }
              ],
              temperature: 0.2,
              max_tokens: 1200,
              response_format: { type: 'json_object' }
            })
          });

          if (r.ok) {
            const d = await r.json();
            const content = d.choices?.[0]?.message?.content || '{}';
            const p = JSON.parse(content);
            
            // التحقق من صحة البيانات
            p.lat = parseFloat(p.lat) || 30.0;
            p.lng = parseFloat(p.lng) || 45.0;
            p.threat_score = Math.min(100, Math.max(0, parseInt(p.threat_score) || 50));
            p._source = 'groq';
            
            return res.status(200).json(p);
          }
        } catch (e) {
          console.error('Groq analysis error:', e.message);
        }
      }

      // بديل Gemini إذا فشل Groq
      if (apiKeyGemini) {
        try {
          const r = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKeyGemini}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.2, maxOutputTokens: 1000 }
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
              p.threat_score = Math.min(100, Math.max(0, parseInt(p.threat_score) || 50));
              p._source = 'gemini';
              
              return res.status(200).json(p);
            }
          }
        } catch (e) {
          console.error('Gemini analysis error:', e.message);
        }
      }

      return res.status(502).json({ 
        error: "فشل التحليل",
        message: "جميع خدمات التحليل غير متوفرة حالياً"
      });
    }

    return res.status(400).json({ error: "نوع الطلب غير معروف" });
    
  } catch (error) {
    console.error('Fatal error:', error);
    return res.status(500).json({ 
      error: "فشل النظام",
      details: error.message 
    });
  }
}
