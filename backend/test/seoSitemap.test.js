import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCatalogSitemap } from '../src/utils/seoSitemap.js';

test('genera sitemap con productos y categorias publicas', () => {
  const xml = buildCatalogSitemap({
    siteUrl: 'https://www.tecnotitlan.com.mx/',
    categories: [{ slug: 'audio-y-video', updatedAt: '2026-09-08T12:00:00.000Z' }],
    products: [{ sku: 'AUR-001', updatedAt: '2026-09-08T13:00:00.000Z' }],
  });

  assert.match(xml, /https:\/\/www\.tecnotitlan\.com\.mx\/product\/AUR-001/);
  assert.match(xml, /\?category=audio-y-video/);
  assert.match(xml, /<lastmod>2026-09-08T13:00:00\.000Z<\/lastmod>/);
});

test('escapa caracteres reservados en URLs de categoria', () => {
  const xml = buildCatalogSitemap({
    categories: [{ slug: 'audio&video', updatedAt: new Date() }],
  });

  assert.match(xml, /audio%26video/);
  assert.doesNotMatch(xml, /audio&video/);
});
