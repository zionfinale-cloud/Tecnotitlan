import { useEffect } from 'react';
import { env } from '../config/runtimeEnv';

const DEFAULT_SITE_URL = 'https://www.tecnotitlan.com.mx';

export const getSiteOrigin = () => String(env('REACT_APP_SITE_URL', DEFAULT_SITE_URL) || DEFAULT_SITE_URL)
  .trim()
  .replace(/\/+$/, '');

export const absoluteUrl = (value = '', origin = getSiteOrigin()) => {
  if (!value) return `${origin}/images/logo.png`;
  try {
    return new URL(value, `${origin}/`).toString();
  } catch {
    return `${origin}/images/logo.png`;
  }
};

const setMeta = (attribute, key, content) => {
  if (!content) return;
  let element = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', String(content));
};

const setCanonical = (url) => {
  let element = document.head.querySelector('link[rel="canonical"]');
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', 'canonical');
    document.head.appendChild(element);
  }
  element.setAttribute('href', url);
};

const Seo = ({
  title,
  description,
  canonicalPath = '/',
  image,
  type = 'website',
  robots = 'index, follow',
  jsonLd = [],
}) => {
  useEffect(() => {
    const origin = getSiteOrigin();
    const canonical = absoluteUrl(canonicalPath, origin);
    const socialImage = absoluteUrl(image, origin);
    const schemas = (Array.isArray(jsonLd) ? jsonLd : [jsonLd]).filter(Boolean);

    document.documentElement.lang = 'es-MX';
    document.title = title;
    setCanonical(canonical);
    setMeta('name', 'description', description);
    setMeta('name', 'robots', robots);
    setMeta('property', 'og:locale', 'es_MX');
    setMeta('property', 'og:type', type);
    setMeta('property', 'og:site_name', 'Tecnotitlán');
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:url', canonical);
    setMeta('property', 'og:image', socialImage);
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', socialImage);

    document.head.querySelectorAll('script[data-tecnotitlan-seo]').forEach((node) => node.remove());
    schemas.forEach((schema, index) => {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.dataset.tecnotitlanSeo = String(index);
      script.textContent = JSON.stringify(schema).replace(/</g, '\\u003c');
      document.head.appendChild(script);
    });

    return () => {
      document.head.querySelectorAll('script[data-tecnotitlan-seo]').forEach((node) => node.remove());
    };
  }, [canonicalPath, description, image, jsonLd, robots, title, type]);

  return null;
};

export default Seo;
