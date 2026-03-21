export default function OfflinePage() {
  return (
    <div dir="rtl" className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="text-8xl mb-6">📡</div>
        <h1 className="text-2xl font-bold text-white mb-3">لا يوجد اتصال بالإنترنت</h1>
        <p className="text-gray-400 mb-6 leading-relaxed">
          تحقق من اتصالك بالشبكة وحاول مرة أخرى.<br />
          بعض المعلومات المحفوظة مسبقاً قد تكون متاحة.
        </p>
        <button onClick={() => window.location.reload()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors">
          إعادة المحاولة
        </button>
        <p className="text-gray-600 text-xs mt-4">مدرسة الرفعة النموذجية — الكويت</p>
      </div>
    </div>
  )
}
