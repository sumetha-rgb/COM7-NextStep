import { google } from 'googleapis';

function encodedHeader(value: string) {
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

export async function sendOtpEmail(to: string, code: string) {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
  const from = process.env.GMAIL_FROM_EMAIL;
  if (!clientId || !clientSecret || !refreshToken || !from) throw new Error('Gmail OAuth ยังตั้งค่าไม่ครบ');

  const appUrl = (process.env.APP_URL || process.env.NEXTAUTH_URL || '').replace(/\/$/, '');
  const logoUrl = process.env.EMAIL_LOGO_URL || (appUrl ? appUrl + '/com7-logo.svg' : '');
  const logo = logoUrl
    ? `<img src="${logoUrl}" alt="COM7" width="120" style="display:block;margin:0 auto 16px;width:120px;height:auto" />`
    : '<div style="font-size:26px;font-weight:800;color:#059669;margin-bottom:16px">COM7</div>';
  const html = '<!doctype html><html lang="th"><body style="margin:0;background:#f1f5f9;padding:24px 12px;font-family:Arial,Tahoma,sans-serif;color:#172033">' +
    '<div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:28px 22px;text-align:center">' + logo +
    '<h1 style="font-size:22px;line-height:1.4;margin:0 0 10px;color:#172033">รหัสยืนยันการเข้าสู่ระบบ COM7</h1>' +
    '<p style="font-size:15px;color:#475569;margin:0 0 18px">คุณขอเข้าสู่ระบบ COM7 ด้วยอีเมลนี้</p>' +
    `<div style="margin:0 0 18px;padding:18px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px"><div style="font-size:34px;letter-spacing:8px;font-weight:800;color:#047857">${code}</div></div>` +
    '<p style="font-size:14px;color:#475569;line-height:1.7;margin:0"><b>รหัสนี้ใช้ได้ 10 นาที และใช้ได้ครั้งเดียว</b></p>' +
    '<p style="border-top:1px solid #e2e8f0;margin:20px 0 0;padding-top:16px;font-size:13px;color:#64748b;line-height:1.7">หากคุณไม่ได้เป็นผู้ขอรหัสนี้ โปรดเพิกเฉยต่ออีเมลฉบับนี้<br/><b>เพื่อความปลอดภัย ห้ามส่งต่อรหัสนี้ให้ผู้อื่น</b></p>' +
    '</div><p style="text-align:center;font-size:12px;color:#64748b;margin:14px 0 0">COM7 | ระบบยืนยันตัวตน</p></body></html>';
  const plainText = `รหัสยืนยันการเข้าสู่ระบบ COM7\n\nคุณขอเข้าสู่ระบบ COM7 ด้วยอีเมลนี้\n\nรหัสยืนยัน: ${code}\nรหัสนี้ใช้ได้ 10 นาที และใช้ได้ครั้งเดียว\n\nหากคุณไม่ได้เป็นผู้ขอรหัสนี้ โปรดเพิกเฉยต่ออีเมลฉบับนี้\nเพื่อความปลอดภัย ห้ามส่งต่อรหัสนี้ให้ผู้อื่น\n\nCOM7 | ระบบยืนยันตัวตน`;

  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });
  const gmail = google.gmail({ version: 'v1', auth });
  const message = [
    `From: ${encodedHeader(process.env.GMAIL_FROM_NAME || 'COM7 Identity Portal')} <${from}>`,
    `To: ${to}`,
    `Subject: ${encodedHeader('รหัสยืนยันการเข้าสู่ระบบ COM7')}`,
    'MIME-Version: 1.0',
    'Content-Type: multipart/alternative; boundary="COM7_OTP_BOUNDARY"',
    '',
    '--COM7_OTP_BOUNDARY',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '', Buffer.from(plainText, 'utf8').toString('base64'),
    '--COM7_OTP_BOUNDARY',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '', Buffer.from(html, 'utf8').toString('base64'),
    '--COM7_OTP_BOUNDARY--',
  ].join('\r\n');
  await gmail.users.messages.send({ userId: 'me', requestBody: { raw: Buffer.from(message, 'utf8').toString('base64url') } });
}
