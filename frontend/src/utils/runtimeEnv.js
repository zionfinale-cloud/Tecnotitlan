import { env } from '../config/runtimeEnv';

const getRuntimeEnv = (key) => env(key);

export const stripePublishableKey = getRuntimeEnv('REACT_APP_STRIPE_PUBLISHABLE_KEY');

export default getRuntimeEnv;
