import { notFound } from 'next/navigation';
import { isDemo } from '@/lib/demo';
import DemoPanel from '@/components/DemoPanel';
export default function Page() { if (!isDemo()) notFound(); return <DemoPanel />; }
