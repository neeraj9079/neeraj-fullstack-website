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

async function readUsers() {
  return await dbQuery(
    "SELECT * FROM users ORDER BY id ASC"
  );
}

async function saveUser(user) {
  await dbQuery(
    `INSERT INTO users (id, name, email, password, role)
     VALUES ($1,$2,$3,$4,$5)`,
    [
      user.id,
      user.name,
      user.email,
      user.password,
      user.role
    ]
  );
}

function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect("/login.html");
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      message: "Login required",
      user: null
    });
  }

  if (String(req.session.user.role).toLowerCase() !== "admin") {
    return res.status(403).json({
      message: "Admin access required",
      user: req.session.user
    });
  }

  next();
}

/* AUTH - SUPABASE */

app.post("/api/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existingUsers = await dbQuery(
      "SELECT * FROM public.users WHERE email = $1",
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const allUsers = await dbQuery("SELECT id FROM public.users LIMIT 1");

    const hashedPassword = await bcrypt.hash(password, 10);

    const rows = await dbQuery(
      `INSERT INTO public.users (id, name, email, password, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, role`,
      [
        Date.now(),
        name,
        email,
        hashedPassword,
        allUsers.length === 0 ? "admin" : "user"
      ]
    );

    res.json({
      message: "Registered successfully. First user becomes admin.",
      user: rows[0]
    });

  } catch (error) {
    console.error("REGISTER ERROR:", error.message);
    res.status(500).json({
      message: "Register failed",
      error: error.message
    });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const rows = await dbQuery(
      "SELECT * FROM public.users WHERE email = $1",
      [email]
    );

    const user = rows[0];

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
  role: String(user.role || "user").toLowerCase()
};

    res.json({
      message: "Login successful",
      role: user.role
    });

  } catch (error) {
    console.error("LOGIN ERROR:", error.message);
    res.status(500).json({
      message: "Server login error",
      error: error.message
    });
  }
});

/* USERS - SUPABASE */

app.get("/api/admin/users", requireAdmin, async (req, res) => {
  try {
    const users = await dbQuery(
      "SELECT id, name, email, role, created_at FROM public.users ORDER BY id DESC"
    );

    res.json(users);
  } catch (error) {
    console.error("USERS GET ERROR:", error.message);
    res.status(500).json({
      message: "Users loading failed",
      error: error.message
    });
  }
});

app.delete("/api/admin/users/:id", requireAdmin, async (req, res) => {
  try {
    await dbQuery(
      "DELETE FROM public.users WHERE id = $1",
      [req.params.id]
    );

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("USER DELETE ERROR:", error.message);
    res.status(500).json({
      message: "User delete failed",
      error: error.message
    });
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

/* GALLERY - SUPABASE + CLOUDINARY */

app.get("/api/gallery", async (req, res) => {
  try {
    const gallery = await dbQuery(
      `SELECT id, title, image, description, public_id, created_at
       FROM public.gallery
       ORDER BY id DESC`
    );

    res.json(gallery);
  } catch (error) {
    console.error("GALLERY GET ERROR:", error.message);
    res.status(500).json({
      message: "Gallery loading failed",
      error: error.message
    });
  }
});

app.post("/api/admin/gallery", requireAdmin, upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "Please upload an image"
      });
    }

    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "neeraj-portfolio-gallery"
    });

    const rows = await dbQuery(
      `INSERT INTO public.gallery
       (title, image, description, public_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        req.body.title || "",
        result.secure_url,
        req.body.description || "",
        result.public_id
      ]
    );

    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.json({
      message: "Gallery image uploaded successfully",
      item: rows[0]
    });

  } catch (error) {
    console.error("GALLERY UPLOAD ERROR:", error.message);
    res.status(500).json({
      message: "Image upload failed",
      error: error.message
    });
  }
});

app.delete("/api/admin/gallery/:id", requireAdmin, async (req, res) => {
  try {
    const rows = await dbQuery(
      "SELECT public_id FROM public.gallery WHERE id = $1",
      [req.params.id]
    );

    const item = rows[0];

    if (item && item.public_id) {
      try {
        await cloudinary.uploader.destroy(item.public_id);
      } catch (cloudinaryError) {
        console.error("Cloudinary delete error:", cloudinaryError.message);
      }
    }

    await dbQuery(
      "DELETE FROM public.gallery WHERE id = $1",
      [req.params.id]
    );

    res.json({
      message: "Gallery item deleted successfully"
    });

  } catch (error) {
    console.error("GALLERY DELETE ERROR:", error.message);
    res.status(500).json({
      message: "Gallery item delete failed",
      error: error.message
    });
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

/* CONTACT - SUPABASE */

app.post("/api/contact", async (req, res) => {
  try {
    const messageData = {
      name: req.body.name || "",
      email: req.body.email || "",
      mobile: req.body.mobile || "",
      subject: req.body.subject || "",
      message: req.body.message || "",
      date: new Date().toLocaleString()
    };

    const rows = await dbQuery(
      `INSERT INTO public.messages 
       (name, email, mobile, subject, message, date)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        messageData.name,
        messageData.email,
        messageData.mobile,
        messageData.subject,
        messageData.message,
        messageData.date
      ]
    );

    res.json({
      message: "Message sent successfully",
      data: rows[0]
    });

    sendContactEmails(messageData);

  } catch (error) {
    console.error("CONTACT ERROR:", error.message);
    res.status(500).json({
      message: "Message failed",
      error: error.message
    });
  }
});

app.get("/api/admin/messages", requireAdmin, async (req, res) => {
  try {
    const messages = await dbQuery(
      `SELECT id, name, email, mobile, subject, message, date, created_at
       FROM public.messages
       ORDER BY id DESC`
    );

    res.json(messages);
  } catch (error) {
    console.error("MESSAGES GET ERROR:", error.message);
    res.status(500).json({
      message: "Messages loading failed",
      error: error.message
    });
  }
});

app.delete("/api/admin/messages/:id", requireAdmin, async (req, res) => {
  try {
    await dbQuery(
      "DELETE FROM public.messages WHERE id = $1",
      [req.params.id]
    );

    res.json({
      message: "Message deleted successfully"
    });

  } catch (error) {
    console.error("MESSAGE DELETE ERROR:", error.message);
    res.status(500).json({
      message: "Message delete failed",
      error: error.message
    });
  }
});
/* EMITRA SERVICES - SUPABASE */

app.get("/api/emitra-services", async (req, res) => {
  try {
    const services = await dbQuery(`
      SELECT 
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
      FROM public.emitra_services
      ORDER BY id DESC
    `);

    res.json(services);
  } catch (error) {
    console.error("EMITRA GET ERROR:", error.message);
    res.status(500).json({
      message: "e-Mitra services loading failed",
      error: error.message
    });
  }
});

app.post("/api/admin/emitra-services", requireAdmin, upload.single("formPdf"), async (req, res) => {
  try {
    const rows = await dbQuery(
      `INSERT INTO public.emitra_services 
       (name, category, documents, fees, processing_time, description, status, form_name, form_pdf)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
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

    res.json({
      message: "e-Mitra Service Added Successfully",
      service: rows[0]
    });
  } catch (error) {
    console.error("EMITRA ADD ERROR:", error.message);
    res.status(500).json({
      message: "e-Mitra service add failed",
      error: error.message
    });
  }
});

app.put("/api/admin/emitra-services/:id", requireAdmin, upload.single("formPdf"), async (req, res) => {
  try {
    const oldRows = await dbQuery(
      "SELECT form_name, form_pdf FROM public.emitra_services WHERE id = $1",
      [req.params.id]
    );

    const oldService = oldRows[0] || {};

    const rows = await dbQuery(
      `UPDATE public.emitra_services SET
        name = $1,
        category = $2,
        documents = $3,
        fees = $4,
        processing_time = $5,
        description = $6,
        status = $7,
        form_name = $8,
        form_pdf = $9
       WHERE id = $10
       RETURNING *`,
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

    res.json({
      message: "e-Mitra Service Updated Successfully",
      service: rows[0]
    });
  } catch (error) {
    console.error("EMITRA UPDATE ERROR:", error.message);
    res.status(500).json({
      message: "e-Mitra service update failed",
      error: error.message
    });
  }
});

app.delete("/api/admin/emitra-services/:id", requireAdmin, async (req, res) => {
  try {
    await dbQuery(
      "DELETE FROM public.emitra_services WHERE id = $1",
      [req.params.id]
    );

    res.json({
      message: "e-Mitra Service Deleted Successfully"
    });
  } catch (error) {
    console.error("EMITRA DELETE ERROR:", error.message);
    res.status(500).json({
      message: "e-Mitra service delete failed",
      error: error.message
    });
  }
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

/* SETTINGS - SUPABASE */

app.get("/api/settings", async (req, res) => {
  try {
    const rows = await dbQuery(
      "SELECT * FROM public.settings WHERE id = 1"
    );

    if (rows.length === 0) {
      return res.json({
        logo: "Neeraj.dev",
        footer: "© 2026 Neeraj Swami. All Rights Reserved.",
        whatsapp: "",
        email: "",
        github: "",
        linkedin: "",
        instagram: ""
      });
    }

    res.json(rows[0]);

  } catch (error) {
    console.error("SETTINGS GET ERROR:", error.message);

    res.status(500).json({
      message: "Settings loading failed",
      error: error.message
    });
  }
});

app.post("/api/admin/settings", requireAdmin, async (req, res) => {
  try {
    await dbQuery(
      `UPDATE public.settings SET
        logo = $1,
        logo_image = $2,
        footer = $3,
        whatsapp = $4,
        email = $5,
        github = $6,
        linkedin = $7,
        instagram = $8
       WHERE id = 1`,
      [
        req.body.logo || "",
        req.body.logo_image || "",
        req.body.footer || "",
        req.body.whatsapp || "",
        req.body.email || "",
        req.body.github || "",
        req.body.linkedin || "",
        req.body.instagram || ""
      ]
    );

    res.json({
      message: "Settings updated successfully"
    });

  } catch (error) {
    console.error("SETTINGS UPDATE ERROR:", error.message);

    res.status(500).json({
      message: "Settings update failed",
      error: error.message
    });
  }
});

/* VISITOR ANALYTICS - SUPABASE */

app.post("/api/track-visitor", async (req, res) => {
  try {
    await dbQuery(
      `INSERT INTO public.analytics
       (page, referrer, user_agent, ip)
       VALUES ($1, $2, $3, $4)`,
      [
        req.body.page || "Unknown",
        req.body.referrer || "Direct",
        req.headers["user-agent"] || "",
        req.headers["x-forwarded-for"] || req.socket.remoteAddress || ""
      ]
    );

    res.json({
      success: true,
      message: "Visitor tracked"
    });

  } catch (error) {
    console.error("VISITOR TRACK ERROR:", error.message);

    res.status(500).json({
      success: false,
      message: "Visitor tracking failed",
      error: error.message
    });
  }
});

app.get("/api/admin/analytics", requireAdmin, async (req, res) => {
  try {
    const totalRows = await dbQuery(
      "SELECT COUNT(*)::int AS total FROM public.analytics"
    );

    const todayRows = await dbQuery(
      `SELECT COUNT(*)::int AS total 
       FROM public.analytics
       WHERE created_at::date = CURRENT_DATE`
    );

    const recentVisits = await dbQuery(
      `SELECT id, page, referrer, user_agent AS "userAgent", ip, created_at AS date
       FROM public.analytics
       ORDER BY id DESC
       LIMIT 100`
    );

    res.json({
      totalVisits: totalRows[0].total,
      todayVisits: todayRows[0].total,
      recentVisits
    });

  } catch (error) {
    console.error("ANALYTICS ERROR:", error.message);

    res.status(500).json({
      message: "Analytics loading failed",
      error: error.message
    });
  }
});

let pool = null;

if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
}

async function dbQuery(query, params = []) {
  if (!pool) throw new Error("Database not connected");

  const result = await pool.query(query, params);
  return result.rows;
}

app.listen(PORT, () => {
  console.log(`Website running at http://localhost:${PORT}`);
});