export default function HealthPage() {
  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <section className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-widest text-blue-500">Health Check</p>
        <h1 className="mt-2 text-2xl font-black">화면 표시 테스트</h1>
        <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-600">
          이 화면이 보이면 Next 서버와 CSS는 정상이고, 홈 화면의 클라이언트 실행 또는 브라우저 캐시 쪽을 보면 됩니다.
        </p>
      </section>
    </main>
  );
}
