# 🏛️ DILG Siquijor Task Tracker

**DILG Region NIR • Siquijor Provincial Office — Task & Program Tracker**

A comprehensive web application for monitoring departmental programs, managing recurring tasks, and tracking performance across DILG Siquijor Provincial Office and all municipalities in Siquijor Province, Negros Island Region (NIR).

![Status](https://img.shields.io/badge/status-production--ready-green)
![License](https://img.shields.io/badge/license-Government-blue)
![Deploy](https://img.shields.io/badge/deploy-Vercel-black)

---

## ✨ Features

### 🌐 Public Dashboard (No Login Required)
- Real-time completion statistics
- Department performance comparison
- Monthly trend charts
- Task category breakdown

### 👤 Standard User Portal
- View assigned tasks and programs
- Update task status (Pending → In Progress → Submitted → Completed)
- Upload file outputs (PDF, DOC, XLS, Images)
- Track personal completion rate

### 🛡️ Admin Portal
- Full task template management (create recurring/one-time tasks)
- User management with role-based access control
- Kanban board view of all tasks
- Real-time statistics dashboard
- Scheduler management (generate recurring instances)
- Email notification configuration

### ⚙️ Technical Features
- **Recurring Task Scheduler** — Automatic generation of task instances (daily/weekly/monthly/quarterly/yearly)
- **File Upload** — Drag-and-drop with preview (10MB limit)
- **Notifications** — In-app toast notifications and bell center
- **RBAC** — Role-based access control (Admin / Standard)
- **Responsive** — Mobile-first design
- **Persistent Storage** — localStorage (demo) or Supabase (production)

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS v4 |
| Routing | React Router DOM v6 |
| Charts | Recharts |
| Icons | Lucide React |
| Database | PostgreSQL (via Supabase) |
| Auth | Supabase Auth (RBAC) |
| Storage | Supabase Storage |
| Hosting | Vercel |
| Scheduler | Vercel Cron / Supabase Edge Functions |

---

## 📁 Project Structure

```
dilg-tracker/
├── api/                          # Vercel serverless functions
│   └── scheduler.ts              # Cron job handler
├── prisma/
│   └── schema.prisma             # Database schema
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql # SQL migration
├── src/
│   ├── components/               # Reusable UI components
│   │   ├── FileUpload.tsx        # Drag-and-drop file upload
│   │   ├── Layout.tsx            # App shell (sidebar + header)
│   │   ├── NotificationCenter.tsx # Notification bell dropdown
│   │   └── ToastContainer.tsx    # Toast notifications
│   ├── context/                  # React contexts
│   │   ├── AuthContext.tsx       # Authentication state
│   │   └── NotificationContext.tsx # Notification state
│   ├── data/
│   │   └── mockData.ts          # Demo data (localStorage fallback)
│   ├── pages/                    # Route pages
│   │   ├── AdminDashboard.tsx    # Admin stats + Kanban
│   │   ├── Login.tsx             # Authentication page
│   │   ├── MyTasks.tsx           # Standard user task view
│   │   ├── PublicDashboard.tsx   # Public-facing dashboard
│   │   ├── SchedulerPage.tsx     # Scheduler management
│   │   ├── TaskManagement.tsx    # Task template CRUD
│   │   └── UserManagement.tsx    # User CRUD
│   ├── services/                 # Business logic layer
│   │   ├── database.ts          # CRUD operations
│   │   ├── notifications.ts     # Notification service
│   │   ├── scheduler.ts         # Recurring task scheduler
│   │   ├── storage.ts           # File storage service
│   │   └── supabaseClient.ts    # Supabase connection
│   ├── types/
│   │   └── index.ts             # TypeScript interfaces
│   ├── App.tsx                   # Root component + routing
│   ├── main.tsx                  # Entry point
│   ├── index.css                 # Global styles
│   └── vite-env.d.ts            # Vite type declarations
├── .env.example                  # Environment template
├── .gitignore
├── DEPLOYMENT.md                 # Deployment guide
├── HOSTING_GUIDE.md              # Step-by-step hosting guide
├── vercel.json                   # Vercel configuration
└── package.json
```

---

## 🚀 Quick Start (Development)

```bash
# Clone the repository
git clone https://github.com/YOUR-USERNAME/dilg-tracker.git
cd dilg-tracker

# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:5173
```

### Getting Started (Clean System)

The system starts completely clean with no pre-seeded data.

1. **First user to register becomes ADMIN automatically**
2. Go to `/register` → Create your admin account
3. After login, create additional users in User Management
4. Create task templates and assign to users
5. Monitor progress on the dashboard

**Municipalities served:**
- DILG Siquijor Provincial Office
- Municipality of Siquijor, Larena, San Juan
- Municipality of Enrique Villanueva, Maria, Lazi

---

## 🌐 Deploy to Production

See **[HOSTING_GUIDE.md](./HOSTING_GUIDE.md)** for complete step-by-step instructions.

**Quick Summary:**
1. Push code to GitHub
2. Create Supabase project → Run SQL migration
3. Import project in Vercel → Add environment variables → Deploy
4. (Optional) Add custom domain

**Cost:** ₱0/month (all services have generous free tiers)

---

## 🔐 Security

- Row Level Security (RLS) on all database tables
- Password hashing with bcrypt
- Role-based access control (RBAC)
- HTTPS-only (enforced by Vercel)
- Environment variables for secrets
- CORS configured properly

---

## 📊 Database Schema

```
users ────────────── task_assignments ──────── task_instances
  │                       │                         │
  │                       └─────────────────────────┘
  │                                                 │
  └── notifications                          task_templates
  │
  └── uploaded_files
```

Key design: **TaskTemplate** (defines the recurring pattern) → **TaskInstance** (individual occurrence with its own status and deadline).

---

## 📝 License

Government of the Philippines — Department of the Interior and Local Government

This software is developed for public service use.

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📞 Support

For issues or questions, contact the DILG Information and Communications Technology Service.
