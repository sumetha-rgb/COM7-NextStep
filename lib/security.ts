export function sameOrigin(req: Request) {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  try {
    const requestHost = req.headers.get('x-forwarded-host')?.split(',')[0].trim() || req.headers.get('host');
    const requestProto = req.headers.get('x-forwarded-proto')?.split(',')[0].trim() || new URL(req.url).protocol.replace(':', '');
    const expected = requestHost ? `${requestProto}://${requestHost}` : new URL(req.url).origin;
    if (new URL(origin).origin === expected) return true;

    // ใน development localhost กับ 127.0.0.1 อาจถูกใช้สลับกัน แต่ต้องเป็นพอร์ตเดียวกันเท่านั้น
    if (process.env.NODE_ENV !== 'production') {
      const actual = new URL(origin);
      const target = new URL(expected);
      const local = new Set(['localhost', '127.0.0.1', '::1']);
      return local.has(actual.hostname) && local.has(target.hostname) && actual.port === target.port;
    }
    return false;
  } catch { return false; }
}
