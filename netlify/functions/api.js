const axios = require('axios');
const cheerio = require('cheerio');

const SOURCE = process.env.AKWAM_BASE_URL || 'https://akwam.ss';

const client = axios.create({
  timeout: 15000,
  maxRedirects: 5,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
    'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8'
  }
});

function abs(value) {
  if (!value) return null;
  try { return new URL(value, SOURCE).href; } catch { return null; }
}

function text(value) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify(body)
  };
}

function extractItems(html) {
  const $ = cheerio.load(html);
  const out = [];
  const seen = new Set();

  $('.entry-box, .widget-body .entry-box, .col-lg-2 .entry-box').each((_, el) => {
    const a = $(el).find('.entry-title a, a').first();
    const link = abs(a.attr('href'));
    const title = text($(el).find('.entry-title a, .entry-title, h2, h3').first().text()) || text(a.text());

    if (!link || !title || seen.has(link)) return;

    const img = $(el).find('img').first();
    const poster = abs(img.attr('src') || img.attr('data-src'));
    const rating = text($(el).find('.rating, .rate').first().text()) || 'N/A';
    const category = text($(el).find('.category, .genres').first().text());
    const year = text($(el).find('.year').first().text()) || '';
    const isSeries = /\/series\/|\/season\/|مسلسل/i.test(link + ' ' + title);

    seen.add(link);
    out.push({
      id: Buffer.from(link).toString('base64url'),
      title,
      originalTitle: '',
      link,
      poster,
      banner: poster,
      rating,
      category,
      year,
      story: '',
      isSeries,
      quality: 'WEB',
      resolution: '1080p'
    });
  });

  return out;
}

exports.handler = async (event) => {
  try {
    const path = event.path
      .replace(/^\/\.netlify\/functions\/api/, '')
      .replace(/^\/api/, '') || '/';

    const q = event.queryStringParameters || {};

    if (path === '/health') {
      return response(200, { success: true, service: 'akwam-netlify-api' });
    }

    if (path === '/media') {
      const query = q.q || '';
      const type = q.type || 'movies';
      const page = q.page || '1';

      let url = `${SOURCE}/movies?page=${encodeURIComponent(page)}`;

      if (query.trim()) {
        url = `${SOURCE}/search?q=${encodeURIComponent(query.trim())}&page=${encodeURIComponent(page)}`;
      } else if (type === 'series') {
        url = `${SOURCE}/series?page=${encodeURIComponent(page)}`;
      }

      const { data } = await client.get(url);
      const items = extractItems(data);

      return response(200, {
        success: true,
        count: items.length,
        page: Number(page),
        data: items
      });
    }

    if (path === '/series-episodes') {
      const url = q.url;
      if (!url) return response(400, { success: false, message: 'رابط المسلسل مطلوب' });

      const { data } = await client.get(url);
      const $ = cheerio.load(data);
      const episodes = [];
      const seen = new Set();

      $('a[href*="/episode/"], a[href*="/watch/"]').each((_, el) => {
        const link = abs($(el).attr('href'));
        if (!link || seen.has(link)) return;

        const title = text($(el).text()) || `الحلقة ${episodes.length + 1}`;
        seen.add(link);
        episodes.push({ title, link });
      });

      return response(200, { success: true, count: episodes.length, data: episodes });
    }

    if (path === '/stream-link') {
      const url = q.url;
      if (!url) return response(400, { success: false, message: 'الرابط مطلوب' });

      const { data } = await client.get(url);
      const $ = cheerio.load(data);

      let watchUrl =
        $('a[href*="/watch/"]').first().attr('href') ||
        $('a[href*="/download/"]').first().attr('href') ||
        $('iframe').first().attr('src');

      watchUrl = abs(watchUrl);

      if (!watchUrl) {
        return response(404, { success: false, message: 'لم يتم العثور على رابط مشاهدة' });
      }

      let streamUrl = null;
      const streamLinks = [];

      try {
        const watch = await client.get(watchUrl);
        const $$ = cheerio.load(watch.data);

        $$('source').each((_, el) => {
          const url = abs($$(el).attr('src'));
          if (!url) return;
          const quality =
            $$(el).attr('label') ||
            $$(el).attr('size') ||
            $$(el).attr('data-quality') ||
            'auto';
          if (!streamLinks.some((x) => x.url === url)) {
            streamLinks.push({ quality, url });
          }
        });

        const fallback =
          $$('video source').first().attr('src') ||
          $$('video').first().attr('src') ||
          $$('iframe').first().attr('src');

        streamUrl = abs(fallback);
        if (streamUrl && !streamLinks.some((x) => x.url === streamUrl)) {
          streamLinks.push({ quality: 'auto', url: streamUrl });
        }
      } catch (e) {
        console.warn('watch extraction:', e.message);
      }

      return response(200, {
        success: true,
        streamUrl: streamUrl || streamLinks[0]?.url || watchUrl,
        streamLinks,
        sourcePage: watchUrl,
        direct: Boolean(streamUrl || streamLinks.length)
      });
    }

    return response(404, { success: false, message: 'API route not found' });
  } catch (error) {
    console.error(error);
    return response(500, {
      success: false,
      message: 'حدث خطأ في الخادم',
      error: error.message
    });
  }
};