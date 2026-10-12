import { revalidateTag } from 'next/cache';
import { appendRows } from './sheets';
import type { Role } from './permissions';

export type AuditEntry = {
  editorEmail: string; editorRole: Role | string; targetEmail: string;
  field: 'fullName' | 'nickname' | 'institution' | 'phone' | 'birthDate' | 'startDate' | 'endDate' | 'status' | 'role';
  oldValue: string; newValue: string; action: string; note?: string;
};
// เขียนอย่างเดียว (append-only) ไม่มีฟังก์ชันแก้/ลบ
export async function writeAudit(entries: AuditEntry[]) {
  const ts = new Date().toISOString();
  await appendRows('AuditLog', entries.map((e) => ({ timestamp: ts, note: '', ...e })));
  revalidateTag('audit');
}
