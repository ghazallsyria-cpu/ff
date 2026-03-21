import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StatCard from '@/components/shared/StatCard'
import PageHeader from '@/components/shared/PageHeader'
import { Users, BookOpen, GraduationCap, UserCheck, ClipboardList, FileText, MessageSquare, Bell, BarChart3, TrendingUp } from 'lucide-react'
import { formatDateTime, formatDate } from '@/lib/utils'
import Link from 'next/link'

export default async function AdminDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('users').select('role,full_name').eq('id', user.id).single()
  if (!['admin','management'].includes(profile?.role ?? '')) redirect('/login')

  const today = new Date().toISOString().split('T')[0]

  const [
    { count: totalStudents }, { count: totalTeachers },
    { count: totalSections }, { count: totalExams },
    { count: todayPresent }, { count: todayAbsent },
    { count: unreadMessages },
    { data: recentGrades }, { data: recentAnnouncements }, { data: topStudents },
  ] = await Promise.all([
    supabase.from('students').select('*',{count:'exact',head:true}),
    supabase.from('teachers').select('*',{count:'exact',head:true}),
    supabase.from('sections').select('*',{count:'exact',head:true}),
    supabase.from('exams').select('*',{count:'exact',head:true}),
    supabase.from('attendance').select('*',{count:'exact',head:true}).eq('date',today).eq('status','present'),
    supabase.from('attendance').select('*',{count:'exact',head:true}).eq('date',today).eq('status','absent'),
    supabase.from('messages').select('*',{count:'exact',head:true}).eq('is_read',false),
    supabase.from('grades').select('score,students(users(full_name)),exams(subjects(name))').order('created_at',{ascending:false}).limit(6),
    supabase.from('announcements').select('title,created_at,users(full_name)').order('created_at',{ascending:false}).limit(4),
    supabase.from('grades').select('student_id,score,students(users(full_name))').gte('score',90).order('score',{ascending:false}).limit(5),
  ])

  const attendanceRate = totalStudents ? Math.round(((todayPresent??0)/totalStudents)*100) : 0
  const avgScore = recentGrades?.length ? Math.round(recentGrades.reduce((a,g)=>a+g.score,0)/recentGrades.length) : 0

  return (
    <div className="p-6 space-y-6">
      <PageHeader title={`مرحباً، ${profile?.full_name} 👋`} subtitle={`لوحة تحكم المدير — ${formatDate(today)}`} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="الطلاب" value={totalStudents??0} icon={GraduationCap} color="blue" />
        <StatCard title="المعلمون" value={totalTeachers??0} icon={Users} color="green" />
        <StatCard title="الشعب" value={totalSections??0} icon={BookOpen} color="purple" />
        <StatCard title="رسائل جديدة" value={unreadMessages??0} icon={MessageSquare} color="red" />
      </div>
      <div className="grid grid-cols-4 gap-4">
        {[
          {l:'حاضر اليوم',v:todayPresent??0,bg:'bg-green-50',c:'text-green-600'},
          {l:'غائب اليوم',v:todayAbsent??0,bg:'bg-red-50',c:'text-red-600'},
          {l:'نسبة الحضور',v:`${attendanceRate}%`,bg:'bg-blue-50',c:'text-blue-600'},
          {l:'متوسط الدرجات',v:`${avgScore}%`,bg:'bg-purple-50',c:'text-purple-600'},
        ].map(s=>(
          <div key={s.l} className={`${s.bg} rounded-2xl p-4 text-center border border-gray-100`}>
            <p className={`text-3xl font-bold ${s.c}`}>{s.v}</p>
            <p className="text-sm text-gray-500 mt-1">{s.l}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {href:'/dashboard/admin/messages',label:'كل الرسائل',icon:MessageSquare,color:'#2563eb'},
          {href:'/dashboard/admin/exams',label:'كل الاختبارات',icon:ClipboardList,color:'#9333ea'},
          {href:'/dashboard/admin/assignments',label:'كل الواجبات',icon:FileText,color:'#ca8a04'},
          {href:'/dashboard/admin/results',label:'كل النتائج',icon:BarChart3,color:'#16a34a'},
        ].map(q=>(
          <Link key={q.href} href={q.href} className="text-white rounded-2xl p-4 flex items-center gap-3 shadow-sm hover:opacity-90 transition-opacity" style={{background:q.color}}>
            <q.icon className="w-5 h-5 opacity-80"/>
            <span className="font-semibold text-sm">{q.label}</span>
          </Link>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-purple-600"/>آخر النتائج</h2>
            <Link href="/dashboard/admin/results" className="text-xs text-blue-600">الكل</Link>
          </div>
          {recentGrades?.map((g:any)=>(
            <div key={g.id} className="flex items-center justify-between p-2.5 hover:bg-gray-50 rounded-xl">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-800 truncate">{g.students?.users?.full_name}</p>
                <p className="text-xs text-gray-400">{g.exams?.subjects?.name}</p>
              </div>
              <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${g.score>=50?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{Math.round(g.score)}%</span>
            </div>
          ))}
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-bold text-gray-800 flex items-center gap-2 mb-4"><TrendingUp className="w-5 h-5 text-green-600"/>أفضل الطلاب</h2>
          {topStudents?.map((g:any,i:number)=>(
            <div key={i} className="flex items-center gap-3 p-2.5 hover:bg-gray-50 rounded-xl">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold ${i===0?'bg-yellow-500':i===1?'bg-gray-400':'bg-blue-400'}`}>{i+1}</div>
              <p className="text-sm font-medium text-gray-800 flex-1 truncate">{g.students?.users?.full_name}</p>
              <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-lg">{Math.round(g.score)}%</span>
            </div>
          ))}
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800 flex items-center gap-2"><Bell className="w-5 h-5 text-yellow-500"/>الإعلانات</h2>
            <Link href="/dashboard/announcements" className="text-xs text-blue-600">الكل</Link>
          </div>
          {recentAnnouncements?.map((a:any)=>(
            <div key={a.id} className="p-3 bg-yellow-50 border border-yellow-100 rounded-xl mb-2">
              <p className="font-semibold text-gray-800 text-sm">{a.title}</p>
              <p className="text-xs text-gray-400 mt-1">{formatDateTime(a.created_at)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
