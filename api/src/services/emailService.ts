import { env } from '../config/env';
import { logger } from '../config/logger';
import { EmailNotificationLog } from '../models/EmailNotificationLog';
import { currentDate } from '../utils/time';

type EmailRecipient = {
  userId: string;
  email: string;
  name: string;
};

type MissingPickReminderEmailInput = {
  recipients: EmailRecipient[];
  leagueName: string;
  matchCount: number;
  dedupeKey: string;
};

type TestEmailInput = {
  to: string;
  name?: string;
};

type PasswordResetEmailInput = {
  to: string;
  name: string;
  resetUrl: string;
  expiresInMinutes: number;
};

export type EmailSendSummary = {
  attempted: number;
  sent: number;
  skippedAlreadySent: number;
  skippedQuota: number;
  skippedNotConfigured: number;
  failed: number;
};

function emptySummary(overrides: Partial<EmailSendSummary> = {}): EmailSendSummary {
  return {
    attempted: 0,
    sent: 0,
    skippedAlreadySent: 0,
    skippedQuota: 0,
    skippedNotConfigured: 0,
    failed: 0,
    ...overrides,
  };
}

function getDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getDayBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

function normalizeAppUrl(): string {
  return (env.APP_BASE_URL || 'https://app.worldporra.com').replace(/\/+$/u, '');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function firstName(name: string): string {
  return name.trim().split(/\s+/u)[0] || 'there';
}

export function isEmailConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);
}

export function getAppBaseUrl(): string {
  return normalizeAppUrl();
}

async function sendViaResend(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<string> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      ...(env.EMAIL_REPLY_TO ? { reply_to: env.EMAIL_REPLY_TO } : {}),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend send failed with ${response.status}: ${body.slice(0, 500)}`);
  }

  const body = await response.json().catch(() => ({})) as { id?: string };
  return body.id ?? '';
}

export async function sendMissingPickReminderEmails(input: MissingPickReminderEmailInput): Promise<EmailSendSummary> {
  if (input.recipients.length === 0) return emptySummary();

  if (!isEmailConfigured() || env.EMAIL_DAILY_LIMIT <= 0) {
    return emptySummary({ skippedNotConfigured: input.recipients.length });
  }

  const now = currentDate();
  const dayKey = getDayKey(now);
  const { start, end } = getDayBounds(now);
  const sentToday = await EmailNotificationLog.countDocuments({ sentAt: { $gte: start, $lt: end } });
  const remainingQuota = Math.max(0, env.EMAIL_DAILY_LIMIT - sentToday);

  const alreadySent = await EmailNotificationLog.find({
    userId: { $in: input.recipients.map((recipient) => recipient.userId) },
    type: 'missing_picks',
    dedupeKey: input.dedupeKey,
    dayKey,
  }).select('userId').lean();
  const alreadySentUserIds = new Set(alreadySent.map((entry) => String(entry.userId)));
  const unsentRecipients = input.recipients.filter((recipient) => !alreadySentUserIds.has(recipient.userId));
  const recipientsToSend = unsentRecipients.slice(0, remainingQuota);

  const summary = emptySummary({
    attempted: recipientsToSend.length,
    skippedAlreadySent: input.recipients.length - unsentRecipients.length,
    skippedQuota: Math.max(0, unsentRecipients.length - recipientsToSend.length),
  });

  const appUrl = normalizeAppUrl();

  for (const recipient of recipientsToSend) {
    const subject = `${input.leagueName}: picks reminder`;
    const plural = input.matchCount === 1 ? 'match is' : 'matches are';
    const greeting = firstName(recipient.name);
    const text = [
      `Hi ${greeting},`,
      '',
      `${input.matchCount} ${plural} locking soon in ${input.leagueName}, and you still have predictions to fill in.`,
      '',
      `Open World Porra: ${appUrl}`,
    ].join('\n');
    const html = [
      `<p>Hi ${escapeHtml(greeting)},</p>`,
      `<p><strong>${input.matchCount}</strong> ${escapeHtml(plural)} locking soon in <strong>${escapeHtml(input.leagueName)}</strong>, and you still have predictions to fill in.</p>`,
      `<p><a href="${escapeHtml(appUrl)}">Open World Porra</a></p>`,
    ].join('');

    try {
      const providerMessageId = await sendViaResend({
        to: recipient.email,
        subject,
        text,
        html,
      });
      await EmailNotificationLog.create({
        userId: recipient.userId,
        type: 'missing_picks',
        dedupeKey: input.dedupeKey,
        dayKey,
        provider: 'resend',
        providerMessageId,
        sentAt: now,
        metadata: {
          leagueName: input.leagueName,
          matchCount: input.matchCount,
        },
      });
      summary.sent += 1;
    } catch (error: any) {
      if (error?.code === 11000) {
        summary.skippedAlreadySent += 1;
      } else {
        summary.failed += 1;
        logger.error({ err: error, userId: recipient.userId }, 'Email reminder send failed');
      }
    }
  }

  return summary;
}

export async function sendTestEmail(input: TestEmailInput): Promise<{ providerMessageId: string }> {
  const appUrl = normalizeAppUrl();
  const greeting = firstName(input.name ?? '');
  const providerMessageId = await sendViaResend({
    to: input.to,
    subject: 'World Porra email test',
    text: [
      `Hi ${greeting},`,
      '',
      'This is a test email from World Porra. Email notifications are configured correctly.',
      '',
      `Open World Porra: ${appUrl}`,
    ].join('\n'),
    html: [
      `<p>Hi ${escapeHtml(greeting)},</p>`,
      '<p>This is a test email from <strong>World Porra</strong>. Email notifications are configured correctly.</p>',
      `<p><a href="${escapeHtml(appUrl)}">Open World Porra</a></p>`,
    ].join(''),
  });

  return { providerMessageId };
}

export async function sendPasswordResetEmail(input: PasswordResetEmailInput): Promise<{ providerMessageId: string | null; skipped: boolean }> {
  if (!isEmailConfigured()) {
    return { providerMessageId: null, skipped: true };
  }

  const greeting = firstName(input.name);
  const providerMessageId = await sendViaResend({
    to: input.to,
    subject: 'Reset your World Porra password',
    text: [
      `Hi ${greeting},`,
      '',
      'We received a request to reset your World Porra password.',
      '',
      `Reset your password: ${input.resetUrl}`,
      '',
      `This link expires in ${input.expiresInMinutes} minutes. If you did not request this, you can ignore this email.`,
    ].join('\n'),
    html: [
      `<p>Hi ${escapeHtml(greeting)},</p>`,
      '<p>We received a request to reset your World Porra password.</p>',
      `<p><a href="${escapeHtml(input.resetUrl)}">Reset your password</a></p>`,
      `<p>This link expires in ${input.expiresInMinutes} minutes. If you did not request this, you can ignore this email.</p>`,
    ].join(''),
  });

  return { providerMessageId, skipped: false };
}
