'use client';
import { useState, useEffect } from 'react';

type Year = {
  _id: string;
  year: number;
  programId: string;
  program?: {
    nameTh: string;
  };
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  currentYearId: string;
  currentYear: number;
  onSuccess: () => void;
};

export default function CopyCoursesModal({
  isOpen,
  onClose,
  currentYearId,
  currentYear,
  onSuccess,
}: Props) {
  const [years, setYears] = useState<Year[]>([]);
  const [selectedYearId, setSelectedYearId] = useState('');
  const [loading, setLoading] = useState(false);
  const [counting, setCounting] = useState(false);
  const [courseCount, setCourseCount] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadYears();
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedYearId) {
      loadCourseCount();
    } else {
      setCourseCount(null);
    }
  }, [selectedYearId]);

  async function loadYears() {
    try {
      const res = await fetch('/api/years');
      if (res.ok) {
        const data = await res.json();
        // กรองเฉพาะปีที่ไม่ใช่ปีปัจจุบัน
        const filtered = data.filter((y: Year) => y._id !== currentYearId);
        setYears(filtered);
      }
    } catch (err) {
      console.error('Error loading years:', err);
    }
  }

  async function loadCourseCount() {
    setCounting(true);
    setCourseCount(null);
    try {
      const res = await fetch(`/api/uni-courses?yearId=${selectedYearId}`);
      if (res.ok) {
        const data = await res.json();
        setCourseCount(data.length);
      }
    } catch (err) {
      console.error('Error loading course count:', err);
    } finally {
      setCounting(false);
    }
  }

  async function handleCopy() {
    if (!selectedYearId) {
      setError('กรุณาเลือกปีต้นทาง');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/uni-courses/copy-from-year', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromYearId: selectedYearId,
          toYearId: currentYearId,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        onSuccess();
        onClose();
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
          className="surface surface-pad max-w-md w-full animate-slideDown"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="text-3xl">📥</div>
            <div>
              <h2 className="text-xl font-semibold text-slate-800">
                ดึงรายวิชาจากปีก่อน
              </h2>
              <p className="text-sm text-slate-600 mt-0.5">
                คัดลอกรายวิชามาใช้ในปี {currentYear}
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
                value={selectedYearId}
                onChange={(e) => setSelectedYearId(e.target.value)}
                disabled={loading}
              >
                <option value="">-- เลือกปีการศึกษา --</option>
                {years.map((y) => (
                  <option key={y._id} value={y._id}>
                    {y.year} - {y.program?.nameTh || 'ไม่ระบุสาขา'}
                  </option>
                ))}
              </select>
            </div>

            {/* Course Count */}
            {selectedYearId && (
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-blue-700">📚 จำนวนรายวิชา:</span>
                  {counting ? (
                    <div className="skeleton h-5 w-16 rounded" />
                  ) : (
                    <span className="font-semibold text-blue-900">
                      {courseCount ?? 0} วิชา
                    </span>
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

            {/* Info */}
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <p className="text-xs text-slate-600">
                💡 <strong>หมายเหตุ:</strong> ระบบจะคัดลอกเฉพาะรายวิชาที่ยังไม่มีในปีปัจจุบัน
                รายวิชาที่ซ้ำกันจะถูกข้ามไป
              </p>
            </div>
          </div>

          {/* Actions */}
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
              disabled={loading || !selectedYearId || counting}
            >
              {loading ? (
                <>
                  <span className="inline-block animate-spin mr-2">⏳</span>
                  กำลังคัดลอก...
                </>
              ) : (
                <>
                  <span className="mr-2">✅</span>
                  คัดลอกรายวิชา
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
