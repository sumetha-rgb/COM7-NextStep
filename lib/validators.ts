export const normEmail = (s: unknown) => String(s ?? '').trim().toLowerCase();
export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) && s.length <= 254;
export const normName = (s: unknown) => String(s ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
// ใช้ตรวจชื่อที่ผู้ใช้อาจพิมพ์คำนำหน้าติดหรือเว้นจากชื่อ เช่น
// "นายสมชาย สมบัติ" และ "นาย สมชาย สมบัติ" ให้ถือเป็นชื่อเดียวกัน
export const normPersonName = (s: unknown) => normName(s)
  .replace(/^(นางสาว|เด็กชาย|เด็กหญิง|อาจารย์|นาย|นาง|น\.ส\.|ด\.ช\.|ด\.ญ\.)\s*/i, '$1')
  .toLowerCase();
export const cleanPhone = (s: string) => s.replace(/[\s-]/g, '');
// เบอร์ไทย: มือถือ 0[689]xxxxxxxx หรือโทรศัพท์บ้าน 0[2-5,7]xxxxxxx
export const isThaiPhone = (s: string) => /^0(?:[689]\d{8}|[2-57]\d{7})$/.test(cleanPhone(s));

const THAI_MONTHS: Record<string, number> = {
  'ม.ค.': 1, 'มกราคม': 1, 'ก.พ.': 2, 'กุมภาพันธ์': 2, 'มี.ค.': 3, 'มีนาคม': 3,
  'เม.ย.': 4, 'เมษายน': 4, 'พ.ค.': 5, 'พฤษภาคม': 5, 'มิ.ย.': 6, 'มิถุนายน': 6,
  'ก.ค.': 7, 'กรกฎาคม': 7, 'ส.ค.': 8, 'สิงหาคม': 8, 'ก.ย.': 9, 'กันยายน': 9,
  'ต.ค.': 10, 'ตุลาคม': 10, 'พ.ย.': 11, 'พฤศจิกายน': 11, 'ธ.ค.': 12, 'ธันวาคม': 12,
};

function dateParts(value: string) {
  const raw = String(value ?? '').trim().replace(/\s+/g, '');
  if (!raw) return null;
  const iso = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(raw);
  let year: number; let month: number; let day: number;
  if (iso) {
    year = Number(iso[1]); month = Number(iso[2]); day = Number(iso[3]);
  } else {
    const parts = raw.split(/[-/]/);
    if (parts.length !== 3) return null;
    day = Number(parts[0]);
    month = THAI_MONTHS[parts[1]] ?? Number(parts[1]);
    year = Number(parts[2]);
    if (![day, month, year].every(Number.isFinite)) return null;
  }
  // ปี พ.ศ. แบบเต็ม และแบบย่อ เช่น 2547 หรือ 69
  if (year < 100) year += 2500;
  if (year >= 2400) year -= 543;
  return { year, month, day };
}

export function normalizeDateInput(value: string) {
  const p = dateParts(value);
  if (!p || p.year < 1900 || p.month < 1 || p.month > 12 || p.day < 1 || p.day > 31) return '';
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day));
  if (d.getUTCFullYear() !== p.year || d.getUTCMonth() !== p.month - 1 || d.getUTCDate() !== p.day) return '';
  return `${p.year.toString().padStart(4, '0')}-${p.month.toString().padStart(2, '0')}-${p.day.toString().padStart(2, '0')}`;
}

export function isValidDateInput(value: string) {
  return Boolean(normalizeDateInput(value));
}

export function isValidPastDate(value: string) {
  const normalized = normalizeDateInput(value);
  if (!normalized) return false;
  const d = new Date(normalized + 'T00:00:00Z');
  return d.getTime() <= Date.now() && d.getUTCFullYear() >= 1900;
}
export const maskPhone = (p: string) => (p.length >= 5 ? `${p.slice(0, 2)}x-xxx-x${p.slice(-3)}` : p ? 'xxx' : '');
export const maskBirth = (b: string) => (b ? `${normalizeDateInput(b).slice(0, 4) || b.slice(0, 4)}-xx-xx` : '');
