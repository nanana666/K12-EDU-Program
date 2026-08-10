import { Link } from "react-router-dom";

/**
 * 入口选择页：进入前端后由用户自行选择教师端或学生端。
 */
export default function EntrySelect() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-10 bg-gradient-to-b from-sky-50 via-white to-white px-6">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-slate-800">K12 小学语文教育</h1>
        <p className="mt-3 text-lg text-slate-500">请选择你的身份进入</p>
      </div>

      <div className="grid w-full max-w-3xl gap-6 sm:grid-cols-2">
        <Link
          to="/teacher"
          className="group flex flex-col items-center gap-4 rounded-3xl border-2 border-brand-100 bg-white p-10 shadow-sm transition hover:-translate-y-1 hover:border-brand-400 hover:shadow-xl"
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-100 text-4xl transition group-hover:bg-brand-500 group-hover:text-white">
            🧑‍🏫
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-brand-600">教师端</p>
            <p className="mt-2 text-sm text-slate-500">
              出题、发布答题、查看统计
            </p>
          </div>
          <span className="mt-2 rounded-full bg-brand-50 px-5 py-1.5 text-sm font-medium text-brand-600 transition group-hover:bg-brand-600 group-hover:text-white">
            进入教师端
          </span>
        </Link>

        <Link
          to="/student"
          className="group flex flex-col items-center gap-4 rounded-3xl border-2 border-emerald-100 bg-white p-10 shadow-sm transition hover:-translate-y-1 hover:border-emerald-400 hover:shadow-xl"
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-4xl transition group-hover:bg-emerald-500 group-hover:text-white">
            🧒
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-emerald-600">学生端</p>
            <p className="mt-2 text-sm text-slate-500">输入学号，参与答题</p>
          </div>
          <span className="mt-2 rounded-full bg-emerald-50 px-5 py-1.5 text-sm font-medium text-emerald-600 transition group-hover:bg-emerald-600 group-hover:text-white">
            进入学生端
          </span>
        </Link>
      </div>
    </div>
  );
}
