export async function sendOtpEmail(to: string, code: string) {
  const appUrl = (process.env.APP_URL || process.env.NEXTAUTH_URL || '').replace(/\/$/, '');
  const logoUrl = process.env.EMAIL_LOGO_URL || (appUrl ? appUrl + '/com7-logo.svg' : '');
  const logo = logoUrl
    ? '<img src="' + logoUrl + '" alt="COM7" width="150" style="display:block;margin:0 auto 16px;width:150px;height:auto" />'
    : '<div style="font-size:28px;font-weight:800;color:#08a575;margin-bottom:16px">COM7</div>';
  const htmlContent = '<div style="margin:0;background:#f0fdf8;padding:32px 16px;font-family:Arial,sans-serif;color:#172033">' +
    '<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:20px;padding:32px 24px;text-align:center">' +
    logo +
    '<h1 style="font-size:24px;margin:8px 0 12px">ยืนยันตัวตน</h1>' +
    '<p style="font-size:16px;color:#64748b">รหัสยืนยันตัวตนของคุณคือ</p>' +
    '<div style="margin:24px 0;padding:20px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:14px">' +
    '<div style="font-size:38px;letter-spacing:10px;font-weight:800;color:#059669">' + code + '</div></div>' +
    '<p style="font-size:14px;color:#64748b;line-height:1.7"><b>รหัสใช้ได้ภายใน 10 นาที</b><br/>และใช้ได้เพียงครั้งเดียว</p>' +
    '<p style="border-top:1px solid #e2e8f0;padding-top:18px;font-size:13px;color:#94a3b8">หากคุณไม่ได้เป็นผู้ขอรหัสนี้ กรุณาเพิกเฉยต่ออีเมลฉบับนี้<br/>ห้ามส่งต่อรหัส OTP ให้ผู้อื่น</p>' +
    '</div><p style="text-align:center;font-size:12px;color:#94a3b8">ระบบยืนยันตัวตน COM7</p></div>';

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': process.env.BREVO_API_KEY || '',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: process.env.BREVO_FROM_NAME || 'COM7 Identity Portal', email: process.env.BREVO_FROM_EMAIL },
      to: [{ email: to }],
      subject: 'รหัสยืนยันตัวตน (OTP) ของคุณ',
      htmlContent,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error('Brevo ' + res.status + ': ' + detail.slice(0, 300));
  }
}
