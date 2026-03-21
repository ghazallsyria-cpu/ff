-- ============================================================
-- Migration 003: سياسات RLS الكاملة المبنية على منطق المدرسة
-- ============================================================

-- تفعيل RLS على كل الجداول
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- USERS
-- ============================================================
CREATE POLICY "users_select_self" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_select_admin" ON public.users FOR SELECT USING (get_user_role() IN ('admin','management'));
CREATE POLICY "users_select_teacher_students" ON public.users FOR SELECT
  USING (get_user_role() = 'teacher' AND role = 'student');
CREATE POLICY "users_select_teacher_profiles" ON public.users FOR SELECT
  USING (role IN ('teacher','admin','management'));
CREATE POLICY "users_select_parent_children" ON public.users FOR SELECT
  USING (get_user_role() = 'parent' AND role = 'student');
CREATE POLICY "users_update_self" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "users_all_admin" ON public.users FOR ALL USING (get_user_role() = 'admin');

-- ============================================================
-- ACADEMIC YEARS
-- ============================================================
CREATE POLICY "academic_years_select_all" ON public.academic_years FOR SELECT USING (true);
CREATE POLICY "academic_years_manage_admin" ON public.academic_years FOR ALL USING (get_user_role() IN ('admin','management'));

-- ============================================================
-- CLASSES & SECTIONS & SUBJECTS
-- ============================================================
CREATE POLICY "classes_select_all" ON public.classes FOR SELECT USING (true);
CREATE POLICY "classes_manage_admin" ON public.classes FOR ALL USING (get_user_role() IN ('admin','management'));

CREATE POLICY "sections_select_all" ON public.sections FOR SELECT USING (true);
CREATE POLICY "sections_manage_admin" ON public.sections FOR ALL USING (get_user_role() IN ('admin','management'));

CREATE POLICY "subjects_select_all" ON public.subjects FOR SELECT USING (true);
CREATE POLICY "subjects_manage_admin" ON public.subjects FOR ALL USING (get_user_role() IN ('admin','management'));

-- ============================================================
-- PARENTS
-- ============================================================
CREATE POLICY "parents_select_self" ON public.parents FOR SELECT USING (auth.uid() = id);
CREATE POLICY "parents_select_admin" ON public.parents FOR SELECT USING (get_user_role() IN ('admin','management'));
CREATE POLICY "parents_select_teacher" ON public.parents FOR SELECT
  USING (get_user_role() = 'teacher' AND id IN (
    SELECT s.parent_id FROM public.students s
    WHERE s.section_id IN (SELECT section_id FROM public.teacher_sections WHERE teacher_id = auth.uid())
  ));
CREATE POLICY "parents_manage_admin" ON public.parents FOR ALL USING (get_user_role() = 'admin');

-- ============================================================
-- STUDENTS
-- ============================================================
CREATE POLICY "students_select_self" ON public.students FOR SELECT USING (auth.uid() = id);
CREATE POLICY "students_select_admin" ON public.students FOR SELECT USING (get_user_role() IN ('admin','management'));
CREATE POLICY "students_select_teacher" ON public.students FOR SELECT
  USING (get_user_role() = 'teacher' AND section_id IN (
    SELECT section_id FROM public.teacher_sections WHERE teacher_id = auth.uid()
  ));
CREATE POLICY "students_select_parent" ON public.students FOR SELECT
  USING (get_user_role() = 'parent' AND parent_id = auth.uid());
CREATE POLICY "students_manage_admin" ON public.students FOR ALL USING (get_user_role() = 'admin');

-- ============================================================
-- TEACHERS
-- ============================================================
CREATE POLICY "teachers_select_all" ON public.teachers FOR SELECT USING (true);
CREATE POLICY "teachers_update_self" ON public.teachers FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "teachers_manage_admin" ON public.teachers FOR ALL USING (get_user_role() = 'admin');

-- ============================================================
-- TEACHER SECTIONS
-- ============================================================
CREATE POLICY "teacher_sections_select_all" ON public.teacher_sections FOR SELECT USING (true);
CREATE POLICY "teacher_sections_manage_admin" ON public.teacher_sections FOR ALL USING (get_user_role() IN ('admin','management'));

-- ============================================================
-- ATTENDANCE — ✅ مبني على teacher_sections
-- ============================================================
CREATE POLICY "attendance_select_student" ON public.attendance FOR SELECT
  USING (student_id = auth.uid());
CREATE POLICY "attendance_select_parent" ON public.attendance FOR SELECT
  USING (get_user_role() = 'parent' AND student_id IN (
    SELECT id FROM public.students WHERE parent_id = auth.uid()
  ));
CREATE POLICY "attendance_select_teacher" ON public.attendance FOR SELECT
  USING (get_user_role() = 'teacher' AND section_id IN (
    SELECT section_id FROM public.teacher_sections WHERE teacher_id = auth.uid()
  ));
CREATE POLICY "attendance_select_admin" ON public.attendance FOR SELECT
  USING (get_user_role() IN ('admin','management'));
-- ✅ المعلم يسجّل فصوله فقط
CREATE POLICY "attendance_insert_teacher" ON public.attendance FOR INSERT
  WITH CHECK (
    get_user_role() = 'teacher' AND
    section_id IN (SELECT section_id FROM public.teacher_sections WHERE teacher_id = auth.uid()) AND
    recorded_by = auth.uid()
  );
CREATE POLICY "attendance_update_teacher" ON public.attendance FOR UPDATE
  USING (get_user_role() = 'teacher' AND section_id IN (
    SELECT section_id FROM public.teacher_sections WHERE teacher_id = auth.uid()
  ));
CREATE POLICY "attendance_all_admin" ON public.attendance FOR ALL USING (get_user_role() IN ('admin','management'));

-- ============================================================
-- EXAMS — ✅ الطالب يرى شعبته فقط + ضمن الوقت
-- ============================================================
CREATE POLICY "exams_select_teacher_own" ON public.exams FOR SELECT
  USING (teacher_id = auth.uid());
CREATE POLICY "exams_select_admin" ON public.exams FOR SELECT
  USING (get_user_role() IN ('admin','management'));
CREATE POLICY "exams_select_student" ON public.exams FOR SELECT
  USING (
    get_user_role() = 'student' AND
    status = 'published' AND
    section_id = (SELECT section_id FROM public.students WHERE id = auth.uid()) AND
    (start_at IS NULL OR NOW() >= start_at) AND
    (end_at IS NULL OR NOW() <= end_at)
  );
CREATE POLICY "exams_manage_teacher" ON public.exams FOR ALL
  USING (teacher_id = auth.uid() OR get_user_role() IN ('admin','management'));

-- ============================================================
-- QUESTIONS
-- ============================================================
CREATE POLICY "questions_select_teacher" ON public.questions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.exams e WHERE e.id = exam_id AND e.teacher_id = auth.uid()));
CREATE POLICY "questions_select_admin" ON public.questions FOR SELECT
  USING (get_user_role() IN ('admin','management'));
CREATE POLICY "questions_select_student" ON public.questions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.exams e
    WHERE e.id = exam_id AND e.status = 'published'
    AND e.section_id = (SELECT section_id FROM public.students WHERE id = auth.uid())
  ));
CREATE POLICY "questions_manage_teacher" ON public.questions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.exams e WHERE e.id = exam_id AND e.teacher_id = auth.uid())
    OR get_user_role() IN ('admin','management'));

-- ============================================================
-- QUESTION OPTIONS — ✅ إخفاء is_correct عن الطلاب يتم في الكود
-- ============================================================
CREATE POLICY "question_options_select_teacher" ON public.question_options FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.questions q JOIN public.exams e ON e.id = q.exam_id
    WHERE q.id = question_id AND e.teacher_id = auth.uid()
  ));
CREATE POLICY "question_options_select_admin" ON public.question_options FOR SELECT
  USING (get_user_role() IN ('admin','management'));
CREATE POLICY "question_options_select_student" ON public.question_options FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.questions q JOIN public.exams e ON e.id = q.exam_id
    WHERE q.id = question_id AND e.status = 'published'
    AND e.section_id = (SELECT section_id FROM public.students WHERE id = auth.uid())
  ));
CREATE POLICY "question_options_manage_teacher" ON public.question_options FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.questions q JOIN public.exams e ON e.id = q.exam_id
    WHERE q.id = question_id AND e.teacher_id = auth.uid()
  ) OR get_user_role() IN ('admin','management'));

-- ============================================================
-- EXAM ATTEMPTS — ✅ تحقق من max_attempts والوقت
-- ============================================================
CREATE POLICY "exam_attempts_select_student" ON public.exam_attempts FOR SELECT
  USING (student_id = auth.uid());
CREATE POLICY "exam_attempts_select_teacher" ON public.exam_attempts FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.exams e WHERE e.id = exam_id AND e.teacher_id = auth.uid()));
CREATE POLICY "exam_attempts_select_admin" ON public.exam_attempts FOR SELECT
  USING (get_user_role() IN ('admin','management'));
CREATE POLICY "exam_attempts_insert_student" ON public.exam_attempts FOR INSERT
  WITH CHECK (
    student_id = auth.uid() AND
    get_user_role() = 'student' AND
    EXISTS (
      SELECT 1 FROM public.exams e
      WHERE e.id = exam_id AND e.status = 'published'
      AND e.section_id = (SELECT section_id FROM public.students WHERE id = auth.uid())
      AND (e.start_at IS NULL OR NOW() >= e.start_at)
      AND (e.end_at IS NULL OR NOW() <= e.end_at)
      AND (SELECT COUNT(*) FROM public.exam_attempts a WHERE a.exam_id = e.id AND a.student_id = auth.uid()) < e.max_attempts
    )
  );
CREATE POLICY "exam_attempts_update_student" ON public.exam_attempts FOR UPDATE
  USING (student_id = auth.uid() AND status = 'ongoing');
CREATE POLICY "exam_attempts_update_teacher" ON public.exam_attempts FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.exams e WHERE e.id = exam_id AND e.teacher_id = auth.uid())
    OR get_user_role() IN ('admin','management'));

-- ============================================================
-- STUDENT ANSWERS
-- ============================================================
CREATE POLICY "student_answers_select_student" ON public.student_answers FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.exam_attempts a WHERE a.id = attempt_id AND a.student_id = auth.uid()));
CREATE POLICY "student_answers_select_teacher" ON public.student_answers FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.exam_attempts a JOIN public.exams e ON e.id = a.exam_id
    WHERE a.id = attempt_id AND e.teacher_id = auth.uid()
  ));
CREATE POLICY "student_answers_insert_student" ON public.student_answers FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.exam_attempts a WHERE a.id = attempt_id AND a.student_id = auth.uid() AND a.status = 'ongoing'
  ));
CREATE POLICY "student_answers_update_student" ON public.student_answers FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.exam_attempts a WHERE a.id = attempt_id AND a.student_id = auth.uid() AND a.status = 'ongoing'
  ));
CREATE POLICY "student_answers_manage_admin" ON public.student_answers FOR ALL
  USING (get_user_role() IN ('admin','management'));

-- ============================================================
-- GRADES — ✅ الطالب وولي الأمر يريان الدرجات
-- ============================================================
CREATE POLICY "grades_select_student" ON public.grades FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "grades_select_parent" ON public.grades FOR SELECT
  USING (get_user_role() = 'parent' AND student_id IN (
    SELECT id FROM public.students WHERE parent_id = auth.uid()
  ));
CREATE POLICY "grades_select_teacher" ON public.grades FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.exams e WHERE e.id = exam_id AND e.teacher_id = auth.uid()));
CREATE POLICY "grades_select_admin" ON public.grades FOR SELECT
  USING (get_user_role() IN ('admin','management'));
CREATE POLICY "grades_manage_teacher" ON public.grades FOR ALL
  USING (EXISTS (SELECT 1 FROM public.exams e WHERE e.id = exam_id AND e.teacher_id = auth.uid())
    OR get_user_role() IN ('admin','management'));

-- ============================================================
-- ASSIGNMENTS — ✅ الطالب يرى واجبات شعبته
-- ============================================================
CREATE POLICY "assignments_select_student" ON public.assignments FOR SELECT
  USING (get_user_role() = 'student' AND section_id = (SELECT section_id FROM public.students WHERE id = auth.uid()));
CREATE POLICY "assignments_select_parent" ON public.assignments FOR SELECT
  USING (get_user_role() = 'parent' AND section_id IN (
    SELECT section_id FROM public.students WHERE parent_id = auth.uid()
  ));
CREATE POLICY "assignments_select_teacher" ON public.assignments FOR SELECT
  USING (teacher_id = auth.uid() OR get_user_role() IN ('admin','management'));
CREATE POLICY "assignments_manage_teacher" ON public.assignments FOR ALL
  USING (teacher_id = auth.uid() OR get_user_role() IN ('admin','management'));

-- ============================================================
-- ASSIGNMENT SUBMISSIONS
-- ============================================================
CREATE POLICY "submissions_select_student" ON public.assignment_submissions FOR SELECT
  USING (student_id = auth.uid());
CREATE POLICY "submissions_select_parent" ON public.assignment_submissions FOR SELECT
  USING (get_user_role() = 'parent' AND student_id IN (
    SELECT id FROM public.students WHERE parent_id = auth.uid()
  ));
CREATE POLICY "submissions_select_teacher" ON public.assignment_submissions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_id AND a.teacher_id = auth.uid()));
CREATE POLICY "submissions_insert_student" ON public.assignment_submissions FOR INSERT
  WITH CHECK (student_id = auth.uid() AND get_user_role() = 'student');
CREATE POLICY "submissions_update_student" ON public.assignment_submissions FOR UPDATE
  USING (student_id = auth.uid() AND status = 'submitted');
CREATE POLICY "submissions_manage_teacher" ON public.assignment_submissions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_id AND a.teacher_id = auth.uid())
    OR get_user_role() IN ('admin','management'));

-- ============================================================
-- SCHEDULES
-- ============================================================
CREATE POLICY "schedules_select_all" ON public.schedules FOR SELECT USING (true);
CREATE POLICY "schedules_manage_admin" ON public.schedules FOR ALL USING (get_user_role() IN ('admin','management'));

-- ============================================================
-- ANNOUNCEMENTS
-- ============================================================
CREATE POLICY "announcements_select_all" ON public.announcements FOR SELECT USING (
  target_role = 'all' OR
  target_role::text = get_user_role() OR
  get_user_role() IN ('admin','management')
);
CREATE POLICY "announcements_manage_admin" ON public.announcements FOR ALL
  USING (get_user_role() IN ('admin','management'));

-- ============================================================
-- MESSAGES
-- ============================================================
CREATE POLICY "messages_select_own" ON public.messages FOR SELECT
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());
CREATE POLICY "messages_insert" ON public.messages FOR INSERT WITH CHECK (sender_id = auth.uid());
CREATE POLICY "messages_update_read" ON public.messages FOR UPDATE USING (receiver_id = auth.uid());

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE POLICY "notifications_select_own" ON public.notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "notifications_update_own" ON public.notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "notifications_insert_system" ON public.notifications FOR INSERT
  WITH CHECK (get_user_role() IN ('admin','management') OR user_id = auth.uid());
