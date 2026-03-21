'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Clock, CheckCircle, AlertCircle, Loader2, ChevronRight, ChevronLeft, Send } from 'lucide-react'

interface Option { id: string; content: string; order_index: number }
interface Question { id: string; content: string; type: string; points: number; order_index: number; question_options: Option[] }
interface Exam { id: string; title: string; duration: number; allow_backtracking: boolean; show_result_immediately: boolean; pass_score: number }

export default function TakeExamPage() {
  const router = useRouter()
  const params = useParams()
  const examId = params.id as string
  const supabase = createClient()

  const [exam, setExam] = useState<Exam | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [currentIdx, setCurrentIdx] = useState(0)
  const [timeLeft, setTimeLeft] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ score: number; passed: boolean } | null>(null)
  const [error, setError] = useState('')

  // Load exam and create attempt
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: examData, error: examErr } = await supabase
        .from('exams')
        .select('id, title, duration, settings, pass_score')
        .eq('id', examId)
        .single()

      if (examErr || !examData) { setError('الاختبار غير موجود أو غير متاح'); setLoading(false); return }

      const { data: qs } = await supabase
        .from('questions')
        .select('id, content, type, points, order_index, question_options(id, content, order_index)')
        .eq('exam_id', examId)
        .order('order_index')

      // Check existing attempt
      const { data: existingAttempt } = await supabase
        .from('exam_attempts')
        .select('id, status, score')
        .eq('exam_id', examId)
        .eq('student_id', user.id)
        .eq('status', 'ongoing')
        .single()

      let aid = existingAttempt?.id

      if (!aid) {
        const { data: newAttempt, error: attErr } = await supabase
          .from('exam_attempts')
          .insert({ exam_id: examId, student_id: user.id })
          .select('id')
          .single()

        if (attErr || !newAttempt) {
          setError('لا يمكن بدء الاختبار — تحقق من أن الاختبار في وقته وأنك لم تستنفد المحاولات')
          setLoading(false)
          return
        }
        aid = newAttempt.id
      }

      setExam({ ...examData, allow_backtracking: examData.settings?.allow_backtracking ?? true, show_result_immediately: examData.settings?.show_result_immediately ?? true })
      setQuestions(qs?.map(q => ({ ...q, question_options: (q.question_options as any[]).sort((a, b) => a.order_index - b.order_index) })) || [])
      setAttemptId(aid)
      setTimeLeft((examData.duration || 60) * 60)
      setLoading(false)
    }
    init()
  }, [examId])

  // Timer
  useEffect(() => {
    if (!attemptId || timeLeft <= 0 || result) return
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timer); submitExam(); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [attemptId, timeLeft > 0, result])

  const submitExam = useCallback(async () => {
    if (submitting || !attemptId) return
    setSubmitting(true)

    // Save all answers
    const { data: { user } } = await supabase.auth.getUser()
    const answerRecords = Object.entries(answers).map(([question_id, selected_option_id]) => ({
      attempt_id: attemptId, question_id, selected_option_id,
    }))
    if (answerRecords.length > 0) {
      await supabase.from('student_answers').upsert(answerRecords, { onConflict: 'attempt_id,question_id' })
    }

    // Auto-grade
    const { data: gradeResult } = await supabase.rpc('auto_grade_attempt', { p_attempt_id: attemptId })
    const score = gradeResult ?? 0
    const passed = score >= (exam?.pass_score ?? 50)

    if (exam?.show_result_immediately) {
      setResult({ score: Math.round(score), passed })
    } else {
      router.push('/dashboard/student/exams')
    }
    setSubmitting(false)
  }, [attemptId, answers, exam, submitting])

  async function saveAnswer(questionId: string, optionId: string) {
    setAnswers(prev => ({ ...prev, [questionId]: optionId }))
    if (attemptId) {
      await supabase.from('student_answers').upsert(
        { attempt_id: attemptId, question_id: questionId, selected_option_id: optionId },
        { onConflict: 'attempt_id,question_id' }
      )
    }
  }

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`
  const currentQ = questions[currentIdx]
  const progress = questions.length > 0 ? Math.round((Object.keys(answers).length / questions.length) * 100) : 0

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center"><Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-3" /><p className="text-gray-500">جاري تحميل الاختبار...</p></div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl p-8 text-center max-w-md shadow-sm border">
        <AlertCircle className="w-14 h-14 text-red-500 mx-auto mb-4" />
        <h2 className="font-bold text-gray-800 text-xl mb-2">تعذّر الدخول</h2>
        <p className="text-gray-500 mb-5">{error}</p>
        <button onClick={() => router.back()} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-semibold">العودة</button>
      </div>
    </div>
  )

  if (result) return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="bg-white rounded-2xl p-10 text-center max-w-md shadow-sm border">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 ${result.passed ? 'bg-green-100' : 'bg-red-100'}`}>
          {result.passed
            ? <CheckCircle className="w-10 h-10 text-green-600" />
            : <AlertCircle className="w-10 h-10 text-red-500" />}
        </div>
        <h2 className="font-bold text-gray-800 text-2xl mb-2">{result.passed ? '🎉 مبروك! ناجح' : 'للأسف.. راسب'}</h2>
        <p className="text-5xl font-black my-5" style={{ color: result.passed ? '#16a34a' : '#dc2626' }}>{result.score}%</p>
        <p className="text-gray-500 mb-6">درجة النجاح: {exam?.pass_score}%</p>
        <button onClick={() => router.push('/dashboard/student/exams')} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold">
          العودة للاختبارات
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div>
          <h1 className="font-bold text-gray-800">{exam?.title}</h1>
          <p className="text-xs text-gray-400">{Object.keys(answers).length}/{questions.length} سؤال تم الإجابة عنه</p>
        </div>
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-lg ${timeLeft < 300 ? 'bg-red-100 text-red-600' : 'bg-blue-50 text-blue-700'}`}>
            <Clock className="w-5 h-5" />{formatTime(timeLeft)}
          </div>
          <button onClick={submitExam} disabled={submitting}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-60">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            تسليم الاختبار
          </button>
        </div>
      </div>

      {/* Progress */}
      <div className="h-1.5 bg-gray-200">
        <div className="h-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
      </div>

      <div className="flex flex-1 max-w-5xl mx-auto w-full gap-5 p-6">
        {/* Question Navigator */}
        <div className="w-48 flex-shrink-0">
          <div className="bg-white rounded-2xl border border-gray-100 p-4 sticky top-24">
            <p className="text-xs font-bold text-gray-500 mb-3">الأسئلة</p>
            <div className="grid grid-cols-4 gap-1.5">
              {questions.map((q, i) => (
                <button key={q.id} onClick={() => setCurrentIdx(i)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                    i === currentIdx ? 'bg-blue-600 text-white' :
                    answers[q.id] ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}>{i + 1}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Current Question */}
        {currentQ && (
          <div className="flex-1">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-start gap-3 mb-6">
                <span className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0">
                  {currentIdx + 1}
                </span>
                <div className="flex-1">
                  <p className="font-semibold text-gray-800 text-lg leading-relaxed">{currentQ.content}</p>
                  <p className="text-xs text-gray-400 mt-1">{currentQ.points} {currentQ.points === 1 ? 'درجة' : 'درجات'}</p>
                </div>
              </div>

              {currentQ.type === 'essay' ? (
                <textarea placeholder="اكتب إجابتك هنا..." rows={5}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
              ) : (
                <div className="space-y-3">
                  {currentQ.question_options.map(opt => (
                    <button key={opt.id} onClick={() => saveAnswer(currentQ.id, opt.id)}
                      className={`w-full text-right px-5 py-3.5 rounded-xl border-2 transition-all font-medium text-sm ${
                        answers[currentQ.id] === opt.id
                          ? 'border-blue-600 bg-blue-50 text-blue-800'
                          : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/30 text-gray-700'
                      }`}>
                      <div className="flex items-center gap-3">
                        <span className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                          answers[currentQ.id] === opt.id ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
                        }`}>
                          {answers[currentQ.id] === opt.id && <span className="w-2 h-2 bg-white rounded-full" />}
                        </span>
                        {opt.content}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex justify-between mt-8">
                <button
                  onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
                  disabled={currentIdx === 0 || !exam?.allow_backtracking}
                  className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                  <ChevronRight className="w-4 h-4" />السابق
                </button>
                {currentIdx < questions.length - 1 ? (
                  <button onClick={() => setCurrentIdx(i => i + 1)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold">
                    التالي<ChevronLeft className="w-4 h-4" />
                  </button>
                ) : (
                  <button onClick={submitExam} disabled={submitting}
                    className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold">
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    تسليم الاختبار
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
