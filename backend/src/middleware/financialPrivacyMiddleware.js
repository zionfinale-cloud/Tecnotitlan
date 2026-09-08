const FINANCIAL_FIELDS = new Set([
  'baseNetPrice',
  'cashIn',
  'cashOut',
  'commissionAmount',
  'commissionAtRisk',
  'commissionRate',
  'costOfGoodsSold',
  'costPrice',
  'estimatedExposure',
  'expectedNet',
  'feesEstimated',
  'fixedFee',
  'grossProfit',
  'inventoryCostAtRisk',
  'inventorySpent',
  'investedInPeriod',
  'margin',
  'netRevenue',
  'operatingExpenses',
  'profit',
  'profitMargin',
  'refundAmount30d',
  'remaining',
  'returnCost',
  'returnShippingAtRisk',
  'shippingCostEstimate',
  'shippingPrice',
  'shippingAtRisk',
  'salesRevenue',
  'spent',
  'totalCost',
  'unexpectedExpenses',
  'unitCost',
]);

const permissionName = (permission) => permission?.name || permission;

export const canViewFinancialData = (user = {}) => {
  if ((user.role?.name || user.role) === 'SUPER_ADMIN') return true;
  const permissions = user.permissions || user.role?.permissions || [];
  return permissions.map(permissionName).includes('finance:read_costs');
};

export const redactFinancialData = (value) => {
  if (Array.isArray(value)) return value.map(redactFinancialData);
  if (!value || typeof value !== 'object' || value instanceof Date || Buffer.isBuffer(value)) return value;

  return Object.entries(value).reduce((safe, [key, entry]) => {
    if (!FINANCIAL_FIELDS.has(key)) safe[key] = redactFinancialData(entry);
    return safe;
  }, {});
};

export const enforceFinancialPrivacy = (req, res, next) => {
  const sendJson = res.json.bind(res);
  res.json = (body) => sendJson(canViewFinancialData(req.user) ? body : redactFinancialData(body));
  next();
};
