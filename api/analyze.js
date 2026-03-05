// pages/api/analyze.js
export const config = {
  runtime: 'nodejs',
  maxDuration: 60, // نحتاج وقت أطول للتحليل
};

// تخزين مؤقت للنتائج (في الإنتاج استخدم Redis أو Upstash)
const analysisCache = new Map();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { text, jobId } = req.query;

  // ===== طلب جديد للتحليل =====
  if (req.method === 'POST') {
    const decodedText = decodeURIComponent(text || '').trim();
    if (!decodedText) {
      return res.status(400).json({ error: 'النص مطلوب' });
    }

    // إنشاء معرف فريد للوظيفة
    const newJobId = Date.now().toString(36) + Math.random().toString(36).substring(2);
    
    // تخزين حالة "قيد المعالجة"
    analysisCache.set(newJobId, { 
      status: 'processing',
      text: decodedText,
      created: Date.now()
    });

    // بدء المعالجة في الخلفية (لا ننتظرها)
    processAnalysisInBackground(newJobId, decodedText);
    
    // نعيد فوراً مع jobId
    return res.status(202).json({ 
      jobId: newJobId,
      status: 'processing',
      message: 'جاري التحليل، استخدم jobId للاستعلام عن النتيجة'
    });
  }

  // ===== استعلام عن نتيجة التحليل =====
  if (req.method === 'GET' && jobId) {
    const result = analysisCache.get(jobId);
    
    if (!result) {
      return res.status(404).json({ error: 'لم يتم العثور على الوظيفة' });
    }
    
    if (result.status === 'processing') {
      return res.status(202).json({ status: 'processing' });
    }
    
    if (result.status === 'complete') {
      return res.status(200).json(result.data);
    }
    
    return res.status(500).json({ error: 'حالة غير معروفة' });
  }

  return res.status(400).json({ error: 'طلب غير صالح' });
}

// ===== دالة المعالجة في الخلفية =====
async function processAnalysisInBackground(jobId, text) {
  console.log(`🔄 بدء تحليل خلفي للوظيفة ${jobId}`);
  
  const apiKeyGroq = process.env.GROQ_API_KEY;
  const apiKeyGemini = process.env.GEMINI_API_KEY;
  
  try {
    let analysis = null;
    
    // محاولة Groq أولاً
    if (apiKeyGroq) {
      try {
        const prompt = `حلل هذا الخبر بدقة وأعد JSON فقط:
"${text}"

{
  "threat_level": "حرج|مرتفع|متوسط|منخفض",
  "threat_score": 0-100,
  "summary": "تحليل في 3 جمل",
  "parties": ["طرف1", "طرف2"],
  "location_name": "الموقع",
  "lat": رقم,
  "lng": رقم
}`;

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${apiKeyGroq}` 
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.2,
            max_tokens: 1000,
            response_format: { type: 'json_object' }
          })
        });

        if (response.ok) {
          const data = await response.json();
          analysis = JSON.parse(data.choices[0].message.content);
          analysis._source = 'groq';
        }
      } catch (e) {
        console.error('Groq error:', e);
      }
    }
    
    // إذا فشل Groq، استخدم التحليل الأساسي
    if (!analysis) {
      analysis = basicAnalysis(text);
    }
    
    // تخزين النتيجة
    analysisCache.set(jobId, {
      status: 'complete',
      data: analysis,
      completed: Date.now()
    });
    
    console.log(`✅ اكتمل تحليل ${jobId}`);
    
    // تنظيف الذاكرة بعد 30 دقيقة
    setTimeout(() => {
      analysisCache.delete(jobId);
    }, 30 * 60 * 1000);
    
  } catch (error) {
    console.error('خطأ في المعالجة الخلفية:', error);
    analysisCache.set(jobId, {
      status: 'error',
      error: error.message
    });
  }
}

// ===== تحليل أساسي كحل احتياطي =====
function basicAnalysis(text) {
  const t = text.toLowerCase();
  
  // تحديد الموقع
  let location = 'منطقة الصراع';
  let lat = 33.5, lng = 36.3;
  
  const locationMap = {
    'لبنان|بيروت|الضاحية': { name: 'لبنان', lat: 33.9, lng: 35.5 },
    'إيران|طهران|أصفهان': { name: 'إيران', lat: 32.4, lng: 53.7 },
    'إسرائيل|تل أبيب|غزة|القدس': { name: 'فلسطين/إسرائيل', lat: 31.5, lng: 34.8 },
    'العراق|بغداد|الموصل': { name: 'العراق', lat: 33.3, lng: 44.4 },
    'سوريا|دمشق|حلب': { name: 'سوريا', lat: 34.8, lng: 39.0 },
    'اليمن|صنعاء|عدن': { name: 'اليمن', lat: 15.5, lng: 47.5 },
    'مصر|القاهرة|الإسكندرية': { name: 'مصر', lat: 26.8, lng: 30.8 },
    'السعودية|الرياض|جدة': { name: 'السعودية', lat: 24.7, lng: 46.7 },
    'الأردن|عمان': { name: 'الأردن', lat: 31.2, lng: 36.5 },
    'تركيا|اسطنبول|أنقرة': { name: 'تركيا', lat: 39.0, lng: 35.0 }
  };
  
  for (const [pattern, data] of Object.entries(locationMap)) {
    if (new RegExp(pattern).test(t)) {
      location = data.name;
      lat = data.lat;
      lng = data.lng;
      break;
    }
  }
  
  // تحديد مستوى التهديد
  let threat = 'مرتفع';
  let score = 75;
  
  if (/حرب|تصعيد|مواجهة|اشتباكات/.test(t)) {
    threat = 'حرج';
    score = 92;
  } else if (/غارات|قصف|هجوم|ضربة/.test(t)) {
    threat = 'مرتفع';
    score = 78;
  } else if (/توتر|تحذير|تهديد|إنذار/.test(t)) {
    threat = 'متوسط';
    score = 55;
  } else {
    threat = 'منخفض';
    score = 30;
  }
  
  // استخراج الأطراف
  const parties = [];
  if (/إسرائيل|تل أبيب/.test(t)) parties.push('إسرائيل');
  if (/إيران|طهران/.test(t)) parties.push('إيران');
  if (/لبنان|بيروت/.test(t)) parties.push('لبنان');
  if (/حزب الله/.test(t)) parties.push('حزب الله');
  if (/حماس|غزة/.test(t)) parties.push('حماس');
  if (/أمريكا|الولايات المتحدة|واشنطن/.test(t)) parties.push('الولايات المتحدة');
  if (/روسيا|موسكو/.test(t)) parties.push('روسيا');
  if (/تركيا|أنقرة/.test(t)) parties.push('تركيا');
  
  if (parties.length === 0) parties.push('أطراف محلية');
  
  return {
    threat_level: threat,
    threat_score: score,
    summary: `تحليل فوري: ${text.substring(0, 100)}... الأطراف الرئيسية: ${parties.join('، ')} في ${location}`,
    parties: parties,
    interests: `صراع مصالح بين ${parties.join(' و ')} في ${location}`,
    scenarios: {
      current: `الوضع الراهن في ${location} يشير إلى ${threat === 'حرج' ? 'تصعيد خطير' : 'توتر مستمر'}`,
      best: 'تهدئة عبر وساطة دولية',
      worst: 'اتساع رقعة الصراع'
    },
    forecast: 'يحتاج إلى متابعة دقيقة خلال الأيام القادمة',
    lat: lat,
    lng: lng,
    location_name: location,
    _source: 'basic'
  };
}
