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

  const threads = [...new Map(
    messages.filter(m => !m.parent_id).map(m => {
      const otherId = m.sender_id === currentUser?.id ? m.receiver_id : m.sender_id
      const other = m.sender_id === currentUser?.id ? m.receiver : m.sender
      return [otherId, { id: otherId, name: other?.full_name, role: other?.role, lastMsg: m }]
    })
  ).values()]

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
      {/* Header */}
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

      {/* INDIVIDUAL */}
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
                {(()=>{const t=threads.find(x=>x.id===selectedThread); return (
                  <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold">{t?.name?.charAt(0)}</div>
                      <div><p className="font-bold text-gray-800">{t?.name}</p><p className="text-xs text-gray-400">{ROLE_AR[t?.role||'']}</p></div>
                    </div>
                    <button onClick={()=>{setCompose(f=>({...f,to:selectedThread!}));setTab('compose')}} className="flex items-center gap-1.5 text-xs text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg">
                      <Reply className="w-3.5 h-3.5"/>رسالة جديدة
                    </button>
                  </div>
                )})()}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {threadMsgs.map(m=>{
                    const mine=m.sender_id===currentUser?.id
                    return (
                      <div key={m.id} className={`flex ${mine?'justify-start':'justify-end'} group`}>
                        <div className={`max-w-sm relative ${mine?'ml-8':'mr-8'}`}>
                          {m.parent_id&&<p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Reply className="w-3 h-3"/>رد</p>}
                          <div className={`px-4 py-3 rounded-2xl text-sm ${mine?'bg-blue-600 text-white rounded-tr-sm':'bg-gray-100 text-gray-800 rounded-tl-sm'}`}>
                            {m.subject&&<p className={`font-bold text-xs mb-1 ${mine?'text-blue-200':'text-gray-500'}`}>{m.subject}</p>}
                            <p>{m.content}</p>
                            <div className={`flex items-center justify-between mt-1 ${mine?'text-blue-200':'text-gray-400'}`}>
                              <span className="text-xs">{formatDateTime(m.created_at)}</span>
                              {mine&&(m.is_read?<CheckCheck className="w-3.5 h-3.5"/>:<Check className="w-3.5 h-3.5"/>)}
                            </div>
                          </div>
                          <div className={`absolute top-0 ${mine?'right-0 translate-x-full':'left-0 -translate-x-full'} hidden group-hover:flex gap-1 px-1`}>
                            <button onClick={()=>{setReplyTo(m);setCompose(f=>({...f,to:mine?m.receiver_id:m.sender_id}));setTab('compose')}} className="p-1.5 bg-white border border-gray-200 rounded-lg text-gray-500 hover:text-blue-600 shadow-sm" title="رد">
                              <Reply className="w-3.5 h-3.5"/>
                            </button>
                            {(mine||currentUser?.role==='admin')&&(
                              <button onClick={()=>deleteMsg(m)} className="p-1.5 bg-white border border-gray-200 rounded-lg text-gray-500 hover:text-red-600 shadow-sm" title="حذف">
                                <Trash2 className="w-3.5 h-3.5"/>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={bottomRef}/>
                </div>
                <form onSubmit={e=>{e.preventDefault();setCompose(f=>({...f,to:selectedThread!}));sendMsg()}} className="p-3 border-t flex gap-2">
                  <input placeholder="رد سريع... (Enter للإرسال)" value={compose.content} onChange={e=>setCompose(f=>({...f,content:e.target.value}))}
                    onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&(e.preventDefault(),setCompose(f=>({...f,to:selectedThread!})),sendMsg())}
                    className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>
                  <button type="submit" disabled={sending||!compose.content.trim()} className="bg-blue-600 text-white px-4 rounded-xl disabled:opacity-50">
                    {sending?<Loader2 className="w-4 h-4 animate-spin"/>:<Send className="w-4 h-4"/>}
                  </button>
                </form>
              </>
            }
          </div>
        </div>
      )}

      {/* GROUP */}
      {tab==='group'&&(
        <div className="flex-1 overflow-y-auto space-y-4">
          {canGroup&&<button onClick={()=>{setCompose(f=>({...f,isGroup:true}));setTab('compose')}} className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-colors">
            <Plus className="w-5 h-5"/>إرسال رسالة جماعية
          </button>}
          {groupMessages.length===0
            ? <div className="bg-white rounded-2xl p-10 text-center text-gray-400 border"><Users className="w-12 h-12 mx-auto mb-3 opacity-30"/><p>لا توجد رسائل جماعية</p></div>
            : groupMessages.map(m=>{
              const isRead=m.group_message_reads?.some((r:any)=>r.user_id===currentUser?.id)
              const mine=m.sender_id===currentUser?.id
              return (
                <div key={m.id} onClick={async()=>{
                  if(!isRead&&!mine){
                    await supabase.from('group_message_reads').upsert({message_id:m.id,user_id:currentUser.id},{onConflict:'message_id,user_id'})
                    setGroupMessages(prev=>prev.map(x=>x.id===m.id?{...x,group_message_reads:[...(x.group_message_reads||[]),{user_id:currentUser.id}]}:x))
                  }
                }} className={`bg-white rounded-2xl shadow-sm border p-5 cursor-pointer transition-all ${!isRead&&!mine?'border-blue-300 bg-blue-50/40':'border-gray-100'}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center text-white"><Users className="w-5 h-5"/></div>
                      <div>
                        <p className="font-bold text-gray-800">{m.sender?.full_name}</p>
                        <p className="text-xs text-gray-400">{formatDateTime(m.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!isRead&&!mine&&<span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full font-bold">جديد</span>}
                      {mine&&<span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{m.group_message_reads?.length||0} قراءة</span>}
                    </div>
                  </div>
                  {m.subject&&<p className="font-semibold text-gray-800 mb-2">{m.subject}</p>}
                  <p className="text-gray-700 leading-relaxed">{m.content}</p>
                </div>
              )
            })
          }
        </div>
      )}

      {/* COMPOSE */}
      {tab==='compose'&&(
        <div className="flex-1 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 max-w-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-gray-800 text-lg">رسالة جديدة</h2>
              {replyTo&&<div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-xl text-xs font-medium">
                <Reply className="w-3.5 h-3.5"/>رداً على: {(replyTo.sender_id===currentUser?.id?replyTo.receiver:replyTo.sender)?.full_name}
                <button onClick={()=>setReplyTo(null)}><X className="w-3.5 h-3.5"/></button>
              </div>}
            </div>
            {canGroup&&<div className="flex gap-2 mb-5">
              {[{v:false,l:'رسالة فردية',c:'blue'},{v:true,l:'رسالة جماعية',c:'purple'}].map(b=>(
                <button key={String(b.v)} onClick={()=>setCompose(f=>({...f,isGroup:b.v}))} className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${compose.isGroup===b.v?`bg-${b.c}-600 text-white border-${b.c}-600`:'bg-white text-gray-600 border-gray-200'}`}
                  style={{background:compose.isGroup===b.v?(b.c==='blue'?'#2563eb':'#9333ea'):'white',color:compose.isGroup===b.v?'white':'#4b5563',borderColor:compose.isGroup===b.v?(b.c==='blue'?'#2563eb':'#9333ea'):'#e5e7eb'}}>
                  {b.l}
                </button>
              ))}
            </div>}
            <div className="space-y-4">
              {!compose.isGroup?(
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">المستلم *</label>
                  <select value={compose.to} onChange={e=>setCompose(f=>({...f,to:e.target.value}))} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">اختر المستلم...</option>
                    {users.map(u=><option key={u.id} value={u.id}>{u.full_name} — {ROLE_AR[u.role]}</option>)}
                  </select>
                </div>
              ):(
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">الشعبة</label>
                    <select value={compose.section_id} onChange={e=>setCompose(f=>({...f,section_id:e.target.value}))} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
                      <option value="">كل الشعب</option>
                      {sections.map(s=><option key={s.id} value={s.id}>{(s.classes as any)?.name} - {s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">الفئة</label>
                    <select value={compose.target_role} onChange={e=>setCompose(f=>({...f,target_role:e.target.value}))} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
                      <option value="all">الجميع</option>
                      <option value="student">الطلاب فقط</option>
                      <option value="parent">أولياء الأمور</option>
                      <option value="teacher">المعلمون</option>
                    </select>
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الموضوع</label>
                <input value={compose.subject} onChange={e=>setCompose(f=>({...f,subject:e.target.value}))} placeholder="موضوع الرسالة (اختياري)" className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">نص الرسالة *</label>
                <textarea value={compose.content} onChange={e=>setCompose(f=>({...f,content:e.target.value}))} rows={6} placeholder="اكتب رسالتك هنا..." className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"/>
              </div>
              <div className="flex gap-3 justify-end">
                <button onClick={()=>setTab('individual')} className="px-5 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-600 hover:bg-gray-50">إلغاء</button>
                <button onClick={sendMsg} disabled={sending||!compose.content.trim()} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50" style={{background:compose.isGroup?'#9333ea':'#2563eb'}}>
                  {sending?<Loader2 className="w-4 h-4 animate-spin"/>:<Send className="w-4 h-4"/>}
                  {compose.isGroup?'إرسال للجميع':'إرسال'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
