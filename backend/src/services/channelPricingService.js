const money = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

export const normalizeCommissionRate = (value) => {
  const parsed = Number(value) || 0;
  const normalized = parsed > 1 ? parsed / 100 : parsed;
  return Math.min(Math.max(normalized, 0), 0.95);
};

export const calculateChannelPrice = ({
  baseNetPrice,
  commissionRate = 0,
  fixedFee = 0,
  shippingCostEstimate = 0,
}) => {
  const targetNet = Math.max(Number(baseNetPrice) || 0, 0);
  const rate = normalizeCommissionRate(commissionRate);
  const fixedCharges =
    Math.max(Number(fixedFee) || 0, 0) +
    Math.max(Number(shippingCostEstimate) || 0, 0);
  const price = money((targetNet + fixedCharges) / (1 - rate));
  const commissionAmount = money(price * rate);
  const expectedNet = money(price - commissionAmount - fixedCharges);

  return {
    baseNetPrice: money(targetNet),
    commissionRate: rate,
    commissionAmount,
    fixedFee: money(fixedFee || 0),
    shippingCostEstimate: money(shippingCostEstimate || 0),
    price,
    expectedNet,
  };
};

export const resolveMarketplacePrice = ({ product, listing }) => {
  if (listing?.autoPrice === false && Number(listing?.price) > 0) {
    return {
      ...calculateChannelPrice({
        baseNetPrice: product.price,
        commissionRate: listing.commissionRate,
        fixedFee: listing.fixedFee,
        shippingCostEstimate: listing.shippingCostEstimate,
      }),
      price: money(listing.price),
      automatic: false,
    };
  }

  return {
    ...calculateChannelPrice({
      baseNetPrice: product.price,
      commissionRate: listing?.commissionRate,
      fixedFee: listing?.fixedFee,
      shippingCostEstimate: listing?.shippingCostEstimate,
    }),
    automatic: true,
  };
};
