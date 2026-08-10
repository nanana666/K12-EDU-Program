/**
 * 等待出题页：极简、柔和，适合小学生。
 */
export default function WaitingRoom({ student }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 bg-gradient-to-b from-emerald-50 to-white">
      <div className="flex h-28 w-28 items-center justify-center rounded-full bg-emerald-100 shadow-inner">
        <span className="h-10 w-10 animate-pulse rounded-full bg-emerald-400" />
      </div>
      <div className="text-center">
        <h1 className="text-3xl font-bold text-slate-800">
          你好，{student.name}
        </h1>
        <p className="mt-3 text-lg text-slate-500">请稍等，老师马上出题…</p>
      </div>
      <p className="rounded-full bg-white px-6 py-2 text-sm text-slate-400 shadow-sm">
        学号 {student.id}
      </p>
    </div>
  );
}
