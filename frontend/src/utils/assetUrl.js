const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const API_ORIGIN = new URL(API_BASE_URL).origin;

const FALLBACK_PRODUCT_IMAGE = 'https://placehold.co/600x450/151a1d/75f238?text=TECNOTITLAN';

const resolveAssetUrl = (value, fallback = FALLBACK_PRODUCT_IMAGE) => {
  if (!value) return fallback;
  if (/^https?:\/\//i.test(value) || value.startsWith('data:') || value.startsWith('blob:')) {
    return value;
  }
  if (value.startsWith('/uploads/')) {
    return `${API_ORIGIN}${value}`;
  }
  return value;
};

export { FALLBACK_PRODUCT_IMAGE, resolveAssetUrl };
