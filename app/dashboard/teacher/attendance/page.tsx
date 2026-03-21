'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/shared/PageHeader'
import { UserCheck, Save, Loader2 } from 'lucide-react'
import { ATTENDANCE_STATUS_AR } from '@/lib/utils'
import type { AttendanceStatus } from '@/types/database'

interface StudentRow {
  id: string
  national_id: string
  status: AttendanceStatus | ''
  users: { full_name: string }
}

export default function TeacherAttendancePage() {
  const supabase = createClient()

  const [sections, setSections] = useState<any[]>([])
  const [selectedSection, setSelectedSection] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')
  const [period, setPeriod] = useState(1)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [students, setStudents] = useState<StudentRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function loadSections() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('teacher_sections')
        .select('section_id, subject_id, sections(id,name,classes(name)), subjects(id,name)')
        .eq('teacher_id', user.id)

      setSections(data || [])
    }

    loadSections()
  }, [])

  async function loadStudents() {
    if (!selectedSection) return

    setLoading(true)

    const { data: studentList } = await supabase
      .from('students')
      .select('id, national_id, users(full_name)')
      .eq('section_id', selectedSection)
      .order('users(full_name)')

    const { data: existingAttendance } = await supabase
      .from('attendance')
      .select('student_id, status')
      .eq('section_id', selectedSection)
      .eq('subject_id', selectedSubject)
      .eq('date', date)
      .eq('period', period)

    const attendanceMap = new Map(
      existingAttendance?.map(a => [a.student_id, a.status]) || []
    )

    setStudents(
      (studentList || []).map(s => ({
        ...s,
        users: (s.users as any) || { full_name: '' },
        status: (attendanceMap.get(s.id) || 'present') as AttendanceStatus,
      }))
    )

    setLoading(false)
  }

  function setStatus(studentId: string, status: AttendanceStatus) {
    setStudents(prev =>
      prev.map(s => (s.id === studentId ? { ...s, status } : s))
    )
  }

  function markAll(status: AttendanceStatus) {
    setStudents(prev => prev.map(s => ({ ...s, status })))
  }

  async function saveAttendance() {
    if (!selectedSection || !selectedSubject || students.length === 0) return

    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()

    const records = students.map(s => ({
      student_id: s.id,
      section_id: selectedSection,
      subject_id: selectedSubject,
      date,
      period,
      status: s.status || 'present',
      recorded_by: user?.id,
    }))

    await supabase
      .from('attendance')
      .upsert(records, {
        onConflict: 'student_id,subject_id,date,period',
      })

    setSaving(false)
    setSaved(true)

    setTimeout(() => setSaved(false), 2000)
  }

  const selectedTS = sections.find(
    s => s.section_id === selectedSection && s.subject_id === selectedSubject
  )

  // الحل هنا
  const uniqueSections = Array.from(
    new Map(sections.map(s => [s.section_id, s])).values()
  )

  return (
    <div className="p-6">
      <PageHeader title="تسجيل الحضور والغياب" subtitle="سجّل حضور طلابك بسهولة" />

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">الشعبة</label>

            <select
              value={selectedSection}
              onChange={e => {
                setSelectedSection(e.target.value)
                setSelectedSubject('')
              }}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">اختر الشعبة</option>

              {uniqueSections.map(s => (
                <option key={s.section_id} value={s.section_id}>
                  {s.sections?.classes?.name} - شعبة {s.sections?.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">المادة</label>

            <select
              value={selectedSubject}
              onChange={e => setSelectedSubject(e.target.value)}
              disabled={!selectedSection}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-50"
            >
              <option value="">اختر المادة</option>

              {sections
                .filter(s => s.section_id === selectedSection)
                .map(s => (
                  <option key={s.subject_id} value={s.subject_id}>
                    {s.subjects?.name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">التاريخ</label>

            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">الحصة</label>

            <select
              value={period}
              onChange={e => setPeriod(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {[1, 2, 3, 4, 5, 6, 7].map(p => (
                <option key={p} value={p}>
                  الحصة {p}
                </option>
              ))}
            </select>
          </div>

        </div>

        <button
          onClick={loadStudents}
          disabled={!selectedSection || !selectedSubject}
          className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
        >
          تحميل الطلاب
        </button>
      </div>

      {loading && (
        <div className="flex justify-center py-10">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      )}

      {students.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-blue-600" />
              <span className="font-bold text-gray-800">
                {students.length} طالب
              </span>
            </div>

            <div className="flex gap-2">
              {Object.entries(ATTENDANCE_STATUS_AR).map(([k, v]) => (
                <button
                  key={k}
                  onClick={() => markAll(k as AttendanceStatus)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 hover:bg-gray-50"
                >
                  تحديد الكل — {v}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-gray-50">
            {students.map((s, i) => (
              <div key={s.id} className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50/50">
                <span className="text-sm text-gray-400 w-8 text-center font-mono">
                  {i + 1}
                </span>

                <div className="flex-1">
                  <p className="font-medium text-gray-800 text-sm">
                    {s.users?.full_name}
                  </p>
                  <p className="text-xs text-gray-400">{s.national_id}</p>
                </div>

                <div className="flex gap-2">
                  {(Object.entries(ATTENDANCE_STATUS_AR) as [AttendanceStatus, string][]).map(([k, v]) => (
                    <button
                      key={k}
                      onClick={() => setStatus(s.id, k)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        s.status === k
                          ? k === 'present'
                            ? 'bg-green-600 text-white'
                            : k === 'absent'
                            ? 'bg-red-600 text-white'
                            : k === 'late'
                            ? 'bg-yellow-500 text-white'
                            : 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-gray-100">
            <button
              onClick={saveAttendance}
              disabled={saving}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 text-sm transition-colors"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  جاري الحفظ...
                </>
              ) : saved ? (
                <>تم الحفظ</>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  حفظ الحضور
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
