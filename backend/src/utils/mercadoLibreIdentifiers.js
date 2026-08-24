const normalizeMercadoLibreId = (value = '') => String(value).trim().toUpperCase();

const isMercadoLibreItemId = (value) => /^MLM\d{7,}$/.test(normalizeMercadoLibreId(value));

const isSameMercadoLibreIdentifier = (left, right) => {
  const normalizedLeft = normalizeMercadoLibreId(left);
  const normalizedRight = normalizeMercadoLibreId(right);

  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
};

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
};
