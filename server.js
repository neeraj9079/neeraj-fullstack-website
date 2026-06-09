const nodemailer = require("nodemailer");
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");

const app = express();
app.set("trust proxy", 1);

const PORT = process.env.PORT || 3000;
const USERS_FILE = path.join(__dirname, "data", "users.json");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  connectionTimeout: 30000,
  greetingTimeout: 30000,
  socketTimeout: 60000,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || "temporary-dev-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 24 * 60 * 60 * 1000
  }
}));

app.use(express.static(path.join(__dirname, "public")));

const uploadsDir = path.join(__dirname, "public", "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g, "-"));
  }
});

const upload = multer({ storage });

function ensureDataFile(filePath, defaultData) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
  }
}

function readJson(filePath, defaultData) {
  ensureDataFile(filePath, defaultData);
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
    return defaultData;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function readUsers() {
  return readJson(USERS_FILE, []);
}

function saveUsers(users) {
  writeJson(USERS_FILE, users);
}

function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect("/login.html");
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.status(403).send("Access denied: Admin only");
  }
  next();
}

/* AUTH */
app.post("/api/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const users = readUsers();

    if (users.find(u => u.email === email)) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const user = {
      id: Date.now(),
      name,
      email,
      password: await bcrypt.hash(password, 10),
      role: users.length === 0 ? "admin" : "user"
    };

    users.push(user);
    saveUsers(users);

    res.json({ message: "Registered successfully. First user becomes admin." });
  } catch (error) {
    console.error("REGISTER ERROR:", error);
    res.status(500).json({ message: "Register failed" });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const users = readUsers();
    const user = users.find(u => u.email === email);

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const ok = await bcrypt.compare(password, user.password);

    if (!ok) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    res.json({ message: "Login successful", role: user.role });
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    res.status(500).json({ message: "Server login error" });
  }
});

app.get("/api/me", (req, res) => {
  res.json({ user: req.session.user || null });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ message: "Logged out" }));
});

app.get("/dashboard", requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

app.get("/admin-neeraj-9079", requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

/* USERS */
app.get("/api/admin/users", requireAdmin, (req, res) => {
  const users = readUsers().map(({ password, ...safe }) => safe);
  res.json(users);
});

app.delete("/api/admin/users/:id", requireAdmin, (req, res) => {
  const users = readUsers();
  const updatedUsers = users.filter(user => String(user.id) !== String(req.params.id));
  saveUsers(updatedUsers);
  res.json({ message: "User deleted successfully" });
});

/* HOME */
app.get("/api/home", (req, res) => {
  const file = path.join(__dirname, "data", "home.json");
  res.json(readJson(file, {
    title: "Neeraj Swami",
    subtitle: "Full Stack Developer | IT Support Assistant"
  }));
});

app.post("/api/admin/home", requireAdmin, (req, res) => {
  const file = path.join(__dirname, "data", "home.json");
  writeJson(file, req.body);
  res.json({ message: "Home page updated successfully" });
});

/* ABOUT */
app.get("/api/about", (req, res) => {
  const file = path.join(__dirname, "data", "about.json");
  res.json(readJson(file, {
    content: "My name is Neeraj Swami. I have 4 years of experience in e-Mitra services and IT Support."
  }));
});

app.post("/api/admin/about", requireAdmin, (req, res) => {
  const file = path.join(__dirname, "data", "about.json");
  writeJson(file, req.body);
  res.json({ message: "About page updated successfully" });
});

/* PROJECTS */
app.get("/api/projects", (req, res) => {
  const file = path.join(__dirname, "data", "projects.json");
  res.json(readJson(file, []));
});

app.post("/api/admin/projects", requireAdmin, (req, res) => {
  const file = path.join(__dirname, "data", "projects.json");
  const projects = readJson(file, []);

  projects.push({
    id: Date.now(),
    title: req.body.title,
    description: req.body.description,
    github: req.body.github || "",
    demo: req.body.demo || ""
  });

  writeJson(file, projects);
  res.json({ message: "Project added successfully" });
});

app.delete("/api/admin/projects/:id", requireAdmin, (req, res) => {
  const file = path.join(__dirname, "data", "projects.json");
  const projects = readJson(file, []);
  const updated = projects.filter(p => String(p.id) !== String(req.params.id));

  writeJson(file, updated);
  res.json({ message: "Project deleted successfully" });
});

/* GALLERY */
app.get("/api/gallery", (req, res) => {
  const file = path.join(__dirname, "data", "gallery.json");
  res.json(readJson(file, []));
});

app.post("/api/admin/gallery", requireAdmin, upload.single("image"), async (req, res) => {
  try {
    const file = path.join(__dirname, "data", "gallery.json");

    if (!req.file) {
      return res.status(400).json({ message: "Please upload an image" });
    }

    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "neeraj-portfolio-gallery"
    });

    const gallery = readJson(file, []);

    gallery.push({
      id: Date.now(),
      title: req.body.title,
      image: result.secure_url,
      description: req.body.description || "",
      public_id: result.public_id
    });

    writeJson(file, gallery);

    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

    res.json({ message: "Gallery image uploaded to Cloudinary successfully" });
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    res.status(500).json({ message: "Image upload failed" });
  }
});

app.delete("/api/admin/gallery/:id", requireAdmin, async (req, res) => {
  try {
    const file = path.join(__dirname, "data", "gallery.json");
    const gallery = readJson(file, []);
    const item = gallery.find(g => String(g.id) === String(req.params.id));

    if (item && item.public_id) {
      try {
        await cloudinary.uploader.destroy(item.public_id);
      } catch (cloudinaryError) {
        console.error("Cloudinary delete error:", cloudinaryError);
      }
    }

    const updated = gallery.filter(g => String(g.id) !== String(req.params.id));
    writeJson(file, updated);

    res.json({ message: "Gallery item deleted successfully" });
  } catch (error) {
    console.error("Gallery delete error:", error);
    res.status(500).json({ message: "Gallery item delete failed" });
  }
});

/* RESUME */
app.get("/api/resume", (req, res) => {
  const file = path.join(__dirname, "data", "resume.json");
  res.json(readJson(file, { resume: "" }));
});

app.post("/api/admin/resume", requireAdmin, upload.single("resume"), (req, res) => {
  const file = path.join(__dirname, "data", "resume.json");

  writeJson(file, {
    resume: req.file ? `/uploads/${req.file.filename}` : ""
  });

  res.json({ message: "Resume uploaded successfully" });
});

// /* EMAIL BACKGROUND */
// async function sendContactEmails(message) {
//   try {
//     await transporter.sendMail({
//       from: process.env.EMAIL_USER,
//       to: message.email,
//       subject: "Thank You For Contacting Neeraj Swami",
//       html: `
//         <h2>Thank You!</h2>
//         <p>Dear ${message.name},</p>
//         <p>Your message has been received successfully. I will contact you soon.</p>
//         <p>Regards,<br>Neeraj Swami</p>
//       `
//     });
  } catch (err) {
    console.error("User Email Error:", err.message);
  }

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      subject: "New Contact Message - Portfolio Website",
      html: `
        <h2>New Contact Message</h2>
        <p><strong>Name:</strong> ${message.name}</p>
        <p><strong>Email:</strong> ${message.email}</p>
        <p><strong>Mobile:</strong> ${message.mobile || "Not provided"}</p>
        <p><strong>Subject:</strong> ${message.subject || "No subject"}</p>
        <p><strong>Message:</strong> ${message.message}</p>
        <p><strong>Date:</strong> ${message.date}</p>
      `
    });
  } catch (err) {
    console.error("Admin Email Error:", err.message);
  }
}

/* CONTACT */
app.post("/api/contact", (req, res) => {
  try {
    const file = path.join(__dirname, "data", "messages.json");
    const messages = readJson(file, []);

    const message = {
      id: Date.now(),
      name: req.body.name || "",
      email: req.body.email || "",
      mobile: req.body.mobile || "",
      subject: req.body.subject || "",
      message: req.body.message || "",
      date: new Date().toLocaleString()
    };

    messages.push(message);
    writeJson(file, messages);

    res.json({ message: "Message sent successfully" });

    sendContactEmails(message);
  } catch (error) {
    console.error("CONTACT ERROR:", error);
    res.status(500).json({ message: "Message failed" });
  }
});

app.get("/api/admin/messages", requireAdmin, (req, res) => {
  const file = path.join(__dirname, "data", "messages.json");
  res.json(readJson(file, []));
});

app.delete("/api/admin/messages/:id", requireAdmin, (req, res) => {
  const file = path.join(__dirname, "data", "messages.json");
  const messages = readJson(file, []);
  const updated = messages.filter(msg => String(msg.id) !== String(req.params.id));

  writeJson(file, updated);
  res.json({ message: "Message deleted successfully" });
});

/* VISITOR COUNTER */
app.get("/api/visitor-count", (req, res) => {
  const file = path.join(__dirname, "data", "visitors.json");

  const data = readJson(file, {
    totalVisitors: 0,
    todayVisitors: 0,
    lastVisitDate: ""
  });

  const today = new Date().toLocaleDateString();

  data.totalVisitors += 1;

  if (data.lastVisitDate !== today) {
    data.todayVisitors = 1;
    data.lastVisitDate = today;
  } else {
    data.todayVisitors += 1;
  }

  writeJson(file, data);
  res.json(data);
});

app.get("/api/admin/visitor-stats", requireAdmin, (req, res) => {
  const file = path.join(__dirname, "data", "visitors.json");

  res.json(readJson(file, {
    totalVisitors: 0,
    todayVisitors: 0,
    lastVisitDate: ""
  }));
});

/* SETTINGS */
app.get("/api/settings", (req, res) => {
  const file = path.join(__dirname, "data", "settings.json");

  res.json(readJson(file, {
    logo: "Neeraj.dev",
    footer: "© 2026 Neeraj Swami. All Rights Reserved.",
    whatsapp: "",
    email: "",
    github: "",
    linkedin: "",
    instagram: ""
  }));
});

app.post("/api/admin/settings", requireAdmin, (req, res) => {
  const file = path.join(__dirname, "data", "settings.json");
  writeJson(file, req.body);
  res.json({ message: "Website settings updated successfully" });
});

app.listen(PORT, () => {
  console.log(`Website running at http://localhost:${PORT}`);
});