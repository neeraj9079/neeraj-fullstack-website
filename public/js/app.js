async function getMe() {
  try {
    const res = await fetch("/api/me");
    const data = await res.json();
    const userStatus = document.getElementById("userStatus");

    if (userStatus) {
      userStatus.innerHTML = data.user
        ? `<p><strong>Logged in as:</strong> ${data.user.name} (${data.user.role})</p>
           <button class="btn" onclick="logout()">Logout</button>`
        : `<p>You are not logged in.</p>`;
    }
  } catch (error) {
    console.error("Get user error:", error);
  }
}

async function handleRegister(event) {
  event.preventDefault();

  const form = event.target;

  const res = await fetch("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: form.name.value,
      email: form.email.value,
      password: form.password.value
    })
  });

  const data = await res.json();
  alert(data.message);

  if (res.ok) window.location.href = "login.html";
}

async function handleLogin(event) {
  event.preventDefault();

  const form = event.target;

  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: form.email.value,
      password: form.password.value
    })
  });

  const data = await res.json();
  alert(data.message);

  if (res.ok) {
    window.location.href = data.role === "admin" ? "/admin-neeraj-9079" : "/dashboard";
  }
}

async function logout() {
  await fetch("/api/logout", { method: "POST" });
  window.location.href = "login.html";
}

async function loadDashboardStats() {
  try {
    const usersRes = await fetch("/api/admin/users");
    const projectsRes = await fetch("/api/projects");
    const galleryRes = await fetch("/api/gallery");
    const messagesRes = await fetch("/api/admin/messages");

    const users = usersRes.ok ? await usersRes.json() : [];
    const projects = projectsRes.ok ? await projectsRes.json() : [];
    const gallery = galleryRes.ok ? await galleryRes.json() : [];
    const messages = messagesRes.ok ? await messagesRes.json() : [];

    if (document.getElementById("totalUsers")) {
      document.getElementById("totalUsers").textContent = users.length;
    }

    if (document.getElementById("adminUsers")) {
      document.getElementById("adminUsers").textContent =
        users.filter(user => user.role === "admin").length;
    }

    if (document.getElementById("totalProjects")) {
      document.getElementById("totalProjects").textContent = projects.length;
    }

    if (document.getElementById("galleryImages")) {
      document.getElementById("galleryImages").textContent = gallery.length;
    }

    if (document.getElementById("contactMessages")) {
      document.getElementById("contactMessages").textContent = messages.length;
    }
  } catch (error) {
    console.error("Dashboard stats error:", error);
  }
}

async function loadAdminUsers() {
  const usersBody = document.getElementById("usersBody");
  if (!usersBody) return;

  try {
    const res = await fetch("/api/admin/users");

    if (!res.ok) {
      usersBody.innerHTML = `<tr><td colspan="5">Access denied. Admin login required.</td></tr>`;
      return;
    }

    const users = await res.json();

    usersBody.innerHTML = users.map(user => `
      <tr>
        <td>${user.id}</td>
        <td>${user.name}</td>
        <td>${user.email}</td>
        <td>${user.role}</td>
        <td>
          <button class="delete-btn" onclick="deleteUser(${user.id})">Delete</button>
        </td>
      </tr>
    `).join("");
  } catch (error) {
    console.error("Admin users error:", error);
  }
}

/* HOME CMS */
const homeForm = document.getElementById("homeForm");

if (homeForm) {
  fetch("/api/home")
    .then(res => res.json())
    .then(data => {
      document.getElementById("homeTitle").value = data.title || "";
      document.getElementById("homeSubtitle").value = data.subtitle || "";
    });

  homeForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const res = await fetch("/api/admin/home", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: document.getElementById("homeTitle").value,
        subtitle: document.getElementById("homeSubtitle").value
      })
    });

    const data = await res.json();
    alert(data.message || "Home Page Saved");
  });
}

/* ABOUT CMS */
const aboutForm = document.getElementById("aboutForm");

if (aboutForm) {
  fetch("/api/about")
    .then(res => res.json())
    .then(data => {
      document.getElementById("aboutContent").value = data.content || "";
    });

  aboutForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const res = await fetch("/api/admin/about", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: document.getElementById("aboutContent").value
      })
    });

    const data = await res.json();
    alert(data.message || "About Page Saved");
  });
}

/* SHOW HOME */
const homeTitleText = document.getElementById("homeTitleText");
const homeSubtitleText = document.getElementById("homeSubtitleText");

if (homeTitleText && homeSubtitleText) {
  fetch("/api/home")
    .then(res => res.json())
    .then(data => {
      homeTitleText.textContent = data.title || "Neeraj Swami";
      homeSubtitleText.textContent = data.subtitle || "Full Stack Developer | IT Support Assistant";
    });
}

/* SHOW ABOUT */
const aboutContentText = document.getElementById("aboutContentText");

if (aboutContentText) {
  fetch("/api/about")
    .then(res => res.json())
    .then(data => {
      aboutContentText.innerHTML = data.content || "";
    });
}

/* SHOW PROJECTS */
const projectsContainer = document.getElementById("projectsContainer");

if (projectsContainer) {
  fetch("/api/projects")
    .then(res => res.json())
    .then(projects => {
      if (!projects.length) {
        projectsContainer.innerHTML = "<p>No projects added yet.</p>";
        return;
      }

      projectsContainer.innerHTML = projects.map(project => {
        const title = String(project.title || "");
        const isEmitraProject = title.toLowerCase().includes("e-mitra");

        const projectLink = isEmitraProject
          ? "emitra.html"
          : project.demo || "#";

        return `
          <a href="${projectLink}" class="project-click-card">
            <div class="project">
              <h3>${project.title}</h3>
              <p>${project.description}</p>

              ${project.github ? `<span class="btn">GitHub</span>` : ""}
              <span class="btn secondary">
                ${isEmitraProject ? "Open e-Mitra Portal" : "Open Project"}
              </span>
            </div>
          </a>
        `;
      }).join("");
    })
    .catch(error => {
      console.error("Projects load error:", error);
      projectsContainer.innerHTML = "<p>Projects load failed.</p>";
    });
}

/* ADD PROJECT */
const projectForm = document.getElementById("projectForm");

if (projectForm) {
  projectForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const body = {
      title: document.getElementById("projectTitle").value,
      description: document.getElementById("projectDescription").value,
      github: document.getElementById("projectGithub").value,
      demo: document.getElementById("projectDemo").value
    };

    console.log("PROJECT BODY:", body);

    const res = await fetch("/api/admin/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body)
    });

    const data = await res.json().catch(() => ({}));

    console.log("PROJECT RESPONSE:", res.status, data);

    if (!res.ok) {
      alert(data.message || `Project add failed. Status: ${res.status}`);
      return;
    }

    alert(data.message || "Project added successfully");
    location.reload();
  });
}

/* ADMIN PROJECT LIST */
const adminProjectsList = document.getElementById("adminProjectsList");

if (adminProjectsList) {
  fetch("/api/projects")
    .then(res => res.json())
    .then(projects => {
      if (!projects.length) {
        adminProjectsList.innerHTML = "<p>No projects added yet.</p>";
        return;
      }

      adminProjectsList.innerHTML = projects.map(project => `
        <div class="service">
          <h3>${project.title}</h3>
          <p>${project.description}</p>
          <button onclick="deleteProject(${project.id})">Delete</button>
        </div>
      `).join("");
    });
}

async function deleteProject(id) {
  const res = await fetch(`/api/admin/projects/${id}`, { method: "DELETE" });
  const data = await res.json();
  alert(data.message || "Project deleted successfully");
  location.reload();
}

/* SHOW GALLERY */
const galleryContainer = document.getElementById("galleryContainer");

if (galleryContainer) {
  fetch("/api/gallery")
    .then(res => res.json())
    .then(gallery => {
      if (!gallery.length) {
        galleryContainer.innerHTML = "<p>No gallery items added yet.</p>";
        return;
      }

      galleryContainer.innerHTML = gallery.map(item => `
        <div class="gallery-item">
          ${item.image ? `<img src="${item.image}" alt="${item.title}">` : ""}
          <h3>${item.title}</h3>
          <p>${item.description || ""}</p>
        </div>
      `).join("");
    });
}

/* UPLOAD GALLERY IMAGE */
const galleryForm = document.getElementById("galleryForm");

if (galleryForm) {
  galleryForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const imageFile = document.getElementById("galleryImage").files[0];

    if (!imageFile) {
      alert("Please choose an image");
      return;
    }

    const formData = new FormData();
    formData.append("title", document.getElementById("galleryTitle").value);
    formData.append("description", document.getElementById("galleryDescription").value);
    formData.append("image", imageFile);

    const res = await fetch("/api/admin/gallery", {
      method: "POST",
      body: formData
    });

    const data = await res.json();
    alert(data.message || "Gallery image uploaded successfully");
    location.reload();
  });
}

/* ADMIN GALLERY LIST */
const adminGalleryList = document.getElementById("adminGalleryList");

if (adminGalleryList) {
  fetch("/api/gallery")
    .then(res => res.json())
    .then(gallery => {
      if (!gallery.length) {
        adminGalleryList.innerHTML = "<p>No gallery items added yet.</p>";
        return;
      }

      adminGalleryList.innerHTML = gallery.map(item => `
        <div class="service">
          ${item.image ? `<img src="${item.image}" alt="${item.title}" style="width:120px;border-radius:10px;">` : ""}
          <h3>${item.title}</h3>
          <p>${item.description || ""}</p>
          <button onclick="deleteGalleryItem(${item.id})">Delete</button>
        </div>
      `).join("");
    });
}

async function deleteGalleryItem(id) {
  const res = await fetch(`/api/admin/gallery/${id}`, { method: "DELETE" });
  const data = await res.json();
  alert(data.message || "Gallery item deleted successfully");
  location.reload();
}

/* MODERN RESUME DISPLAY */
const resumeBox = document.getElementById("resumeBox");

if (resumeBox) {
  fetch("/api/resume")
    .then(res => res.json())
    .then(data => {

      const resumeName = document.getElementById("resumeName");
      const resumeRole = document.getElementById("resumeRole");
      const resumeExperience = document.getElementById("resumeExperience");
      const resumeLanguages = document.getElementById("resumeLanguages");
      const resumeEducation = document.getElementById("resumeEducation");
      const resumeObjective = document.getElementById("resumeObjective");
      const resumeSkills = document.getElementById("resumeSkills");

      if (resumeName) {
        resumeName.textContent = data.name || "Neeraj Swami";
      }

      if (resumeRole) {
        resumeRole.textContent = data.role || "IT Support Assistant";
      }

      if (resumeExperience) {
        resumeExperience.textContent = data.experience || "";
      }

      if (resumeLanguages) {
        resumeLanguages.textContent = data.languages || "";
      }

      if (resumeEducation) {
        resumeEducation.textContent = data.education || "";
      }

      if (resumeObjective) {
        resumeObjective.textContent = data.objective || "";
      }

      if (resumeSkills) {
        const skills = String(data.skills || "")
          .split(",")
          .map(skill => skill.trim())
          .filter(Boolean);

        resumeSkills.innerHTML = skills
          .map(skill => `<span>${skill}</span>`)
          .join("");
      }

      if (data.resume) {
        resumeBox.innerHTML = `
          <a class="resume-download-btn"
             href="${data.resume}"
             target="_blank"
             download>
             Download Resume
          </a>

          <iframe
            class="resume-frame"
            src="${data.resume}">
          </iframe>
        `;
      } else {
        resumeBox.innerHTML =
          "<p>No resume PDF uploaded.</p>";
      }
    })
    .catch(error => {
      console.error("Resume load error:", error);
    });
}

/* MODERN RESUME ADMIN */
const resumeForm = document.getElementById("resumeForm");

if (resumeForm) {

  fetch("/api/resume")
    .then(res => res.json())
    .then(data => {

      if(document.getElementById("resumeName"))
        document.getElementById("resumeName").value = data.name || "";

      if(document.getElementById("resumeRole"))
        document.getElementById("resumeRole").value = data.role || "";

      if(document.getElementById("resumeExperience"))
        document.getElementById("resumeExperience").value = data.experience || "";

      if(document.getElementById("resumeSkills"))
        document.getElementById("resumeSkills").value = data.skills || "";

      if(document.getElementById("resumeLanguages"))
        document.getElementById("resumeLanguages").value = data.languages || "";

      if(document.getElementById("resumeEducation"))
        document.getElementById("resumeEducation").value = data.education || "";

      if(document.getElementById("resumeObjective"))
        document.getElementById("resumeObjective").value = data.objective || "";
    });

  resumeForm.addEventListener("submit", async function(e){
    e.preventDefault();

    const formData = new FormData();

    formData.append("name", resumeName.value);
    formData.append("role", resumeRole.value);
    formData.append("experience", resumeExperience.value);
    formData.append("skills", resumeSkills.value);
    formData.append("languages", resumeLanguages.value);
    formData.append("education", resumeEducation.value);
    formData.append("objective", resumeObjective.value);

    const file = document.getElementById("resumeFile");

    if(file && file.files[0]){
      formData.append("resume", file.files[0]);
    }

    const res = await fetch("/api/admin/resume", {
      method: "POST",
      body: formData
    });

    const data = await res.json();

    alert(data.message || "Resume saved successfully");
  });
}

/* CONTACT FORM */
const contactForm = document.getElementById("contactForm");

if (contactForm) {
  contactForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    alert("Sending message...");

    const body = {
      name: document.getElementById("contactName").value,
      email: document.getElementById("contactEmail").value,
      mobile: document.getElementById("contactMobile").value,
      subject: document.getElementById("contactSubject").value,
      message: document.getElementById("contactMessage").value
    };

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      let data = {};

      try {
        data = await res.json();
      } catch {
        data = {};
      }

      if (res.ok) {
        alert(data.message || "Message sent successfully");
        contactForm.reset();
      } else {
        alert(data.message || "Message failed. Please try again.");
      }
    } catch (error) {
      console.error("Contact error:", error);
      alert("Network error. Please try again.");
    }
  });
}

/* ADMIN MESSAGES */
const adminMessagesList = document.getElementById("adminMessagesList");

if (adminMessagesList) {
  fetch("/api/admin/messages")
    .then(res => res.json())
    .then(messages => {
      if (!messages.length) {
        adminMessagesList.innerHTML = "<p>No messages yet.</p>";
        return;
      }

      adminMessagesList.innerHTML = messages.map(msg => `
        <div class="service">
          <h3>${msg.name}</h3>
          <p><strong>Email:</strong> ${msg.email}</p>
          <p><strong>Mobile:</strong> ${msg.mobile || "Not provided"}</p>
          <p><strong>Subject:</strong> ${msg.subject || "No subject"}</p>
          <p><strong>Message:</strong> ${msg.message}</p>
          <p><strong>Date:</strong> ${msg.date}</p>
          <button onclick="deleteMessage(${msg.id})">Delete</button>
        </div>
      `).join("");
    });
}

/* SETTINGS */
const settingsForm = document.getElementById("settingsForm");

if (settingsForm) {
  fetch("/api/settings")
    .then(res => res.json())
    .then(data => {
      document.getElementById("siteLogo").value = data.logo || "";
      document.getElementById("logoImage").value = data.logoImage || "";
      document.getElementById("footerText").value = data.footer || "";
      document.getElementById("whatsappNumber").value = data.whatsapp || "";
      document.getElementById("siteEmail").value = data.email || "";
      document.getElementById("githubLink").value = data.github || "";
      document.getElementById("linkedinLink").value = data.linkedin || "";
      document.getElementById("instagramLink").value = data.instagram || "";
    });

  settingsForm.addEventListener("submit", async function(e) {
    e.preventDefault();

    const body = {
      logo: document.getElementById("siteLogo").value,
      logoImage: document.getElementById("logoImage").value,
      footer: document.getElementById("footerText").value,
      whatsapp: document.getElementById("whatsappNumber").value,
      email: document.getElementById("siteEmail").value,
      github: document.getElementById("githubLink").value,
      linkedin: document.getElementById("linkedinLink").value,
      instagram: document.getElementById("instagramLink").value
    };

    const res = await fetch("/api/admin/settings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    alert(data.message);
  });
}

/* FOOTER */
const footerDisplay = document.getElementById("footerTextDisplay");

if (footerDisplay) {
  fetch("/api/settings")
    .then(res => res.json())
    .then(data => {
      footerDisplay.textContent = data.footer || "© 2026 Neeraj Swami. All Rights Reserved.";
    });
}

/* LOGO */
const siteLogoText = document.getElementById("siteLogoText");
const siteLogoImage = document.getElementById("siteLogoImage");

if (siteLogoText || siteLogoImage) {
  fetch("/api/settings")
    .then(res => res.json())
    .then(data => {
      if (siteLogoText) {
        siteLogoText.textContent = data.logo || "Neeraj.dev";
      }

      if (siteLogoImage && data.logoImage) {
        siteLogoImage.src = data.logoImage;
        siteLogoImage.style.display = "inline-block";
      }
    });
}

/* SOCIAL LINKS */
const socialLinks = document.getElementById("socialLinks");

if (socialLinks) {
  fetch("/api/settings")
    .then(res => res.json())
    .then(data => {
      socialLinks.innerHTML = `
        ${data.github ? `<a href="${data.github}" target="_blank">GitHub</a>` : ""}
        ${data.linkedin ? `<a href="${data.linkedin}" target="_blank">LinkedIn</a>` : ""}
        ${data.instagram ? `<a href="${data.instagram}" target="_blank">Instagram</a>` : ""}
        ${data.whatsapp ? `<a href="https://wa.me/${data.whatsapp}" target="_blank">WhatsApp</a>` : ""}
        ${data.email ? `<a href="mailto:${data.email}">Email</a>` : ""}
      `;
    });
}

/* WHATSAPP FLOAT */
const whatsappFloat = document.getElementById("whatsappFloat");

if (whatsappFloat) {
  fetch("/api/settings")
    .then(res => res.json())
    .then(data => {
      if (data.whatsapp) {
        whatsappFloat.href = `https://wa.me/${data.whatsapp}`;
        whatsappFloat.style.display = "inline-block";
      } else {
        whatsappFloat.style.display = "none";
      }
    });
}

/* RESUME DOWNLOAD BUTTON */
const resumeDownloadBtn = document.getElementById("resumeDownloadBtn");

if (resumeDownloadBtn) {
  fetch("/api/resume")
    .then(res => res.json())
    .then(data => {
      if (data.resume) {
        resumeDownloadBtn.href = data.resume;
        resumeDownloadBtn.setAttribute("download", "");
      } else {
        resumeDownloadBtn.style.display = "none";
      }
    });
}

/* DELETE USER */
async function deleteUser(id) {
  const confirmDelete = confirm("Are you sure you want to delete this user?");
  if (!confirmDelete) return;

  try {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "DELETE"
    });

    const data = await res.json();

    alert(data.message || "User deleted successfully");

    loadAdminUsers();
    loadDashboardStats();
  } catch (err) {
    console.error(err);
    alert("Delete failed");
  }
}

async function deleteMessage(id) {
  const confirmDelete = confirm("Are you sure you want to delete this message?");
  if (!confirmDelete) return;

  try {
    const res = await fetch(`/api/admin/messages/${id}`, {
      method: "DELETE"
    });

    const data = await res.json();

    alert(data.message || "Message deleted successfully");
    location.reload();
  } catch (err) {
    console.error(err);
    alert("Delete failed");
  }
}

getMe();

const isAdminPage =
  document.body.classList.contains("admin-body") ||
  window.location.pathname.includes("admin") ||
  window.location.pathname.includes("dashboard");

if (isAdminPage) {
  loadAdminUsers();
  loadDashboardStats();
}