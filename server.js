const nodemailer = require('nodemailer');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
app.set('trust proxy', 1);
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});


const PORT = process.env.PORT || 3000;

const USERS_FILE = path.join(__dirname, 'data', 'users.json');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});


app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'temporary-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  }
}));
app.use(express.static(path.join(__dirname, 'public')));
const uploadsDir = path.join(__dirname, 'public', 'uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + '-' + file.originalname.replace(/\s+/g, '-');
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

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
  try {
    const { email, password } = req.body;

    const users = readUsers();
    const user = users.find(u => u.email === email);

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const ok = await bcrypt.compare(password, user.password);

    if (!ok) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    return res.json({
      message: 'Login successful',
      role: user.role
    });

  } catch (error) {
    console.error('LOGIN ERROR:', error);
    return res.status(500).json({ message: 'Server login error' });
  }
});

app.get('/api/me', (req, res) => res.json({ user: req.session.user || null }));
app.post('/api/logout', (req, res) => req.session.destroy(() => res.json({ message: 'Logged out' })));

app.get('/dashboard', requireLogin, (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/admin-neeraj-9079', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});
app.get('/api/admin/users', requireAdmin, (req, res) => {
  const users = readUsers().map(({ password, ...safe }) => safe);
  res.json(users);
});

app.delete('/api/admin/users/:id', requireAdmin, (req, res) => {

  const users = readUsers();

  const updatedUsers = users.filter(
    user => String(user.id) !== String(req.params.id)
  );

  saveUsers(updatedUsers);

  res.json({
    message: 'User deleted successfully'
  });

});



app.get('/api/home', (req, res) => {
  const file = path.join(__dirname, 'data', 'home.json');
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify({
    title: 'Neeraj Swami',
    subtitle: 'Full Stack Developer | IT Support Assistant'
  }, null, 2));
  res.json(JSON.parse(fs.readFileSync(file, 'utf8')));
});

app.post('/api/admin/home', requireAdmin, (req, res) => {
  const file = path.join(__dirname, 'data', 'home.json');
  fs.writeFileSync(file, JSON.stringify(req.body, null, 2));
  res.json({ message: 'Home page updated successfully' });
});

app.get('/api/about', (req, res) => {
  const file = path.join(__dirname, 'data', 'about.json');
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify({
    content: 'My name is Neeraj Swami. I have 4 years of experience in e-Mitra services and IT Support.'
  }, null, 2));
  res.json(JSON.parse(fs.readFileSync(file, 'utf8')));
});

app.post('/api/admin/about', requireAdmin, (req, res) => {
  const file = path.join(__dirname, 'data', 'about.json');
  fs.writeFileSync(file, JSON.stringify(req.body, null, 2));
  res.json({ message: 'About page updated successfully' });
});
app.get('/api/home', (req, res) => {
  const file = path.join(__dirname, 'data', 'home.json');
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify({
      title: 'Neeraj Swami',
      subtitle: 'Full Stack Developer | IT Support Assistant'
    }, null, 2));
  }
  res.json(JSON.parse(fs.readFileSync(file, 'utf8')));
});

app.post('/api/admin/home', requireAdmin, (req, res) => {
  const file = path.join(__dirname, 'data', 'home.json');
  fs.writeFileSync(file, JSON.stringify(req.body, null, 2));
  res.json({ message: 'Home page updated successfully' });
});

app.get('/api/about', (req, res) => {
  const file = path.join(__dirname, 'data', 'about.json');
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify({
      content: 'My name is Neeraj Swami. I have 4 years of experience in e-Mitra services and IT Support.'
    }, null, 2));
  }
  res.json(JSON.parse(fs.readFileSync(file, 'utf8')));
});

app.post('/api/admin/about', requireAdmin, (req, res) => {
  const file = path.join(__dirname, 'data', 'about.json');
  fs.writeFileSync(file, JSON.stringify(req.body, null, 2));
  res.json({ message: 'About page updated successfully' });
});
app.get('/api/projects', (req, res) => {
  const file = path.join(__dirname, 'data', 'projects.json');
  if (!fs.existsSync(file)) fs.writeFileSync(file, '[]');
  res.json(JSON.parse(fs.readFileSync(file, 'utf8')));
});

app.post('/api/admin/projects', requireAdmin, (req, res) => {
  const file = path.join(__dirname, 'data', 'projects.json');
  if (!fs.existsSync(file)) fs.writeFileSync(file, '[]');

  const projects = JSON.parse(fs.readFileSync(file, 'utf8'));

  const project = {
    id: Date.now(),
    title: req.body.title,
    description: req.body.description,
    github: req.body.github || '',
    demo: req.body.demo || ''
  };

  projects.push(project);
  fs.writeFileSync(file, JSON.stringify(projects, null, 2));

  res.json({ message: 'Project added successfully' });
});

app.delete('/api/admin/projects/:id', requireAdmin, (req, res) => {
  const file = path.join(__dirname, 'data', 'projects.json');
  const projects = JSON.parse(fs.readFileSync(file, 'utf8'));

  const updated = projects.filter(p => String(p.id) !== String(req.params.id));
  fs.writeFileSync(file, JSON.stringify(updated, null, 2));

  res.json({ message: 'Project deleted successfully' });
});
app.get('/api/gallery', (req, res) => {
  const file = path.join(__dirname, 'data', 'gallery.json');
  if (!fs.existsSync(file)) fs.writeFileSync(file, '[]');
  res.json(JSON.parse(fs.readFileSync(file, 'utf8')));
});

app.post('/api/admin/gallery', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const file = path.join(__dirname, 'data', 'gallery.json');

    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, '[]');
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Please upload an image' });
    }

    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'neeraj-portfolio-gallery'
    });

    const gallery = JSON.parse(fs.readFileSync(file, 'utf8'));

    const item = {
      id: Date.now(),
      title: req.body.title,
      image: result.secure_url,
      description: req.body.description || '',
      public_id: result.public_id
    };

    gallery.push(item);
    fs.writeFileSync(file, JSON.stringify(gallery, null, 2));

    fs.unlinkSync(req.file.path);

    res.json({ message: 'Gallery image uploaded to Cloudinary successfully' });

  } catch (error) {
    console.error('Cloudinary upload error:', error);
    res.status(500).json({ message: 'Image upload failed' });
  }
});

app.delete('/api/admin/gallery/:id', requireAdmin, (req, res) => {
  const file = path.join(__dirname, 'data', 'gallery.json');
  const gallery = JSON.parse(fs.readFileSync(file, 'utf8'));

  const updated = gallery.filter(item => String(item.id) !== String(req.params.id));
  fs.writeFileSync(file, JSON.stringify(updated, null, 2));

  res.json({ message: 'Gallery item deleted successfully' });
});
app.get('/api/resume', (req, res) => {
  const file = path.join(__dirname, 'data', 'resume.json');
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify({ resume: '' }, null, 2));
  res.json(JSON.parse(fs.readFileSync(file, 'utf8')));
});

app.post('/api/admin/resume', requireAdmin, upload.single('resume'), (req, res) => {
  const file = path.join(__dirname, 'data', 'resume.json');

  const data = {
    resume: req.file ? `/uploads/${req.file.filename}` : ''
  };

  fs.writeFileSync(file, JSON.stringify(data, null, 2));

  res.json({ message: 'Resume uploaded successfully' });
});


app.post('/api/contact', async (req, res) => {
  const file = path.join(__dirname, 'data', 'messages.json');

  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, '[]');
  }

  const messages = JSON.parse(fs.readFileSync(file, 'utf8'));

  const message = {
    id: Date.now(),
    name: req.body.name,
    email: req.body.email,
     mobile: req.body.mobile || '',
    subject: req.body.subject || '',
    message: req.body.message,
    date: new Date().toLocaleString()
  };

  messages.push(message);
  fs.writeFileSync(file, JSON.stringify(messages, null, 2));
try {

  await transporter.sendMail({
    from: 'swamineeraj642@gmail.com',
    to: req.body.email,

    subject: 'Thank You For Contacting Neeraj Swami',

    html: `
      <h2>Thank You!</h2>

      <p>Dear ${req.body.name},</p>

      <p>
        Your message has been received successfully.
        I will contact you soon.
      </p>

      <p>
        Regards,<br>
        Neeraj Swami
      </p>
    `
  });

  transporter.verify((error, success) => {
  if (error) {
    console.log("Mail login error:", error);
  } else {
    console.log("Mail server is ready");
  }
});

} catch (err) {
  console.error("Email Error:", err);
}
  res.json({ message: 'Message sent successfully' });
});

app.get('/api/admin/messages', requireAdmin, (req, res) => {
  const file = path.join(__dirname, 'data', 'messages.json');

  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, '[]');
  }

  res.json(JSON.parse(fs.readFileSync(file, 'utf8')));
});

app.delete('/api/admin/messages/:id', requireAdmin, (req, res) => {
  const file = path.join(__dirname, 'data', 'messages.json');

  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, '[]');
  }

  const messages = JSON.parse(fs.readFileSync(file, 'utf8'));
  const updated = messages.filter(msg => String(msg.id) !== String(req.params.id));

  fs.writeFileSync(file, JSON.stringify(updated, null, 2));

  res.json({ message: 'Message deleted successfully' });
});

app.get('/api/settings', (req, res) => {
  const file = path.join(__dirname, 'data', 'settings.json');

  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify({
      logo: 'Neeraj.dev',
      footer: '© 2026 Neeraj Swami. All Rights Reserved.',
      whatsapp: '',
      email: '',
      github: '',
      linkedin: '',
      instagram: ''
    }, null, 2));
  }

  res.json(JSON.parse(fs.readFileSync(file, 'utf8')));
});

app.post('/api/admin/settings', requireAdmin, (req, res) => {
  const file = path.join(__dirname, 'data', 'settings.json');

  fs.writeFileSync(file, JSON.stringify(req.body, null, 2));

  res.json({
    message: 'Website settings updated successfully'
  });
});

app.listen(PORT, () => console.log(`Website running at http://localhost:${PORT}`));
