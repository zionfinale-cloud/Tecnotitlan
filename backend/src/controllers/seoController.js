import asyncHandler from 'express-async-handler';
import prisma from '../config/prisma.js';
import { getConfig } from '../services/configService.js';
import { buildCatalogSitemap } from '../utils/seoSitemap.js';

export const getSitemap = asyncHandler(async (req, res) => {
  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where: { isArchived: false },
      select: { sku: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.category.findMany({
      where: { products: { some: { isArchived: false } } },
      select: { slug: true, updatedAt: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const config = getConfig();
  const sitemap = buildCatalogSitemap({
    siteUrl: config.SEO_SITE_URL || config.CLIENT_URL_SECONDARY || config.CLIENT_URL_PRIMARY,
    products,
    categories,
  });

  res.set({
    'Content-Type': 'application/xml; charset=utf-8',
    'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
  });
  res.status(200).send(sitemap);
});
