const SHIPPING_KEY = 'tecnotitlan_shipping_address';
const PAYMENT_KEY = 'tecnotitlan_payment_method';

const getStoredJson = (key, fallback = null) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    localStorage.removeItem(key);
    return fallback;
  }
};

const getShippingAddress = () => getStoredJson(SHIPPING_KEY, {});
const saveShippingAddress = (address) => localStorage.setItem(SHIPPING_KEY, JSON.stringify(address));
const clearShippingAddress = () => localStorage.removeItem(SHIPPING_KEY);

const getPaymentMethod = () => localStorage.getItem(PAYMENT_KEY) || 'BANK_TRANSFER';
const savePaymentMethod = (method) => localStorage.setItem(PAYMENT_KEY, method);
const clearPaymentMethod = () => localStorage.removeItem(PAYMENT_KEY);

export {
  getShippingAddress,
  saveShippingAddress,
  clearShippingAddress,
  getPaymentMethod,
  savePaymentMethod,
  clearPaymentMethod,
};
