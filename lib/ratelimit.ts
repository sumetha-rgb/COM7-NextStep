// Rate limit แบบ fixed window เก็บในแท็บ RateLimit (serverless เก็บในหน่วยความจำไม่ได้)
// หมายเหตุ: Sheets ไม่มี atomic increment จึงเป็นแบบประมาณ; ถ้าทราฟฟิกสูงให้เปลี่ยนไฟล์นี้เป็น Upstash Redis (interface เดิม)
// สำหรับเซิร์ฟเวอร์เดียว เก็บ window ในหน่วยความจำเพื่อไม่ต้องอ่าน/เขียน Sheet
// ทุกคำขอ ซึ่งลด latency ช่วงเปิดลงทะเบียนเป็นรอบ ๆ ได้มาก
const windows = new Map<string, { count: number; startedAt: number }>();

export async function rateLimit(key: string, max: number, windowSec: number): Promise<boolean> {
  const now = Date.now();
  const row = windows.get(key);
  if (!row || now - row.startedAt > windowSec * 1000) {
    windows.set(key, { count: 1, startedAt: now });
    return true;
  }
  row.count += 1;
  return row.count <= max;
}
export const clientIp = (h: Headers) => (h.get('x-forwarded-for') || '').split(',')[0].trim() || h.get('x-real-ip') || 'unknown';
