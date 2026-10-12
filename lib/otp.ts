// โมดูล OTP เดียว: ย้ายไป Redis ได้โดยเขียน createOtp/verifyOtp ใหม่ที่ไฟล์นี้ไฟล์เดียว
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { appendRow, readTab, updateRow } from './sheets';

const TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const COOLDOWN_MS = 60 * 1000;
const emailLocks = new Map<string, Promise<void>>();

async function withEmailLock<T>(email: string, fn: () => Promise<T>): Promise<T> {
  const previous = emailLocks.get(email) || Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  emailLocks.set(email, current);
  await previous;
  try {
    return await fn();
  } finally {
    release();
    if (emailLocks.get(email) === current) emailLocks.delete(email);
  }
}

const hash = (email: string, code: string) =>
  createHmac('sha256', process.env.OTP_SECRET!).update(`${email}:${code}`).digest('hex');

export type CreateResult = { ok: true; code: string } | { ok: false; reason: 'cooldown' };
export async function createOtp(email: string): Promise<CreateResult> {
  return withEmailLock(email, async () => {
  const row = (await readTab('Otp')).find((r) => r.email === email);
  const now = Date.now();
  if (row?.lastSentAt && now - Date.parse(row.lastSentAt) < COOLDOWN_MS) return { ok: false, reason: 'cooldown' };
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const data = {
    email, codeHash: hash(email, code), expiresAt: new Date(now + TTL_MS).toISOString(),
    attempts: '0', usedAt: '', lastSentAt: new Date(now).toISOString(),
  };
  // เขียนทับแถวเดิม = รหัสเก่าเป็นโมฆะทันที
  if (row) await updateRow('Otp', row, data);
  else await appendRow('Otp', data);
  return { ok: true, code };
  });
}

export type VerifyResult = { ok: boolean; reason?: 'none' | 'used' | 'expired' | 'locked' | 'invalid' };
export async function verifyOtp(email: string, code: string): Promise<VerifyResult> {
  return withEmailLock(email, async () => {
  const row = (await readTab('Otp')).find((r) => r.email === email);
  if (!row || !row.codeHash) return { ok: false, reason: 'none' };
  if (row.usedAt) return { ok: false, reason: 'used' };
  if (Date.now() > Date.parse(row.expiresAt)) return { ok: false, reason: 'expired' };
  const attempts = Number(row.attempts || 0);
  if (attempts >= MAX_ATTEMPTS) return { ok: false, reason: 'locked' };
  if (!/^\d{6}$/.test(code)) return { ok: false, reason: 'invalid' };

  const a = Buffer.from(hash(email, code), 'hex');
  const b = Buffer.from(row.codeHash, 'hex');
  const match = a.length === b.length && timingSafeEqual(a, b);
  if (match) {
    const usedAt = new Date().toISOString();
    await updateRow('Otp', row, { usedAt });
    return { ok: true };
  }
  const next = attempts + 1;
  // ครบ 5 ครั้ง: ยกเลิกรหัสนั้น
  await updateRow('Otp', row, { attempts: String(next), usedAt: next >= MAX_ATTEMPTS ? 'cancelled' : '' });
  return { ok: false, reason: 'invalid' };
  });
}
