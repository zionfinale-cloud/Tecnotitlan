import { handleIncomingMessage } from './tecatlConversationService.js';

const handleWebMessage = async ({ message, conversationId, user }) => handleIncomingMessage({
  message,
  conversationId,
  channel: 'WEB',
  customerId: user?.id,
  customerName: user?.name,
  customerEmail: user?.email,
});

export { handleWebMessage };
