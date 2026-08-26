'use client';
import { useState, useEffect, useRef } from 'react';

type Course = {
  _id: string;
  code: string;
  nameTh: string;
  nameEn?: string;
  credits?: number;
};

type Props = {
  yearId: string;
  onSelect: (course: Course) => void;
  placeholder?: string;
};

export default function CourseSearchCombobox({ yearId, onSelect, placeholder }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Close dropdown when clicking outside
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    // Debounce search
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/uni-courses?yearId=${yearId}&search=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data);
          setShowDropdown(true);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [query, yearId]);

  function handleSelect(course: Course) {
    onSelect(course);
    setQuery('');
    setResults([]);
    setShowDropdown(false);
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-xl">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
          🔍
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim() && setShowDropdown(true)}
          placeholder={placeholder || 'ค้นหารหัสหรือชื่อวิชา...'}
          className="input w-full pl-10 pr-4"
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
            กำลังค้นหา...
          </span>
        )}
      </div>

      {showDropdown && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 surface border border-slate-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
          {results.map((course) => (
            <button
              key={course._id}
              onClick={() => handleSelect(course)}
              className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-b-0 transition"
            >
              <div className="font-medium text-sm text-slate-800">
                {course.code} - {course.nameTh}
              </div>
              {course.nameEn && (
                <div className="text-xs text-slate-500 mt-0.5">{course.nameEn}</div>
              )}
              {course.credits !== undefined && (
                <div className="text-xs text-slate-400 mt-0.5">
                  {course.credits} หน่วยกิต
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {showDropdown && !loading && query.trim() && results.length === 0 && (
        <div className="absolute z-50 w-full mt-1 surface border border-slate-200 rounded-lg shadow-lg">
          <div className="px-4 py-3 text-sm text-slate-500 text-center">
            ไม่พบรายวิชา "{query}"
          </div>
        </div>
      )}
    </div>
  );
}
