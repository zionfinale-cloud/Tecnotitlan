import { useContext, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { SettingsContext } from '../context/SettingsContext';
import { resolveAssetUrl } from '../utils/assetUrl';
import Seo, { absoluteUrl, getSiteOrigin } from './Seo';

const INDEXABLE_PAGES = {
  '/': ['Tecnotitlán | Tecnología, gadgets y accesorios en México', 'Compra tecnología, gadgets y accesorios seleccionados, con pagos seguros, garantía y atención personalizada en México.'],
  '/contact': ['Contacto | Tecnotitlán', 'Contacta al equipo de Tecnotitlán para recibir ayuda con productos, compras, envíos, garantías y soporte.'],
  '/privacy-policy': ['Aviso de privacidad | Tecnotitlán', 'Consulta cómo Tecnotitlán protege y utiliza tus datos personales.'],
  '/aviso-de-privacidad': ['Aviso de privacidad | Tecnotitlán', 'Consulta cómo Tecnotitlán protege y utiliza tus datos personales.'],
  '/politica-de-privacidad': ['Aviso de privacidad | Tecnotitlán', 'Consulta cómo Tecnotitlán protege y utiliza tus datos personales.'],
  '/terms-of-service': ['Términos y condiciones | Tecnotitlán', 'Consulta los términos y condiciones de compra y uso de Tecnotitlán.'],
};

const RouteSeo = () => {
  const location = useLocation();
  const { settings } = useContext(SettingsContext);
  const page = INDEXABLE_PAGES[location.pathname];
  const isProduct = location.pathname.startsWith('/product/');
  const search = new URLSearchParams(location.search);
  const category = location.pathname === '/' ? search.get('category') : '';
  const pageNumber = location.pathname === '/' ? Number(search.get('page')) || 1 : 1;
  const canonicalPath = category
    ? `/?category=${encodeURIComponent(category)}${pageNumber > 1 ? `&page=${pageNumber}` : ''}`
    : location.pathname;
  const title = category
    ? `${category.replace(/-/g, ' ')} | Tecnotitlán`
    : page?.[0] || 'Área privada | Tecnotitlán';
  const description = page?.[1] || 'Contenido privado o transaccional de Tecnotitlán.';
  const origin = getSiteOrigin();
  const logo = absoluteUrl(resolveAssetUrl(settings.logoUrl || '/images/logo.png'), origin);
  const schemas = useMemo(() => location.pathname === '/' ? [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: settings.siteName || 'Tecnotitlán',
      url: `${origin}/`,
      logo,
      email: settings.contact_email || undefined,
      sameAs: [settings.social_facebook, settings.social_tiktok].filter(Boolean),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: settings.siteName || 'Tecnotitlán',
      url: `${origin}/`,
      inLanguage: 'es-MX',
    },
  ] : [], [location.pathname, logo, origin, settings]);

  return (
    <Seo
      title={title}
      description={description}
      canonicalPath={canonicalPath}
      image={logo}
      robots={page || category ? 'index, follow' : 'noindex, nofollow'}
      jsonLd={isProduct ? [] : schemas}
    />
  );
};

export default RouteSeo;
