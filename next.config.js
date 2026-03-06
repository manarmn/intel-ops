/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,

  // ضغط الصفحات
  compress: true,

  // إعدادات الصور (إذا أضفت صوراً مستقبلاً)
  images: {
    domains: ['server.arcgisonline.com'],
    unoptimized: true,
  },

  // headers أمنية احترافية
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // منع cache للبيانات الحية
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
          // CORS
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
          // أمان
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      // cache للملفات الثابتة فقط
      {
        source: '/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },

  // تجاهل أخطاء TypeScript في البناء (اختياري)
  typescript: {
    ignoreBuildErrors: false,
  },

  // متغيرات البيئة العامة (غير السرية فقط)
  env: {
    APP_NAME: 'INTEL-OPS PRO V3',
    APP_VERSION: '3.0.0',
  },
};

module.exports = nextConfig;
