import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/shared/PageHeader'
import { BarChart3, UserCheck, FileText, Heart, TrendingUp, TrendingDown, Minus, Download } from 'lucide-react'

function ScoreBar({ score, max = 100, color = 'bg-blue-500' }: { score: number; max?: number; color?: string }) {
  const pct = Math.min(100, Math.round((score / max) * 100))
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-bold text-gray-700 w-10 text-right">{score}%</span>
    </div>
  )
}

export default async function ParentWeeklyReportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // احضر أبناء ولي الأمر
  const { data: children } = await supabase.from('students')
    .select('id, users(full_name), sections(name, classes(name, grade_number, stage, stream))')
    .eq('parent_id', user.id)

  if (!children?.length) {
    return (
      <div className="p-6">
        <PageHeader title="تقرير الأسبوع" subtitle="لا يوجد أبناء مرتبطون بهذا الحساب" />
      </div>
    )
  }

  // التقرير الأخير لكل ابن
  const reports = await Promise.all(children.map(async child => {
    const { data: report } = await supabase.from('weekly_parent_reports')
      .select('*').eq('student_id', child.id).order('week_start', { ascending: false }).limit(1).maybeSingle()

    // إذا لم يكن هناك تقرير، ولّد واحداً لحظياً
    if (!report) {
      const { data: newId } = await supabase.rpc('generate_weekly_report', { p_student_id: child.id })
      if (newId) {
        const { data: newReport } = await supabase.from('weekly_parent_reports').select('*').eq('id', newId).single()
        return { child, report: newReport }
      }
    }
    return { child, report }
  }))

  const weekRange = reports[0]?.report ? {
    start: new Date(reports[0].report.week_start).toLocaleDateString('ar-KW'),
    end: new Date(reports[0].report.week_end).toLocaleDateString('ar-KW'),
  } : null

  const getMoodEmoji = (avg: number) => {
    if (!avg) return '—'
    if (avg >= 4.5) return '😄'
    if (avg >= 3.5) return '🙂'
    if (avg >= 2.5) return '😐'
    if (avg >= 1.5) return '😕'
    return '😢'
  }

  const getStageLabel = (child: any) => {
    const cl = child.sections?.classes
    if (!cl) return ''
    const stage = cl.stage === 'middle' ? 'متوسط' : 'ثانوي'
    const stream = cl.stream === 'science' ? ' — علمي' : cl.stream === 'arts' ? ' — أدبي' : ''
    return `${cl.name} ${stage}${stream} — شعبة ${child.sections.name}`
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="📊 التقرير الأسبوعي"
        subtitle={weekRange ? `الأسبوع من ${weekRange.start} إلى ${weekRange.end}` : 'ملخص أداء أبنائك'}
      />

      {reports.map(({ child, report }) => {
        if (!report || !child) return null
        const att = report.attendance_summary || {}
        const grades = report.grades_summary || {}
        const assign = report.assignments_summary || {}
        const wb = report.wellbeing_summary || {}
        const attPct = att.total > 0 ? Math.round((att.present / att.total) * 100) : 0
        const avgGrade = grades.avg || 0
        const passRate = grades.count > 0 ? Math.round((grades.passed / grades.count) * 100) : 0

        return (
          <div key={child.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-5 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-2xl font-bold">
                    {(child.users as any)?.full_name?.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{(child.users as any)?.full_name}</h2>
                    <p className="text-blue-200 text-sm">{getStageLabel(child)}</p>
                  </div>
                </div>
                <div className="text-center bg-white/15 rounded-xl px-4 py-2">
                  <p className="text-2xl font-bold">{avgGrade}%</p>
                  <p className="text-blue-200 text-xs">المتوسط العام</p>
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border-b border-gray-100">
              {[
                { icon: UserCheck, label: 'الحضور', value: `${attPct}%`, sub: `${att.present || 0}/${att.total || 0} حصة`, color: attPct >= 80 ? 'text-green-600' : attPct >= 60 ? 'text-yellow-600' : 'text-red-600', bg: attPct >= 80 ? 'bg-green-50' : 'bg-red-50' },
                { icon: BarChart3, label: 'الدرجات', value: `${avgGrade}%`, sub: `${grades.passed || 0} ناجح من ${grades.count || 0}`, color: avgGrade >= 60 ? 'text-blue-600' : 'text-red-600', bg: 'bg-blue-50' },
                { icon: FileText, label: 'الواجبات', value: `${assign.submitted || 0}/${(assign.submitted || 0) + (assign.pending || 0)}`, sub: assign.overdue > 0 ? `${assign.overdue} متأخر ⚠️` : 'ممتاز ✅', color: assign.overdue > 0 ? 'text-orange-600' : 'text-green-600', bg: assign.overdue > 0 ? 'bg-orange-50' : 'bg-green-50' },
                { icon: Heart, label: 'الحالة النفسية', value: getMoodEmoji(wb.avg_mood), sub: wb.avg_mood ? `معدل ${wb.avg_mood}/5` : 'لا توجد بيانات', color: 'text-pink-600', bg: 'bg-pink-50' },
              ].map((s, i) => (
                <div key={i} className={`${s.bg} p-4 text-center ${i < 3 ? 'border-l border-gray-100' : ''}`}>
                  <s.icon className={`w-5 h-5 mx-auto mb-1.5 ${s.color}`} />
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
                </div>
              ))}
            </div>

            {/* Attendance Details */}
            <div className="p-5 border-b border-gray-100">
              <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><UserCheck className="w-4 h-4 text-blue-600" />تفاصيل الحضور</h3>
              <div className="grid grid-cols-4 gap-3 mb-3">
                {[
                  { l: 'حاضر', v: att.present || 0, c: 'text-green-600', bg: 'bg-green-50' },
                  { l: 'غائب', v: att.absent || 0, c: 'text-red-600', bg: 'bg-red-50' },
                  { l: 'متأخر', v: att.late || 0, c: 'text-yellow-600', bg: 'bg-yellow-50' },
                  { l: 'مستأذن', v: att.excused || 0, c: 'text-blue-600', bg: 'bg-blue-50' },
                ].map(s => (
                  <div key={s.l} className={`${s.bg} rounded-xl p-3 text-center`}>
                    <p className={`text-xl font-bold ${s.c}`}>{s.v}</p>
                    <p className="text-xs text-gray-500">{s.l}</p>
                  </div>
                ))}
              </div>
              <ScoreBar score={attPct} color={attPct >= 80 ? 'bg-green-500' : attPct >= 60 ? 'bg-yellow-500' : 'bg-red-500'} />
            </div>

            {/* Grades Details */}
            {grades.exams && grades.exams.length > 0 && (
              <div className="p-5 border-b border-gray-100">
                <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-purple-600" />نتائج الاختبارات هذا الأسبوع</h3>
                <div className="space-y-2">
                  {grades.exams.slice(0, 5).map((e: any, i: number) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <span className="text-sm text-gray-700">{e.title}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${e.score >= 60 ? 'bg-green-500' : 'bg-red-500'}`} style={{ width: `${e.score}%` }} />
                        </div>
                        <span className={`text-sm font-bold ${e.score >= 60 ? 'text-green-600' : 'text-red-600'}`}>{e.score}%</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${e.pass ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {e.pass ? 'ناجح' : 'راسب'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Wellbeing alert */}
            {wb.low_days >= 3 && (
              <div className="p-5 bg-pink-50 border-t border-pink-200">
                <div className="flex items-center gap-3">
                  <Heart className="w-5 h-5 text-pink-500 flex-shrink-0" />
                  <div>
                    <p className="font-bold text-pink-800 text-sm">تنبيه دعم نفسي</p>
                    <p className="text-pink-700 text-xs">أبدى ابنك حالة نفسية منخفضة {wb.low_days} أيام هذا الأسبوع. نُنصح بالحديث معه.</p>
                  </div>
                </div>
              </div>
            )}

            <div className="p-4 bg-gray-50 flex items-center justify-between">
              <p className="text-xs text-gray-400">آخر تحديث: {report.generated_at ? new Date(report.generated_at).toLocaleString('ar-KW') : '—'}</p>
              <span className="text-xs text-blue-600 font-medium">يتجدد كل أحد تلقائياً 📅</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
