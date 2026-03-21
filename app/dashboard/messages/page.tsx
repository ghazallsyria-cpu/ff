'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Send, Trash2, Reply, Users, MessageSquare, Plus, X, Loader2, Check, CheckCheck } from 'lucide-react'
import { formatDateTime, ROLE_AR } from '@/lib/utils'

export default function MessagesPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<'individual'|'group'|'compose'>('individual')
  const [messages, setMessages] = useState<any[]>([])
  const [groupMessages, setGroupMessages] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [sections, setSections] = useState<any[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [selectedThread, setSelectedThread] = useState<string|null>(null)
  const [replyTo, setReplyTo] = useState<any>(null)
  const [compose, setCompose] = useState({ to:'', subject:'', content:'', isGroup:false, section_id:'', target_role:'all' })
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('users').select('*').eq('id', user.id).single()
      setCurrentUser(profile)
      const [{ data: msgs }, { data: gMsgs }, { data: allUsers }, { data: sects }] = await Promise.all([
        supabase.from('messages').select('*, sender:sender_id(full_name,role), receiver:receiver_id(full_name,role)')
          .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`).order('created_at'),
        supabase.from('group_messages').select('*, sender:sender_id(full_name), group_message_reads(user_id)').order('created_at', { ascending: false }),
        supabase.from('users').select('id,full_name,role').neq('id', user.id).order('full_name'),
        supabase.from('sections').select('id,name,classes(name)'),
      ])
      setMessages(msgs || [])
      setGroupMessages(gMsgs || [])
      setUsers(allUsers || [])
      setSections(sects || [])
      setLoading(false)
      await supabase.from('messages').update({ is_read: true }).eq('receiver_id', user.id).eq('is_read', false)
    }
    init()
    const ch = supabase.channel('rt-msgs')
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'messages' }, p => setMessages(prev => [...prev, p.new]))
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'group_messages' }, p => setGroupMessages(prev => [p.new, ...prev]))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }) }, [messages, selectedThread])

  const threads = Array.from(new Map(
    messages.filter(m => !m.parent_id).map(m => {
      const otherId = m.sender_id === currentUser?.id ? m.receiver_id : m.sender_id
      const other = m.sender_id === currentUser?.id ? m.receiver : m.sender
      return [otherId, { id: otherId, name: other?.full_name, role: other?.role, lastMsg: m }]
    })
  ).values())

  const threadMsgs = selectedThread
    ? messages.filter(m => (m.sender_id===selectedThread && m.receiver_id===currentUser?.id) || (m.receiver_id===selectedThread && m.sender_id===currentUser?.id))
    : []

  async function sendMsg() {
    if (!compose.content.trim() || (!compose.isGroup && !compose.to && !replyTo)) return
    setSending(true)
    if (compose.isGroup) {
      await supabase.from('group_messages').insert({
        sender_id: currentUser.id, section_id: compose.section_id||null,
        target_role: compose.target_role||null, subject: compose.subject||null, content: compose.content,
      })
    } else {
      const receiverId = replyTo
        ? (replyTo.sender_id===currentUser.id ? replyTo.receiver_id : replyTo.sender_id)
        : compose.to
      await supabase.from('messages').insert({
        sender_id: currentUser.id, receiver_id: receiverId,
        subject: compose.subject||null, content: compose.content,
        parent_id: replyTo?.id||null, message_type:'individual',
      })
    }
    setCompose({ to:'', subject:'', content:'', isGroup:false, section_id:'', target_role:'all' })
    setReplyTo(null)
    setSending(false)
    if (compose.isGroup) setTab('group')
    else setTab('individual')
  }

  async function deleteMsg(m: any) {
    const isMine = m.sender_id === currentUser?.id
    await supabase.from('messages').update(isMine ? { is_deleted_by_sender:true } : { is_deleted_by_receiver:true }).eq('id', m.id)
    setMessages(prev => prev.filter(x => x.id !== m.id))
  }

  const canGroup = ['admin','management','teacher'].includes(currentUser?.role)
  const unreadGroup = groupMessages.filter(m => !m.group_message_reads?.some((r:any) => r.user_id===currentUser?.id) && m.sender_id!==currentUser?.id).length

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>

  return (
    <div className="p-6 h-[calc(100vh-40px)] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><MessageSquare className="w-6 h-6 text-blue-600" />الرسائل</h1>
        <div className="flex gap-2">
          {[{k:'individual',l:'المحادثات',I:MessageSquare},{k:'group',l:`جماعية${unreadGroup>0?` (${unreadGroup})`:''}`,I:Users},{k:'compose',l:'+ جديدة',I:Plus}].map(t=>(
            <button key={t.k} onClick={()=>setTab(t.k as any)} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab===t.k?'bg-blue-600 text-white':'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              <t.I className="w-4 h-4"/>{t.l}
            </button>
          ))}
        </div>
      </div>

      {tab==='individual' && (
        <div className="flex-1 grid grid-cols-3 gap-4 min-h-0">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
            <div className="p-3 border-b bg-gray-50"><p className="text-sm font-bold text-gray-700">المحادثات ({threads.length})</p></div>
            <div className="flex-1 overflow-y-auto">
              {threads.length===0
                ? <p className="text-center text-gray-400 text-sm py-8">لا توجد محادثات</p>
                : threads.map(t=>{
                  const unread=messages.filter(m=>m.sender_id===t.id&&m.receiver_id===currentUser?.id&&!m.is_read).length
                  return (
                    <button key={t.id} onClick={()=>setSelectedThread(t.id)} className={`w-full text-right px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors flex items-center gap-3 ${selectedThread===t.id?'bg-blue-50 border-r-2 border-r-blue-600':''}`}>
                      <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0">{t.name?.charAt(0)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-gray-800 truncate">{t.name}</p>
                          {unread>0&&<span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">{unread}</span>}
                        </div>
                        <p className="text-xs text-gray-400">{ROLE_AR[t.role]}</p>
                        <p className="text-xs text-gray-300 truncate">{t.lastMsg?.content?.substring(0,35)}</p>
                      </div>
                    </button>
                  )
                })
              }
            </div>
          </div>

          <div className="col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
            {!selectedThread
              ? <div className="flex-1 flex items-center justify-center text-gray-400"><div className="text-center"><MessageSquare className="w-14 h-14 mx-auto mb-3 opacity-20"/><p>اختر محادثة</p></div></div>
              : <>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {threadMsgs.map(m=>{
                    const mine=m.sender_id===currentUser?.id
                    return (
                      <div key={m.id} className={`flex ${mine?'justify-start':'justify-end'} group`}>
                        <div className={`max-w-sm relative ${mine?'ml-8':'mr-8'}`}>
                          <div className={`px-4 py-3 rounded-2xl text-sm ${mine?'bg-blue-600 text-white rounded-tr-sm':'bg-gray-100 text-gray-800 rounded-tl-sm'}`}>
                            <p>{m.content}</p>
                            <div className="flex justify-between mt-1 text-xs">
                              <span>{formatDateTime(m.created_at)}</span>
                              {mine&&(m.is_read?<CheckCheck className="w-3.5 h-3.5"/>:<Check className="w-3.5 h-3.5"/>)}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={bottomRef}/>
                </div>
              </>
            }
          </div>
        </div>
      )}

      {tab==='compose'&&(
        <div className="flex-1">
          <div className="bg-white rounded-2xl p-6">
            <textarea value={compose.content} onChange={e=>setCompose(f=>({...f,content:e.target.value}))} className="w-full border p-3 rounded-xl" />
            <button onClick={sendMsg} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-xl">إرسال</button>
          </div>
        </div>
      )}
    </div>
  )
}
