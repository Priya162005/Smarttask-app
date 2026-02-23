# ⚡ TaskFlow AI — Smart Task & Productivity Assistant

> A full-stack-style productivity app with AI-powered task suggestions, analytics, and real-time notifications.

---

## 📸 Features at a Glance

| Feature | Status |
|---|---|
| Login / Register with local auth | ✅ |
| Task CRUD (Add, Edit, Delete, Complete) | ✅ |
| Priority & Deadline inputs | ✅ |
| AI-suggested task ordering | ✅ |
| Productivity tips engine | ✅ |
| In-app deadline notifications | ✅ |
| Analytics with Line, Bar & Pie charts | ✅ |
| Dark / Light mode toggle | ✅ |
| Responsive mobile + desktop | ✅ |
| Persistent storage (localStorage) | ✅ |

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 (Hooks, state management) |
| Charts | Recharts (LineChart, BarChart, PieChart) |
| Styling | CSS-in-JS with CSS custom properties |
| Storage | localStorage (browser-native persistence) |
| AI Engine | Rule-based scoring algorithm (priority × urgency × effort) |
| Auth | Client-side registration/login with session persistence |
| Fonts | Syne (display) + DM Sans (body) via Google Fonts |

---

## 🤖 AI Engine — How It Works

The AI engine ranks pending tasks using a weighted scoring formula:

```
score = priority_weight × 0.4 + urgency_score × 0.4 + efficiency_score × 0.2
```

- **priority_weight**: High=3, Medium=2, Low=1
- **urgency_score**: `1 / (days_until_deadline + 1)` — closer deadlines score higher
- **efficiency_score**: `1 / estimated_hours` — quick-win tasks get a small boost

It also generates contextual tips:
- Alerts you when tasks are overdue
- Celebrates your daily completions
- Reminds you of high-priority backlogs

---

## 🔔 Notifications

In-app alerts appear at the top of the dashboard:
- 🔴 **Overdue**: Tasks past their deadline
- 🟡 **Urgent**: Due within 24 hours
- 🟢 **Soon**: Due within 72 hours

---

## 📊 Analytics

Three pages of insights:
1. **Dashboard** — KPI cards, progress bar, AI tip
2. **Analytics** — Completion trend (7-day), priority breakdown (bar), distribution (pie), completed vs. pending
3. **AI Suggestions** — Ranked task queue + 6 productivity tips

---

## 🚀 Getting Started

### Option A: Run as Claude Artifact
Open `smart-task-app.jsx` directly in Claude.ai as a React artifact — it runs immediately in the browser.

### Option B: Run Locally with Vite

```bash
# 1. Create a new Vite React project
npm create vite@latest taskflow-ai -- --template react
cd taskflow-ai

# 2. Install dependencies
npm install recharts

# 3. Replace src/App.jsx with smart-task-app.jsx content

# 4. Run dev server
npm run dev
```

### Option C: Deploy to Vercel

```bash
npm run build
npx vercel --prod
```

---

## 🔐 Demo Credentials

```
Email:    demo@task.com
Password: demo123
```

The demo account is auto-created with sample tasks on first load.

---

## 📁 Project Structure

```
src/
├── App.jsx              # Main app (all-in-one)
│   ├── DB               # localStorage persistence layer
│   ├── AIEngine         # Task scoring & tip generation
│   ├── AuthPage         # Login/Register UI
│   ├── DashboardPage    # Task CRUD + progress
│   ├── AnalyticsPage    # Charts & stats
│   ├── AISuggestionsPage # AI-ranked queue
│   └── TaskModal        # Add/Edit task form
```

---

## 🛣️ Extending to a Full Backend

To add a real backend (Python Flask or Node.js Express):

### Flask API Skeleton
```python
from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager, create_access_token

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///tasks.db'
db = SQLAlchemy(app)
jwt = JWTManager(app)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(256), nullable=False)

class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    title = db.Column(db.String(256))
    priority = db.Column(db.String(20))
    deadline = db.Column(db.DateTime)
    completed = db.Column(db.Boolean, default=False)

@app.route('/api/auth/register', methods=['POST'])
def register(): ...

@app.route('/api/auth/login', methods=['POST'])
def login(): ...

@app.route('/api/tasks', methods=['GET', 'POST'])
def tasks(): ...
```

### Recommended Production Stack
- **Backend**: Python Flask + SQLAlchemy + JWT
- **Database**: PostgreSQL (via Render/Supabase)
- **Email Notifications**: SendGrid / Resend API
- **Deployment**: Vercel (frontend) + Render (backend)
- **Calendar Sync**: Google Calendar API (OAuth2)

---

## 🗺️ Roadmap

- [ ] Real backend API (Flask/Express)
- [ ] PostgreSQL database
- [ ] Email reminders via SendGrid
- [ ] Google Calendar sync
- [ ] Team collaboration & task assignment
- [ ] Recurring tasks
- [ ] Time tracking

---

## 📄 License

MIT License — free to use and modify.
