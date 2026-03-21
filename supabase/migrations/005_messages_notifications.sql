-- ============================================================
-- Migration 005: نظام الرسائل المتطور + الإشعارات
-- ============================================================

-- إضافة أعمدة للرسائل الفردية
ALTER TABLE public.messages 
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_deleted_by_sender BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_deleted_by_receiver BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'individual' 
    CHECK (message_type IN ('individual', 'group', 'announcement'));

-- جدول الرسائل الجماعية (مدير الفصل → الفصل)
CREATE TABLE IF NOT EXISTS public.group_messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sender_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  section_id UUID REFERENCES public.sections(id) ON DELETE CASCADE,
  target_role TEXT CHECK (target_role IN ('all','student','parent','teacher')),
  subject TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.group_message_reads (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  message_id UUID REFERENCES public.group_messages(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  read_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

-- RLS للرسائل الجماعية
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_message_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group_msg_select" ON public.group_messages FOR SELECT USING (
  sender_id = auth.uid() OR
  get_user_role() IN ('admin','management') OR
  (section_id IS NOT NULL AND section_id IN (
    SELECT section_id FROM public.students WHERE id = auth.uid()
    UNION
    SELECT section_id FROM public.teacher_sections WHERE teacher_id = auth.uid()
  )) OR
  (target_role = 'all') OR
  (target_role = get_user_role())
);

CREATE POLICY "group_msg_insert" ON public.group_messages FOR INSERT
  WITH CHECK (sender_id = auth.uid() AND get_user_role() IN ('admin','management','teacher'));

CREATE POLICY "group_msg_reads_manage" ON public.group_message_reads FOR ALL
  USING (user_id = auth.uid());

-- تحديث RLS الرسائل الفردية لدعم الحذف
DROP POLICY IF EXISTS "messages_select_own" ON public.messages;
CREATE POLICY "messages_select_own" ON public.messages FOR SELECT
  USING (
    (sender_id = auth.uid() AND is_deleted_by_sender = FALSE) OR
    (receiver_id = auth.uid() AND is_deleted_by_receiver = FALSE) OR
    get_user_role() IN ('admin','management')
  );

DROP POLICY IF EXISTS "messages_update_read" ON public.messages;
CREATE POLICY "messages_update_own" ON public.messages FOR UPDATE
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());

-- دالة الإشعارات التلقائية عند إرسال رسالة
CREATE OR REPLACE FUNCTION public.notify_on_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_sender_name TEXT;
BEGIN
  SELECT full_name INTO v_sender_name FROM public.users WHERE id = NEW.sender_id;
  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (
    NEW.receiver_id,
    'رسالة جديدة من ' || v_sender_name,
    CASE WHEN NEW.subject IS NOT NULL THEN 'الموضوع: ' || NEW.subject ELSE SUBSTRING(NEW.content, 1, 60) END,
    'info', '/dashboard/messages'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_new_message ON public.messages;
CREATE TRIGGER on_new_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_message();

-- إشعار تلقائي عند تسجيل غياب
CREATE OR REPLACE FUNCTION public.notify_on_absence()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_parent_id UUID; v_student_name TEXT; v_subject_name TEXT;
BEGIN
  IF NEW.status = 'absent' THEN
    SELECT s.parent_id, u.full_name INTO v_parent_id, v_student_name
    FROM public.students s JOIN public.users u ON u.id = s.id WHERE s.id = NEW.student_id;
    SELECT name INTO v_subject_name FROM public.subjects WHERE id = NEW.subject_id;
    IF v_parent_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (v_parent_id, '⚠️ غياب طالبك', v_student_name || ' غائب في حصة ' || COALESCE(v_subject_name,'') || ' بتاريخ ' || NEW.date, 'warning', '/dashboard/parent/attendance');
    END IF;
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (NEW.student_id, 'تم تسجيل غيابك', 'تم تسجيل غيابك في حصة ' || COALESCE(v_subject_name,'') || ' بتاريخ ' || NEW.date, 'warning', '/dashboard/student/attendance');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_absence_recorded ON public.attendance;
CREATE TRIGGER on_absence_recorded
  AFTER INSERT ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_absence();

-- إشعار عند نشر نتيجة
CREATE OR REPLACE FUNCTION public.notify_on_grade()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_exam_title TEXT; v_parent_id UUID; v_student_name TEXT; v_pass_score NUMERIC;
BEGIN
  SELECT e.title, e.pass_score INTO v_exam_title, v_pass_score FROM public.exams e WHERE e.id = NEW.exam_id;
  SELECT s.parent_id, u.full_name INTO v_parent_id, v_student_name
  FROM public.students s JOIN public.users u ON u.id = s.id WHERE s.id = NEW.student_id;
  
  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (NEW.student_id,
    CASE WHEN NEW.score >= v_pass_score THEN '🎉 نتيجة اختبار: ناجح' ELSE '📋 نتيجة اختبار' END,
    'حصلت على ' || ROUND(NEW.score) || '% في ' || COALESCE(v_exam_title,'الاختبار'),
    CASE WHEN NEW.score >= v_pass_score THEN 'success' ELSE 'warning' END,
    '/dashboard/student/grades'
  );
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (v_parent_id, 'نتيجة اختبار ' || COALESCE(v_student_name,''),
      'حصل على ' || ROUND(NEW.score) || '% في ' || COALESCE(v_exam_title,'الاختبار'),
      CASE WHEN NEW.score >= v_pass_score THEN 'success' ELSE 'warning' END,
      '/dashboard/parent/grades'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_grade_added ON public.grades;
CREATE TRIGGER on_grade_added
  AFTER INSERT OR UPDATE ON public.grades
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_grade();

-- إشعار عند نشر واجب
CREATE OR REPLACE FUNCTION public.notify_on_assignment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_subject_name TEXT;
BEGIN
  SELECT name INTO v_subject_name FROM public.subjects WHERE id = NEW.subject_id;
  INSERT INTO public.notifications (user_id, title, message, type, link)
  SELECT s.id, '📄 واجب جديد',
    'تم إضافة واجب في ' || COALESCE(v_subject_name,'') || ': ' || NEW.title,
    'info', '/dashboard/student/assignments'
  FROM public.students s WHERE s.section_id = NEW.section_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_assignment_added ON public.assignments;
CREATE TRIGGER on_assignment_added
  AFTER INSERT ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_assignment();

-- إشعار عند نشر اختبار
CREATE OR REPLACE FUNCTION public.notify_on_exam_publish()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_subject_name TEXT;
BEGIN
  IF NEW.status = 'published' AND (OLD.status IS NULL OR OLD.status != 'published') THEN
    SELECT name INTO v_subject_name FROM public.subjects WHERE id = NEW.subject_id;
    INSERT INTO public.notifications (user_id, title, message, type, link)
    SELECT s.id, '📝 اختبار جديد متاح',
      NEW.title || ' في مادة ' || COALESCE(v_subject_name,''),
      'info', '/dashboard/student/exams'
    FROM public.students s WHERE s.section_id = NEW.section_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_exam_published ON public.exams;
CREATE TRIGGER on_exam_published
  AFTER INSERT OR UPDATE ON public.exams
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_exam_publish();
