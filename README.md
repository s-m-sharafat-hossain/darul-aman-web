# Darul Aman Academy — Complete Website & Management Portal

> **Residential Islamic Madrasa Management System** — Cox's Bazar, Bangladesh

[![License](https://img.shields.io/badge/License-Proprietary-red.svg)](LICENSE.txt)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4.x-blue.svg)](https://expressjs.com)

---

## 🌐 Live Demo

| Component | URL |
|-----------|-----|
| 🌍 Public Website | `https://<your-github-username>.github.io/<repo-name>/` |
| 🔐 Management Portal | `https://<your-github-username>.github.io/<repo-name>/portal/login.html` |
| ⚙️ Backend API | `https://<your-render-app-name>.onrender.com/api` |

---

## 📁 Project Structure

```
darul-aman-website/
├── index.html              # Main homepage
├── portal/                 # Management portal
│   ├── login.html          # Portal login page
│   ├── admin/              # Admin dashboard pages
│   ├── guardian/           # Guardian dashboard pages
│   ├── student/            # Student dashboard pages
│   ├── teacher/            # Teacher dashboard pages
│   ├── super-admin/        # Super-admin dashboard pages
│   └── js/
│       └── config.js       # ⚠️ Update API_BASE_URL here after deploying backend
├── backend/                # Backend API (Node.js + Express + Prisma + SQLite)
│   ├── src/                # Source code
│   ├── prisma/             # Database schema and seed
│   ├── .env.example        # Copy to .env and fill in values
│   └── package.json
└── README.md
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- [Node.js 18+](https://nodejs.org) — Download and install
- A modern web browser (Chrome, Edge, Firefox)

### 1. Clone the Repository
```bash
git clone https://github.com/<your-username>/<repo-name>.git
cd <repo-name>
```

### 2. Start the Backend
```bash
cd backend

# Copy environment file
copy .env.example .env

# Install dependencies
npm install

# Set up database & seed demo data
npx prisma db push
node prisma/seed.js

# Start the server
npm run dev
```

The API runs at **http://localhost:4000**

### 3. Open the Website
Open `index.html` directly in your browser, **or** use a local server:
```bash
# From the project root folder:
npx serve .
# Then open http://localhost:3000
```

### 4. Login to the Portal
Go to `portal/login.html` and use the demo credentials:

| Role | User Code | Password |
|------|-----------|----------|
| 🔴 Super Admin | `SUPERADMIN-0001` | `ChangeMe123!` |
| 👨‍💼 Admin/Principal | `STF-DEMO-0001` | `ChangeMe123!` |
| 👨‍🏫 Teacher | `STF-DEMO-0002` | `ChangeMe123!` |
| 👨‍👩‍👦 Guardian | `GRD-DEMO-0001` | `ChangeMe123!` |
| 🎓 Student | `STU-DEMO-0001` | `ChangeMe123!` |

> ⚠️ **Change all passwords immediately in a production environment!**

---

## 🌐 Deployment Guide

### Frontend → GitHub Pages (Free)

1. Push this repository to GitHub
2. Go to **Settings → Pages** in your GitHub repository
3. Set source to **"Deploy from a branch"**, choose **`main`** branch, **`/ (root)`** folder
4. Click **Save** — your site will be live in 1-2 minutes at:
   `https://<username>.github.io/<repo-name>/`

### Backend → Render.com (Free)

1. Go to [render.com](https://render.com) and create a free account
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure the service:

   | Setting | Value |
   |---------|-------|
   | **Name** | `darul-aman-api` (or any name) |
   | **Root Directory** | `backend` |
   | **Runtime** | `Node` |
   | **Build Command** | `npm install && npx prisma generate && npx prisma db push && node prisma/seed.js` |
   | **Start Command** | `npm start` |
   | **Instance Type** | `Free` |

5. Add these **Environment Variables** in Render dashboard:

   | Key | Value |
   |-----|-------|
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | `file:./prod.db` |
   | `JWT_ACCESS_SECRET` | *(generate: run `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`)* |
   | `JWT_REFRESH_SECRET` | *(generate another one)* |
   | `JWT_ACCESS_EXPIRES_IN` | `15m` |
   | `JWT_REFRESH_EXPIRES_IN` | `7d` |
   | `CORS_ORIGIN` | `https://<username>.github.io` |
   | `FRONTEND_URL` | `https://<username>.github.io/<repo-name>` |
   | `UPLOAD_DIR` | `uploads` |

6. Click **"Create Web Service"** — Render will deploy automatically

7. **Update portal config** — After deployment, edit `portal/js/config.js`:
   ```js
   window.DAA_CONFIG = {
     API_BASE_URL: 'https://<your-render-app-name>.onrender.com/api',
     MOCK_MODE: false,
   };
   ```
   Then commit and push — GitHub Pages will update automatically.

---

## 🔧 Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3, Bootstrap 5, Vanilla JS |
| Backend | Node.js 18, Express 4 |
| Database | SQLite (via Prisma ORM) |
| Auth | JWT (access + refresh tokens) |
| Validation | Zod |
| Logging | Winston |
| Deployment | GitHub Pages (frontend) + Render.com (backend) |

---

## 🔐 Security Notes

- **Never commit `.env`** — it's in `.gitignore`
- **Change all demo passwords** before sharing with real users
- **Set strong JWT secrets** in production (64+ random bytes)
- **Set `CORS_ORIGIN`** to your exact GitHub Pages URL in production

---

## 📞 Contact

- **Email**: darulaman.cox@gmail.com
- **Phone**: +8801729-872581
- **Address**: South Sahittika Palli, Darul Aman Road, B.G.B Camp, Ward No. 06, Cox's Bazar

---

**Darul Aman Academy** — Excellence in Islamic Education 🌟