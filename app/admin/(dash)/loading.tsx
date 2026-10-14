export default function Loading() {
  return (
    <div className="space-y-5" role="status" aria-live="polite">
      <span className="sr-only">กำลังโหลดหน้า</span>
      <div className="h-7 w-40 animate-pulse rounded-lg bg-slate-200" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((item) => <div key={item} className="h-24 animate-pulse rounded-xl border border-slate-100 bg-slate-50" />)}
      </div>
      <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
      <div className="h-72 animate-pulse rounded-xl border border-slate-100 bg-white" />
      <p className="text-center text-sm text-slate-500">กำลังโหลดข้อมูล…</p>
    </div>
  );
}
