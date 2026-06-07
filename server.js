const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const USERS_FILE = path.join(__dirname, 'data', 'users.json');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: 'change-this-secret-key',
  resave: false,
  saveUninitialized: false,
}));
app.use(express.static(path.join(__dirname, 'public')));

function readUsers() {
  if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]');
  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
}
function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}
function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/login.html');
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).send('Access denied: Admin only');
  next();
}

app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ message: 'All fields are required' });
  const users = readUsers();
  if (users.find(u => u.email === email)) return res.status(409).json({ message: 'Email already registered' });
  const user = {
    id: Date.now(),
    name,
    email,
    password: await bcrypt.hash(password, 10),
    role: users.length === 0 ? 'admin' : 'user'
  };
  users.push(user);
  saveUsers(users);
  res.json({ message: 'Registered successfully. First user becomes admin.' });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const users = readUsers();
  const user = users.find(u => u.email === email);
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }
  req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };
  res.json({ message: 'Login successful', role: user.role });
});

app.get('/api/me', (req, res) => res.json({ user: req.session.user || null }));
app.post('/api/logout', (req, res) => req.session.destroy(() => res.json({ message: 'Logged out' })));

app.get('/dashboard', requireLogin, (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/admin', requireAdmin, (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/api/admin/users', requireAdmin, (req, res) => {
  const users = readUsers().map(({ password, ...safe }) => safe);
  res.json(users);
});

app.listen(PORT, () => console.log(`Website running at http://localhost:${PORT}`));
