const escapeXml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const normalizeSiteUrl = (value = '') => String(value || 'https://www.tecnotitlan.com.mx')
  .trim()
  .replace(/\/+$/, '');

const sitemapEntry = ({ loc, lastmod, changefreq, priority }) => [
  '  <url>',
  `    <loc>${escapeXml(loc)}</loc>`,
  lastmod ? `    <lastmod>${new Date(lastmod).toISOString()}</lastmod>` : '',
  changefreq ? `    <changefreq>${changefreq}</changefreq>` : '',
  priority ? `    <priority>${priority}</priority>` : '',
  '  </url>',
].filter(Boolean).join('\n');

export const buildCatalogSitemap = ({ siteUrl, products = [], categories = [] }) => {
  const origin = normalizeSiteUrl(siteUrl);
  const entries = [
    { loc: `${origin}/`, changefreq: 'daily', priority: '1.0' },
    { loc: `${origin}/contact`, changefreq: 'monthly', priority: '0.5' },
    { loc: `${origin}/privacy-policy`, changefreq: 'yearly', priority: '0.2' },
    { loc: `${origin}/terms-of-service`, changefreq: 'yearly', priority: '0.2' },
    ...categories.map((category) => ({
      loc: `${origin}/?category=${encodeURIComponent(category.slug)}`,
      lastmod: category.updatedAt,
      changefreq: 'weekly',
      priority: '0.7',
    })),
    ...products.map((product) => ({
      loc: `${origin}/product/${encodeURIComponent(product.sku)}`,
      lastmod: product.updatedAt,
      changefreq: 'weekly',
      priority: '0.8',
    })),
  ];

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map(sitemapEntry),
    '</urlset>',
    '',
  ].join('\n');
};

export { escapeXml, normalizeSiteUrl };
