export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const { type } = req.query;
  if (type === 'news') return handleNews(req, res);
  if (type === 'analyze') return handleAnalysis(req, res);
  if (type === 'telegram') return handleTelegram(req, res);
  if (type === 'strikes') return handleStrikes(req, res);
  if (type === 'forecast') return handleForecast(req, res);
  return res.status(400).json({ error: 'نوع غير معروف' });
}

// ============================================================
// NEWS
// ============================================================
async function handleNews(req, res) {
  const t0 = Date.now();
  const GROQ = process.env.GROQ_API_KEY;
  const GNEWS = process.env.GNEWS_API_KEY;
  const GUARDIAN = process.env.GUARDIAN_API_KEY;
  const NEWSAPI = process.env.NEWS_API_KEY;

  function parseRSS(xml, name, flag, lang) {
    const out = [];
    try {
      const re = /<item>([\s\S]*?)<\/item>|<entry>([\s\S]*?)<\/entry>/gi;
      let m;
      while ((m = re.exec(xml)) && out.length < 6) {
        const b = m[1] || m[2];
        const tm = b.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
        let title = tm ? tm[1].replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").trim() : '';
        if (!title || title.length < 8) continue;
        const dm = b.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/) || b.match(/<published[^>]*>([\s\S]*?)<\/published>/);
        let date = new Date().toISOString();
        if (dm) try { date = new Date(dm[1]).toISOString(); } catch(e) {}
        const lm = b.match(/<link[^>]*>([\s\S]*?)<\/link>/) || b.match(/<link[^>]*href="([^"]+)"/) || b.match(/<guid[^>]*>([\s\S]*?)<\/guid>/);
        out.push({ title, publishedAt: date, source: { name, flag }, url: lm ? lm[1].trim() : '', lang });
      }
    } catch(e) {}
    return out;
  }

  const feeds = [
    // وكالات دولية
    ['https://arabic.rt.com/rss/', 'RT عربي', '🇷🇺', 'ar'],
    ['https://feeds.reuters.com/reuters/worldNews', 'Reuters', '🌐', 'en'],
    ['https://feeds.reuters.com/Reuters/worldNews', 'Reuters World', '🌐', 'en'],
    // Associated Press
    ['https://rsshub.app/apnews/topics/ap-top-news', 'AP News', '🇺🇸', 'en'],
    ['https://feeds.apnews.com/rss/apf-topnews', 'AP Top News', '🇺🇸', 'en'],
    ['https://feeds.apnews.com/rss/apf-middleeast', 'AP Middle East', '🇺🇸', 'en'],
    ['https://sputnikarabic.ae/rss', 'سبوتنيك', '🇷🇺', 'ar'],
    // رئيسية
    ['https://www.aljazeera.net/feed/topic-35', 'الجزيرة', '🇶🇦', 'ar'],
    ['https://www.bbc.com/arabic/index.xml', 'BBC عربي', '🇬🇧', 'ar'],
    ['https://alarabiya.net/ar/rss.xml', 'العربية', '🇸🇦', 'ar'],
    ['https://www.france24.com/ar/rss', 'فرانس 24', '🇫🇷', 'ar'],
    ['https://www.skynewsarabia.com/rss.xml', 'سكاي نيوز', '🇦🇪', 'ar'],
    ['https://www.almayadeen.net/rss', 'الميادين', '🇱🇧', 'ar'],
    ['https://www.independentarabia.com/rss.xml', 'إندبندنت', '🌍', 'ar'],
    ['https://aawsat.com/home/rss', 'الشرق الأوسط', '🗞️', 'ar'],
    ['https://www.dw.com/ar/rss', 'DW عربي', '🇩🇪', 'ar'],
    // سعودية
    ['https://www.alriyadh.com/rss', 'الرياض', '🇸🇦', 'ar'],
    ['https://www.okaz.com.sa/rss', 'عكاظ', '🇸🇦', 'ar'],
    ['https://sabq.org/rss', 'سبق', '🇸🇦', 'ar'],
    ['https://www.aleqt.com/rss', 'الاقتصادية', '🇸🇦', 'ar'],
    // مصرية
    ['https://www.masrawy.com/rss', 'مصراوي', '🇪🇬', 'ar'],
    ['https://www.youm7.com/rss', 'اليوم السابع', '🇪🇬', 'ar'],
    ['https://www.almasryalyoum.com/rss', 'المصري اليوم', '🇪🇬', 'ar'],
    ['https://www.ahram.org.eg/rss', 'الأهرام', '🇪🇬', 'ar'],
    // عراقية
    ['https://www.rudaw.net/arabic/rss', 'روداو', '🇮🇶', 'ar'],
    ['https://www.alsumaria.tv/rss', 'السومرية', '🇮🇶', 'ar'],
    ['https://shafaq.com/ar/rss.xml', 'شفق نيوز', '🇮🇶', 'ar'],
    ['https://www.baghdadtoday.news/rss.xml', 'بغداد اليوم', '🇮🇶', 'ar'],
    ['https://www.almadapaper.net/rss', 'المدى', '🇮🇶', 'ar'],
    ['https://www.alsabaah.iq/rss', 'الصباح', '🇮🇶', 'ar'],
    // سورية
    ['https://sana.sy/feed/', 'سانا', '🇸🇾', 'ar'],
    ['https://orient-news.net/feed/', 'أورينت', '🇸🇾', 'ar'],
    ['https://www.enabbaladi.net/feed', 'عنب بلدي', '🇸🇾', 'ar'],
    // يمنية
    ['https://www.sabanews.net/rss.xml', 'سبأ', '🇾🇪', 'ar'],
    ['https://almasirah.net/rss.xml', 'المسيرة', '🇾🇪', 'ar'],
    // لبنانية
    ['https://www.annahar.com/rss', 'النهار', '🇱🇧', 'ar'],
    ['https://www.nna-leb.gov.lb/rss', 'الوكالة الوطنية', '🇱🇧', 'ar'],
    // فلسطينية
    ['https://www.wafa.ps/rss', 'وفا', '🇵🇸', 'ar'],
    ['https://www.maannews.net/rss', 'معاً', '🇵🇸', 'ar'],
    ['https://www.alquds.co.uk/rss', 'القدس العربي', '🇵🇸', 'ar'],
    // إيرانية
    ['https://www.irna.ir/rss.xml', 'IRNA', '🇮🇷', 'ar'],
    ['https://www.tasnimnews.com/ar/rss', 'تسنيم', '🇮🇷', 'ar'],
    ['https://www.mehrnews.com/rss', 'مهر نيوز', '🇮🇷', 'ar'],
    // تركية
    ['https://www.aa.com.tr/ar/rss', 'الأناضول', '🇹🇷', 'ar'],
    ['https://www.trtarabi.com/rss', 'TRT عربي', '🇹🇷', 'ar'],
    // إسرائيلية
    ['https://www.timesofisrael.com/feed/', 'Times of Israel', '🇮🇱', 'en'],
    ['https://www.jpost.com/Rss/RssFeedsHeadlines.aspx', 'Jerusalem Post', '🇮🇱', 'en'],
    // إنجليزية متخصصة
    ['https://www.al-monitor.com/rss', 'Al-Monitor', '🇺🇸', 'en'],
    ['https://www.middleeasteye.net/rss', 'Middle East Eye', '🇬🇧', 'en'],
    ['https://www.arabnews.com/rss', 'Arab News', '🇸🇦', 'en'],
    ['https://gulfnews.com/rss', 'Gulf News', '🇦🇪', 'en'],
    ['https://feeds.bbci.co.uk/news/world/middle_east/rss.xml', 'BBC ME', '🇬🇧', 'en'],
    ['https://rss.nytimes.com/services/xml/rss/nyt/MiddleEast.xml', 'NY Times', '🇺🇸', 'en'],
    ['https://www.theguardian.com/world/middleeast/rss', 'The Guardian', '🇬🇧', 'en'],
    ['https://foreignpolicy.com/feed/', 'Foreign Policy', '🇺🇸', 'en'],
    // خليجية
    ['https://alghad.com/rss', 'الغد', '🇯🇴', 'ar'],
    ['https://www.alraimedia.com/rss', 'الراي', '🇰🇼', 'ar'],
    ['https://www.alqabas.com/rss', 'القبس', '🇰🇼', 'ar'],
    ['https://www.alayam.com/rss', 'الأيام', '🇧🇭', 'ar'],
    // مغاربية
    ['https://www.hespress.com/rss', 'هسبريس', '🇲🇦', 'ar'],
    ['https://www.elkhabar.com/rss', 'الخبر', '🇩🇿', 'ar'],
    ['https://www.babnet.net/rss', 'باب نت', '🇹🇳', 'ar'],
  ];

  const all = [];
  const BATCH = 12;

  for (let i = 0; i < feeds.length; i += BATCH) {
    const results = await Promise.allSettled(
      feeds.slice(i, i + BATCH).map(async ([url, name, flag, lang]) => {
        try {
          const r = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/rss+xml,*/*' },
            signal: AbortSignal.timeout(4000)
          });
          if (!r.ok) return [];
          return parseRSS(await r.text(), name, flag, lang);
        } catch(e) { return []; }
      })
    );
    results.forEach(r => r.status === 'fulfilled' && all.push(...r.value));
  }

  // GNews
  if (GNEWS) {
    try {
      const r = await fetch(`https://gnews.io/api/v4/search?q=middle+east&lang=ar&max=10&sortby=publishedAt&apikey=${GNEWS}`, { signal: AbortSignal.timeout(4000) });
      if (r.ok) { const d = await r.json(); d.articles?.forEach(a => a.title && all.push({ title: a.title, publishedAt: a.publishedAt, source: { name: a.source?.name||'GNews', flag: '📰' }, url: a.url, lang: 'ar' })); }
    } catch(e) {}
  }

  // NewsAPI
  if (NEWSAPI) {
    try {
      const r = await fetch(`https://newsapi.org/v2/everything?q=middle+east+OR+iran+OR+israel+OR+iraq&language=ar&pageSize=10&sortBy=publishedAt&apiKey=${NEWSAPI}`, { signal: AbortSignal.timeout(4000) });
      if (r.ok) { const d = await r.json(); d.articles?.forEach(a => a.title && all.push({ title: a.title, publishedAt: a.publishedAt, source: { name: a.source?.name||'NewsAPI', flag: '📰' }, url: a.url, lang: 'ar' })); }
    } catch(e) {}
  }

  // Guardian
  if (GUARDIAN && GUARDIAN !== 'test') {
    try {
      const r = await fetch(`https://content.guardianapis.com/search?q=middle+east+iran+israel+iraq&page-size=8&order-by=newest&api-key=${GUARDIAN}`, { signal: AbortSignal.timeout(4000) });
      if (r.ok) { const d = await r.json(); d.response?.results?.forEach(a => a.webTitle && all.push({ title: a.webTitle, publishedAt: a.webPublicationDate, source: { name: 'Guardian', flag: '🇬🇧' }, url: a.webUrl, lang: 'en' })); }
    } catch(e) {}
  }

  // GDELT Project - أكبر قاعدة بيانات أخبار في العالم
  try {
    const gdeltQueries = [
      // عربي
      'https://api.gdeltproject.org/api/v2/doc/doc?query=middle+east+sourcelang:arabic&mode=artlist&maxrecords=15&format=json&sort=DateDesc',
      // إنجليزي
      'https://api.gdeltproject.org/api/v2/doc/doc?query=iran+OR+israel+OR+iraq+OR+syria+OR+lebanon+OR+yemen+sourcelang:english&mode=artlist&maxrecords=15&format=json&sort=DateDesc',
    ];
    const gdeltResults = await Promise.allSettled(
      gdeltQueries.map(url => fetch(url, { signal: AbortSignal.timeout(5000) }))
    );
    for (const result of gdeltResults) {
      if (result.status === 'fulfilled' && result.value.ok) {
        try {
          const d = await result.value.json();
          d.articles?.forEach(a => {
            if (!a.title || a.title.length < 8) return;
            // تحويل تاريخ GDELT من صيغة YYYYMMDDTHHMMSSz
            let pubDate = new Date().toISOString();
            if (a.seendate) {
              try {
                const sd = a.seendate.toString();
                pubDate = new Date(`${sd.slice(0,4)}-${sd.slice(4,6)}-${sd.slice(6,8)}T${sd.slice(9,11)}:${sd.slice(11,13)}:00Z`).toISOString();
              } catch(e) {}
            }
            const domain = a.domain || a.url?.match(/https?:\/\/([^/]+)/)?.[1] || 'GDELT';
            all.push({
              title: a.title,
              publishedAt: pubDate,
              source: { name: domain, flag: '🌍' },
              url: a.url || '',
              lang: a.language === 'Arabic' ? 'ar' : 'en'
            });
          });
        } catch(e) {}
      }
    }
  } catch(e) {}

  // ترجمة غير العربية
  // تحديد غير العربية + الفارسية (تشترك في نفس Unicode لكن تختلف)
  const nonAr = all.filter(a => {
    const arabicChars = (a.title.match(/[\u0600-\u06FF]/g)||[]).length;
    const totalChars = a.title.replace(/\s/g,'').length;
    // إذا كانت نسبة الأحرف العربية/الفارسية أقل من 40% = تحتاج ترجمة
    // أو إذا كانت اللغة غير عربية صراحةً
    const isPersian = /[\u067E\u0686\u06AF\u06CC\u0698]/.test(a.title); // أحرف فارسية خاصة
    return a.lang !== 'ar' || arabicChars / totalChars < 0.4 || isPersian;
  });
  if (nonAr.length && GROQ) {
    try {
      const batch = nonAr.slice(0, 30);
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: `ترجم للعربية الفصحى. JSON فقط: {"t":["ترجمة1",...]}\n${batch.map((a,i)=>`${i+1}. ${a.title}`).join('\n')}` }],
          temperature: 0.1, max_tokens: 2000, response_format: { type: 'json_object' }
        }), signal: AbortSignal.timeout(10000)
      });
      if (r.ok) {
        const d = await r.json();
        const tr = JSON.parse(d.choices?.[0]?.message?.content||'{}').t || [];
        batch.forEach((a,i) => { if(tr[i]) { a.title = tr[i]; a.lang = 'ar'; } });
      }
    } catch(e) {}
  }

  // إزالة تكرار وترتيب
  all.sort((a,b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  const seen = new Set();
  const unique = all.filter(a => {
    if (!a.title || a.title.length < 8) return false;
    const k = a.title.substring(0, 30).toLowerCase().replace(/\s/g, '');
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });

  return res.status(200).json({
    articles: unique.slice(0, 300),
    stats: { total: unique.length, time_ms: Date.now() - t0 }
  });
}

// ============================================================
// ANALYZE
// ============================================================
async function handleAnalysis(req, res) {
  const { text } = req.query;
  if (!text) return res.status(400).json({ error: 'النص مطلوب' });
  const txt = decodeURIComponent(text).replace(/["\\`]/g,' ').trim();
  const GROQ = process.env.GROQ_API_KEY;
  const GEMINI = process.env.GEMINI_API_KEY;

  const prompt = `أنت محلل جيوسياسي خبير. حلل هذا الخبر بدقة تامة واذكر أسماء حقيقية فقط.

قواعد صارمة:
- اذكر دول وأشخاص وأماكن حقيقية من الخبر
- لا تستخدم "المنطقة" أو "الدول المعنية"
- الموقع: مدينة أو دولة حقيقية من الخبر مع إحداثياتها الدقيقة
- JSON نقي فقط بلا نص آخر

{
  "threat_level": "حرج|مرتفع|متوسط|منخفض",
  "threat_score": 0-100,
  "summary": "3 جمل تحليلية بأسماء وأماكن حقيقية",
  "parties": ["اسم حقيقي 1", "اسم حقيقي 2"],
  "interests": "المصالح الحقيقية لكل طرف",
  "scenarios": {
    "current": "وصف الوضع الراهن بالتفصيل",
    "best": "أفضل سيناريو واقعي",
    "worst": "أسوأ سيناريو واقعي"
  },
  "forecast": "توقعات محددة خلال 30 يوماً",
  "lat": إحداثية_دقيقة,
  "lng": إحداثية_دقيقة,
  "location_name": "اسم المدينة أو الدولة الحقيقية"
}

الخبر: "${txt}"`;

  // محاولة Groq أولاً (نموذج سريع)
  if (GROQ) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ}` },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: 'محلل جيوسياسي خبير. JSON نقي فقط.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.2, max_tokens: 900,
          response_format: { type: 'json_object' }
        }), signal: AbortSignal.timeout(9000)
      });
      if (r.ok) {
        const d = await r.json();
        const p = JSON.parse(d.choices?.[0]?.message?.content || '{}');
        if (p.threat_level) {
          p.lat = parseFloat(p.lat) || 33.3;
          p.lng = parseFloat(p.lng) || 44.4;
          p.threat_score = Math.min(100, Math.max(0, parseInt(p.threat_score)||50));
          p._source = 'groq';
          return res.status(200).json(p);
        }
      }
    } catch(e) {}
  }

  // محاولة Gemini (بديل سريع)
  if (GEMINI) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 900 }
          }), signal: AbortSignal.timeout(12000) }
      );
      const d = await r.json();
      if (r.ok && d.candidates?.length) {
        let raw = d.candidates[0]?.content?.parts?.[0]?.text || '';
        raw = raw.replace(/```json|```/g, '').trim();
        const m = raw.match(/\{[\s\S]*\}/);
        if (m) {
          const p = JSON.parse(m[0]);
          if (p.threat_level) {
            p.lat = parseFloat(p.lat) || 33.3;
            p.lng = parseFloat(p.lng) || 44.4;
            p.threat_score = Math.min(100, Math.max(0, parseInt(p.threat_score)||50));
            p._source = 'gemini';
            return res.status(200).json(p);
          }
        }
      }
    } catch(e) {}
  }

  // محاولة Groq النموذج الكبير كآخر محاولة
  if (GROQ) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: 'محلل جيوسياسي خبير. JSON نقي فقط.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.2, max_tokens: 1200,
          response_format: { type: 'json_object' }
        }), signal: AbortSignal.timeout(20000)
      });
      if (r.ok) {
        const d = await r.json();
        const p = JSON.parse(d.choices?.[0]?.message?.content || '{}');
        if (p.threat_level) {
          p.lat = parseFloat(p.lat) || 33.3;
          p.lng = parseFloat(p.lng) || 44.4;
          p.threat_score = Math.min(100, Math.max(0, parseInt(p.threat_score)||50));
          p._source = 'groq';
          return res.status(200).json(p);
        }
      }
    } catch(e) {}
  }

  return res.status(502).json({ error: 'فشل التحليل - تحقق من مفاتيح API' });
}


// ============================================================
// TELEGRAM - قنوات عسكرية
// ============================================================
async function handleTelegram(req, res) {
  const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!TOKEN) return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN غير موجود' });

  const channels = [
    { id: '@intelslava', name: 'Intel Slava', flag: '🪖' },
    { id: '@wargonzo', name: 'War Gonzo', flag: '⚔️' },
    { id: '@rybar', name: 'Rybar', flag: '🎯' },
    { id: '@MiddleEastSpectator', name: 'ME Spectator', flag: '🌍' },
    { id: '@AlHadath', name: 'الحدث', flag: '📡' },
    { id: '@AlArabiya_Ar', name: 'العربية', flag: '🇸🇦' },
    { id: '@AlJazeeraAr', name: 'الجزيرة', flag: '🇶🇦' },
    { id: '@ultrapalestine', name: 'أولترا فلسطين', flag: '🇵🇸' },
    { id: '@qassam_arabic', name: 'كتائب القسام', flag: '🔴' },
    { id: '@IRNAarabic', name: 'إيرنا عربي', flag: '🇮🇷' },
  ];

  const GROQ = process.env.GROQ_API_KEY;
  const allMessages = [];

  await Promise.allSettled(channels.map(async (ch) => {
    try {
      const r = await fetch(
        `https://api.telegram.org/bot${TOKEN}/getUpdates?offset=-5&limit=5`,
        { signal: AbortSignal.timeout(4000) }
      );
      // جلب آخر رسائل القناة عبر forwardFromChat
      const r2 = await fetch(
        `https://api.telegram.org/bot${TOKEN}/sendMessage?chat_id=${ch.id}&text=.`,
        { signal: AbortSignal.timeout(3000) }
      );
      // استخدام RSS بديل للقنوات العامة
      const rss = await fetch(
        `https://rsshub.app/telegram/channel/${ch.id.replace('@','')}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (rss.ok) {
        const xml = await rss.text();
        const re = /<item>([\s\S]*?)<\/item>/gi;
        let m;
        while ((m = re.exec(xml)) && allMessages.length < 50) {
          const b = m[1];
          const tm = b.match(/<title[^>]*>([\s\S]*?)<\/title>/);
          const dm = b.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/);
          const lm = b.match(/<link[^>]*>([\s\S]*?)<\/link>/);
          let title = tm ? tm[1].replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim() : '';
          if (!title || title.length < 8) return;
          let date = new Date().toISOString();
          if (dm) try { date = new Date(dm[1]).toISOString(); } catch(e) {}
          allMessages.push({
            title, publishedAt: date,
            source: { name: ch.name, flag: ch.flag },
            url: lm ? lm[1].trim() : '',
            lang: 'ar', _from: 'telegram'
          });
        }
      }
    } catch(e) {}
  }));

  // ترجمة غير العربية
  const nonAr = allMessages.filter(a => !(a.title.match(/[\u0600-\u06FF]/)||[]));
  if (nonAr.length && GROQ) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: `ترجم للعربية. JSON فقط: {"t":["ترجمة1",...]}
${nonAr.slice(0,10).map((a,i)=>`${i+1}. ${a.title}`).join('\n')}` }],
          temperature: 0.1, max_tokens: 1000, response_format: { type: 'json_object' }
        }), signal: AbortSignal.timeout(8000)
      });
      if (r.ok) {
        const d = await r.json();
        const tr = JSON.parse(d.choices?.[0]?.message?.content||'{}').t||[];
        nonAr.slice(0,10).forEach((a,i) => { if(tr[i]) a.title = tr[i]; });
      }
    } catch(e) {}
  }

  allMessages.sort((a,b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  return res.status(200).json({ messages: allMessages, count: allMessages.length });
}

// ============================================================
// STRIKES - خريطة الضربات العسكرية عبر Groq
// ============================================================
async function handleStrikes(req, res) {
  const GROQ = process.env.GROQ_API_KEY;
  if (!GROQ) return res.status(500).json({ error: 'GROQ_API_KEY غير موجود' });

  // جلب آخر الأخبار العسكرية
  const newsFeeds = [
    'https://www.almayadeen.net/rss',
    'https://arabic.rt.com/rss/',
    'https://www.aljazeera.net/feed/topic-35',
    'https://sana.sy/feed/',
    'https://almasirah.net/rss.xml',
  ];

  const headlines = [];
  await Promise.allSettled(newsFeeds.map(async url => {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (!r.ok) return;
      const xml = await r.text();
      const re = /<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/gi;
      let m; let count = 0;
      while ((m = re.exec(xml)) && count < 5) {
        const t = m[1].replace(/<[^>]+>/g,'').trim();
        if (t.length > 15 && /غارة|قصف|هجوم|ضربة|صاروخ|مسيّر|اشتباك|معركة|عملية|قوات|جيش|حزب الله|حماس|حوثي/i.test(t)) {
          headlines.push(t); count++;
        }
      }
    } catch(e) {}
  }));

  if (!headlines.length) {
    return res.status(200).json({ strikes: [], message: 'لا توجد أحداث عسكرية حديثة' });
  }

  const prompt = `أنت محلل عسكري. من هذه العناوين الإخبارية، استخرج الضربات والأحداث العسكرية وضعها على الخريطة.

العناوين:
${headlines.slice(0,15).join('\n')}

أجب بـ JSON فقط:
{
  "strikes": [
    {
      "title": "وصف الحدث العسكري",
      "type": "غارة جوية|قصف مدفعي|هجوم صاروخي|اشتباك بري|ضربة بمسيّر|عملية خاصة",
      "location": "اسم المدينة أو المنطقة",
      "country": "اسم الدولة",
      "lat": رقم,
      "lng": رقم,
      "attacker": "المهاجم",
      "defender": "المدافع",
      "severity": "عالي|متوسط|منخفض",
      "time": "منذ كم وقت تقريباً"
    }
  ]
}`;

  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'محلل عسكري خبير. JSON نقي فقط.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2, max_tokens: 2000,
        response_format: { type: 'json_object' }
      }), signal: AbortSignal.timeout(20000)
    });
    if (r.ok) {
      const d = await r.json();
      const p = JSON.parse(d.choices?.[0]?.message?.content||'{}');
      const strikes = (p.strikes||[]).map(s => ({
        ...s,
        lat: parseFloat(s.lat)||33.3,
        lng: parseFloat(s.lng)||44.4
      }));
      return res.status(200).json({ strikes, count: strikes.length, sources: headlines.length });
    }
  } catch(e) {}

  return res.status(200).json({ strikes: [], message: 'فشل استخراج الضربات' });
}

// ============================================================
// FORECAST - توقعات التصعيد خلال 24 ساعة
// ============================================================
async function handleForecast(req, res) {
  const GROQ = process.env.GROQ_API_KEY;
  if (!GROQ) return res.status(500).json({ error: 'GROQ_API_KEY غير موجود' });

  // جلب آخر 20 خبر
  const newsFeeds = [
    'https://www.almayadeen.net/rss',
    'https://arabic.rt.com/rss/',
    'https://www.aljazeera.net/feed/topic-35',
    'https://alarabiya.net/ar/rss.xml',
    'https://feeds.reuters.com/reuters/worldNews',
  ];

  const headlines = [];
  await Promise.allSettled(newsFeeds.map(async url => {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (!r.ok) return;
      const xml = await r.text();
      const re = /<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/gi;
      let m; let count = 0;
      while ((m = re.exec(xml)) && count < 5) {
        const t = m[1].replace(/<[^>]+>/g,'').trim();
        if (t.length > 15) { headlines.push(t); count++; }
      }
    } catch(e) {}
  }));

  const prompt = `أنت محلل استخباراتي خبير. بناءً على هذه الأخبار الأخيرة، أعطني تقرير توقعات التصعيد خلال الـ24 ساعة القادمة.

الأخبار:
${headlines.slice(0,20).join('\n')}

أجب بـ JSON فقط:
{
  "escalation_probability": 0-100,
  "risk_level": "حرج|مرتفع|متوسط|منخفض",
  "hotspots": [
    {
      "location": "اسم المنطقة",
      "country": "الدولة",
      "lat": رقم,
      "lng": رقم,
      "probability": 0-100,
      "reason": "سبب التوقع",
      "timeframe": "خلال كم ساعة"
    }
  ],
  "key_indicators": ["مؤشر 1", "مؤشر 2", "مؤشر 3"],
  "recommended_watch": ["منطقة للمراقبة 1", "منطقة 2"],
  "summary": "ملخص تقرير التوقعات في 3 جمل",
  "confidence": 0-100,
  "generated_at": "${new Date().toISOString()}"
}`;

  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'محلل استخباراتي خبير. JSON نقي فقط.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3, max_tokens: 2000,
        response_format: { type: 'json_object' }
      }), signal: AbortSignal.timeout(25000)
    });
    if (r.ok) {
      const d = await r.json();
      const p = JSON.parse(d.choices?.[0]?.message?.content||'{}');
      p.hotspots = (p.hotspots||[]).map(h => ({ ...h, lat: parseFloat(h.lat)||33.3, lng: parseFloat(h.lng)||44.4 }));
      p.escalation_probability = Math.min(100, Math.max(0, parseInt(p.escalation_probability)||50));
      return res.status(200).json(p);
    }
  } catch(e) {}

  return res.status(500).json({ error: 'فشل إنشاء التوقعات' });
}

function localAnalysis(text) {
  const t = text.toLowerCase();
  let threat = 'منخفض', score = 30, loc = 'منطقة الشرق الأوسط', lat = 33.3, lng = 44.4;
  if (/حرب|تصعيد|مواجهة|اشتباكات/.test(t)) { threat='حرج'; score=90; }
  else if (/غارات|قصف|هجوم|ضربة/.test(t)) { threat='مرتفع'; score=75; }
  else if (/توتر|تحذير|تهديد/.test(t)) { threat='متوسط'; score=55; }
  const locs = [
    [/لبنان|بيروت/,'لبنان',33.9,35.5],[/إيران|طهران/,'إيران',32.4,53.7],
    [/غزة|إسرائيل/,'غزة/إسرائيل',31.5,34.8],[/العراق|بغداد/,'العراق',33.3,44.4],
    [/سوريا|دمشق/,'سوريا',34.8,39.0],[/اليمن|صنعاء/,'اليمن',15.5,47.5],
    [/مصر|القاهرة/,'مصر',26.8,30.8],[/السعودية|الرياض/,'السعودية',24.7,46.7],
    [/تركيا|أنقرة/,'تركيا',39.0,35.0],
  ];
  for (const [re,n,la,ln] of locs) { if (re.test(t)) { loc=n; lat=la; lng=ln; break; } }
  const parties = [];
  if (/إسرائيل/.test(t)) parties.push('إسرائيل');
  if (/إيران/.test(t)) parties.push('إيران');
  if (/حزب الله/.test(t)) parties.push('حزب الله');
  if (/حماس/.test(t)) parties.push('حماس');
  if (/أمريكا|الولايات/.test(t)) parties.push('الولايات المتحدة');
  if (/روسيا/.test(t)) parties.push('روسيا');
  if (!parties.length) parties.push('أطراف محلية');
  return {
    threat_level: threat, threat_score: score,
    summary: `تحليل: ${text.substring(0,80)}. الأطراف: ${parties.join('، ')} في ${loc}.`,
    parties, interests: `مصالح متضاربة في ${loc}`,
    scenarios: {
      current: `وضع ${threat} في ${loc}`,
      best: 'تهدئة عبر وساطة دولية',
      worst: 'اتساع الصراع وتدخل أطراف إضافية'
    },
    forecast: `احتمال استمرار التوتر خلال 30 يوماً`,
    lat, lng, location_name: loc, _source: 'local'
  };
}
