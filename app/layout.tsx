import './globals.css';
import type { Metadata, Viewport } from 'next';
export const metadata: Metadata = { title: { default: 'COM7 NextStep', template: '%s | COM7 NextStep' }, applicationName: 'COM7 NextStep', icons: { icon: '/com7-mark.svg', shortcut: '/com7-mark.svg', apple: '/com7-mark.svg' }, robots: { index: false } };
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="th"><body>{children}</body></html>;
}
