'use client';
import { useState, useEffect } from 'react';

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [details, setDetails] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      loadAvailableYears();
    }
  }, [isOpen]);

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

  async function handleCopy() {
    if (!selectedYear) {
      setError('กรุณาเลือกปีต้นทาง');
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
          className="surface surface-pad max-w-lg w-full animate-slideDown"
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
                คัดลอกสาขาและรายวิชาทั้งหมดมาใช้ในปี {currentYear}
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
            {!details && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                <div className="flex items-start gap-2">
                  <span className="text-lg">⚠️</span>
                  <div className="text-xs text-amber-800">
                    <p className="font-medium mb-1">คำเตือน:</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      <li>จะคัดลอก <strong>สาขาทั้งหมด</strong> จากปีต้นทาง</li>
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
                disabled={loading || !selectedYear}
              >
                {loading ? (
                  <>
                    <span className="inline-block animate-spin mr-2">⏳</span>
                    กำลังคัดลอก...
                  </>
                ) : (
                  <>
                    <span className="mr-2">✅</span>
                    คัดลอกทั้งปี
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
