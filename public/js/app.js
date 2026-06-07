async function getMe(){
  const r = await fetch('/api/me');
  const data = await r.json();
  const el = document.getElementById('userStatus');
  if(el) el.innerHTML = data.user ? `Welcome, ${data.user.name} (${data.user.role}) <button onclick="logout()" class="btn secondary">Logout</button>` : '<a class="btn" href="login.html">Login</a>';
}
async function logout(){ await fetch('/api/logout',{method:'POST'}); location.href='/'; }
async function handleRegister(e){
  e.preventDefault();
  const body = Object.fromEntries(new FormData(e.target));
  const r = await fetch('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const d = await r.json(); alert(d.message); if(r.ok) location.href='login.html';
}
async function handleLogin(e){
  e.preventDefault();
  const body = Object.fromEntries(new FormData(e.target));
  const r = await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const d = await r.json(); alert(d.message); if(r.ok) location.href=d.role==='admin'?'/admin':'/dashboard';
}
async function loadAdminUsers(){
  const r = await fetch('/api/admin/users');
  if(!r.ok) return;
  const users = await r.json();
  const body = document.getElementById('usersBody');
  if(body) body.innerHTML = users.map(u=>`<tr><td>${u.id}</td><td>${u.name}</td><td>${u.email}</td><td>${u.role}</td></tr>`).join('');
}
getMe(); loadAdminUsers();
