const normalizeMercadoLibreId = (value = '') => String(value).trim().toUpperCase();

const isMercadoLibreItemId = (value) => /^MLM\d{7,}$/.test(normalizeMercadoLibreId(value));

const isSameMercadoLibreIdentifier = (left, right) => {
  const normalizedLeft = normalizeMercadoLibreId(left);
  const normalizedRight = normalizeMercadoLibreId(right);

  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
};

export {
  normalizeMercadoLibreId,
  isMercadoLibreItemId,
  isSameMercadoLibreIdentifier,
};
