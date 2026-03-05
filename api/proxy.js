// ============================================
// INTEL-OPS PROXY - VERSION 4.0 (PROFESSIONAL)
// مع أكثر من 100+ مصدر إخباري موثوق
// ============================================

export const config = {
  runtime: 'nodejs',
  maxDuration: 30, // أقصى مدة مسموحة في الخطة المجانية
};

export default async function handler(req, res) {
  // إعدادات CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { type } = req.query;

  try {
    if (type === 'news') {
      return await handleNews(req, res);
    }
    
    if (type === 'analyze') {
      return await handleAnalysis(req, res);
    }

    return res.status(400).json({ error: 'نوع طلب غير معروف' });
  } catch (error) {
    console.error('❌ خطأ عام:', error);
    return res.status(500).json({ error: 'خطأ داخلي في الخادم' });
  }
}

// ============================================
// دالة معالجة الأخبار - مهنية وحقيقية
// ============================================
async function handleNews(req, res) {
  const startTime = Date.now();
  const { q = 'الشرق الأوسط' } = req.query;
  
  // مفاتيح API
  const apiKeyGNews = process.env.GNEWS_API_KEY;
  const apiKeyGroq = process.env.GROQ_API_KEY;
  const apiKeyGuardian = process.env.GUARDIAN_API_KEY;
  const apiKeyNews = process.env.NEWS_API_KEY;
  
  const allArticles = [];
  const errors = [];

  // دالة مساعدة لاستخراج العناوين من RSS
  function parseRSS(xml, sourceName, sourceFlag, lang = 'ar', maxItems = 8) {
    const items = [];
    try {
      // محاولة استخراج items بطرق مختلفة
      const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
      const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
      
      let match;
      let regex = xml.includes('<item>') ? itemRegex : entryRegex;
      
      while ((match = regex.exec(xml)) !== null && items.length < maxItems) {
        const item = match[1];
        
        // استخراج العنوان - محاولة عدة صيغ
        let title = '';
        const titleMatches = [
          item.match(/<title>([^<]+)<\/title>/),
          item.match(/<title[^>]*>(?:<!\[CDATA\[)?([^<\]]+)/)
        ];
        
        for (const tm of titleMatches) {
          if (tm && tm[1]) {
            title = tm[1].trim().replace(/<!\[CDATA\[|\]\]>/g, '').trim();
            break;
          }
        }
        
        if (!title || title.length < 8 || title.includes('بحث') || title.includes('rss')) continue;
        
        // استخراج التاريخ
        let pubDate = new Date().toISOString();
        const dateMatches = [
          item.match(/<pubDate>([^<]+)<\/pubDate>/),
          item.match(/<published>([^<]+)<\/published>/),
          item.match(/<updated>([^<]+)<\/updated>/)
        ];
        
        for (const dm of dateMatches) {
          if (dm && dm[1]) {
            try {
              pubDate = new Date(dm[1]).toISOString();
              break;
            } catch (e) {}
          }
        }
        
        // استخراج الرابط
        let link = '';
        const linkMatches = [
          item.match(/<link>([^<]+)<\/link>/),
          item.match(/<link[^>]*href="([^"]+)"/),
          item.match(/<id>([^<]+)<\/id>/)
        ];
        
        for (const lm of linkMatches) {
          if (lm && lm[1]) {
            link = lm[1].trim();
            break;
          }
        }
        
        items.push({
          title: title,
          publishedAt: pubDate,
          source: { name: sourceName, flag: sourceFlag },
          url: link,
          lang: lang,
          _source: sourceName
        });
      }
    } catch (e) {
      console.error(`خطأ في parseRSS لـ ${sourceName}:`, e.message);
    }
    return items;
  }

  // ===== قائمة المصادر RSS الموسعة (100+ مصدر) =====
  const feeds = [
    // ===== وكالات أنباء عالمية (موثوقة جداً) =====
    ['https://arabic.rt.com/rss/', 'RT عربي', '🇷🇺', 'ar'],
    ['https://arabic.reuters.com/rss/', 'رويترز عربي', '🇬🇧', 'ar'],
    ['https://www.afp.com/ar/rss', 'فرانس برس', '🇫🇷', 'ar'],
    ['https://www.dpa.com/ar/rss', 'DPA الألمانية', '🇩🇪', 'ar'],
    
    // ===== مصادر عربية رئيسية =====
    ['https://www.aljazeera.net/feed/topic-35', 'الجزيرة', '🇶🇦', 'ar'],
    ['https://www.bbc.com/arabic/index.xml', 'BBC عربي', '🇬🇧', 'ar'],
    ['https://alarabiya.net/ar/rss.xml', 'العربية', '🇸🇦', 'ar'],
    ['https://www.france24.com/ar/rss', 'فرانس 24', '🇫🇷', 'ar'],
    ['https://www.skynewsarabia.com/rss.xml', 'سكاي نيوز', '🇦🇪', 'ar'],
    ['https://www.almayadeen.net/rss', 'الميادين', '🇱🇧', 'ar'],
    ['https://www.independentarabia.com/rss.xml', 'إندبندنت', '🌍', 'ar'],
    ['https://aawsat.com/home/rss', 'الشرق الأوسط', '🗞️', 'ar'],
    
    // ===== مصادر سعودية =====
    ['https://www.alriyadh.com/rss', 'الرياض', '🇸🇦', 'ar'],
    ['https://www.aleqt.com/rss', 'الاقتصادية', '🇸🇦', 'ar'],
    ['https://www.alwatan.com.sa/rss.xml', 'الوطن السعودية', '🇸🇦', 'ar'],
    ['https://www.okaz.com.sa/rss', 'عكاظ', '🇸🇦', 'ar'],
    ['https://sabq.org/rss', 'سبق', '🇸🇦', 'ar'],
    
    // ===== مصادر مصرية =====
    ['https://www.masrawy.com/rss', 'مصراوي', '🇪🇬', 'ar'],
    ['https://www.youm7.com/rss', 'اليوم السابع', '🇪🇬', 'ar'],
    ['https://www.elwatannews.com/rss', 'الوطن مصر', '🇪🇬', 'ar'],
    ['https://www.almasryalyoum.com/rss', 'المصري اليوم', '🇪🇬', 'ar'],
    ['https://www.ahram.org.eg/rss', 'الأهرام', '🇪🇬', 'ar'],
    ['https://www.shorouknews.com/rss', 'الشروق', '🇪🇬', 'ar'],
    
    // ===== مصادر إماراتية =====
    ['https://www.albayan.ae/rss', 'البيان', '🇦🇪', 'ar'],
    ['https://www.emaratalyoum.com/rss', 'الإمارات اليوم', '🇦🇪', 'ar'],
    ['https://www.alittihad.ae/rss', 'الاتحاد', '🇦🇪', 'ar'],
    
    // ===== مصادر قطرية =====
    ['https://www.al-sharq.com/rss', 'الشرق قطر', '🇶🇦', 'ar'],
    ['https://www.raya.com/rss', 'الراية', '🇶🇦', 'ar'],
    ['https://www.al-watan.com/rss', 'الوطن قطر', '🇶🇦', 'ar'],
    
    // ===== مصادر كويتية =====
    ['https://www.alraimedia.com/rss', 'الراي', '🇰🇼', 'ar'],
    ['https://www.aljarida.com/rss', 'الجريدة', '🇰🇼', 'ar'],
    ['https://www.alwatan.com.kw/rss', 'الوطن الكويتية', '🇰🇼', 'ar'],
    ['https://www.alqabas.com/rss', 'القبس', '🇰🇼', 'ar'],
    ['https://www.alanba.com.kw/rss', 'الأنباء', '🇰🇼', 'ar'],
    
    // ===== مصادر بحرينية =====
    ['https://www.alayam.com/rss', 'الأيام البحرين', '🇧🇭', 'ar'],
    ['https://www.albiladpress.com/rss', 'البلاد', '🇧🇭', 'ar'],
    ['https://www.akhbar-alkhaleej.com/rss', 'أخبار الخليج', '🇧🇭', 'ar'],
    
    // ===== مصادر عمانية =====
    ['https://www.alwatan.om/rss', 'الوطن العمانية', '🇴🇲', 'ar'],
    ['https://www.al-shabiba.com/rss', 'الشبيبة', '🇴🇲', 'ar'],
    ['https://www.omannews.gov.om/rss', 'وكالة الأنباء العمانية', '🇴🇲', 'ar'],
    
    // ===== مصادر أردنية =====
    ['https://alghad.com/rss', 'الغد', '🇯🇴', 'ar'],
    ['https://www.addustour.com/rss', 'الدستور', '🇯🇴', 'ar'],
    ['https://www.ammonnews.net/rss', 'عمان نت', '🇯🇴', 'ar'],
    ['https://www.khaberni.com/rss', 'خبرني', '🇯🇴', 'ar'],
    
    // ===== مصادر لبنانية =====
    ['https://www.annahar.com/rss', 'النهار', '🇱🇧', 'ar'],
    ['https://www.almayadeen.net/rss', 'الميادين', '🇱🇧', 'ar'],
    ['https://www.aljadeed.tv/rss', 'الجديد', '🇱🇧', 'ar'],
    ['https://www.mtv.com.lb/rss', 'MTV لبنان', '🇱🇧', 'ar'],
    ['https://www.lbcgroup.tv/rss', 'LBC', '🇱🇧', 'ar'],
    ['https://www.nna-leb.gov.lb/rss', 'الوكالة الوطنية', '🇱🇧', 'ar'],
    
    // ===== مصادر عراقية =====
    ['https://www.rudaw.net/arabic/rss', 'روداو', '🇮🇶', 'ar'],
    ['https://www.alsumaria.tv/rss', 'السومرية', '🇮🇶', 'ar'],
    ['https://shafaq.com/ar/rss.xml', 'شفق نيوز', '🇮🇶', 'ar'],
    ['https://www.baghdadtoday.news/rss.xml', 'بغداد اليوم', '🇮🇶', 'ar'],
    ['https://www.nrttv.com/ar/rss', 'NRT عربية', '🇮🇶', 'ar'],
    ['https://www.kirkuknow.com/ar/rss', 'كركوك ناو', '🇮🇶', 'ar'],
    ['https://www.alghadpress.com/rss', 'الغد برس', '🇮🇶', 'ar'],
    ['https://www.almadapaper.net/rss', 'المدى', '🇮🇶', 'ar'],
    ['https://www.alsabaah.iq/rss', 'الصباح', '🇮🇶', 'ar'],
    
    // ===== مصادر سورية =====
    ['https://sana.sy/feed/', 'سانا', '🇸🇾', 'ar'],
    ['https://orient-news.net/feed/', 'أورينت', '🇸🇾', 'ar'],
    ['https://www.syriahr.com/feed/', 'المرصد السوري', '🇬🇧', 'en'],
    ['https://www.enabbaladi.net/feed', 'عنب بلدي', '🇸🇾', 'ar'],
    ['https://www.syrianpc.com/rss', 'المركز الصحفي', '🇸🇾', 'ar'],
    
    // ===== مصادر يمنية =====
    ['https://www.sabanews.net/rss.xml', 'سبأ', '🇾🇪', 'ar'],
    ['https://almasirah.net/rss.xml', 'المسيرة', '🇾🇪', 'ar'],
    ['https://www.adenalghad.net/rss', 'عدن الغد', '🇾🇪', 'ar'],
    ['https://www.alayyam.info/rss', 'الأيام اليمنية', '🇾🇪', 'ar'],
    ['https://www.almotamar.net/rss', 'المؤتمر نت', '🇾🇪', 'ar'],
    
    // ===== مصادر ليبية =====
    ['https://www.libyaakhbar.com/rss', 'أخبار ليبيا', '🇱🇾', 'ar'],
    ['https://www.libya-al-mostakbal.org/rss', 'ليبيا المستقبل', '🇱🇾', 'ar'],
    ['https://www.218tv.net/feed', '218', '🇱🇾', 'ar'],
    ['https://www.libyaobserver.ly/rss', 'ليبيا أوبزرفر', '🇱🇾', 'en'],
    
    // ===== مصادر تونسية =====
    ['https://www.babnet.net/rss', 'باب نت', '🇹🇳', 'ar'],
    ['https://www.tunisia.tn/rss', 'تونس الرسمية', '🇹🇳', 'ar'],
    ['https://www.alchourouk.com/rss', 'الشروق', '🇹🇳', 'ar'],
    ['https://www.assabah.com.tn/rss', 'الصباح', '🇹🇳', 'ar'],
    
    // ===== مصادر جزائرية =====
    ['https://www.elkhabar.com/rss', 'الخبر', '🇩🇿', 'ar'],
    ['https://www.echoroukonline.com/rss', 'الشروق', '🇩🇿', 'ar'],
    ['https://www.ennaharonline.com/rss', 'النهار', '🇩🇿', 'ar'],
    ['https://www.al-fadjr.com/rss', 'الفجر', '🇩🇿', 'ar'],
    
    // ===== مصادر مغربية =====
    ['https://www.hespress.com/rss', 'هسبريس', '🇲🇦', 'ar'],
    ['https://www.alayam24.com/rss', 'الأيام 24', '🇲🇦', 'ar'],
    ['https://www.akhbarona.com/rss', 'أخبارنا', '🇲🇦', 'ar'],
    ['https://www.le360.ma/ar/rss', 'Le360', '🇲🇦', 'ar'],
    
    // ===== مصادر سودانية =====
    ['https://www.sudanakhbar.com/rss', 'أخبار السودان', '🇸🇩', 'ar'],
    ['https://www.alrakoba.net/rss', 'الركوبة', '🇸🇩', 'ar'],
    ['https://www.sudaress.com/rss', 'سودارس', '🇸🇩', 'ar'],
    
    // ===== مصادر فلسطينية =====
    ['https://www.maannews.net/rss', 'معاً', '🇵🇸', 'ar'],
    ['https://www.wafa.ps/rss', 'وفا', '🇵🇸', 'ar'],
    ['https://www.alquds.co.uk/rss', 'القدس العربي', '🇵🇸', 'ar'],
    ['https://www.qudsnet.com/rss', 'قدس نت', '🇵🇸', 'ar'],
    ['https://www.safa.ps/rss', 'وكالة صفا', '🇵🇸', 'ar'],
    
    // ===== مصادر إيرانية =====
    ['https://www.irna.ir/rss.xml', 'IRNA', '🇮🇷', 'ar'],
    ['https://www.tasnimnews.com/ar/rss', 'تسنيم', '🇮🇷', 'ar'],
    ['https://www.mehrnews.com/rss', 'مهر نيوز', '🇮🇷', 'ar'],
    ['https://www.farsnews.ir/rss', 'فارس', '🇮🇷', 'ar'],
    ['https://www.presstv.ir/rss', 'Press TV', '🇮🇷', 'en'],
    
    // ===== مصادر تركية =====
    ['https://www.aa.com.tr/ar/rss', 'الأناضول', '🇹🇷', 'ar'],
    ['https://www.trtarabi.com/rss', 'TRT عربي', '🇹🇷', 'ar'],
    ['https://www.dailysabah.com/rss', 'Daily Sabah', '🇹🇷', 'en'],
    ['https://www.hurriyetdailynews.com/rss', 'Hürriyet', '🇹🇷', 'en'],
    
    // ===== مصادر إسرائيلية (لوجهات النظر) =====
    ['https://www.timesofisrael.com/feed/', 'Times of Israel', '🇮🇱', 'en'],
    ['https://www.jpost.com/Rss/RssFeedsHeadlines.aspx', 'Jerusalem Post', '🇮🇱', 'en'],
    ['https://www.haaretz.com/rss', 'Haaretz', '🇮🇱', 'en'],
    ['https://www.ynetnews.com/rss', 'Ynetnews', '🇮🇱', 'en'],
    
    // ===== مصادر إنجليزية متخصصة بالشرق الأوسط =====
    ['https://www.al-monitor.com/rss', 'Al-Monitor', '🇺🇸', 'en'],
    ['https://www.middleeasteye.net/rss', 'Middle East Eye', '🇬🇧', 'en'],
    ['https://www.alaraby.co.uk/english/rss', 'The New Arab', '🇬🇧', 'en'],
    ['https://www.egyptindependent.com/rss', 'Egypt Independent', '🇪🇬', 'en'],
    ['https://www.arabnews.com/rss', 'Arab News', '🇸🇦', 'en'],
    ['https://gulfnews.com/rss', 'Gulf News', '🇦🇪', 'en'],
    ['https://www.khaleejtimes.com/rss', 'Khaleej Times', '🇦🇪', 'en'],
    ['https://www.thenationalnews.com/rss', 'The National', '🇦🇪', 'en'],
    
    // ===== وكالات أنباء عالمية (إنجليزية) =====
    ['https://feeds.reuters.com/reuters/worldNews', 'Reuters', '🌐', 'en'],
    ['https://feeds.bbci.co.uk/news/world/middle_east/rss.xml', 'BBC', '🇬🇧', 'en'],
    ['https://rss.nytimes.com/services/xml/rss/nyt/MiddleEast.xml', 'NY Times', '🇺🇸', 'en'],
    ['https://www.theguardian.com/world/middleeast/rss', 'The Guardian', '🇬🇧', 'en'],
    ['https://feeds.washingtonpost.com/rss/world', 'Washington Post', '🇺🇸', 'en'],
    ['https://www.economist.com/middle-east-and-africa/rss.xml', 'The Economist', '🇬🇧', 'en'],
    ['https://foreignpolicy.com/feed/', 'Foreign Policy', '🇺🇸', 'en'],
    ['https://www.cfr.org/rss.xml', 'CFR', '🇺🇸', 'en'],
    
    // ===== مصادر فرنسية =====
    ['https://www.lemonde.fr/proche-orient/rss_full.xml', 'Le Monde', '🇫🇷', 'fr'],
    ['https://www.lefigaro.fr/rss/figaro_international.xml', 'Le Figaro', '🇫🇷', 'fr'],
    ['https://www.france24.com/fr/moyen-orient/rss', 'France 24', '🇫🇷', 'fr'],
    ['https://www.liberation.fr/rss', 'Libération', '🇫🇷', 'fr'],
    ['https://www.leparisien.fr/rss', 'Le Parisien', '🇫🇷', 'fr'],
    
    // ===== مصادر ألمانية =====
    ['https://www.dw.com/ar/rss', 'DW عربي', '🇩🇪', 'ar'],
    ['https://www.spiegel.de/international/index.rss', 'Der Spiegel', '🇩🇪', 'en'],
    ['https://www.zeit.de/index.rss', 'Die Zeit', '🇩🇪', 'de'],
    
    // ===== مصادر روسية =====
    ['https://sputnikarabic.ae/rss', 'سبوتنيك', '🇷🇺', 'ar'],
    ['https://arabic.rt.com/rss/', 'RT عربي', '🇷🇺', 'ar'],
    ['https://tass.com/rss', 'TASS', '🇷🇺', 'en'],
    
    // ===== مصادر صينية =====
    ['http://arabic.cgtn.com/rss', 'CGTN', '🇨🇳', 'ar'],
    ['https://www.xinhuanet.com/english/rss', 'Xinhua', '🇨🇳', 'en'],
  ];

  // جلب المصادر بشكل متوازي (10 مصادر في كل دفعة)
  console.log(`📡 جاري جلب الأخبار من ${feeds.length} مصدر...`);
  
  // تجميع المصادر في دفعات (batches) لمنع timeout
  const batchSize = 15;
  for (let i = 0; i < feeds.length; i += batchSize) {
    const batch = feeds.slice(i, i + batchSize);
    const batchPromises = batch.map(async ([url, name, flag, lang]) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        
        const response = await fetch(url, {
          headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/rss+xml, application/xml, text/xml, */*'
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) return [];
        
        const xml = await response.text();
        const articles = parseRSS(xml, name, flag, lang, 5);
        return articles;
        
      } catch (e) {
        // تجاهل أخطاء المصادر الفردية
        return [];
      }
    });
    
    const batchResults = await Promise.allSettled(batchPromises);
    batchResults.forEach(result => {
      if (result.status === 'fulfilled' && result.value.length > 0) {
        allArticles.push(...result.value);
      }
    });
    
    console.log(`📊 دفعة ${i/batchSize + 1}: ${allArticles.length} خبر حتى الآن`);
  }

  // ===== GNews API =====
  if (apiKeyGNews) {
    try {
      console.log('📡 جلب من GNews...');
      const gnResp = await fetch(
        `https://gnews.io/api/v4/search?q=${encodeURIComponent(q)}&lang=ar&max=10&sortby=publishedAt&apikey=${apiKeyGNews}&_=${Date.now()}`,
        { signal: AbortSignal.timeout(4000) }
      );
      
      if (gnResp.ok) {
        const gnData = await gnResp.json();
        gnData.articles?.forEach(a => {
          if (a.title && a.title.length > 10) {
            allArticles.push({
              title: a.title,
              description: a.description,
              publishedAt: a.publishedAt,
              source: { name: a.source?.name || 'GNews', flag: '📰' },
              url: a.url,
              image: a.image,
              lang: 'ar',
              _source: 'gnews'
            });
          }
        });
        console.log(`✅ GNews: ${gnData.articles?.length || 0} خبر`);
      }
    } catch (e) {
      errors.push(`GNews: ${e.message}`);
    }
  }

  // ===== NewsAPI =====
  if (apiKeyNews) {
    try {
      console.log('📡 جلب من NewsAPI...');
      const newsResp = await fetch(
        `https://newsapi.org/v2/everything?q=${encodeURIComponent('middle east OR iran OR israel OR iraq OR syria OR lebanon')}&language=ar&pageSize=10&sortBy=publishedAt&apiKey=${apiKeyNews}`,
        { signal: AbortSignal.timeout(4000) }
      );
      
      if (newsResp.ok) {
        const newsData = await newsResp.json();
        newsData.articles?.forEach(a => {
          if (a.title && a.title.length > 10) {
            allArticles.push({
              title: a.title,
              description: a.description,
              publishedAt: a.publishedAt,
              source: { name: a.source?.name || 'NewsAPI', flag: '📰' },
              url: a.url,
              image: a.urlToImage,
              lang: 'ar',
              _source: 'newsapi'
            });
          }
        });
        console.log(`✅ NewsAPI: ${newsData.articles?.length || 0} خبر`);
      }
    } catch (e) {
      errors.push(`NewsAPI: ${e.message}`);
    }
  }

  // ===== The Guardian API =====
  if (apiKeyGuardian && apiKeyGuardian !== 'test') {
    try {
      console.log('📡 جلب من Guardian...');
      const gResp = await fetch(
        `https://content.guardianapis.com/search?q=middle%20east%20OR%20iran%20OR%20israel%20OR%20iraq%20OR%20syria%20OR%20lebanon&page-size=8&order-by=newest&api-key=${apiKeyGuardian}`,
        { signal: AbortSignal.timeout(4000) }
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
              lang: 'en',
              _source: 'guardian'
            });
          }
        });
        console.log(`✅ Guardian: ${gData.response?.results?.length || 0} خبر`);
      }
    } catch (e) {
      errors.push(`Guardian: ${e.message}`);
    }
  }

  // ===== ترجمة الأخبار الإنجليزية والفرنسية =====
  const nonArabicArticles = allArticles.filter(a => a.lang !== 'ar' || !(a.title.match(/[\u0600-\u06FF]/g) || []).length);
  
  if (nonArabicArticles.length > 0 && apiKeyGroq) {
    console.log(`🔄 ترجمة ${nonArabicArticles.length} خبر...`);
    
    try {
      // تجميع العناوين للترجمة (حد أقصى 15 خبر)
      const titlesForTranslation = nonArabicArticles.slice(0, 15).map(a => a.title).join('\n');
      
      const translationResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${apiKeyGroq}` 
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ 
            role: 'user', 
            content: `ترجم هذه العناوين الإخبارية إلى العربية الفصحى بدقة. احتفظ بالأسماء العلم كما هي.
رد فقط بـ JSON: {"translations": ["ترجمة 1", "ترجمة 2", ...]}

العناوين:
${titlesForTranslation}`
          }],
          temperature: 0.1,
          max_tokens: 1500,
          response_format: { type: 'json_object' }
        }),
        signal: AbortSignal.timeout(8000)
      });

      if (translationResp.ok) {
        const tData = await translationResp.json();
        const content = tData.choices?.[0]?.message?.content || '{}';
        const translations = JSON.parse(content).translations || [];
        
        nonArabicArticles.slice(0, 15).forEach((article, index) => {
          if (translations[index]) {
            article.title_original = article.title;
            article.title = translations[index];
            article.lang = 'ar';
          }
        });
        console.log(`✅ تمت ترجمة ${translations.length} خبر`);
      }
    } catch (e) {
      errors.push(`الترجمة: ${e.message}`);
    }
  }

  // ===== إزالة التكرارات بذكاء =====
  const uniqueMap = new Map();
  
  allArticles.forEach(article => {
    // تنظيف العنوان للمقارنة
    const cleanTitle = article.title
      .substring(0, 40)
      .toLowerCase()
      .replace(/[^\w\u0600-\u06FF]/g, '')
      .trim();
    
    if (!cleanTitle || cleanTitle.length < 5) return;
    
    if (!uniqueMap.has(cleanTitle)) {
      uniqueMap.set(cleanTitle, article);
    } else {
      // إذا كان مكرراً، نفضل المصدر الأكثر موثوقية
      const existing = uniqueMap.get(cleanTitle);
      const trustedSources = ['رويترز', 'الجزيرة', 'BBC', 'Reuters', 'Guardian', 'NY Times'];
      const existingTrust = trustedSources.some(s => existing.source.name.includes(s)) ? 1 : 0;
      const newTrust = trustedSources.some(s => article.source.name.includes(s)) ? 1 : 0;
      
      if (newTrust > existingTrust) {
        uniqueMap.set(cleanTitle, article);
      }
    }
  });

  const uniqueArticles = Array.from(uniqueMap.values());
  
  // ترتيب حسب التاريخ (الأحدث أولاً)
  uniqueArticles.sort((a, b) => {
    return new Date(b.publishedAt) - new Date(a.publishedAt);
  });

  const executionTime = Date.now() - startTime;
  console.log(`✅ تم جلب ${uniqueArticles.length} خبر فريد من ${feeds.length} مصدر في ${executionTime}ms`);
  
  if (errors.length > 0) {
    console.log('⚠️ أخطاء:', errors.slice(0, 5));
  }

  return res.status(200).json({
    articles: uniqueArticles.slice(0, 50), // أقصى 50 خبر
    stats: {
      total: uniqueArticles.length,
      sources: [...new Set(uniqueArticles.map(a => a.source.name))].length,
      time_ms: executionTime,
      errors: errors.length > 0 ? errors.slice(0, 3) : undefined
    }
  });
}

// ============================================
// دالة معالجة التحليل - باستخدام Groq حقيقياً
// ============================================
async function handleAnalysis(req, res) {
  const { text } = req.query;
  
  if (!text) {
    return res.status(400).json({ error: 'النص مطلوب للتحليل' });
  }
  
  const decodedText = decodeURIComponent(text).trim();
  const apiKeyGroq = process.env.GROQ_API_KEY;
  const apiKeyGemini = process.env.GEMINI_API_KEY;
  
  if (!apiKeyGroq && !apiKeyGemini) {
    return res.status(500).json({ error: 'لا توجد مفاتيح API للتحليل' });
  }

  console.log(`🔍 تحليل: "${decodedText.substring(0, 50)}..."`);

  // تحسين prompt للحصول على نتائج دقيقة
  const prompt = `أنت محلل جيوسياسي خبير من طراز هنري كيسنجر. حلل هذا الخبر بدقة واحترافية:

"${decodedText}"

قم بتحليل دقيق وشامل. كن محدداً وواقعياً.

المطلوب (JSON فقط):
{
  "threat_level": "حرج|مرتفع|متوسط|منخفض",
  "threat_score": (0-100),
  "summary": "تحليل دقيق في 3-4 جمل مع ذكر الأسماء والأماكن الحقيقية",
  "parties": ["طرف1", "طرف2", "طرف3"],
  "interests": "المصالح الحقيقية للأطراف المشاركة",
  "scenarios": {
    "current": "الوضع الراهن بالتفصيل",
    "best": "أفضل سيناريو واقعي ممكن",
    "worst": "أسوأ سيناريو واقعي ممكن"
  },
  "forecast": "توقعات دقيقة للأيام الـ30 القادمة مع ذكر احتمالات",
  "lat": (إحداثية دقيقة للموقع),
  "lng": (إحداثية دقيقة للموقع),
  "location_name": "الموقع الحقيقي (مدينة، منطقة، دولة)"
}`;

  // ===== استخدام Groq أولاً (الأسرع والأدق) =====
  if (apiKeyGroq) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${apiKeyGroq}` 
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: 'محلل جيوسياسي خبير. رد بـ JSON صحيح فقط.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.2,
          max_tokens: 1500,
          response_format: { type: 'json_object' }
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '{}';
        
        try {
          const analysis = JSON.parse(content);
          
          // التحقق من صحة البيانات وتنظيفها
          analysis.threat_score = Math.min(100, Math.max(0, parseInt(analysis.threat_score) || 50));
          analysis.lat = parseFloat(analysis.lat) || 32.0;
          analysis.lng = parseFloat(analysis.lng) || 44.0;
          analysis._source = 'groq';
          analysis.analyzed_at = new Date().toISOString();
          
          console.log(`✅ تحليل Groq: ${analysis.threat_level} - ${analysis.location_name || 'غير محدد'}`);
          
          return res.status(200).json(analysis);
        } catch (e) {
          console.error('❌ خطأ في تحليل JSON:', e.message);
        }
      }
    } catch (e) {
      console.error('❌ Groq error:', e.message);
    }
  }

  // ===== بديل Gemini إذا فشل Groq =====
  if (apiKeyGemini) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKeyGemini}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 1200 }
          }),
          signal: controller.signal
        }
      );

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        // استخراج JSON من النص
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const analysis = JSON.parse(jsonMatch[0]);
          
          analysis.threat_score = Math.min(100, Math.max(0, parseInt(analysis.threat_score) || 50));
          analysis.lat = parseFloat(analysis.lat) || 32.0;
          analysis.lng = parseFloat(analysis.lng) || 44.0;
          analysis._source = 'gemini';
          analysis.analyzed_at = new Date().toISOString();
          
          console.log(`✅ تحليل Gemini: ${analysis.threat_level} - ${analysis.location_name || 'غير محدد'}`);
          
          return res.status(200).json(analysis);
        }
      }
    } catch (e) {
      console.error('❌ Gemini error:', e.message);
    }
  }

  // ===== إذا فشل كل شيء، نحاول تحليل بسيط =====
  console.error('❌ فشلت جميع محاولات التحليل المتقدمة، استخدام التحليل الأساسي');
  
  // تحليل أساسي كحل أخير
  const basicAnalysis = basicKeywordAnalysis(decodedText);
  
  return res.status(200).json({
    ...basicAnalysis,
    _source: 'basic',
    analyzed_at: new Date().toISOString(),
    warning: 'تم استخدام التحليل الأساسي بسبب فشل خدمات AI'
  });
}

// ============================================
// دالة تحليل أساسي بالكلمات المفتاحية (كحل احتياطي)
// ============================================
function basicKeywordAnalysis(text) {
  const textLower = text.toLowerCase();
  
  // تحديد مستوى التهديد
  let threatLevel = 'منخفض';
  let threatScore = 30;
  
  if (textLower.includes('غارات') || textLower.includes('قصف') || textLower.includes('هجوم') || 
      textLower.includes('ضربة') || textLower.includes('توغل')) {
    threatLevel = 'مرتفع';
    threatScore = 75;
  }
  if (textLower.includes('حرب') || textLower.includes('تصعيد') || textLower.includes('مواجهة') ||
      textLower.includes('اشتباكات') || textLower.includes('معارك')) {
    threatLevel = 'حرج';
    threatScore = 90;
  }
  if (textLower.includes('توتر') || textLower.includes('تحذير') || textLower.includes('تهديد') ||
      textLower.includes('إنذار') || textLower.includes('استنفار')) {
    threatLevel = 'متوسط';
    threatScore = 55;
  }
  
  // تحديد الموقع
  let location = 'منطقة غير محددة';
  let lat = 32.0, lng = 44.0; // وسط العراق كموقع افتراضي
  
  const locationMap = [
    { keywords: ['لبنان', 'بيروت', 'جنوب لبنان', 'الضاحية'], name: 'لبنان', lat: 33.9, lng: 35.5 },
    { keywords: ['إيران', 'طهران', 'أصفهان', 'قم', 'شيراز'], name: 'إيران', lat: 32.4, lng: 53.7 },
    { keywords: ['إسرائيل', 'تل أبيب', 'القدس', 'حيفا', 'غزة'], name: 'فلسطين/إسرائيل', lat: 31.5, lng: 34.8 },
    { keywords: ['العراق', 'بغداد', 'البصرة', 'الموصل', 'أربيل'], name: 'العراق', lat: 33.3, lng: 44.4 },
    { keywords: ['سوريا', 'دمشق', 'حلب', 'حمص', 'اللاذقية'], name: 'سوريا', lat: 34.8, lng: 39.0 },
    { keywords: ['اليمن', 'صنعاء', 'عدن', 'تعز', 'الحديدة'], name: 'اليمن', lat: 15.5, lng: 47.5 },
    { keywords: ['مصر', 'القاهرة', 'الإسكندرية', 'سيناء'], name: 'مصر', lat: 26.8, lng: 30.8 },
    { keywords: ['الأردن', 'عمان', 'إربد', 'الزرقاء'], name: 'الأردن', lat: 31.2, lng: 36.5 },
    { keywords: ['السعودية', 'الرياض', 'جدة', 'الدمام', 'مكة'], name: 'السعودية', lat: 24.7, lng: 46.7 },
    { keywords: ['الإمارات', 'دبي', 'أبوظبي', 'الشارقة'], name: 'الإمارات', lat: 24.5, lng: 54.4 },
    { keywords: ['قطر', 'الدوحة'], name: 'قطر', lat: 25.3, lng: 51.5 },
    { keywords: ['الكويت', 'مدينة الكويت'], name: 'الكويت', lat: 29.5, lng: 47.5 },
    { keywords: ['البحرين', 'المنامة'], name: 'البحرين', lat: 26.2, lng: 50.6 },
    { keywords: ['عمان', 'مسقط'], name: 'عمان', lat: 21.5, lng: 55.9 },
    { keywords: ['تركيا', 'اسطنبول', 'أنقرة', 'إزمير'], name: 'تركيا', lat: 39.0, lng: 35.0 },
  ];
  
  for (const loc of locationMap) {
    if (loc.keywords.some(k => textLower.includes(k))) {
      location = loc.name;
      lat = loc.lat;
      lng = loc.lng;
      break;
    }
  }
  
  // استخراج الأطراف المعنية
  const parties = [];
  const partyKeywords = [
    { keywords: ['إسرائيل', 'تل أبيب', 'الجيش الإسرائيلي'], name: 'إسرائيل' },
    { keywords: ['إيران', 'طهران', 'الحرس الثوري'], name: 'إيران' },
    { keywords: ['لبنان', 'بيروت', 'حزب الله'], name: 'حزب الله' },
    { keywords: ['حماس', 'غزة', 'فلسطين'], name: 'حماس' },
    { keywords: ['أمريكا', 'الولايات المتحدة', 'واشنطن', 'البنتاغون'], name: 'الولايات المتحدة' },
    { keywords: ['روسيا', 'موسكو', 'الكرملين'], name: 'روسيا' },
    { keywords: ['العراق', 'بغداد', 'الحشد الشعبي'], name: 'العراق' },
    { keywords: ['سوريا', 'دمشق', 'الأسد'], name: 'سوريا' },
    { keywords: ['مصر', 'القاهرة', 'السيسي'], name: 'مصر' },
    { keywords: ['الأردن', 'عمان', 'الملك عبدالله'], name: 'الأردن' },
    { keywords: ['السعودية', 'الرياض', 'الملك سلمان'], name: 'السعودية' },
    { keywords: ['تركيا', 'أنقرة', 'أردوغان'], name: 'تركيا' },
    { keywords: ['قطر', 'الدوحة', 'تميم'], name: 'قطر' },
    { keywords: ['الإمارات', 'أبوظبي', 'محمد بن زايد'], name: 'الإمارات' },
    { keywords: ['الكويت', 'مدينة الكويت'], name: 'الكويت' },
  ];
  
  for (const party of partyKeywords) {
    if (party.keywords.some(k => textLower.includes(k))) {
      parties.push(party.name);
    }
  }
  
  if (parties.length === 0) parties.push('أطراف محلية');
  
  // إنشاء ملخص
  const summary = `تحليل أولي للخبر: ${text.substring(0, 60)}... يشير إلى ${threatLevel === 'حرج' ? 'تصعيد خطير' : threatLevel === 'مرتفع' ? 'توتر ملحوظ' : threatLevel === 'متوسط' ? 'تطورات محدودة' : 'استقرار نسبي'} في ${location}. الأطراف الرئيسية المتوقعة: ${parties.join('، ')}.`;
  
  // سيناريوهات
  const scenarios = {
    current: `الوضع الراهن يشير إلى ${threatLevel === 'حرج' ? 'تصعيد عسكري محتمل' : threatLevel === 'مرتفع' ? 'توتر متزايد' : threatLevel === 'متوسط' ? 'ترقب وحذر' : 'هدوء نسبي'} في ${location}.`,
    best: `أفضل سيناريو: تهدئة وجهود وساطة دولية تخفف حدة التوتر خلال الأيام القادمة.`,
    worst: `أسوأ سيناريو: اتساع نطاق المواجهة وجذب أطراف إقليمية أخرى للصراع.`
  };
  
  return {
    threat_level: threatLevel,
    threat_score: threatScore,
    summary: summary,
    parties: parties,
    interests: `المصالح المتضاربة بين ${parties.join(' و ')} في ${location} تقود إلى استمرار حالة التوتر.`,
    scenarios: scenarios,
    forecast: `خلال 30 يوماً: ${threatLevel === 'حرج' ? 'احتمال تصعيد بنسبة 70%' : threatLevel === 'مرتفع' ? 'احتمال استمرار التوتر بنسبة 60%' : threatLevel === 'متوسط' ? 'احتمال تطورات جديدة بنسبة 40%' : 'احتمال هدوء نسبي بنسبة 65%'}.`,
    lat: lat,
    lng: lng,
    location_name: location
  };
}
