'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Video, CheckCircle, Clock, Play, ExternalLink, Loader2, BookOpen, Film, Eye } from 'lucide-react'

interface Session {
  id: string; status: string; session_date: string; period: number
  zoom_link: string; zoom_password?: string; started_at?: string
  subjects: { name: string }; sections: { name: string; classes: { name: string } }
  checked_in_count: number; expected_students: number
}

interface Recording {
  id: string; recording_url: string; recording_type: string
  title: string; duration_minutes?: number; created_at: string
  live_sessions: { subjects: { name: string }; session_date: string; period: number }
  recording_views: { completed: boolean }[]
}

export default function StudentLivePage() {
  const supabase = createClient()
  const [tab, setTab] = useState<'today' | 'recordings'>('today')
  const [sessions, setSessions] = useState<Session[]>([])
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [checkedIn, setCheckedIn] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState('')
  const [checkInResult, setCheckInResult] = useState<Record<string, any>>({})

  useEffect(() => {
    loadData()
    const ch = supabase.channel('student-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_sessions' }, loadData)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: student } = await supabase.from('students')
      .select('section_id').eq('id', user.id).single()
    if (!student) return

    const today = new Date().toISOString().split('T')[0]

    const [{ data: sess }, { data: recs }, { data: myCheckins }] = await Promise.all([
      supabase.from('live_sessions')
        .select('*, subjects(name), sections(name, classes(name))')
        .eq('session_date', today)
        .eq('section_id', student.section_id)
        .neq('status', 'cancelled')
        .order('period'),

      supabase.from('session_recordings')
        .select(`*, live_sessions(subjects(name), session_date, period, sections(name, classes(name))),
                  recording_views(completed)`)
        .order('created_at', { ascending: false })
        .limit(20),

      supabase.from('session_checkins')
        .select('session_id').eq('student_id', user.id)
    ])

    setSessions((sess || []) as any)
    setRecordings((recs || []) as any)

    const cMap: Record<string, boolean> = {}
    ;(myCheckins || []).forEach(c => { cMap[c.session_id] = true })
    setCheckedIn(cMap)
    setLoading(false)
  }

  async function checkIn(sessionId: string) {
    setActionId(sessionId)
    const { data } = await supabase.rpc('student_checkin', { p_session_id: sessionId })
    if (data) {
      setCheckInResult(prev => ({ ...prev, [sessionId]: data }))
      setCheckedIn(prev => ({ ...prev, [sessionId]: true }))
    }
    setActionId('')
  }

  async function markRecordingViewed(recordingId: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('recording_views').upsert({
      recording_id: recordingId,
      student_id: user.id,
      completed: true,
      duration_watched_minutes: 0
    }, { onConflict: 'recording_id,student_id' })

    try {
      await supabase.rpc('increment_view_count' as any, { rec_id: recordingId })
    } catch {}

    setRecordings(prev => prev.map(r =>
      r.id === recordingId
        ? { ...r, recording_views: [{ completed: true }] }
        : r
    ))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return <div className="p-6">...نفس الواجهة بدون تغيير...</div>
}
