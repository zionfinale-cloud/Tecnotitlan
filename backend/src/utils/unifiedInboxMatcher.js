const normalizeInboxValue = (value = '') => String(value || '').trim().toLowerCase();

const normalizeInboxPhone = (value = '') => String(value || '').replace(/\D/g, '').slice(-10);

const getOrderPhone = (order) => normalizeInboxPhone(
  order.user?.phone
  || order.shippingAddress?.phone
  || order.shippingAddress?.phoneNumber
  || order.shippingAddress?.receiver_phone
  || order.shippingAddress?.receiver_address?.receiver_phone
);

const findAutomaticInboxOrder = ({ orders, userId, email, phone }) => {
  if (userId) {
    const match = orders.find((order) => order.userId === userId);
    if (match) return { order: match, method: 'AUTO_USER', confidence: 100 };
  }

  const normalizedEmail = normalizeInboxValue(email);
  if (normalizedEmail) {
    const match = orders.find((order) => (
      normalizeInboxValue(order.user?.email || order.shippingAddress?.email) === normalizedEmail
    ));
    if (match) return { order: match, method: 'AUTO_EMAIL', confidence: 95 };
  }

  const normalizedPhone = normalizeInboxPhone(phone);
  if (normalizedPhone.length === 10) {
    const match = orders.find((order) => getOrderPhone(order) === normalizedPhone);
    if (match) return { order: match, method: 'AUTO_PHONE', confidence: 90 };
  }

  return null;
};

export { normalizeInboxValue, normalizeInboxPhone, findAutomaticInboxOrder };
