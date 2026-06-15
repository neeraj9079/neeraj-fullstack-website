require("dotenv").config();
const { Pool } = require("pg");
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
const EMITRA_FILE = path.join(__dirname, "data", "emitra-services.json");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  name: "neeraj_session",
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

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
      cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g, "-"));
    }
  })
});

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

    users.push({
      id: Date.now(),
      name,
      email,
      password: await bcrypt.hash(password, 10),
      role: users.length === 0 ? "admin" : "user"
    });

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

    if (!user) return res.status(401).json({ message: "Invalid email or password" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ message: "Invalid email or password" });

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

/* SECURE PAGES */
app.get("/dashboard", requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

app.get("/admin-neeraj-9079", requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.get("/admin-projects-neeraj-9079", requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin-projects.html"));
});

/* USERS */
app.get("/api/admin/users", requireAdmin, (req, res) => {
  const users = readUsers().map(({ password, ...safe }) => safe);
  res.json(users);
});

app.delete("/api/admin/users/:id", requireAdmin, (req, res) => {
  const users = readUsers();
  saveUsers(users.filter(user => String(user.id) !== String(req.params.id)));
  res.json({ message: "User deleted successfully" });
});

/* HOME */
app.get("/api/home", (req, res) => {
  res.json(readJson(path.join(__dirname, "data", "home.json"), {
    title: "Neeraj Swami",
    subtitle: "Full Stack Developer | IT Support Assistant"
  }));
});

app.post("/api/admin/home", requireAdmin, (req, res) => {
  writeJson(path.join(__dirname, "data", "home.json"), req.body);
  res.json({ message: "Home page updated successfully" });
});

/* ABOUT */
app.get("/api/about", (req, res) => {
  res.json(readJson(path.join(__dirname, "data", "about.json"), {
    content: "My name is Neeraj Swami. I have 4 years of experience in e-Mitra services and IT Support."
  }));
});

app.post("/api/admin/about", requireAdmin, (req, res) => {
  writeJson(path.join(__dirname, "data", "about.json"), req.body);
  res.json({ message: "About page updated successfully" });
});

/* PROJECTS - SUPABASE SAFE */

app.get("/api/projects", async (req, res) => {
  try {
    const rows = await dbQuery(
      `SELECT id, title, description, github, demo, created_at
       FROM public.projects
       ORDER BY id DESC`
    );

    res.json(rows);
  } catch (error) {
    console.error("PROJECTS GET ERROR:", error);
    res.status(500).json({
      message: "Projects loading failed",
      error: error.message
    });
  }
});

app.post("/api/admin/projects", requireAdmin, async (req, res) => {
  try {
    const title = String(req.body.title || "").trim();
    const description = String(req.body.description || "").trim();
    const github = String(req.body.github || "").trim();
    const demo = String(req.body.demo || "").trim();

    if (!title) {
      return res.status(400).json({
        message: "Project title is required"
      });
    }

    const rows = await dbQuery(
      `INSERT INTO public.projects (title, description, github, demo)
       VALUES ($1, $2, $3, $4)
       RETURNING id, title, description, github, demo, created_at`,
      [title, description, github, demo]
    );

    res.json({
      message: "Project added successfully",
      project: rows[0]
    });

  } catch (error) {
    console.error("PROJECT ADD ERROR:", error);
    res.status(500).json({
      message: "Project add failed",
      error: error.message
    });
  }
});

app.delete("/api/admin/projects/:id", requireAdmin, async (req, res) => {
  try {
    await dbQuery(
      `DELETE FROM public.projects WHERE id = $1`,
      [req.params.id]
    );

    res.json({
      message: "Project deleted successfully"
    });

  } catch (error) {
    console.error("PROJECT DELETE ERROR:", error);
    res.status(500).json({
      message: "Project delete failed",
      error: error.message
    });
  }
});

/* GALLERY */
app.get("/api/gallery", (req, res) => {
  res.json(readJson(path.join(__dirname, "data", "gallery.json"), []));
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

    writeJson(file, gallery.filter(g => String(g.id) !== String(req.params.id)));
    res.json({ message: "Gallery item deleted successfully" });
  } catch (error) {
    console.error("Gallery delete error:", error);
    res.status(500).json({ message: "Gallery item delete failed" });
  }
});

/* RESUME */
app.get("/api/resume", (req, res) => {
  res.json(readJson(path.join(__dirname, "data", "resume.json"), { resume: "" }));
});

app.post("/api/admin/resume", requireAdmin, upload.single("resume"), (req, res) => {
  writeJson(path.join(__dirname, "data", "resume.json"), {
    resume: req.file ? `/uploads/${req.file.filename}` : ""
  });

  res.json({ message: "Resume uploaded successfully" });
});

/* CONTACT EMAIL */
async function sendBrevoEmail(payload) {
  if (!process.env.BREVO_API_KEY) {
    throw new Error("BREVO_API_KEY missing");
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": process.env.BREVO_API_KEY,
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText);
  }

  return response.json();
}

async function sendContactEmails(message) {
  try {
    await sendBrevoEmail({
      sender: {
        name: "Neeraj Swami",
        email: process.env.EMAIL_USER
      },
      to: [{ email: message.email, name: message.name }],
      subject: "Thank You For Contacting Neeraj Swami",
      htmlContent: `
        <h2>Thank You!</h2>
        <p>Dear ${message.name},</p>
        <p>Your message has been received successfully. I will contact you soon.</p>
        <p>Regards,<br>Neeraj Swami</p>
      `
    });

    await sendBrevoEmail({
      sender: {
        name: "Neeraj Portfolio",
        email: process.env.EMAIL_USER
      },
      to: [{ email: process.env.EMAIL_USER, name: "Neeraj Swami" }],
      subject: "New Contact Message - Portfolio Website",
      htmlContent: `
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
    console.error("Brevo Email Error:", err.message);
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
  res.json(readJson(path.join(__dirname, "data", "messages.json"), []));
});

app.delete("/api/admin/messages/:id", requireAdmin, (req, res) => {
  const file = path.join(__dirname, "data", "messages.json");
  const messages = readJson(file, []);
  writeJson(file, messages.filter(msg => String(msg.id) !== String(req.params.id)));
  res.json({ message: "Message deleted successfully" });
});

/* EMITRA SERVICES - SUPABASE */

app.get("/api/emitra-services", async (req, res) => {
  try {
    const services = await dbQuery(
      `SELECT 
        id,
        name,
        category,
        documents,
        fees,
        processing_time AS "processingTime",
        description,
        status,
        form_name AS "formName",
        form_pdf AS "formPdf",
        created_at
       FROM emitra_services
       ORDER BY id DESC`
    );

    res.json(services);
  } catch (error) {
    console.error("EMITRA GET ERROR:", error.message);
    res.status(500).json({ message: "e-Mitra services loading failed" });
  }
});

app.post("/api/admin/emitra-services", requireAdmin, upload.single("formPdf"), async (req, res) => {
  try {
    await dbQuery(
      `INSERT INTO emitra_services 
       (name, category, documents, fees, processing_time, description, status, form_name, form_pdf)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        req.body.name,
        req.body.category,
        req.body.documents || "",
        req.body.fees || "",
        req.body.processingTime || "",
        req.body.description || "",
        req.body.status || "Active",
        req.body.formName || "",
        req.file ? `/uploads/${req.file.filename}` : ""
      ]
    );

    res.json({ message: "e-Mitra Service Added Successfully" });
  } catch (error) {
    console.error("EMITRA ADD ERROR:", error.message);
    res.status(500).json({ message: "e-Mitra service add failed" });
  }
});

app.put("/api/admin/emitra-services/:id", requireAdmin, upload.single("formPdf"), async (req, res) => {
  try {
    const oldRows = await dbQuery(
      "SELECT form_name, form_pdf FROM emitra_services WHERE id = $1",
      [req.params.id]
    );

    const oldService = oldRows[0] || {};

    await dbQuery(
      `UPDATE emitra_services SET
        name = $1,
        category = $2,
        documents = $3,
        fees = $4,
        processing_time = $5,
        description = $6,
        status = $7,
        form_name = $8,
        form_pdf = $9
       WHERE id = $10`,
      [
        req.body.name,
        req.body.category,
        req.body.documents || "",
        req.body.fees || "",
        req.body.processingTime || "",
        req.body.description || "",
        req.body.status || "Active",
        req.body.formName || oldService.form_name || "",
        req.file ? `/uploads/${req.file.filename}` : oldService.form_pdf || "",
        req.params.id
      ]
    );

    res.json({ message: "e-Mitra Service Updated Successfully" });
  } catch (error) {
    console.error("EMITRA UPDATE ERROR:", error.message);
    res.status(500).json({ message: "e-Mitra service update failed" });
  }
});

app.delete("/api/admin/emitra-services/:id", requireAdmin, async (req, res) => {
  try {
    await dbQuery(
      "DELETE FROM emitra_services WHERE id = $1",
      [req.params.id]
    );

    res.json({ message: "e-Mitra Service Deleted Successfully" });
  } catch (error) {
    console.error("EMITRA DELETE ERROR:", error.message);
    res.status(500).json({ message: "e-Mitra service delete failed" });
  }
});

app.put("/api/admin/emitra-services/:id", requireAdmin, upload.single("formPdf"), (req, res) => {
  const services = readJson(EMITRA_FILE, []);

  const updatedServices = services.map(service => {
    if (String(service.id) === String(req.params.id)) {
      return {
        ...service,
        name: req.body.name,
        category: req.body.category,
        documents: req.body.documents || "",
        fees: req.body.fees || "",
        processingTime: req.body.processingTime || "",
        description: req.body.description || "",
        status: req.body.status || "Active",
        formName: req.body.formName || service.formName || "",
        formPdf: req.file ? `/uploads/${req.file.filename}` : service.formPdf || ""
      };
    }

    return service;
  });

  writeJson(EMITRA_FILE, updatedServices);

  res.json({
    message: "e-Mitra Service Updated Successfully"
  });
});

app.delete("/api/admin/emitra-services/:id", requireAdmin, (req, res) => {
  const services = readJson(EMITRA_FILE, []);

  writeJson(
    EMITRA_FILE,
    services.filter(service => String(service.id) !== String(req.params.id))
  );

  res.json({
    message: "e-Mitra Service Deleted Successfully"
  });
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
  res.json(readJson(path.join(__dirname, "data", "visitors.json"), {
    totalVisitors: 0,
    todayVisitors: 0,
    lastVisitDate: ""
  }));
});

/* HIRE ME */
app.get("/api/hire", (req, res) => {
  res.json(readJson(path.join(__dirname, "data", "hire.json"), {
    title: "Hire Me",
    intro: "Looking for a reliable professional for IT Support, e-Mitra services, web development, or technical assistance? Let's work together.",
    services: [
      {
        title: "Website Development",
        description: "Responsive websites using HTML, CSS, JavaScript, Node.js and modern web technologies."
      },
      {
        title: "IT Support Services",
        description: "Technical support, troubleshooting, computer maintenance and system assistance."
      },
      {
        title: "e-Mitra Services",
        description: "Government documentation, online applications, digital services and citizen support."
      }
    ],
    buttonText: "Hire Me Now",
    resumeButtonText: "View Resume"
  }));
});

app.post("/api/admin/hire", requireAdmin, (req, res) => {
  writeJson(path.join(__dirname, "data", "hire.json"), req.body);
  res.json({ message: "Hire Me page updated successfully" });
});

/* CONTACT INFO */
app.get("/api/contact-info", (req, res) => {
  res.json(readJson(path.join(__dirname, "data", "contact-info.json"), {
    name: "Neeraj Swami",
    role: "IT Support Assistant & Full Stack Learner",
    email: "swamineeraj642@gmail.com",
    location: "Rajasthan, India",
    description: "Feel free to contact me regarding IT Support, e-Mitra services, web development projects, technical collaboration, or professional opportunities."
  }));
});

app.post("/api/admin/contact-info", requireAdmin, (req, res) => {
  writeJson(path.join(__dirname, "data", "contact-info.json"), req.body);
  res.json({ message: "Contact information updated successfully" });
});

/* SETTINGS */
app.get("/api/settings", (req, res) => {
  res.json(readJson(path.join(__dirname, "data", "settings.json"), {
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
  writeJson(path.join(__dirname, "data", "settings.json"), req.body);
  res.json({ message: "Website settings updated successfully" });
});

/* VISITOR ANALYTICS */
const ANALYTICS_FILE = path.join(__dirname, "data", "analytics.json");

app.post("/api/track-visitor", (req, res) => {
  try {
    const visits = readJson(ANALYTICS_FILE, []);

    visits.push({
      id: Date.now(),
      page: req.body.page || "Unknown",
      referrer: req.body.referrer || "Direct",
      userAgent: req.headers["user-agent"] || "",
      ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress || "",
      date: new Date().toISOString()
    });

    writeJson(ANALYTICS_FILE, visits);

    res.json({ success: true, message: "Visitor tracked" });
  } catch (error) {
    console.error("VISITOR TRACK ERROR:", error);
    res.status(500).json({ success: false, message: "Visitor tracking failed" });
  }
});

app.get("/api/admin/analytics", requireAdmin, (req, res) => {
  try {
    const visits = readJson(ANALYTICS_FILE, []);

    res.json({
      totalVisits: visits.length,
      recentVisits: visits.slice(-100).reverse()
    });
  } catch (error) {
    console.error("ANALYTICS ERROR:", error);
    res.status(500).json({ message: "Analytics loading failed" });
  }
});

/* SUPABASE DATABASE */

let pool = null;

if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  pool.on("error", (err) => {
    console.error("PostgreSQL Pool Error:", err.message);
  });

  pool.query("SELECT NOW()")
    .then(() => {
      console.log("Supabase Connected Successfully");
    })
    .catch((err) => {
      console.error("Supabase Connection Error:", err.message);
    });
} else {
  console.log("DATABASE_URL not found. Database disabled.");
}

app.get("/api/test-db", async (req, res) => {
  try {
    if (!pool) {
      return res.status(500).json({
        success: false,
        error: "DATABASE_URL missing"
      });
    }

    const result = await pool.query("SELECT NOW()");

    res.json({
      success: true,
      message: "Supabase Connected Successfully",
      time: result.rows[0].now
    });

  } catch (err) {
    console.error("DB TEST ERROR:", err.message);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

async function dbQuery(query, params = []) {
  if (!pool) {
    throw new Error("Database not connected");
  }

  const result = await pool.query(query, params);
  return result.rows;
}


app.listen(PORT, () => {
  console.log(`Website running at http://localhost:${PORT}`);
});