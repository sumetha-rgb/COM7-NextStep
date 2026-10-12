'use client';
import { go } from './DemoBar';
import { ROLES, type Role } from '@/lib/permissions';
const INFO: Record<Role, [string, string]> = {
  Intern: ['นักศึกษาฝึกงาน', 'เห็นเฉพาะหน้ากฎระเบียบของนักศึกษาฝึกงาน'],
  DVE: ['นักเรียนทวิภาคี (DVE)', 'เห็นเฉพาะหน้ากฎระเบียบของนักเรียนทวิภาคี'],
  Teacher: ['อาจารย์นิเทศ', 'เห็นเฉพาะแนวปฏิบัติสำหรับอาจารย์นิเทศ'],
  Admin: ['ผู้ดูแลระบบ', 'ภาพรวม / ประวัติการแก้ไข / ดูกฎระเบียบทุกบทบาท'],
};
export default function DemoPanel() {
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-xl font-bold">โหมดสาธิต (Demo)</h1>
      <p className="mt-1 text-sm text-gray-600">เลือกมุมมองเพื่อเข้าทันทีโดยไม่ต้องใช้ OTP · สลับได้ตลอดจากแถบสีเหลืองด้านล่างของทุกหน้า</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {ROLES.map((r) => (
          <button key={r} onClick={() => go(r)} className="rounded-xl border bg-white p-4 text-left shadow-sm hover:border-blue-500">
            <p className="font-semibold">{INFO[r][0]}</p><p className="mt-1 text-sm text-gray-500">{INFO[r][1]}</p>
          </button>
        ))}
      </div>
      <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">หน้า Admin (ภาพรวม/ประวัติ) ดึงข้อมูลจาก Google Sheet จึงต้องรัน <code>npm run seed</code> ก่อน · ปิด demo โดยตั้ง DEMO_MODE=false</p>
    </main>
  );
}
