# 🏫 مدرسة الرفعة النموذجية — نظام إدارة متكامل

نظام إدارة مدرسي شامل مبني بـ Next.js 14 و Supabase، جاهز للنشر على Netlify.

---

## 📋 المتطلبات

- Node.js 20+
- حساب [Supabase](https://supabase.com)
- حساب [Netlify](https://netlify.com)

---

## ⚡ الإعداد السريع

### 1. إعداد Supabase

1. أنشئ مشروعاً جديداً على [supabase.com/dashboard](https://supabase.com/dashboard)
2. افتح **SQL Editor** ونفّذ الملفات بهذا الترتيب:

```sql
-- الملف 1: الجداول والأنواع
supabase/migrations/001_tables.sql

-- الملف 2: الدوال والـ Triggers
supabase/migrations/002_functions_triggers.sql

-- الملف 3: سياسات RLS
supabase/migrations/003_rls_policies.sql

-- الملف 4: البيانات الأولية
supabase/migrations/004_seed_data.sql
```

3. من **Settings > API** انسخ:
   - `Project URL`
   - `anon public key`

### 2. إعداد المتغيرات البيئية

انسخ `.env.example` إلى `.env.local`:

```bash
cp .env.example .env.local
```

عدّل القيم:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3. تشغيل المشروع محلياً

```bash
npm install
npm run dev
```

افتح [http://localhost:3000](http://localhost:3000)

---

## 👥 إنشاء المستخدمين

### طريقة إنشاء المدير:

1. من Supabase Dashboard > **Authentication > Users > Add User**
2. أدخل البريد وكلمة المرور
3. في **SQL Editor** نفّذ:

```sql
UPDATE public.users 
SET role = 'admin', must_reset_password = FALSE 
WHERE email = 'admin@school.edu';
```

### الأدوار المتاحة:
| الدور | الصلاحيات |
|-------|-----------|
| `admin` | كامل — إدارة النظام |
| `management` | تقارير + إعلانات |
| `teacher` | فصوله فقط |
| `student` | بياناته فقط |
| `parent` | أبناؤه فقط |

---

## 🚀 النشر على Netlify

### الطريقة الأولى: عبر GitHub

1. ارفع المشروع على GitHub
2. في Netlify: **New site > Import from GitHub**
3. أضف متغيرات البيئة في **Site Settings > Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. انشر!

### الطريقة الثانية: Netlify CLI

```bash
npm install -g netlify-cli
netlify init
netlify env:set NEXT_PUBLIC_SUPABASE_URL "your-url"
netlify env:set NEXT_PUBLIC_SUPABASE_ANON_KEY "your-key"
netlify deploy --prod
```

---

## 🗂️ هيكل المشروع

```
refaaschool/
├── app/
│   ├── login/               # صفحة تسجيل الدخول
│   ├── reset-password/      # تغيير كلمة المرور
│   └── dashboard/
│       ├── page.tsx         # لوحة المدير
│       ├── management/      # لوحة الإدارة
│       ├── teacher/         # لوحة المعلم
│       ├── student/         # لوحة الطالب
│       └── parent/          # لوحة ولي الأمر
├── components/shared/       # مكونات مشتركة
├── lib/supabase/            # Supabase clients
├── supabase/migrations/     # ملفات قاعدة البيانات
├── types/                   # TypeScript types
└── middleware.ts            # حماية المسارات
```

---

## 🔐 الأمان

- ✅ RLS مفعّل على كل الجداول (50+ سياسة)
- ✅ `getUser()` بدلاً من `getSession()` في Middleware
- ✅ كل مستخدم يرى بياناته فقط
- ✅ المعلم يدير فصوله فقط
- ✅ تحقق من وقت الاختبار في RLS
- ✅ تحقق من عدد المحاولات في RLS

---

## 🛠️ التقنيات المستخدمة

| التقنية | الاستخدام |
|---------|----------|
| Next.js 14 | Framework |
| React 18 | UI |
| Supabase | قاعدة البيانات + المصادقة |
| TailwindCSS | التصميم |
| TypeScript | أمان الأنواع |
| Lucide React | الأيقونات |

---

## 📞 الدعم

لأي استفسار تواصل مع مدير النظام.

---

تم التطوير بواسطة فريق مدرسة الرفعة النموذجية © 2026
