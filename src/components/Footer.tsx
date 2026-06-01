export default function Footer() {
  return (
    <footer className="border-t border-line bg-white/95 backdrop-blur-md no-print sticky bottom-0 z-20">
      <div className="container-page py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 grid place-items-center text-white shadow-soft">
              <span className="text-sm">📋</span>
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-ink">ระบบใบเทียบโอนรายวิชา</div>
              <div className="text-[11px] text-slate-500">มหาวิทยาลัยเทคโนโลยีราชมงคลกรุงเทพ</div>
            </div>
          </div>
          <div className="text-[11px] text-slate-500 sm:text-right">
            <div>แบบฟอร์ม สวท. 12-05 · © {new Date().getFullYear()} RMUTK</div>
          </div>
        </div>
      </div>
    </footer>
  );
}
