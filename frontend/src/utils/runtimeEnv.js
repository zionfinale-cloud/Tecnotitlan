const runtimeEnv = typeof window !== 'undefined' && window.__TECNOTITLAN_ENV__
  ? window.__TECNOTITLAN_ENV__
  : {};

const getRuntimeEnv = (key) => runtimeEnv[key] || process.env[key] || '';

export const stripePublishableKey = getRuntimeEnv('REACT_APP_STRIPE_PUBLISHABLE_KEY');

export default getRuntimeEnv;
