'use client';
import { useEffect, useRef } from 'react';

declare global { interface Window { turnstile?: { render: (el: HTMLElement, o: Record<string, unknown>) => string; reset: (id?: string) => void } } }

export default function Turnstile({ onToken, resetKey }: { onToken: (t: string) => void; resetKey: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useRef<string>();
  useEffect(() => {
    const draw = () => {
      if (!ref.current || !window.turnstile) return;
      if (id.current) { window.turnstile.reset(id.current); onToken(''); return; }
      id.current = window.turnstile.render(ref.current, {
        sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY, callback: onToken,
        'expired-callback': () => onToken(''), 'error-callback': () => onToken(''),
      });
    };
    if (window.turnstile) draw();
    else {
      let s = document.getElementById('cf-ts') as HTMLScriptElement | null;
      if (!s) {
        s = document.createElement('script');
        s.id = 'cf-ts'; s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; s.async = true;
        document.head.appendChild(s);
      }
      s.addEventListener('load', draw);
      return () => s?.removeEventListener('load', draw);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);
  return <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
    <p className="mb-2 text-xs text-gray-600">กรุณายืนยันว่าไม่ใช่บอท</p>
    <div ref={ref} />
  </div>;
}
