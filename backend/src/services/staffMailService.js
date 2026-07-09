import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

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

const folderAliases = {
  INBOX: ['INBOX'],
  SENT: ['Sent', 'INBOX.Sent', 'Sent Messages', 'Sent Items', 'Enviados', 'INBOX.Enviados'],
  DRAFTS: ['Drafts', 'INBOX.Drafts', 'Borradores', 'INBOX.Borradores'],
  SPAM: ['Junk', 'INBOX.Junk', 'Spam', 'INBOX.Spam', 'spam', 'INBOX.spam', 'Correo no deseado', 'INBOX.Correo no deseado'],
  TRASH: ['Trash', 'INBOX.Trash', 'Deleted Messages', 'Papelera', 'INBOX.Papelera'],
};

const listMailboxes = async (client) => {
  const boxes = [];

  const mailboxList = await client.list();
  if (mailboxList?.[Symbol.asyncIterator]) {
    for await (const mailbox of mailboxList) {
      boxes.push(mailbox.path);
    }
    return boxes;
  }

  for (const mailbox of mailboxList || []) {
    boxes.push(mailbox.path);
  }

  return boxes;
};

const resolveMailbox = async (client, mailbox = 'INBOX') => {
  if (!mailbox || mailbox === 'INBOX') return 'INBOX';
  const aliases = folderAliases[mailbox] || [mailbox];
  const mailboxes = await listMailboxes(client);
  const normalized = new Map(mailboxes.map((path) => [path.toLowerCase(), path]));
  for (const alias of aliases) {
    const match = normalized.get(alias.toLowerCase());
    if (match) return match;
  }
  return aliases[0];
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
    const mailboxPath = await resolveMailbox(client, mailbox);
    const selected = await client.mailboxOpen(mailboxPath);
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
    const mailboxPath = await resolveMailbox(client, mailbox);
    await client.mailboxOpen(mailboxPath);
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

const sendMessage = async ({ email, password, to, cc, bcc, subject, text, html, inReplyTo }) => {
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

  const sentAt = new Date();
  const messageId = `<${crypto.randomUUID()}@${MAIL_DOMAIN}>`;
  const mail = {
    from: `"Tecnotitlan" <${credentials.email}>`,
    to,
    cc: cc?.trim() || undefined,
    bcc: bcc?.trim() || undefined,
    subject,
    text,
    html,
    messageId,
    date: sentAt,
    inReplyTo: inReplyTo || undefined,
    references: inReplyTo || undefined,
  };

  const result = await transporter.sendMail(mail);

  const imapClient = await connectImap(credentials);
  try {
    const sentFolder = await resolveMailbox(imapClient, 'SENT');
    const rawMessageHeaders = [
      `From: "Tecnotitlan" <${credentials.email}>`,
      `To: ${to}`,
    ];
    if (cc?.trim()) rawMessageHeaders.push(`Cc: ${cc.trim()}`);
    if (bcc?.trim()) rawMessageHeaders.push(`Bcc: ${bcc.trim()}`);
    rawMessageHeaders.push(
      `Subject: ${subject}`,
      `Date: ${sentAt.toUTCString()}`,
      `Message-ID: ${messageId}`
    );
    if (inReplyTo) {
      rawMessageHeaders.push(`In-Reply-To: ${inReplyTo}`);
      rawMessageHeaders.push(`References: ${inReplyTo}`);
    }
    rawMessageHeaders.push(
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      '',
      text
    );

    const rawMessage = rawMessageHeaders.filter(Boolean).join('\r\n');

    await imapClient.append(sentFolder, Buffer.from(rawMessage, 'utf8'), ['\\Seen'], sentAt);
  } catch (error) {
    result.sentCopyWarning = error.message;
  } finally {
    await imapClient.logout().catch(() => {});
  }

  return result;
};

const deleteMessage = async ({ email, password, uid, mailbox }) => {
  const client = await connectImap({ email, password });
  try {
    const currentMailboxPath = await resolveMailbox(client, mailbox);
    await client.mailboxOpen(currentMailboxPath);

    // Si ya estamos en papelera, eliminar permanentemente
    if (mailbox === 'TRASH') {
      await client.messageFlagsAdd(String(uid), ['\\Deleted'], { uid: true });
      await client.expunge();
      return { success: true, deletedPermanently: true };
    }

    // De lo contrario, mover a la carpeta Trash
    const trashFolder = await resolveMailbox(client, 'TRASH');
    if (trashFolder && trashFolder !== currentMailboxPath) {
      await client.messageMove(String(uid), trashFolder, { uid: true });
      return { success: true, movedToTrash: true };
    } else {
      // Fallback: eliminar permanentemente si no hay papelera disponible
      await client.messageFlagsAdd(String(uid), ['\\Deleted'], { uid: true });
      await client.expunge();
      return { success: true, deletedPermanently: true };
    }
  } finally {
    await client.logout().catch(() => {});
  }
};

export {
  MAIL_DOMAIN,
  MAIL_HOST,
  listMessages,
  getMessage,
  sendMessage,
  deleteMessage,
  validateCredentials,
};
