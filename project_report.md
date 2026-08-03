# SASP-INES — Full Project Report

## 1. Project Overview

**SASP-INES** stands for **Student Academic Support Platform for INES-Ruhengeri**.  
It is a **web-based academic management system** built specifically for [INES-Ruhengeri](https://www.ines.ac.rw/), a private university in Rwanda.

The platform serves two types of users:

| User Type | Purpose |
|-----------|---------|
| **Students** | View their enrolled courses, exams, documents, and announcements |
| **Admins** | Manage students, courses, documents, exams, announcements, and academic settings |

The system is designed so that each student **only sees content that matches their own academic profile** (department, program, year of study, academic year) — this filtering is enforced both at the database level and the application level.

---

## 2. Technology Stack

### 2.1 Frontend Framework

| Technology | Version | Role |
|------------|---------|------|
| **Next.js** | 14.2.29 | Full-stack React framework (App Router) |
| **React** | 18 | UI rendering |
| **TypeScript** | 5 | Type-safe development |
| **TailwindCSS** | 3 | Utility-first CSS styling |

### 2.2 Backend / Database

| Technology | Version | Role |
|------------|---------|------|
| **Supabase** | (hosted cloud) | Backend-as-a-Service: Auth, PostgreSQL database, Row Level Security |
| **@supabase/supabase-js** | 2 | JavaScript client for Supabase |
| **@supabase/ssr** | 0.5 | Server-side rendering support for Supabase Auth |

### 2.3 UI Components & Libraries

| Library | Role |
|---------|------|
| **Radix UI** | Accessible, unstyled headless UI primitives (Avatar, Dialog, Dropdown, Label, Separator, Slot, Toast, Tooltip) |
| **Lucide React** | Icon library |
| **class-variance-authority (cva)** | Composable component variants |
| **clsx + tailwind-merge** | Conditional class name merging |

### 2.4 Form Handling & Validation

| Library | Role |
|---------|------|
| **react-hook-form** | Performant form state management |
| **@hookform/resolvers** | Integration bridge for Zod with react-hook-form |
| **Zod** | Schema-based runtime validation |

### 2.5 Development Tools

| Tool | Role |
|------|------|
| **ESLint** | Code linting |
| **PostCSS + Autoprefixer** | CSS post-processing |
| **TypeScript** | Static type checking |

---

## 3. Project Structure

```
SASP-INES/
├── app/                          # Next.js App Router pages
│   ├── (admin)/                  # Admin route group
│   │   └── admin/                # Admin section pages
│   │       ├── page.tsx          # Admin dashboard (overview + stats)
│   │       ├── courses/          # Course management (CRUD)
│   │       ├── students/         # Student profile management
│   │       ├── documents/        # Documents management (future)
│   │       ├── exams/            # Exams management (future)
│   │       ├── announcements/    # Announcements management (future)
│   │       ├── graduation-ai/    # AI graduation assistant (planned)
│   │       └── settings/         # Admin settings (future)
│   ├── (auth)/                   # Auth route group
│   │   └── login/                # Login page
│   └── (dashboard)/              # Student route group
│       ├── dashboard/            # Student overview dashboard
│       ├── courses/              # Student course list
│       ├── exams/                # Student exam papers (future)
│       ├── documents/            # Student documents (future)
│       ├── announcements/        # Student announcements (future)
│       └── profile/              # Student profile editor
│
├── components/                   # Reusable React components
│   ├── auth/                     # LoginForm
│   ├── courses/                  # Course card, details, admin/student views
│   ├── layout/                   # Sidebar, Topbar, MobileNav
│   ├── shared/                   # PageHeader, EmptyState
│   └── ui/                       # Base design system (Badge, Button, etc.)
│
├── lib/                          # Core business logic & utilities
│   ├── auth/                     # getProfile, requireAuth, requireAdmin
│   ├── courses/                  # Course-related server logic
│   ├── supabase/                 # Supabase client (browser + server)
│   ├── academic-config.ts        # Departments, programs, year config
│   └── utils.ts                  # Shared utilities (e.g., formatDate)
│
├── types/                        # TypeScript type definitions
│   └── index.ts                  # All domain interfaces
│
├── supabase/
│   └── migrations/               # PostgreSQL migration scripts
│       ├── 001_profiles.sql      # Users table + RLS policies
│       ├── 002_courses.sql       # Courses table + RLS policies
│       └── 003_profile_academic_year.sql  # Academic year column addition
│
├── middleware.ts                 # Next.js auth guard middleware
├── next.config.mjs               # Next.js configuration
├── tailwind.config.ts            # Tailwind theme configuration
├── tsconfig.json                 # TypeScript configuration
└── package.json                  # Dependencies and scripts
```

---

## 4. System Architecture

### 4.1 Route Groups (Next.js App Router)

The app uses **route groups** (parentheses folders) to organize pages without affecting the URL:

| Route Group | URL Prefix | Who Accesses It |
|-------------|-----------|-----------------|
| `(auth)` | `/login` | Unauthenticated users |
| `(dashboard)` | `/dashboard`, `/courses`, `/exams`, `/documents`, `/announcements`, `/profile` | Authenticated students |
| `(admin)` | `/admin/*` | Admin users only |

### 4.2 Authentication Flow

```
User visits any page
        │
        ▼
middleware.ts (runs on every request)
        │
        ├─ No Supabase env vars → pass through (dev mode)
        │
        ├─ Has session + visiting /login → redirect to /dashboard
        │
        ├─ No session + visiting protected route → redirect to /login
        │
        └─ Has session + visiting protected route → proceed
```

Auth is powered by **Supabase Auth** using cookie-based sessions managed by `@supabase/ssr`. The middleware refreshes the session token on every request to keep users logged in.

### 4.3 Role-Based Access

There are exactly two roles:

| Role | Access |
|------|--------|
| `student` | Can read own profile; sees only their matching courses/content |
| `admin` | Full CRUD on all data; can view and manage all students/courses |

**Role promotion** can only be done directly in the database by another admin — students cannot promote themselves (enforced by Row Level Security).

---

## 5. Database Design

### 5.1 Tables

#### `public.profiles`
Stores extended user data for every Supabase Auth user.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Linked to `auth.users.id` |
| `student_id` | TEXT (unique, nullable) | University-issued ID, e.g. `UG2528267` |
| `full_name` | TEXT | Student's full name |
| `university_email` | TEXT (unique, nullable) | e.g. `ug2528267@ines.ac.rw` |
| `department` | TEXT | e.g. `Computer Science` |
| `program` | TEXT | e.g. `Software Engineering` |
| `year_of_study` | SMALLINT | Current year in programme (≥1) |
| `academic_year` | TEXT | e.g. `2026/2027` — Admin-set label |
| `role` | ENUM | `student` or `admin` |
| `avatar_url` | TEXT | Profile picture URL |
| `created_at` / `updated_at` | TIMESTAMPTZ | Audit timestamps |

#### `public.courses`
Stores academic courses targeting specific student groups.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Auto-generated |
| `code` | TEXT | e.g. `CS301` — unique per program+academic_year |
| `title` | TEXT | Course full name |
| `description` | TEXT (nullable) | Optional description |
| `credits` | SMALLINT | Credit hours (>0) |
| `instructor` | TEXT (nullable) | Instructor name |
| `department` | TEXT | Targeting: department |
| `program` | TEXT | Targeting: program |
| `year_of_study` | SMALLINT | Targeting: year |
| `academic_year` | TEXT | Targeting: academic year |
| `start_date` / `end_date` | DATE (nullable) | Optional delivery period |
| `is_active` | BOOLEAN | Visibility flag — default `false` |
| `created_by` | UUID | Admin who created the course |
| `created_at` / `updated_at` | TIMESTAMPTZ | Audit timestamps |

> **Key design decision:** Courses default to `is_active = false`. Admins must explicitly activate a course to make it visible to students. Multiple courses may overlap in dates — no constraint prevents this.

### 5.2 Academic Targeting Model

Every piece of content (courses, future documents, announcements) is targeted to students using **4 dimensions**:

```
department + program + year_of_study + academic_year
```

> **Important:** There is **no semester** column. INES-Ruhengeri does not organize delivery by semester — courses run on their own individual schedules with `start_date`/`end_date`.

### 5.3 Row Level Security (RLS)

All tables have RLS enabled. Access is deny-by-default (no policy = no access).

#### Profiles Table Policies

| Policy | Who | What |
|--------|-----|------|
| `profiles_select_own` | Any authenticated user | Can SELECT their own row |
| `profiles_select_admin` | Admins | Can SELECT ALL rows |
| `profiles_update_student` | Students | Can UPDATE only `full_name` and `avatar_url` |
| `profiles_update_admin` | Admins | Can UPDATE any field on any row |
| `profiles_insert_admin` | Admins | Can INSERT new profile rows |

#### Courses Table Policies

| Policy | Who | What |
|--------|-----|------|
| `courses_select_student` | Students | See only `is_active=true` courses matching their academic profile |
| `courses_select_admin` | Admins | See ALL courses |
| `courses_insert_admin` | Admins | Create new courses |
| `courses_update_admin` | Admins | Edit any course |
| `courses_delete_admin` | Admins | Delete any course |

### 5.4 Database Helper Functions (SECURITY DEFINER)

These functions run with elevated privileges (bypassing RLS) to prevent infinite recursion when RLS policies need to check the same table:

| Function | Purpose |
|----------|---------|
| `is_admin()` | Returns `true` if the current session user is an admin |
| `profile_protected_fields_unchanged(...)` | Verifies students haven't changed protected fields during an UPDATE |
| `matches_academic_profile(...)` | Checks if the current user's profile matches a given course's academic context |
| `handle_updated_at()` | Trigger function that auto-updates `updated_at` timestamps |
| `handle_new_user()` | Trigger that auto-creates a profile row when a new user signs up |

---

## 6. Academic Configuration

The file [`lib/academic-config.ts`](file:///c:/Programming_Folder/SASP-INES/lib/academic-config.ts) defines all supported **departments and programs** at INES-Ruhengeri:

| Department | Programs |
|-----------|---------|
| Computer Science | Software Engineering (4yr), Information Systems (4yr), Computer Networks (3yr), Data Science (4yr) |
| Business Administration | Management (4yr), Finance and Banking (4yr), Marketing (3yr), Accounting (4yr) |
| Economics | Applied Economics (4yr), Development Economics (3yr) |
| Education | Education Sciences (4yr), Mathematics Education (4yr) |
| Law | Law (4yr) |
| Social Sciences | Sociology (3yr), Political Science (4yr) |

The max years per program determine how many year options appear in admin forms.

---

## 7. Pages & Features

### 7.1 Authentication

- **`/login`** — Login form with email + password. Uses Supabase Auth.  
  - Handles error states (e.g., missing profile, server error) via URL query params.

### 7.2 Student Dashboard (`/dashboard`)

- **`/dashboard`** — Overview page showing stats cards (Enrolled Courses, Exams, Announcements, Documents) and placeholders for recent announcements and upcoming events.
- **`/courses`** — Lists active courses matching the student's academic profile.
- **`/exams`** — Planned: previous exam papers (not yet configured).
- **`/documents`** — Planned: lecture notes, syllabi, handbooks (not yet configured).
- **`/announcements`** — Planned: university announcements (not yet configured).
- **`/profile`** — Student profile editor (editable fields: full name, avatar only).

### 7.3 Admin Panel (`/admin`)

- **`/admin`** — Admin dashboard with live stats: total students, total/active courses, and a table of the 5 most recently created courses.
- **`/admin/courses`** — Full course management: Create, Read, Update, Delete (CRUD). Supports filtering, sorting, activating/deactivating courses.
- **`/admin/students`** — Student profile management: view all students, edit academic details (department, program, year, academic year, student ID).
- **`/admin/documents`** — Planned: upload/manage documents.
- **`/admin/exams`** — Planned: upload/manage exam papers.
- **`/admin/announcements`** — Planned: create/manage announcements.
- **`/admin/graduation-ai`** — Planned: AI-powered graduation eligibility checker.
- **`/admin/settings`** — Planned: platform-wide settings.

---

## 8. Key Components

| Component | Location | Purpose |
|-----------|---------|---------|
| `LoginForm.tsx` | `components/auth/` | Email/password login form with Zod validation |
| `Sidebar.tsx` | `components/layout/` | Navigation sidebar (different links for student/admin) |
| `Topbar.tsx` | `components/layout/` | Top navigation bar with user info and logout |
| `MobileNav.tsx` | `components/layout/` | Mobile-responsive navigation menu |
| `AdminCoursesClient.tsx` | `components/courses/` | Full-featured admin course management table |
| `AdminCourseModals.tsx` | `components/courses/` | Create/Edit/Delete course modal dialogs |
| `AdminCourseActions.tsx` | `components/courses/` | Action buttons (toggle active, edit, delete) |
| `CourseCard.tsx` | `components/courses/` | Card display for a single course |
| `CourseDetails.tsx` | `components/courses/` | Detailed course info panel |
| `StudentCoursesClient.tsx` | `components/courses/` | Student-facing course list with filtering |

---

## 9. Security Model Summary

```
┌─────────────────────────────────────────────────────────────┐
│                     Security Layers                         │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: middleware.ts                                     │
│    - Redirects unauthenticated users to /login              │
│    - Redirects admins away from student routes (optional)   │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: Server-side auth guards (lib/auth/)               │
│    - requireAuth()  → redirects if not logged in            │
│    - requireAdmin() → redirects if not an admin             │
├─────────────────────────────────────────────────────────────┤
│  Layer 3: Supabase Row Level Security (PostgreSQL)          │
│    - Students can only read their own matching data         │
│    - Students cannot modify protected profile fields        │
│    - Admins can read and write everything                   │
│    - Anonymous users see nothing                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 10. Development Workflow

### Running locally

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

### Environment Variables (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-project-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
```

### Database Setup

Run the 3 migration files in order in the Supabase SQL editor:
1. `001_profiles.sql` — Creates the profiles table and all auth infrastructure
2. `002_courses.sql` — Creates the courses table and academic targeting
3. `003_profile_academic_year.sql` — Adds the `academic_year` column to profiles

### Creating the First Admin

1. Create a user via Supabase Auth Dashboard
2. Run the following SQL to promote them:
```sql
UPDATE public.profiles
SET role = 'admin'
WHERE university_email = 'your-admin@ines.ac.rw';
```

---

## 11. Current State vs. Planned Features

| Feature | Status |
|---------|--------|
| Authentication (login/logout) | ✅ Complete |
| Student profile (view/edit) | ✅ Complete |
| Admin dashboard (stats overview) | ✅ Complete |
| Admin course management (CRUD) | ✅ Complete |
| Admin student management | ✅ Complete |
| Student course list | ✅ Complete |
| Exams (student + admin) | 🔲 Planned |
| Documents (student + admin) | 🔲 Planned |
| Announcements (student + admin) | 🔲 Planned |
| Admin settings | 🔲 Planned |
| Graduation AI assistant | 🔲 Planned |

---

## 12. Summary

SASP-INES is a **well-architected, security-first academic portal** built for INES-Ruhengeri. It is unique in that it:

- **Has no "semester" concept** — course delivery is date-based and programme-specific, reflecting how INES actually operates.
- **Enforces data access at the database level** using PostgreSQL Row Level Security — even if the application code has a bug, students cannot see data that doesn't belong to them.
- **Uses a clear 4-dimension targeting system** (department + program + year_of_study + academic_year) to automatically route the right content to the right students.
- **Defaults all new courses to inactive** — preventing accidental early visibility to students.
- **Separates admin and student interfaces** cleanly using Next.js route groups.
