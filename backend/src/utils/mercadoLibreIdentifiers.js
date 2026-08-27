const normalizeMercadoLibreId = (value = '') => {
  const normalized = String(value ?? '').trim().toUpperCase();

  if (!normalized || ['NULL', 'UNDEFINED', 'N/A'].includes(normalized)) {
    return null;
  }

  return normalized;
};

const isMercadoLibreItemId = (value) => /^MLM\d{7,}$/.test(normalizeMercadoLibreId(value));

const isSameMercadoLibreIdentifier = (left, right) => {
  const normalizedLeft = normalizeMercadoLibreId(left);
  const normalizedRight = normalizeMercadoLibreId(right);

  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
};

const normalizeGtin = (value) => {
  if (value === undefined) return undefined;
  if (value === null || String(value).trim() === '') return null;

  const normalized = String(value).replace(/[^0-9]/g, '');
  if (![8, 12, 13, 14].includes(normalized.length)) {
    const error = new Error('El GTIN/EAN/UPC debe tener 8, 12, 13 o 14 digitos.');
    error.statusCode = 400;
    throw error;
  }

  return normalized;
};

const isRequiredMercadoLibreAttribute = (attribute) => {
  const tags = attribute?.tags || {};
  return Boolean(tags.required || tags.catalog_required);
};

const isConditionalMercadoLibreAttribute = (attribute) =>
  Boolean(attribute?.tags?.conditional_required);

const buildMercadoLibreFamilyName = ({
  requestedFamilyName,
  brand,
  model,
  productName,
  sku,
} = {}) => {
  const explicitFamilyName = String(requestedFamilyName || '').trim();
  if (explicitFamilyName) return explicitFamilyName.slice(0, 60);

  const normalizedBrand = String(brand || '').trim();
  const normalizedModel = String(model || '').trim();
  let familyName = '';

  if (normalizedBrand && normalizedModel) {
    const brandLower = normalizedBrand.toLocaleLowerCase();
    const modelLower = normalizedModel.toLocaleLowerCase();
    const modelAlreadyIncludesBrand =
      modelLower === brandLower || modelLower.startsWith(`${brandLower} `);

    familyName = modelAlreadyIncludesBrand
      ? normalizedModel
      : `${normalizedBrand} ${normalizedModel}`;
  } else {
    familyName =
      normalizedModel ||
      normalizedBrand ||
      String(productName || sku || '').trim();
  }

  return familyName.slice(0, 60);
};

export {
  normalizeMercadoLibreId,
  isMercadoLibreItemId,
  isSameMercadoLibreIdentifier,
  buildMercadoLibreFamilyName,
  normalizeGtin,
  isRequiredMercadoLibreAttribute,
  isConditionalMercadoLibreAttribute,
};
