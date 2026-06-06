export default function NoAssignedYearsScreen({ role, fullName }: { role: 'teacher' | 'committee'; fullName?: string }) {
  const roleLabel = role === 'teacher' ? 'อาจารย์' : 'กรรมการ';
  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-8 text-center shadow-sm">
        <div className="text-6xl mb-4">⚠️</div>
        <h1 className="text-2xl font-bold text-amber-900 mb-3">ยังไม่ได้รับมอบหมายปีการศึกษา</h1>
        <p className="text-amber-800 mb-2">
          สวัสดี{fullName ? ` คุณ${fullName}` : ''}
        </p>
        <p className="text-amber-800 mb-6">
          บัญชี{roleLabel}ของคุณยังไม่ได้รับมอบหมายปีการศึกษาที่รับผิดชอบ
          <br />
          จึงยังไม่สามารถเข้าใช้งานระบบได้
        </p>
        <div className="bg-white/60 border border-amber-200 rounded-lg p-4 text-left text-sm text-amber-900 mb-6">
          <div className="font-semibold mb-2">📞 ขั้นตอนถัดไป</div>
          <ul className="list-disc list-inside space-y-1">
            <li>ติดต่อผู้ดูแลระบบ (admin) เพื่อขอมอบหมายปีการศึกษาที่รับผิดชอบ</li>
            <li>เมื่อได้รับมอบหมายแล้ว กรุณา <span className="font-semibold">ออกจากระบบและเข้าสู่ระบบใหม่</span> เพื่อให้สิทธิ์มีผล</li>
          </ul>
        </div>
        <a href="/api/auth/signout?callbackUrl=/login" className="btn btn-primary">
          ออกจากระบบ
        </a>
      </div>
    </div>
  );
}
