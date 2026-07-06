import { handleIncomingMessage } from './tecatlConversationService.js';

const handleWhatsAppMessage = async ({ message, jid, name }) => handleIncomingMessage({
  message,
  channel: 'WHATSAPP',
  externalUserId: jid,
  customerName: name,
});

export { handleWhatsAppMessage };
