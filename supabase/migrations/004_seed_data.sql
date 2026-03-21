-- ============================================================
-- Migration 004: البيانات الأولية
-- ============================================================

-- السنة الدراسية الحالية
INSERT INTO public.academic_years (name, start_date, end_date, is_current)
VALUES ('2025-2026', '2025-09-01', '2026-06-30', TRUE)
ON CONFLICT DO NOTHING;

-- الصفوف الدراسية
WITH ay AS (SELECT id FROM public.academic_years WHERE is_current = TRUE LIMIT 1)
INSERT INTO public.classes (name, level, academic_year_id)
SELECT name, level, ay.id FROM ay,
(VALUES
  ('الصف السابع',  7), ('الصف الثامن',  8), ('الصف التاسع',   9),
  ('الصف العاشر', 10), ('الصف الحادي عشر', 11), ('الصف الثاني عشر', 12)
) AS v(name, level)
ON CONFLICT DO NOTHING;

-- الشعب (أ، ب، ج لكل صف)
INSERT INTO public.sections (class_id, name, capacity)
SELECT c.id, s.name, 30
FROM public.classes c
CROSS JOIN (VALUES ('أ'), ('ب'), ('ج')) AS s(name)
ON CONFLICT DO NOTHING;

-- المواد الدراسية
INSERT INTO public.subjects (name, code) VALUES
  ('اللغة العربية',       'AR'),  ('اللغة الإنجليزية',     'EN'),
  ('الرياضيات',           'MA'),  ('الفيزياء',              'PH'),
  ('الكيمياء',            'CH'),  ('الأحياء',               'BI'),
  ('التاريخ',             'HI'),  ('الجغرافيا',             'GE'),
  ('التربية الإسلامية',   'IS'),  ('الحاسوب',               'CS'),
  ('التربية البدنية',     'PE'),  ('الفنون',                'AR2')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- تعليمات إنشاء المستخدمين
-- ============================================================
-- يجب إنشاء المستخدمين عبر Supabase Auth Dashboard أو الكود
-- ثم تعيين أدوارهم في جدول users
-- مثال لتحديث دور مستخدم موجود:
-- UPDATE public.users SET role = 'admin', must_reset_password = FALSE WHERE email = 'admin@school.edu';
