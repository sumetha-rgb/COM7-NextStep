# ระบบยืนยันตัวตนด้วย OTP อีเมล + แยกสิทธิ์ + หน้า Admin

Next.js 14 (App Router) · NextAuth v4 (JWT) · Google Sheets · Brevo · Cloudflare Turnstile · Vercel

## โครงสร้าง
```
middleware.ts                 ป้องกันเส้นทางตาม role (ชั้นที่ 1)
lib/permissions.ts            ตาราง role -> หน้าที่เข้าได้ / หน้าแรก (ที่เดียว)
lib/otp.ts                    createOtp / verifyOtp (โมดูลเดียว ย้ายไป Redis ได้)
lib/ratelimit.ts              rate limit (Sheets; สลับเป็น Upstash ได้ที่ไฟล์นี้)
lib/sheets.ts users.ts audit.ts brevo.ts turnstile.ts auth.ts validators.ts
content/rules.ts              เนื้อหากฎระเบียบแยกตาม role (แก้ได้ไม่ต้องแตะหน้า)
app/login                     พอร์ทัล Intern/DVE/Teacher (+ปุ่ม "สำหรับอาจารย์/นักศึกษา")
app/admin/login               พอร์ทัล Admin (อีเมล -> OTP เท่านั้น)
app/confirm                   แก้ข้อมูล + PDPA + ยืนยันตัวตน
app/rules                     หน้ากฎระเบียบของ role ตัวเอง
app/admin/(dash)              ภาพรวม / ประวัติการแก้ไข / ตัวอย่างกฎระเบียบ
app/api/...                   otp/request, auth, institutions, me, admin/users, admin/audit
scripts/seed-sheet.mjs        สร้างแท็บ หัวคอลัมน์ และข้อมูลทดสอบ
```

## ตั้งค่า
1. สร้าง Google Sheet ว่าง, สร้าง Service Account, เปิด Sheets API, แชร์ชีตให้อีเมล service account (สิทธิ์ Editor)
2. คัดลอก `.env.example` เป็น `.env.local` แล้วกรอกค่า
3. `npm install && npm run seed` (สร้างแท็บ Users, Institutions, Otp, AuditLog, **RateLimit** + ผู้ใช้ทดสอบ 4 role)
4. แก้อีเมลตัวอย่างในแท็บ Users เป็นอีเมลจริงที่รับ OTP ได้ แล้ว `npm run dev`

> ห้ามสลับลำดับคอลัมน์ในชีต (โค้ดอ้างตามลำดับ) · แท็บ `Users` มีคอลัมน์ `citizenId` สำหรับตรวจสอบเลขบัตรประชาชนของนักศึกษาก่อนส่ง OTP

### โครงสร้างข้อมูลผู้ใช้
- `Users` เก็บนักศึกษา, DVE และอาจารย์
- `DVE` เก็บข้อมูลนักเรียนระดับ ปวส. โดยระบบจะค้นหาและบันทึกข้อมูล DVE จากแท็บนี้โดยตรง
- `AdminUsers` เก็บเฉพาะผู้ดูแลระบบ โดยเก็บ `username` และ `passwordHash` แยกจากผู้ใช้ทั่วไป

### Flow เข้าสู่ระบบ
- นักศึกษา: กรอกชื่อ, นามสกุล, เลขบัตรประชาชน 13 หลัก และ Email ระบบตรวจข้อมูลทั้งชุดกับ `Users.citizenId`, `Users.fullName` และ `Users.email` ก่อนส่ง OTP
- นักเรียนระดับ ปวส. ให้กำหนดค่า `role` ใน Google Sheet เป็น `DVE` ระบบจะพาไปดูแนวปฏิบัติของ DVE หลังยืนยัน OTP
- อาจารย์: เลือกแท็บอาจารย์ แล้วกรอกชื่อและสถานศึกษา ระบบตรวจสอบกับผู้ใช้ role `Teacher` ก่อนส่ง OTP

## Environment Variables (ตั้งบน Vercel)
| ชื่อ | คำอธิบาย |
|---|---|
| BREVO_API_KEY | API key ของ Brevo |
| BREVO_SENDER_EMAIL | อีเมลผู้ส่งที่ verify แล้วใน Brevo |
| GOOGLE_SERVICE_ACCOUNT_EMAIL | client_email ของ service account |
| GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY | private_key (ใส่ \n ตามเดิมได้) |
| SHEET_ID | ID ของ Google Sheet |
| OTP_SECRET | สุ่มยาว ≥ 32 ตัวอักษร (HMAC แฮช OTP) |
| NEXTAUTH_SECRET | สุ่มยาว ≥ 32 ตัวอักษร |
| NEXTAUTH_URL | URL เว็บจริง เช่น https://your-app.vercel.app |
| TURNSTILE_SECRET | secret key ของ Cloudflare Turnstile |
| NEXT_PUBLIC_TURNSTILE_SITE_KEY | site key (public) |

สร้าง secret: `openssl rand -base64 48`
ทดสอบ Turnstile ในเครื่องใช้คีย์ทดสอบของ Cloudflare: site `1x00000000000000000000AA` / secret `1x0000000000000000000000000000000AA`

## พฤติกรรมที่ควรรู้
- OTP: 6 หลักจาก `crypto.randomInt`, เก็บเป็น HMAC-SHA256, หมดอายุ 10 นาที, ใช้ครั้งเดียว, ผิดได้ 5 ครั้ง, ขอใหม่ได้ทุก 60 วินาที (รหัสเก่าถูกเขียนทับทันที), เทียบด้วย `timingSafeEqual`
- ตอบข้อความกลางเหมือนกันทุกกรณีที่หน้าขอรหัส (รวมกรณีขอถี่เกิน 60 วินาที)
- `/login` ไม่ส่ง OTP ให้ Admin และ `/admin/login` ไม่ส่งให้ role อื่น ตรวจซ้ำตอนยืนยันใน `authorize()`
- ปุ่ม "ยืนยันตัวตน" (ผู้ใช้ทั่วไป) -> สถานะ "ยืนยันแล้ว" ทันที พร้อมบันทึก consentAt; Admin ปฏิเสธ/อนุมัติย้อนได้ภายหลัง ผู้ที่ถูก "ปฏิเสธ" จะขอ OTP ไม่ได้
- เปลี่ยน role ที่ชีต/หน้า Admin มีผลเมื่อ login ครั้งถัดไป (session 8 ชม.)
- Admin เปลี่ยนสถานะ/role ของตัวเองไม่ได้ (กัน lock out)
- ข้อมูล Admin แคช 45 วินาที, ประวัติ 30 วินาที (ล้างแคชอัตโนมัติหลังมีการเขียน)
- ข้อจำกัด Sheets: ไม่มี transaction; rate limit ผ่าน Sheets เป็นแบบประมาณและกินโควตาเขียน (~60 ครั้ง/นาที) ถ้าผู้ใช้เยอะให้สลับ `lib/ratelimit.ts` และ `lib/otp.ts` เป็น Redis

## ขั้นตอนทดสอบ
**OTP**
1. ถูก: ขอรหัส -> กรอกรหัสในอีเมล -> เข้าสู่ระบบ, ในชีต Otp แถวนั้น `usedAt` มีค่า และ `codeHash` เป็น hex 64 ตัว (ไม่ใช่เลข 6 หลัก)
2. ผิด: กรอกผิด 1 ครั้ง -> ข้อความ error, `attempts` = 1
3. ครบ 5 ครั้ง: กรอกผิด 5 ครั้ง แล้วกรอกรหัสที่ถูก -> ต้องไม่ผ่าน (`usedAt` = cancelled)
4. หมดอายุ: แก้ `expiresAt` ในชีตเป็นเวลาในอดีต -> กรอกรหัสถูกแล้วต้องไม่ผ่าน
5. ใช้ซ้ำ: login สำเร็จแล้วลองใช้รหัสเดิมอีก -> ไม่ผ่าน
6. ขอซ้ำเร็วเกินไป: กดขอใหม่ก่อน 60 วินาที (ปุ่มถูก disable; ลองยิง API ตรงก็ไม่ส่งอีเมลใหม่ และ `lastSentAt` ไม่เปลี่ยน)
7. รหัสเก่าเป็นโมฆะ: ขอรหัส A, รอครบ 60 วินาที, ขอรหัส B -> กรอก A ต้องไม่ผ่าน
8. อีเมลที่ไม่มีในระบบ -> ข้อความเหมือนอีเมลที่มี และไม่มีอีเมลส่งออก
9. Turnstile: ยิง `POST /api/otp/request` โดยไม่มี token -> 400
10. Rate limit: ขอรหัสเกิน 5 ครั้ง/10 นาที ต่ออีเมล (Admin 3) -> 429

**สิทธิ์**
1. Intern/DVE/Teacher login ที่ `/login` -> ไป `/confirm` (ถ้ายังรอตรวจสอบ) แล้วเห็นหน้า `/rules` ของ role ตัวเองเท่านั้น
2. ใส่ `/admin`, `/admin/audit`, `/api/admin/users` ขณะเป็น role อื่น -> redirect หรือ 403
3. Admin ใส่อีเมลที่ `/login` -> ไม่ได้รหัส; ผู้ใช้ทั่วไปใส่อีเมลที่ `/admin/login` -> ไม่ได้รหัส
4. Admin เข้า `/admin/rules-preview?role=DVE` ดูได้ทุกบทบาท; ไม่ล็อกอินเข้า `/admin` -> `/admin/login`
5. เปลี่ยน role ในชีตระหว่าง session อยู่ -> มีผลหลัง logout/login ใหม่

**หน้าข้อมูล + AuditLog**
1. ที่ `/confirm` แก้ชื่อ/เบอร์/วันเกิด -> แท็บ AuditLog มีแถวละฟิลด์ (editorEmail, editorRole, targetEmail, field, old/new, `self_edit`) และ `self_confirm` สำหรับสถานะ
2. ลองเบอร์ผิดรูปแบบ / วันเกิดอนาคต -> error ภาษาไทย
3. Admin กดอนุมัติ/ปฏิเสธ/เปลี่ยน role -> มีแถว `admin_update`
4. หน้า "ประวัติการแก้ไขข้อมูล": กรองตามบุคคล/ฟิลด์/ผู้แก้/ช่วงวันที่, เรียงใหม่สุดก่อน, pagination 20 แถว; ไม่มีปุ่มแก้/ลบ และ `PATCH/DELETE /api/admin/audit` ได้ 405
5. PDPA: `GET /api/me` ของผู้ใช้ทั่วไปได้เบอร์รูปแบบ `08x-xxx-x123` และวันเกิดเป็นปีเท่านั้น; Admin เห็นเต็ม

## โหมด Demo (ดูได้ทุกมุมมอง)
ตั้ง `DEMO_MODE=true` แล้วเปิด `/demo` เลือก Intern / DVE / Teacher / Admin เข้าได้ทันทีโดยไม่ใช้ OTP
และมีแถบสีเหลืองด้านล่างทุกหน้าให้สลับ role ได้ · หน้า Admin ใช้ข้อมูลจากชีต (ต้อง `npm run seed` ก่อน)
**ต้องตั้ง `DEMO_MODE=false` (หรือลบ) ก่อนใช้งานจริงเสมอ** เพราะโหมดนี้ข้ามการยืนยันตัวตน แนะนำเปิดเฉพาะ Preview environment ของ Vercel
