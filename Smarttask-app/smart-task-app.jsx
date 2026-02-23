import { useState, useEffect, useCallback } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

// ─── Simulated DB (localStorage-persisted) ───────────────────────────────────
const DB = {
  getUsers: () => JSON.parse(localStorage.getItem("stp_users") || "[]"),
  saveUsers: (u) => localStorage.setItem("stp_users", JSON.stringify(u)),
  getTasks: (uid) => JSON.parse(localStorage.getItem(`stp_tasks_${uid}`) || "[]"),
  saveTasks: (uid, t) => localStorage.setItem(`stp_tasks_${uid}`, JSON.stringify(t)),
  getSession: () => JSON.parse(localStorage.getItem("stp_session") || "null"),
  saveSession: (s) => localStorage.setItem("stp_session", JSON.stringify(s)),
  clearSession: () => localStorage.removeItem("stp_session"),
};

// ─── AI Engine ───────────────────────────────────────────────────────────────
const AIEngine = {
  suggestOrder: (tasks) => {
    return [...tasks].sort((a, b) => {
      const priorityScore = { high: 3, medium: 2, low: 1 };
      const pa = priorityScore[a.priority] || 1;
      const pb = priorityScore[b.priority] || 1;
      const deadlineA = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const deadlineB = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      const urgencyA = deadlineA === Infinity ? 0 : 1 / ((deadlineA - Date.now()) / 86400000 + 1);
      const urgencyB = deadlineB === Infinity ? 0 : 1 / ((deadlineB - Date.now()) / 86400000 + 1);
      const scoreA = pa * 0.4 + urgencyA * 0.4 + (a.estimatedTime ? 1 / a.estimatedTime : 0) * 0.2;
      const scoreB = pb * 0.4 + urgencyB * 0.4 + (b.estimatedTime ? 1 / b.estimatedTime : 0) * 0.2;
      return scoreB - scoreA;
    });
  },
  getProductivityTip: (tasks) => {
    const overdue = tasks.filter(t => t.deadline && new Date(t.deadline) < new Date() && !t.completed).length;
    const highPending = tasks.filter(t => t.priority === "high" && !t.completed).length;
    const completedToday = tasks.filter(t => {
      if (!t.completedAt) return false;
      const d = new Date(t.completedAt);
      const now = new Date();
      return d.toDateString() === now.toDateString();
    }).length;
    if (overdue > 0) return `⚠️ You have ${overdue} overdue task${overdue > 1 ? "s" : ""}. Tackle them first!`;
    if (highPending > 2) return `🔥 ${highPending} high-priority tasks pending. Consider time-blocking your day.`;
    if (completedToday >= 3) return `🎉 Great momentum! You've completed ${completedToday} tasks today.`;
    if (tasks.filter(t => !t.completed).length === 0) return "✨ All clear! Perfect time to plan ahead.";
    return "💡 Try the 2-minute rule: if a task takes under 2 minutes, do it now.";
  },
  getNotifications: (tasks) => {
    const now = new Date();
    return tasks
      .filter(t => !t.completed && t.deadline)
      .map(t => {
        const diff = (new Date(t.deadline) - now) / 3600000;
        if (diff < 0) return { task: t, type: "overdue", msg: `"${t.title}" is overdue!` };
        if (diff < 24) return { task: t, type: "urgent", msg: `"${t.title}" due in ${Math.round(diff)}h` };
        if (diff < 72) return { task: t, type: "soon", msg: `"${t.title}" due in ${Math.round(diff / 24)}d` };
        return null;
      })
      .filter(Boolean);
  },
};

// ─── Analytics helpers ────────────────────────────────────────────────────────
const getAnalytics = (tasks) => {
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toDateString();
  });
  const completionTrend = last7.map(day => ({
    day: day.split(" ")[0],
    completed: tasks.filter(t => t.completedAt && new Date(t.completedAt).toDateString() === day).length,
    added: tasks.filter(t => new Date(t.createdAt).toDateString() === day).length,
  }));
  const byPriority = [
    { name: "High", value: tasks.filter(t => t.priority === "high").length, color: "#ef4444" },
    { name: "Medium", value: tasks.filter(t => t.priority === "medium").length, color: "#f59e0b" },
    { name: "Low", value: tasks.filter(t => t.priority === "low").length, color: "#10b981" },
  ];
  const total = tasks.length;
  const completed = tasks.filter(t => t.completed).length;
  const rate = total ? Math.round((completed / total) * 100) : 0;
  return { completionTrend, byPriority, total, completed, rate };
};

// ─── Styles (CSS-in-JS) ──────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #0a0a0f;
    --surface: #12121a;
    --surface2: #1a1a26;
    --border: #2a2a3a;
    --accent: #7c6af7;
    --accent2: #f7436a;
    --accent3: #43e8d8;
    --text: #e8e8f0;
    --muted: #7878a0;
    --high: #ef4444;
    --medium: #f59e0b;
    --low: #10b981;
    --radius: 12px;
  }
  .light {
    --bg: #f4f4f8;
    --surface: #ffffff;
    --surface2: #ebebf5;
    --border: #d8d8e8;
    --text: #0a0a1a;
    --muted: #6060a0;
    --surface: #ffffff;
  }
  html, body, #root { height: 100%; font-family: 'DM Sans', sans-serif; background: var(--bg); color: var(--text); }
  h1,h2,h3,h4 { font-family: 'Syne', sans-serif; }
  input, select, textarea, button { font-family: inherit; }
  ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: var(--surface); } ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

  /* Auth */
  .auth-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; background: radial-gradient(ellipse at 20% 50%, rgba(124,106,247,0.15) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(247,67,106,0.1) 0%, transparent 50%), var(--bg); }
  .auth-card { background: var(--surface); border: 1px solid var(--border); border-radius: 20px; padding: 40px; width: 100%; max-width: 420px; }
  .auth-logo { font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 800; background: linear-gradient(135deg, var(--accent), var(--accent3)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 8px; }
  .auth-subtitle { color: var(--muted); font-size: 14px; margin-bottom: 32px; }
  .auth-tabs { display: flex; gap: 0; background: var(--surface2); border-radius: 10px; padding: 4px; margin-bottom: 28px; }
  .auth-tab { flex: 1; padding: 10px; border: none; background: none; color: var(--muted); cursor: pointer; border-radius: 8px; font-weight: 500; transition: all 0.2s; }
  .auth-tab.active { background: var(--surface); color: var(--text); box-shadow: 0 1px 4px rgba(0,0,0,0.3); }

  /* Form */
  .field { margin-bottom: 18px; }
  .field label { display: block; font-size: 12px; font-weight: 500; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px; }
  .field input, .field select, .field textarea { width: 100%; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius); padding: 12px 14px; color: var(--text); font-size: 14px; transition: border-color 0.2s; outline: none; }
  .field input:focus, .field select:focus, .field textarea:focus { border-color: var(--accent); }
  .field textarea { resize: vertical; min-height: 80px; }
  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 12px 20px; border-radius: var(--radius); border: none; cursor: pointer; font-size: 14px; font-weight: 600; transition: all 0.2s; }
  .btn-primary { background: linear-gradient(135deg, var(--accent), #9b6af7); color: white; width: 100%; }
  .btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
  .btn-ghost { background: none; border: 1px solid var(--border); color: var(--text); }
  .btn-ghost:hover { background: var(--surface2); }
  .btn-danger { background: rgba(239,68,68,0.15); color: var(--high); border: 1px solid rgba(239,68,68,0.3); }
  .btn-sm { padding: 7px 14px; font-size: 13px; }
  .err { color: var(--accent2); font-size: 13px; margin-top: 8px; background: rgba(247,67,106,0.1); padding: 10px 14px; border-radius: 8px; border: 1px solid rgba(247,67,106,0.2); }

  /* App shell */
  .app { display: flex; min-height: 100vh; }
  .sidebar { width: 240px; background: var(--surface); border-right: 1px solid var(--border); display: flex; flex-direction: column; padding: 28px 16px; position: fixed; height: 100vh; z-index: 10; }
  .sidebar-logo { font-family: 'Syne', sans-serif; font-size: 18px; font-weight: 800; background: linear-gradient(135deg, var(--accent), var(--accent3)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; padding: 0 8px; margin-bottom: 36px; }
  .nav-item { display: flex; align-items: center; gap: 10px; padding: 12px 12px; border-radius: var(--radius); color: var(--muted); cursor: pointer; font-size: 14px; font-weight: 500; transition: all 0.15s; margin-bottom: 4px; border: none; background: none; width: 100%; text-align: left; }
  .nav-item:hover { color: var(--text); background: var(--surface2); }
  .nav-item.active { color: var(--text); background: linear-gradient(135deg, rgba(124,106,247,0.2), rgba(67,232,216,0.1)); border: 1px solid rgba(124,106,247,0.3); }
  .sidebar-bottom { margin-top: auto; }
  .user-chip { display: flex; align-items: center; gap: 10px; padding: 12px; background: var(--surface2); border-radius: var(--radius); }
  .avatar { width: 34px; height: 34px; border-radius: 50%; background: linear-gradient(135deg, var(--accent), var(--accent2)); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; color: white; flex-shrink: 0; }
  .user-info { font-size: 13px; }
  .user-name { font-weight: 600; }
  .user-role { color: var(--muted); font-size: 11px; }

  /* Main content */
  .main { margin-left: 240px; flex: 1; min-height: 100vh; }
  .topbar { display: flex; align-items: center; justify-content: space-between; padding: 20px 32px; border-bottom: 1px solid var(--border); background: var(--surface); position: sticky; top: 0; z-index: 5; backdrop-filter: blur(12px); }
  .page-title { font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; }
  .topbar-actions { display: flex; align-items: center; gap: 12px; }
  .toggle-dark { width: 38px; height: 22px; background: var(--surface2); border: 1px solid var(--border); border-radius: 11px; cursor: pointer; position: relative; transition: background 0.2s; }
  .toggle-dark-knob { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; background: var(--accent); border-radius: 50%; transition: left 0.2s; }
  .toggle-dark.light-mode .toggle-dark-knob { left: 18px; }
  .content { padding: 32px; }

  /* Stats */
  .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 28px; }
  .stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 22px; position: relative; overflow: hidden; }
  .stat-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: var(--accent-line, var(--accent)); }
  .stat-value { font-family: 'Syne', sans-serif; font-size: 32px; font-weight: 800; line-height: 1; margin-bottom: 6px; }
  .stat-label { color: var(--muted); font-size: 12px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.06em; }

  /* Task list */
  .section { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; margin-bottom: 20px; }
  .section-header { padding: 20px 24px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
  .section-title { font-family: 'Syne', sans-serif; font-size: 16px; font-weight: 700; }
  .section-body { padding: 0; }

  /* Task item */
  .task-item { display: flex; align-items: center; gap: 14px; padding: 16px 24px; border-bottom: 1px solid var(--border); transition: background 0.15s; }
  .task-item:last-child { border-bottom: none; }
  .task-item:hover { background: var(--surface2); }
  .task-check { width: 22px; height: 22px; border-radius: 6px; border: 2px solid var(--border); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; flex-shrink: 0; }
  .task-check.done { background: var(--accent); border-color: var(--accent); }
  .task-body { flex: 1; min-width: 0; }
  .task-title { font-size: 14px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .task-title.done { text-decoration: line-through; color: var(--muted); }
  .task-meta { display: flex; align-items: center; gap: 10px; margin-top: 5px; flex-wrap: wrap; }
  .badge { display: inline-flex; align-items: center; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 20px; }
  .badge-high { background: rgba(239,68,68,0.15); color: var(--high); }
  .badge-medium { background: rgba(245,158,11,0.15); color: var(--medium); }
  .badge-low { background: rgba(16,185,129,0.15); color: var(--low); }
  .task-date { font-size: 11px; color: var(--muted); }
  .task-date.overdue { color: var(--high); }
  .task-actions { display: flex; gap: 8px; opacity: 0; transition: opacity 0.15s; }
  .task-item:hover .task-actions { opacity: 1; }

  /* Progress bar */
  .progress-wrap { margin: 16px 24px; }
  .progress-label { display: flex; justify-content: space-between; font-size: 12px; color: var(--muted); margin-bottom: 8px; }
  .progress-bar { height: 8px; background: var(--surface2); border-radius: 4px; overflow: hidden; }
  .progress-fill { height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent3)); border-radius: 4px; transition: width 0.5s ease; }

  /* AI tip */
  .ai-tip { background: linear-gradient(135deg, rgba(124,106,247,0.15), rgba(67,232,216,0.08)); border: 1px solid rgba(124,106,247,0.3); border-radius: 14px; padding: 18px 22px; margin-bottom: 24px; display: flex; align-items: center; gap: 14px; }
  .ai-tip-icon { font-size: 24px; flex-shrink: 0; }
  .ai-tip-text { font-size: 14px; }

  /* Notifications */
  .notif-bar { padding: 12px 24px; background: rgba(247,67,106,0.08); border-bottom: 1px solid rgba(247,67,106,0.2); font-size: 13px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .notif-item { background: rgba(247,67,106,0.15); border: 1px solid rgba(247,67,106,0.3); border-radius: 6px; padding: 4px 10px; font-size: 12px; }
  .notif-item.urgent { background: rgba(245,158,11,0.15); border-color: rgba(245,158,11,0.3); color: var(--medium); }
  .notif-item.soon { background: rgba(16,185,129,0.1); border-color: rgba(16,185,129,0.2); color: var(--low); }

  /* Modal */
  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 24px; z-index: 100; }
  .modal { background: var(--surface); border: 1px solid var(--border); border-radius: 20px; padding: 32px; width: 100%; max-width: 480px; }
  .modal-title { font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; margin-bottom: 24px; }
  .modal-footer { display: flex; gap: 12px; margin-top: 24px; justify-content: flex-end; }

  /* Charts page */
  .charts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .chart-card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 24px; }
  .chart-title { font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 700; margin-bottom: 20px; }

  /* AI suggestions section */
  .suggest-list { list-style: none; }
  .suggest-item { display: flex; align-items: center; gap: 12px; padding: 14px 24px; border-bottom: 1px solid var(--border); }
  .suggest-num { width: 24px; height: 24px; border-radius: 50%; background: linear-gradient(135deg, var(--accent), var(--accent3)); color: white; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }

  /* Responsive */
  @media (max-width: 768px) {
    .sidebar { display: none; }
    .main { margin-left: 0; }
    .stats-row { grid-template-columns: 1fr 1fr; }
    .charts-grid { grid-template-columns: 1fr; }
  }
`;

// ─── Icons ───────────────────────────────────────────────────────────────────
const Icon = {
  Check: () => <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>,
  Plus: () => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Edit: () => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Trash: () => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  Dashboard: () => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  Chart: () => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  AI: () => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>,
  Logout: () => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
};

// ─── Auth Page ────────────────────────────────────────────────────────────────
function AuthPage({ onLogin }) {
  const [tab, setTab] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");

  const handleSubmit = () => {
    setErr("");
    if (!email || !pass) return setErr("Please fill in all fields.");
    const users = DB.getUsers();
    if (tab === "register") {
      if (!name) return setErr("Name is required.");
      if (users.find(u => u.email === email)) return setErr("Email already registered.");
      const user = { id: Date.now().toString(), name, email, pass, createdAt: new Date().toISOString() };
      DB.saveUsers([...users, user]);
      DB.saveSession(user);
      onLogin(user);
    } else {
      const user = users.find(u => u.email === email && u.pass === pass);
      if (!user) return setErr("Invalid email or password.");
      DB.saveSession(user);
      onLogin(user);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-logo">⚡ TaskFlow AI</div>
        <div className="auth-subtitle">Your smart productivity companion</div>
        <div className="auth-tabs">
          <button className={`auth-tab ${tab === "login" ? "active" : ""}`} onClick={() => setTab("login")}>Sign In</button>
          <button className={`auth-tab ${tab === "register" ? "active" : ""}`} onClick={() => setTab("register")}>Register</button>
        </div>
        {tab === "register" && (
          <div className="field"><label>Full Name</label><input value={name} onChange={e => setName(e.target.value)} placeholder="Jane Doe" /></div>
        )}
        <div className="field"><label>Email Address</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@example.com" /></div>
        <div className="field"><label>Password</label><input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === "Enter" && handleSubmit()} /></div>
        {err && <div className="err">{err}</div>}
        <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={handleSubmit}>
          {tab === "login" ? "Sign In →" : "Create Account →"}
        </button>
        {tab === "login" && (
          <p style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: "var(--muted)" }}>
            Demo: <strong>demo@task.com</strong> / <strong>demo123</strong>
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Task Modal ───────────────────────────────────────────────────────────────
function TaskModal({ task, onSave, onClose }) {
  const [title, setTitle] = useState(task?.title || "");
  const [desc, setDesc] = useState(task?.description || "");
  const [priority, setPriority] = useState(task?.priority || "medium");
  const [deadline, setDeadline] = useState(task?.deadline || "");
  const [estimatedTime, setEstimatedTime] = useState(task?.estimatedTime || "");

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({ title: title.trim(), description: desc, priority, deadline, estimatedTime: Number(estimatedTime) || 0 });
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">{task ? "Edit Task" : "New Task"}</div>
        <div className="field"><label>Task Title *</label><input value={title} onChange={e => setTitle(e.target.value)} placeholder="What needs to be done?" /></div>
        <div className="field"><label>Description</label><textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Add details..." rows={3} /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div className="field">
            <label>Priority</label>
            <select value={priority} onChange={e => setPriority(e.target.value)}>
              <option value="high">🔴 High</option>
              <option value="medium">🟡 Medium</option>
              <option value="low">🟢 Low</option>
            </select>
          </div>
          <div className="field">
            <label>Est. Hours</label>
            <input type="number" min="0" value={estimatedTime} onChange={e => setEstimatedTime(e.target.value)} placeholder="e.g. 2" />
          </div>
        </div>
        <div className="field"><label>Deadline</label><input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} /></div>
        <div className="modal-footer">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" style={{ width: "auto", padding: "10px 28px" }} onClick={handleSave}>
            {task ? "Save Changes" : "Add Task"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────
function DashboardPage({ tasks, setTasks, userId }) {
  const [modal, setModal] = useState(null); // null | "new" | task object
  const [filter, setFilter] = useState("all");

  const save = (list) => { setTasks(list); DB.saveTasks(userId, list); };

  const addTask = (data) => {
    const t = { id: Date.now().toString(), ...data, completed: false, createdAt: new Date().toISOString() };
    save([...tasks, t]);
    setModal(null);
  };

  const updateTask = (data) => {
    save(tasks.map(t => t.id === modal.id ? { ...t, ...data } : t));
    setModal(null);
  };

  const deleteTask = (id) => save(tasks.filter(t => t.id !== id));

  const toggleTask = (id) => {
    save(tasks.map(t => t.id === id
      ? { ...t, completed: !t.completed, completedAt: !t.completed ? new Date().toISOString() : null }
      : t));
  };

  const filtered = tasks.filter(t => {
    if (filter === "active") return !t.completed;
    if (filter === "done") return t.completed;
    return true;
  });

  const sorted = AIEngine.suggestOrder(filtered.filter(t => !t.completed)).concat(filtered.filter(t => t.completed));
  const tip = AIEngine.getProductivityTip(tasks);
  const notifs = AIEngine.getNotifications(tasks);
  const completed = tasks.filter(t => t.completed).length;
  const pct = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;

  return (
    <div>
      {notifs.length > 0 && (
        <div className="notif-bar">
          <span style={{ color: "var(--accent2)", fontWeight: 600 }}>🔔 Alerts:</span>
          {notifs.map((n, i) => (
            <span key={i} className={`notif-item ${n.type}`}>{n.msg}</span>
          ))}
        </div>
      )}
      <div className="content">
        {/* Stats */}
        <div className="stats-row">
          {[
            { label: "Total Tasks", value: tasks.length, color: "var(--accent)" },
            { label: "Completed", value: completed, color: "var(--accent3)" },
            { label: "In Progress", value: tasks.filter(t => !t.completed).length, color: "var(--medium)" },
            { label: "Completion %", value: `${pct}%`, color: "var(--low)" },
          ].map((s, i) => (
            <div key={i} className="stat-card" style={{ "--accent-line": s.color }}>
              <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* AI Tip */}
        <div className="ai-tip">
          <div className="ai-tip-icon">🤖</div>
          <div className="ai-tip-text"><strong>AI Insight:</strong> {tip}</div>
        </div>

        {/* Progress */}
        <div className="section" style={{ marginBottom: 20 }}>
          <div className="section-header"><span className="section-title">Overall Progress</span><span style={{ fontSize: 13, color: "var(--muted)" }}>{completed}/{tasks.length} tasks</span></div>
          <div className="progress-wrap" style={{ padding: "20px 24px" }}>
            <div className="progress-label"><span>Completion Rate</span><span style={{ fontWeight: 700, color: "var(--accent)" }}>{pct}%</span></div>
            <div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
          </div>
        </div>

        {/* Tasks */}
        <div className="section">
          <div className="section-header">
            <span className="section-title">Tasks</span>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ display: "flex", gap: 4, background: "var(--surface2)", borderRadius: 8, padding: 4 }}>
                {["all", "active", "done"].map(f => (
                  <button key={f} onClick={() => setFilter(f)} className="btn btn-sm" style={{ padding: "5px 12px", background: filter === f ? "var(--surface)" : "none", border: "none", color: filter === f ? "var(--text)" : "var(--muted)", borderRadius: 6, textTransform: "capitalize" }}>{f}</button>
                ))}
              </div>
              <button className="btn btn-primary btn-sm" style={{ width: "auto" }} onClick={() => setModal("new")}>
                <Icon.Plus /> New Task
              </button>
            </div>
          </div>
          <div className="section-body">
            {sorted.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--muted)" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
                <div style={{ fontSize: 14 }}>No tasks yet. Add one to get started!</div>
              </div>
            ) : sorted.map(task => {
              const overdue = task.deadline && new Date(task.deadline) < new Date() && !task.completed;
              return (
                <div key={task.id} className="task-item">
                  <div className={`task-check ${task.completed ? "done" : ""}`} onClick={() => toggleTask(task.id)}>
                    {task.completed && <Icon.Check />}
                  </div>
                  <div className="task-body">
                    <div className={`task-title ${task.completed ? "done" : ""}`}>{task.title}</div>
                    <div className="task-meta">
                      <span className={`badge badge-${task.priority}`}>{task.priority}</span>
                      {task.deadline && (
                        <span className={`task-date ${overdue ? "overdue" : ""}`}>
                          {overdue ? "⚠️ " : "📅 "}
                          {new Date(task.deadline).toLocaleDateString()}
                        </span>
                      )}
                      {task.estimatedTime > 0 && <span className="task-date">⏱ {task.estimatedTime}h</span>}
                    </div>
                  </div>
                  <div className="task-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => setModal(task)}><Icon.Edit /></button>
                    <button className="btn btn-danger btn-sm" onClick={() => deleteTask(task.id)}><Icon.Trash /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {modal && (
        <TaskModal
          task={modal === "new" ? null : modal}
          onSave={modal === "new" ? addTask : updateTask}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

// ─── Analytics Page ───────────────────────────────────────────────────────────
function AnalyticsPage({ tasks }) {
  const { completionTrend, byPriority, total, completed, rate } = getAnalytics(tasks);
  const avgTime = tasks.filter(t => t.estimatedTime > 0).reduce((a, b) => a + b.estimatedTime, 0) /
    (tasks.filter(t => t.estimatedTime > 0).length || 1);

  return (
    <div className="content">
      <div className="stats-row">
        {[
          { label: "Total Tasks", value: total, color: "var(--accent)" },
          { label: "Completed", value: completed, color: "var(--accent3)" },
          { label: "Completion Rate", value: `${rate}%`, color: "var(--low)" },
          { label: "Avg. Est. Hours", value: avgTime.toFixed(1), color: "var(--medium)" },
        ].map((s, i) => (
          <div key={i} className="stat-card" style={{ "--accent-line": s.color }}>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <div className="chart-title">📈 Completion Trend (7 days)</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={completionTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" tick={{ fill: "var(--muted)", fontSize: 12 }} />
              <YAxis tick={{ fill: "var(--muted)", fontSize: 12 }} />
              <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10 }} />
              <Line type="monotone" dataKey="completed" stroke="#7c6af7" strokeWidth={2} dot={{ fill: "#7c6af7" }} name="Completed" />
              <Line type="monotone" dataKey="added" stroke="#43e8d8" strokeWidth={2} dot={{ fill: "#43e8d8" }} name="Added" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <div className="chart-title">📊 Tasks by Priority</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byPriority}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fill: "var(--muted)", fontSize: 12 }} />
              <YAxis tick={{ fill: "var(--muted)", fontSize: 12 }} />
              <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10 }} />
              <Bar dataKey="value" name="Tasks" radius={[6, 6, 0, 0]}>
                {byPriority.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <div className="chart-title">🥧 Priority Distribution</div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={byPriority} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {byPriority.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <div className="chart-title">✅ Completion vs Pending</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={[{ name: "Status", Completed: completed, Pending: total - completed }]}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fill: "var(--muted)", fontSize: 12 }} />
              <YAxis tick={{ fill: "var(--muted)", fontSize: 12 }} />
              <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10 }} />
              <Bar dataKey="Completed" fill="#43e8d8" radius={[6, 6, 0, 0]} />
              <Bar dataKey="Pending" fill="#7c6af7" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ─── AI Suggestions Page ──────────────────────────────────────────────────────
function AISuggestionsPage({ tasks }) {
  const pending = tasks.filter(t => !t.completed);
  const suggested = AIEngine.suggestOrder(pending);
  const tips = [
    "🧠 Use time-blocking: schedule your highest-priority task first thing.",
    "🍅 Try the Pomodoro Technique: 25 min focused work, 5 min break.",
    "📌 Limit your daily 'must-do' list to 3 critical tasks.",
    "⚡ Batch similar tasks together to reduce context-switching.",
    "🌙 Review and plan tomorrow's tasks the night before.",
    "🚫 Say no to low-value work when you have high-priority tasks pending.",
  ];

  return (
    <div className="content">
      <div className="section" style={{ marginBottom: 20 }}>
        <div className="section-header">
          <span className="section-title">🤖 AI-Suggested Task Order</span>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Ranked by priority × urgency × effort</span>
        </div>
        <ul className="suggest-list">
          {suggested.length === 0 ? (
            <li style={{ padding: "30px", textAlign: "center", color: "var(--muted)" }}>No pending tasks! You're all caught up 🎉</li>
          ) : suggested.map((t, i) => {
            const overdue = t.deadline && new Date(t.deadline) < new Date();
            return (
              <li key={t.id} className="suggest-item">
                <div className="suggest-num">{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{t.title}</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                    <span className={`badge badge-${t.priority}`}>{t.priority}</span>
                    {t.deadline && <span style={{ fontSize: 11, color: overdue ? "var(--high)" : "var(--muted)" }}>{overdue ? "⚠️ Overdue" : `Due ${new Date(t.deadline).toLocaleDateString()}`}</span>}
                    {t.estimatedTime > 0 && <span style={{ fontSize: 11, color: "var(--muted)" }}>~{t.estimatedTime}h</span>}
                  </div>
                </div>
                {i === 0 && <span style={{ background: "rgba(124,106,247,0.2)", color: "var(--accent)", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20 }}>START HERE</span>}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="section">
        <div className="section-header"><span className="section-title">💡 Productivity Tips</span></div>
        <ul className="suggest-list">
          {tips.map((tip, i) => (
            <li key={i} className="suggest-item">
              <div style={{ fontSize: 14, color: "var(--text)" }}>{tip}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [tasks, setTasks] = useState([]);
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    const session = DB.getSession();
    if (session) {
      setUser(session);
      setTasks(DB.getTasks(session.id));
      // Seed demo account
      const users = DB.getUsers();
      if (!users.find(u => u.email === "demo@task.com")) {
        const demo = { id: "demo", name: "Demo User", email: "demo@task.com", pass: "demo123", createdAt: new Date().toISOString() };
        DB.saveUsers([...users, demo]);
        const sampleTasks = [
          { id: "t1", title: "Design landing page mockup", priority: "high", deadline: new Date(Date.now() + 86400000).toISOString(), estimatedTime: 4, completed: false, createdAt: new Date().toISOString(), description: "" },
          { id: "t2", title: "Write project proposal", priority: "high", deadline: new Date(Date.now() + 172800000).toISOString(), estimatedTime: 2, completed: false, createdAt: new Date().toISOString(), description: "" },
          { id: "t3", title: "Review pull requests", priority: "medium", deadline: "", estimatedTime: 1, completed: true, completedAt: new Date().toISOString(), createdAt: new Date().toISOString(), description: "" },
          { id: "t4", title: "Update documentation", priority: "low", deadline: "", estimatedTime: 3, completed: false, createdAt: new Date().toISOString(), description: "" },
          { id: "t5", title: "Team standup notes", priority: "low", deadline: "", estimatedTime: 0.5, completed: true, completedAt: new Date().toISOString(), createdAt: new Date().toISOString(), description: "" },
        ];
        DB.saveTasks("demo", sampleTasks);
      }
    } else {
      // Auto-seed demo
      const users = DB.getUsers();
      if (!users.find(u => u.email === "demo@task.com")) {
        const demo = { id: "demo", name: "Demo User", email: "demo@task.com", pass: "demo123", createdAt: new Date().toISOString() };
        DB.saveUsers([...users, demo]);
      }
    }
  }, []);

  const handleLogin = (u) => {
    setUser(u);
    setTasks(DB.getTasks(u.id));
  };

  const handleLogout = () => {
    DB.clearSession();
    setUser(null);
    setTasks([]);
    setPage("dashboard");
  };

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: Icon.Dashboard },
    { id: "analytics", label: "Analytics", icon: Icon.Chart },
    { id: "ai", label: "AI Suggestions", icon: Icon.AI },
  ];

  const pageTitles = { dashboard: "Dashboard", analytics: "Analytics", ai: "AI Suggestions" };

  if (!user) return (
    <>
      <style>{CSS}</style>
      <div className={darkMode ? "" : "light"}><AuthPage onLogin={handleLogin} /></div>
    </>
  );

  return (
    <>
      <style>{CSS}</style>
      <div className={darkMode ? "" : "light"}>
        <div className="app">
          {/* Sidebar */}
          <div className="sidebar">
            <div className="sidebar-logo">⚡ TaskFlow AI</div>
            {navItems.map(n => (
              <button key={n.id} className={`nav-item ${page === n.id ? "active" : ""}`} onClick={() => setPage(n.id)}>
                <n.icon /> {n.label}
              </button>
            ))}
            <div className="sidebar-bottom">
              <div className="user-chip" style={{ marginBottom: 12 }}>
                <div className="avatar">{user.name[0].toUpperCase()}</div>
                <div className="user-info">
                  <div className="user-name">{user.name}</div>
                  <div className="user-role">Free Plan</div>
                </div>
              </div>
              <button className="nav-item" onClick={handleLogout} style={{ color: "var(--muted)" }}>
                <Icon.Logout /> Sign Out
              </button>
            </div>
          </div>

          {/* Main */}
          <div className="main">
            <div className="topbar">
              <div className="page-title">{pageTitles[page]}</div>
              <div className="topbar-actions">
                <span style={{ fontSize: 12, color: "var(--muted)" }}>{darkMode ? "🌙" : "☀️"}</span>
                <div className={`toggle-dark ${darkMode ? "" : "light-mode"}`} onClick={() => setDarkMode(d => !d)}>
                  <div className="toggle-dark-knob" />
                </div>
                <div className="avatar" style={{ width: 36, height: 36, fontSize: 14 }}>{user.name[0].toUpperCase()}</div>
              </div>
            </div>

            {page === "dashboard" && <DashboardPage tasks={tasks} setTasks={setTasks} userId={user.id} />}
            {page === "analytics" && <AnalyticsPage tasks={tasks} />}
            {page === "ai" && <AISuggestionsPage tasks={tasks} />}
          </div>
        </div>
      </div>
    </>
  );
}
