import { NextResponse } from 'next/server';
import { listInstitutionsCached } from '@/lib/users';
export async function GET() {
  try { return NextResponse.json({ institutions: await listInstitutionsCached() }); }
  catch { return NextResponse.json({ error: 'โหลดรายชื่อสถานศึกษาไม่สำเร็จ' }, { status: 500 }); }
}
