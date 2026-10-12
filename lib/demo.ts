// โหมด demo: เปิดด้วย DEMO_MODE=true เท่านั้น (ห้ามเปิดในระบบจริง เพราะข้ามการยืนยัน OTP)
import type { Role } from './permissions';
export const isDemo = () => process.env.DEMO_MODE === 'true';
export const DEMO_USERS: Record<Role, { email: string; name: string }> = {
  Intern: { email: 'intern@example.com', name: 'สมชาย ฝึกงาน (Demo)' },
  DVE: { email: 'dve@example.com', name: 'สมหญิง ทวิภาคี (Demo)' },
  Teacher: { email: 'teacher@example.com', name: 'อาจารย์ ใจดี (Demo)' },
  Admin: { email: 'admin@example.com', name: 'ผู้ดูแล ระบบ (Demo)' },
};
