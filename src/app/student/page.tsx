'use client';
import { useEffect, useState } from 'react';

type Sheet = {
  _id: string; status: string; updatedAt: string;
  selections?: { groupNo: number | null }[];
  studentId: { studentId: string; fullName: string; yearId: { year: number }; programId: { nameTh: string } };
};

function Skeleton() {
  return (
    <div className="surface p-5 animate-pulseSoft">
      <div className="skeleton h-5 w-1/3 mb-2" />
      <div className="skeleton h-3 w-2/3 mb-1" />
      <div className="skeleton h-3 w-1/2" />
    </div>
  );
}

export default function StudentHome() {
  const [list, setList] = useState<Sheet[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { (async () => {
    try {
      const r = await fetch('/api/sheets');
      setList(await r.json());
    } finally { setLoading(false); }
  })(); }, []);

  return (
    <div className="space-y-4">
      <section className="surface p-6 bg-gradient-to-br from-brand-50 to-white animate-slideDown">
        <div className="text-xs font-medium text-brand-700 uppercase tracking-wide">นักศึกษา</div>
        <h1 className="text-xl font-semibold mt-1">ใบเทียบโอนของฉัน</h1>
        <p className="text-sm text-muted mt-1">ดูสถานะและดาวน์โหลดใบเทียบโอนรายวิชาที่อาจารย์/กรรมการได้จัดทำไว้</p>
      </section>

      {loading && <div className="space-y-3"><Skeleton /><Skeleton /></div>}

      {!loading && list.length === 0 && (
        <div className="surface p-10 text-center animate-slideUp">
          <div className="text-5xl mb-3">📄</div>
          <p className="font-medium">ยังไม่มีใบเทียบโอน</p>
          <p className="text-sm text-muted mt-1">กรุณารอการทำเทียบจากอาจารย์/กรรมการ</p>
        </div>
      )}

      {!loading && list.length > 0 && (
        <div className="grid gap-3">
          {list.map(s => {
            const transferred = new Set((s.selections || []).filter(x => x.groupNo).map(x => x.groupNo)).size;
            return (
              <div key={s._id} className="surface card-hover p-5 animate-slideUp">
                <div className="flex justify-between items-start gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{s.studentId?.fullName}</div>
                    <div className="text-xs text-muted mt-0.5">{s.studentId?.programId?.nameTh}</div>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="badge">ปี {s.studentId?.yearId?.year}</span>
                      <span className={`badge ${s.status === 'finalized' ? 'badge-success' : s.status === 'pending_review' ? 'badge-warning' : 'badge-brand'}`}>
                        {s.status === 'finalized' ? '✓ อนุมัติแล้ว' : s.status === 'pending_review' ? '⏳ รอพิจารณา' : '● ฉบับร่าง'}
                      </span>
                      {transferred > 0 && <span className="badge">เทียบโอน {transferred} วิชา</span>}
                    </div>
                    <div className="text-xs text-muted mt-2">
                      อัปเดตล่าสุด: {new Date(s.updatedAt).toLocaleString('th-TH')}
                    </div>
                  </div>
                  {s.status === 'finalized' ? (
                    <a href={`/api/sheets/${s._id}/pdf`} target="_blank" className="btn btn-primary">
                      🖨 เปิด PDF
                    </a>
                  ) : (
                    <div className="text-xs text-muted text-right">รอดำเนินการ</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
