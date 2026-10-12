# Security Testing Checklist

เอกสารนี้เป็น checklist ของระบบ OTP Portal โดยอ้างอิง OWASP WSTG ไม่ใช่การรับรองว่าระบบปลอดภัย 100% ก่อนเปิดใช้งานจริงควรทดสอบบน Production-like environment ด้วยข้อมูลทดสอบเท่านั้น

## Authentication และ Session

- [x] Admin ใช้ Username/Password และตรวจสอบ hash ฝั่งเซิร์ฟเวอร์
- [x] ผู้ใช้ทั่วไปต้องยืนยัน OTP ก่อนสร้าง Session
- [x] OTP หมดอายุ ใช้ซ้ำไม่ได้ และจำกัดจำนวนครั้งที่กรอกผิด
- [x] ตรวจ role ซ้ำใน Middleware, Page และ API
- [x] Logout มีการยืนยันก่อนออกจากระบบ
- [ ] ตั้ง `NEXTAUTH_SECRET`, `OTP_SECRET` และ `NEXTAUTH_URL` เป็นค่าจริงที่ปลอดภัยใน Production

## Authorization และข้อมูลส่วนบุคคล

- [x] API Admin ต้องมี role `Admin`
- [x] API โปรไฟล์ผู้ใช้ให้เข้าถึงเฉพาะผู้ใช้ที่ Login อยู่
- [x] API Admin ไม่ส่ง `passwordHash` ออกไปยัง Browser
- [x] ข้อมูล OTP ไม่ถูกส่งกลับใน Response
- [ ] ทดสอบ IDOR ด้วยบัญชีผู้ใช้ 2 บัญชีและยืนยันว่าไม่สามารถอ่านข้อมูลกันได้

## Input, API และ CSRF

- [x] ตรวจรูปแบบ Email, ชื่อ, เบอร์โทร, Username และ Password ฝั่งเซิร์ฟเวอร์
- [x] ตรวจ Origin สำหรับคำขอเปลี่ยนข้อมูลและอัปโหลดไฟล์
- [x] ใช้ข้อความตอบกลับแบบกลางในขั้นตอนขอ OTP
- [ ] เพิ่ม Redis/Upstash สำหรับ Rate Limit เมื่อมีหลาย Instance

## File Upload

- [x] อัปโหลดผ่าน Server-side API ที่ต้องมี Session
- [x] รับเฉพาะไฟล์ชนิดรูปภาพและจำกัดขนาด 2 MB
- [x] เก็บไฟล์ใน Cloudinary ไม่เก็บ Base64 ใน Google Sheet
- [ ] ตรวจ MIME จากเนื้อไฟล์จริงและพิจารณาแปลงรูปเป็น WebP ก่อนเผยแพร่

## Headers และ Dependencies

- [x] เพิ่ม `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` และ `Permissions-Policy`
- [x] อัปเดต Next.js เป็นสาย 15 ที่มีแพตช์ความปลอดภัย
- [ ] อัปเดต `googleapis` เมื่อพร้อมทดสอบการเปลี่ยนแปลง Major version
- [ ] ตรวจ `npm audit` ก่อนทุกครั้งที่ Deploy

## Production Notes

- ห้าม Commit `.env.local`, Service Account Private Key, Resend Key หรือ Cloudinary Secret
- Admin Registration ต้องตั้ง `ADMIN_REGISTRATION_KEY` และแจกให้เฉพาะผู้ดูแลที่ได้รับอนุญาต
- Google Sheet เหมาะกับข้อมูลขนาดเล็ก/ปานกลาง แต่ OTP และ Rate Limit ควรย้ายไป Redis เมื่อมีผู้ใช้พร้อมกันจำนวนมาก
