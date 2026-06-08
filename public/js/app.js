async function getMe() {
  try {
    const res = await fetch('/api/me');
    const data = await res.json();

    const userStatus = document.getElementById('userStatus');

    if (userStatus) {
      if (data.user) {
        userStatus.innerHTML = `
          <p><strong>Logged in as:</strong> ${data.user.name} (${data.user.role})</p>
          <button class="btn" onclick="logout()">Logout</button>
        `;
      } else {
        userStatus.innerHTML = `<p>You are not logged in.</p>`;
      }
    }
  } catch (error) {
    console.error('Get user error:', error);
  }
}

async function handleRegister(event) {
  event.preventDefault();

  const form = event.target;

  const body = {
    name: form.name.value,
    email: form.email.value,
    password: form.password.value
  };

  const res = await fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  alert(data.message);

  if (res.ok) {
    window.location.href = 'login.html';
  }
}

async function handleLogin(event) {
  event.preventDefault();

  const form = event.target;

  const body = {
    email: form.email.value,
    password: form.password.value
  };

  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  alert(data.message);

  if (res.ok) {
    if (data.role === 'admin') {
      window.location.href = '/admin';
    } else {
      window.location.href = '/dashboard';
    }
  }
}

async function logout() {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = 'login.html';
}

async function loadAdminUsers() {
  const usersBody = document.getElementById('usersBody');
  if (!usersBody) return;

  try {
    const res = await fetch('/api/admin/users');

    if (!res.ok) {
      usersBody.innerHTML = `
        <tr>
          <td colspan="4">Access denied. Admin login required.</td>
        </tr>
      `;
      return;
    }

    const users = await res.json();

    usersBody.innerHTML = users.map(user => `
      <tr>
        <td>${user.id}</td>
        <td>${user.name}</td>
        <td>${user.email}</td>
        <td>${user.role}</td>
      </tr>
    `).join('');

    const totalUsers = document.getElementById('totalUsers');
    const adminUsers = document.getElementById('adminUsers');

    if (totalUsers) totalUsers.textContent = users.length;
    if (adminUsers) adminUsers.textContent = users.filter(user => user.role === 'admin').length;

  } catch (error) {
    console.error('Admin users error:', error);
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

      projectsContainer.innerHTML = projects.map(project => `
        <div class="project">
          <h3>${project.title}</h3>
          <p>${project.description}</p>
          ${project.github ? `<a class="btn" href="${project.github}" target="_blank">GitHub</a>` : ""}
          ${project.demo ? `<a class="btn secondary" href="${project.demo}" target="_blank">Live Demo</a>` : ""}
        </div>
      `).join("");
    });
}

/* ADD PROJECT */
const projectForm = document.getElementById("projectForm");

if (projectForm) {
  projectForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const res = await fetch("/api/admin/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: document.getElementById("projectTitle").value,
        description: document.getElementById("projectDescription").value,
        github: document.getElementById("projectGithub").value,
        demo: document.getElementById("projectDemo").value
      })
    });

    const data = await res.json();
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

const resumeBox = document.getElementById("resumeBox");

if (resumeBox) {
  fetch("/api/resume")
    .then(res => res.json())
    .then(data => {
      if (!data.resume) {
        resumeBox.innerHTML = "<p>No resume uploaded yet.</p>";
        return;
      }

      resumeBox.innerHTML = `
        <a class="btn" href="${data.resume}" download>Download Resume</a>
        <br><br>
        <iframe src="${data.resume}" width="100%" height="700" style="border-radius:15px;border:1px solid #eee;"></iframe>
      `;
    });
}

const resumeForm = document.getElementById("resumeForm");

if (resumeForm) {
  resumeForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const file = document.getElementById("resumeFile").files[0];

    if (!file) {
      alert("Please choose resume PDF");
      return;
    }

    const formData = new FormData();
    formData.append("resume", file);

    const res = await fetch("/api/admin/resume", {
      method: "POST",
      body: formData
    });

    const data = await res.json();
    alert(data.message || "Resume uploaded successfully");
    location.reload();
  });
}

const contactForm = document.getElementById("contactForm");

if (contactForm) {
  contactForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const body = {
  name: document.getElementById("contactName").value,
  email: document.getElementById("contactEmail").value,
  mobile: document.getElementById("contactMobile").value,
  subject: document.getElementById("contactSubject").value,
  message: document.getElementById("contactMessage").value
};

    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    alert(data.message || "Message sent successfully");

    contactForm.reset();
  });
}

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

async function deleteMessage(id) {
  const res = await fetch(`/api/admin/messages/${id}`, {
    method: "DELETE"
  });

  const data = await res.json();
  alert(data.message || "Message deleted successfully");
  location.reload();
}

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

const footerDisplay = document.getElementById("footerTextDisplay");

if (footerDisplay) {
  fetch("/api/settings")
    .then(res => res.json())
    .then(data => {
      footerDisplay.textContent = data.footer;
    });
}

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


getMe();
loadAdminUsers();