import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import nodemailer from 'nodemailer';

const MAIL_DOMAIN = 'tecnotitlan.com.mx';
const MAIL_HOST = 'mail.tecnotitlan.com.mx';

const normalizeMailbox = (email) => String(email || '').trim().toLowerCase();

const validateCredentials = ({ email, password }) => {
  const normalizedEmail = normalizeMailbox(email);
  if (!normalizedEmail || !normalizedEmail.endsWith(`@${MAIL_DOMAIN}`)) {
    throw new Error(`Usa una cuenta @${MAIL_DOMAIN}.`);
  }
  if (!password) {
    throw new Error('La contrasena del correo es obligatoria.');
  }
  return { email: normalizedEmail, password };
};

const createImapClient = ({ email, password }) => new ImapFlow({
  host: MAIL_HOST,
  port: 993,
  secure: true,
  auth: {
    user: email,
    pass: password,
  },
  logger: false,
});

const connectImap = async (credentials) => {
  const safeCredentials = validateCredentials(credentials);
  const client = createImapClient(safeCredentials);
  await client.connect();
  return client;
};

const parseAddressList = (addresses = []) => addresses
  .map((address) => ({
    name: address.name || '',
    address: address.address || '',
  }))
  .filter((address) => address.address);

const messageSummary = async (message) => {
  const parsed = await simpleParser(message.source);
  const text = parsed.text || parsed.html?.replace(/<[^>]+>/g, ' ') || '';
  return {
    uid: message.uid,
    subject: parsed.subject || '(Sin asunto)',
    from: parseAddressList(parsed.from?.value),
    to: parseAddressList(parsed.to?.value),
    date: parsed.date || message.internalDate,
    seen: Array.from(message.flags || []).includes('\\Seen'),
    hasAttachments: (parsed.attachments || []).length > 0,
    snippet: text.replace(/\s+/g, ' ').trim().slice(0, 180),
  };
};

const listMessages = async ({ email, password, mailbox = 'INBOX', limit = 20 }) => {
  const client = await connectImap({ email, password });
  let lock;
  try {
    const selected = await client.mailboxOpen(mailbox);
    if (!selected.exists) return [];

    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
    const start = Math.max(1, selected.exists - safeLimit + 1);
    const messages = [];

    for await (const message of client.fetch(`${start}:*`, {
      uid: true,
      flags: true,
      internalDate: true,
      source: true,
    })) {
      messages.push(await messageSummary(message));
    }

    return messages.sort((a, b) => new Date(b.date) - new Date(a.date));
  } finally {
    if (lock) lock.release();
    await client.logout().catch(() => {});
  }
};

const getMessage = async ({ email, password, uid, mailbox = 'INBOX' }) => {
  const client = await connectImap({ email, password });
  try {
    await client.mailboxOpen(mailbox);
    const message = await client.fetchOne(String(uid), {
      uid: true,
      flags: true,
      internalDate: true,
      source: true,
    }, { uid: true });

    if (!message) return null;
    await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true }).catch(() => {});

    const parsed = await simpleParser(message.source);
    return {
      uid: message.uid,
      subject: parsed.subject || '(Sin asunto)',
      from: parseAddressList(parsed.from?.value),
      to: parseAddressList(parsed.to?.value),
      cc: parseAddressList(parsed.cc?.value),
      date: parsed.date || message.internalDate,
      html: parsed.html || '',
      text: parsed.text || '',
      attachments: (parsed.attachments || []).map((attachment) => ({
        filename: attachment.filename,
        contentType: attachment.contentType,
        size: attachment.size,
      })),
      messageId: parsed.messageId || null,
      inReplyTo: parsed.inReplyTo || null,
    };
  } finally {
    await client.logout().catch(() => {});
  }
};

const sendMessage = async ({ email, password, to, subject, text, html, inReplyTo }) => {
  const credentials = validateCredentials({ email, password });
  if (!to?.trim() || !subject?.trim() || !text?.trim()) {
    throw new Error('Destinatario, asunto y mensaje son obligatorios.');
  }

  const transporter = nodemailer.createTransport({
    host: MAIL_HOST,
    port: 465,
    secure: true,
    auth: {
      user: credentials.email,
      pass: credentials.password,
    },
  });

  return transporter.sendMail({
    from: `"Tecnotitlan" <${credentials.email}>`,
    to,
    subject,
    text,
    html,
    inReplyTo: inReplyTo || undefined,
    references: inReplyTo || undefined,
  });
};

export {
  MAIL_DOMAIN,
  MAIL_HOST,
  listMessages,
  getMessage,
  sendMessage,
  validateCredentials,
};
