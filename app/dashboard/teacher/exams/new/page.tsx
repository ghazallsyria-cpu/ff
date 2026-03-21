'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/shared/PageHeader'
import { Plus, Trash2, Save, Loader2, GripVertical } from 'lucide-react'

interface Option { id: string; content: string; is_correct: boolean }
interface Question {
  id: string; type: 'multiple_choice' | 'true_false' | 'essay'
  content: string; points: number; options: Option[]
}

export default function NewExamPage() {
  const router = useRouter()
  const supabase = createClient()
  const [sections, setSections] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: '', description: '', section_id: '', subject_id: '',
    duration: 60, max_attempts: 1, pass_score: 50,
    start_at: '', end_at: '',
    shuffle_questions: false, shuffle_options: false,
    show_result_immediately: true, allow_backtracking: true,
  })
  const [questions, setQuestions] = useState<Question[]>([])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('teacher_sections')
        .select('section_id, subject_id, sections(name, classes(name)), subjects(name)')
        .eq('teacher_id', user.id)
      setSections(data || [])
    }
    load()
  }, [])

  function addQuestion(type: Question['type']) {
    const newQ: Question = {
      id: crypto.randomUUID(), type, content: '', points: 1,
      options: type === 'true_false'
        ? [{ id: crypto.randomUUID(), content: 'صحيح', is_correct: true }, { id: crypto.randomUUID(), content: 'خطأ', is_correct: false }]
        : type === 'multiple_choice'
        ? [{ id: crypto.randomUUID(), content: '', is_correct: false }, { id: crypto.randomUUID(), content: '', is_correct: false }]
        : [],
    }
    setQuestions(prev => [...prev, newQ])
  }

  function updateQuestion(id: string, field: string, value: any) {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, [field]: value } : q))
  }

  function addOption(qId: string) {
    setQuestions(prev => prev.map(q => q.id === qId
      ? { ...q, options: [...q.options, { id: crypto.randomUUID(), content: '', is_correct: false }] }
      : q))
  }

  function updateOption(qId: string, optId: string, field: string, value: any) {
    setQuestions(prev => prev.map(q => q.id === qId ? {
      ...q,
      options: q.options.map(o => {
        if (field === 'is_correct' && value === true) return { ...o, is_correct: o.id === optId }
        return o.id === optId ? { ...o, [field]: value } : o
      })
    } : q))
  }

  function removeOption(qId: string, optId: string) {
    setQuestions(prev => prev.map(q => q.id === qId
      ? { ...q, options: q.options.filter(o => o.id !== optId) } : q))
  }

  function removeQuestion(id: string) {
    setQuestions(prev => prev.filter(q => q.id !== id))
  }

  async function handleSave(status: 'draft' | 'published') {
    if (!form.title || !form.section_id || !form.subject_id) {
      alert('يرجى ملء العنوان والشعبة والمادة')
      return
    }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: exam, error } = await supabase.from('exams').insert({
      teacher_id: user.id,
      title: form.title, description: form.description || null,
      section_id: form.section_id, subject_id: form.subject_id,
      duration: form.duration, max_attempts: form.max_attempts,
      pass_score: form.pass_score, status,
      start_at: form.start_at || null, end_at: form.end_at || null,
      settings: {
        shuffle_questions: form.shuffle_questions,
        shuffle_options: form.shuffle_options,
        show_result_immediately: form.show_result_immediately,
        allow_backtracking: form.allow_backtracking,
      },
    }).select().single()

    if (error || !exam) { setSaving(false); alert('حدث خطأ في الحفظ'); return }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      const { data: qRow } = await supabase.from('questions').insert({
        exam_id: exam.id, type: q.type, content: q.content,
        points: q.points, order_index: i + 1,
      }).select().single()
      if (qRow && q.options.length > 0) {
        await supabase.from('question_options').insert(
          q.options.map((o, j) => ({ question_id: qRow.id, content: o.content, is_correct: o.is_correct, order_index: j + 1 }))
        )
      }
    }
    setSaving(false)
    router.push('/dashboard/teacher/exams')
  }

  const selectedSection = sections.find(s => s.section_id === form.section_id && s.subject_id === form.subject_id)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader title="إنشاء اختبار جديد" subtitle="أضف أسئلة واختر إعدادات الاختبار" />

      {/* Basic Info */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-5">
        <h2 className="font-bold text-gray-800 mb-4">معلومات الاختبار</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">عنوان الاختبار *</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="مثال: اختبار الفصل الأول في الرياضيات" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">الشعبة *</label>
            <select value={form.section_id} onChange={e => setForm(f => ({ ...f, section_id: e.target.value, subject_id: '' }))}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">اختر الشعبة</option>
              {[...new Map(sections.map(s => [s.section_id, s])).values()].map(s => (
                <option key={s.section_id} value={s.section_id}>{s.sections?.classes?.name} - شعبة {s.sections?.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">المادة *</label>
            <select value={form.subject_id} onChange={e => setForm(f => ({ ...f, subject_id: e.target.value }))}
              disabled={!form.section_id}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50">
              <option value="">اختر المادة</option>
              {sections.filter(s => s.section_id === form.section_id).map(s => (
                <option key={s.subject_id} value={s.subject_id}>{s.subjects?.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">المدة (بالدقائق)</label>
            <input type="number" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: +e.target.value }))}
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">درجة النجاح (%)</label>
            <input type="number" value={form.pass_score} onChange={e => setForm(f => ({ ...f, pass_score: +e.target.value }))}
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ البدء</label>
            <input type="datetime-local" value={form.start_at} onChange={e => setForm(f => ({ ...f, start_at: e.target.value }))}
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ الانتهاء</label>
            <input type="datetime-local" value={form.end_at} onChange={e => setForm(f => ({ ...f, end_at: e.target.value }))}
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">وصف الاختبار</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2}
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="تعليمات أو ملاحظات للطلاب..." />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-4">
          {[
            { key: 'shuffle_questions', label: 'ترتيب الأسئلة عشوائي' },
            { key: 'shuffle_options', label: 'ترتيب الخيارات عشوائي' },
            { key: 'show_result_immediately', label: 'إظهار النتيجة فور الانتهاء' },
            { key: 'allow_backtracking', label: 'السماح بالعودة للأسئلة السابقة' },
          ].map(opt => (
            <label key={opt.key} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={(form as any)[opt.key]}
                onChange={e => setForm(f => ({ ...f, [opt.key]: e.target.checked }))}
                className="w-4 h-4 accent-blue-600" />
              <span className="text-sm text-gray-700">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Questions */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-gray-800">الأسئلة ({questions.length})</h2>
          <div className="flex gap-2">
            {[
              { type: 'multiple_choice' as const, label: '+ اختيار متعدد' },
              { type: 'true_false' as const, label: '+ صح/خطأ' },
              { type: 'essay' as const, label: '+ مقالي' },
            ].map(btn => (
              <button key={btn.type} onClick={() => addQuestion(btn.type)}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-colors">
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {questions.length === 0 && (
          <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center text-gray-400">
            <p className="font-medium">لا توجد أسئلة بعد</p>
            <p className="text-sm mt-1">اضغط على أحد الأزرار أعلاه لإضافة سؤال</p>
          </div>
        )}

        <div className="space-y-4">
          {questions.map((q, qi) => (
            <div key={q.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{qi + 1}</span>
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-lg">
                  {q.type === 'multiple_choice' ? 'اختيار متعدد' : q.type === 'true_false' ? 'صح / خطأ' : 'مقالي'}
                </span>
                <div className="flex items-center gap-1 mr-auto">
                  <input type="number" value={q.points} min={1}
                    onChange={e => updateQuestion(q.id, 'points', +e.target.value)}
                    className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-400" />
                  <span className="text-xs text-gray-400">درجة</span>
                  <button onClick={() => removeQuestion(q.id)} className="mr-2 p-1.5 text-red-400 hover:bg-red-50 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <textarea value={q.content} onChange={e => updateQuestion(q.id, 'content', e.target.value)}
                placeholder="نص السؤال..." rows={2}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none mb-3" />

              {(q.type === 'multiple_choice' || q.type === 'true_false') && (
                <div className="space-y-2">
                  {q.options.map((opt, oi) => (
                    <div key={opt.id} className="flex items-center gap-2">
                      <input type="radio" name={`correct-${q.id}`} checked={opt.is_correct}
                        onChange={() => updateOption(q.id, opt.id, 'is_correct', true)}
                        className="w-4 h-4 accent-green-600 flex-shrink-0" title="الإجابة الصحيحة" />
                      <input value={opt.content} onChange={e => updateOption(q.id, opt.id, 'content', e.target.value)}
                        disabled={q.type === 'true_false'}
                        placeholder={`الخيار ${oi + 1}`}
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:bg-gray-50" />
                      {q.type === 'multiple_choice' && q.options.length > 2 && (
                        <button onClick={() => removeOption(q.id, opt.id)} className="p-1 text-red-400 hover:bg-red-50 rounded-lg">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  {q.type === 'multiple_choice' && q.options.length < 6 && (
                    <button onClick={() => addOption(q.id)} className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1">
                      <Plus className="w-3.5 h-3.5" />إضافة خيار
                    </button>
                  )}
                </div>
              )}
              {q.type === 'essay' && (
                <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">سيكتب الطالب إجابته النصية هنا — يتم تصحيحه يدوياً</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Save Buttons */}
      <div className="flex gap-3 justify-end">
        <button onClick={() => handleSave('draft')} disabled={saving}
          className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          حفظ كمسودة
        </button>
        <button onClick={() => handleSave('published')} disabled={saving}
          className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold text-sm disabled:opacity-50 flex items-center gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          نشر الاختبار
        </button>
      </div>
    </div>
  )
}
