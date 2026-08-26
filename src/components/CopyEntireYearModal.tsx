'use client';
import { useState, useEffect } from 'react';

type Program = {
  _id: string;
  year: number;
  programId: {
    _id: string;
    nameTh: string;
  };
  level: string;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  currentYear: number;
  onSuccess: () => void;
};

export default function CopyEntireYearModal({
  isOpen,
  onClose,
  currentYear,
  onSuccess,
}: Props) {
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedPrograms, setSelectedPrograms] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [loadingPrograms, setLoadingPrograms] = useState(false);
  const [error, setError] = useState('');
  const [details, setDetails] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      loadAvailableYears();
      setSelectedPrograms(new Set());
      setPrograms([]);
      setDetails(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedYear) {
      loadPrograms();
    } else {
      setPrograms([]);
      setSelectedPrograms(new Set());
    }
  }, [selectedYear]);

  async function loadAvailableYears() {
    try {
      const res = await fetch('/api/years');
      if (res.ok) {
        const data = await res.json();
        // ดึงปีที่ไม่ใช่ปีปัจจุบัน และไม่ซ้ำกัน
        const years = [...new Set(data.map((y: any) => y.year))]
          .filter((y) => y !== currentYear) as number[];
        setAvailableYears(years.sort((a, b) => b - a)); // เรียงจากมากไปน้อย
      }
    } catch (err) {
      console.error('Error loading years:', err);
    }
  }

  async function loadPrograms() {
    if (!selectedYear) return;
    setLoadingPrograms(true);
    try {
      const res = await fetch('/api/years');
      if (res.ok) {
        const data = await res.json();
        const yearPrograms = data.filter((y: any) => y.year === selectedYear && y.programId);
        setPrograms(yearPrograms);
        // Select all by default
        setSelectedPrograms(new Set(yearPrograms.map((p: any) => p._id)));
      }
    } catch (err) {
      console.error('Error loading programs:', err);
    } finally {
      setLoadingPrograms(false);
    }
  }

  function toggleProgram(programId: string) {
    const newSet = new Set(selectedPrograms);
    if (newSet.has(programId)) {
      newSet.delete(programId);
    } else {
      newSet.add(programId);
    }
    setSelectedPrograms(newSet);
  }

  function toggleAll() {
    if (selectedPrograms.size === programs.length) {
      setSelectedPrograms(new Set());
    } else {
      setSelectedPrograms(new Set(programs.map(p => p._id)));
    }
  }

  async function handleCopy() {
    if (!selectedYear) {
      setError('กรุณาเลือกปีต้นทาง');
      return;
    }

    if (selectedPrograms.size === 0) {
      setError('กรุณาเลือกสาขาที่ต้องการคัดลอกอย่างน้อย 1 สาขา');
      return;
    }

    setLoading(true);
    setError('');
    setDetails(null);

    try {
      const res = await fetch('/api/years/copy-entire-year', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromYear: selectedYear,
          toYear: currentYear,
          programIds: Array.from(selectedPrograms),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setDetails(data);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2000);
      } else {
        setError(data.error || 'เกิดข้อผิดพลาดในการคัดลอก');
      }
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 animate-fadeIn"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="surface surface-pad max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-slideDown"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="text-3xl">📥</div>
            <div>
              <h2 className="text-xl font-semibold text-slate-800">
                คัดลอกทั้งปีการศึกษา
              </h2>
              <p className="text-sm text-slate-600 mt-0.5">
                เลือกสาขาที่ต้องการคัดลอกมาใช้ในปี {currentYear}
              </p>
            </div>
          </div>

          {/* Content */}
          <div className="space-y-4">
            {/* Select Year */}
            <div>
              <label className="label">เลือกปีต้นทาง</label>
              <select
                className="input w-full"
                value={selectedYear || ''}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                disabled={loading || !!details}
              >
                <option value="">-- เลือกปีการศึกษา --</option>
                {availableYears.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            {/* Programs Selection */}
            {selectedYear && programs.length > 0 && !details && (
              <div className="animate-slideDown">
                <div className="flex items-center justify-between mb-3">
                  <label className="label">เลือกสาขาที่ต้องการคัดลอก</label>
                  <button
                    onClick={toggleAll}
                    className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                    disabled={loading || loadingPrograms}
                  >
                    {selectedPrograms.size === programs.length ? '❌ ยกเลิกทั้งหมด' : '✅ เลือกทั้งหมด'}
                  </button>
                </div>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  {loadingPrograms ? (
                    <div className="p-4 text-center text-sm text-slate-500">กำลังโหลด...</div>
                  ) : (
                    <div className="max-h-64 overflow-y-auto">
                      {programs.map((prog) => (
                        <label
                          key={prog._id}
                          className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-b-0"
                        >
                          <input
                            type="checkbox"
                            checked={selectedPrograms.has(prog._id)}
                            onChange={() => toggleProgram(prog._id)}
                            disabled={loading}
                            className="w-4 h-4"
                          />
                          <div className="flex-1">
                            <div className="font-medium text-sm">{prog.programId?.nameTh || 'N/A'}</div>
                            <div className="text-xs text-slate-500">ระดับ {prog.level}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  เลือกแล้ว: <strong>{selectedPrograms.size}</strong> จาก {programs.length} สาขา
                </p>
              </div>
            )}

            {/* Success Details */}
            {details && (
              <div className="p-4 rounded-lg bg-green-50 border border-green-200 animate-slideDown">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">✅</span>
                  <span className="font-semibold text-green-800">
                    {details.message}
                  </span>
                </div>
                <div className="text-sm text-green-700 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">📚 สาขาที่คัดลอก:</span>
                    <span className="font-bold">{details.copiedPrograms} สาขา</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">📖 รายวิชา:</span>
                    <span className="font-bold">{details.copiedCourses} วิชา</span>
                  </div>
                  {details.skippedPrograms > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">⏭️ ข้าม:</span>
                      <span className="font-bold">{details.skippedPrograms} สาขา (มีอยู่แล้ว)</span>
                    </div>
                  )}
                  {details.details && details.details.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-green-200">
                      <div className="font-medium mb-2">สาขาที่คัดลอก:</div>
                      <ul className="list-disc list-inside text-xs space-y-1">
                        {details.details.map((d: any, i: number) => (
                          <li key={i}>
                            {d.program} · {d.level}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Warning */}
            {!details && selectedYear && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                <div className="flex items-start gap-2">
                  <span className="text-lg">⚠️</span>
                  <div className="text-xs text-amber-800">
                    <p className="font-medium mb-1">คำเตือน:</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      <li>จะคัดลอก <strong>สาขาที่เลือก</strong> จากปีต้นทาง</li>
                      <li>จะคัดลอก <strong>รายวิชาทั้งหมด</strong> ของแต่ละสาขา</li>
                      <li>ปีปลายทาง <strong>ต้องว่างเปล่า</strong> (ยังไม่มีสาขา)</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          {!details && (
            <div className="flex items-center gap-3 mt-6">
              <button
                type="button"
                className="btn btn-cancel flex-1"
                onClick={onClose}
                disabled={loading}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                className="btn btn-primary flex-1"
                onClick={handleCopy}
                disabled={loading || !selectedYear || selectedPrograms.size === 0}
              >
                {loading ? (
                  <>
                    <span className="inline-block animate-spin mr-2">⏳</span>
                    กำลังคัดลอก...
                  </>
                ) : (
                  <>
                    <span className="mr-2">✅</span>
                    คัดลอก {selectedPrograms.size} สาขา
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
