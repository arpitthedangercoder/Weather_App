// Connects your existing Sign-in / logout buttons to the Django API.
// Your header HTML is not changed: buttons are found by their text.
(() => {
  const buttons = [...document.querySelectorAll(".login")];
  const signInBtn = buttons.find(b => /sign/i.test(b.textContent));
  const logoutBtn = buttons.find(b => /logout/i.test(b.textContent));
  if (!signInBtn || !logoutBtn) return;

  // ----- JWT storage + requests
  const store = {
    get access() { return localStorage.getItem("wx_access"); },
    get refresh() { return localStorage.getItem("wx_refresh"); },
    set(t) {
      if (t.access) localStorage.setItem("wx_access", t.access);
      if (t.refresh) localStorage.setItem("wx_refresh", t.refresh);   // refresh rotates
    },
    clear() { localStorage.removeItem("wx_access"); localStorage.removeItem("wx_refresh"); },
  };

  async function raw(path, body) {
    const opt = { headers: {} };
    if (store.access) opt.headers.Authorization = "Bearer " + store.access;
    if (body !== undefined) {
      opt.method = "POST";
      opt.headers["Content-Type"] = "application/json";
      opt.body = JSON.stringify(body);
    }
    const res = await fetch("/api/" + path, opt);
    const data = await res.json().catch(() => ({}));
    return { res, data };
  }

  async function tryRefresh() {
    if (!store.refresh) return false;
    const { res, data } = await raw("token/refresh/", { refresh: store.refresh });
    if (!res.ok) { store.clear(); return false; }
    store.set(data);
    return true;
  }

  // Normal API call: if the access token expired (401), refresh once and retry.
  async function api(path, body) {
    let { res, data } = await raw(path, body);
    if (res.status === 401 && store.refresh && (await tryRefresh())) ({ res, data } = await raw(path, body));
    if (!res.ok) throw new Error(data.error || "Something went wrong.");
    return data;
  }

  // ----- styles + modal (injected, so index.html stays untouched)
  const css = document.createElement("style");
  css.textContent = `
  .auth-hello{
  margin-right:10px;
  font-size:14px;
  opacity:.85
  }
  .auth-overlay{
  position:fixed;
  inset:0;
  background:rgba(0,0,0,.6);
  display:
  flex;align-items:center;
  justify-content:center;
  z-index:99
  }
  .auth-overlay[hidden]{
  display:none
  }
  .auth-box{
  background:#161a28;
  color:#fff;
  width:min(360px,92vw);
  border-radius:12px;
  padding:24px;
  position:relative;
  font-family:inherit;
  }
  .auth-box h3{
  margin-bottom:14px;
  font-weight:600
  }
  .auth-box input
  {width:100%;
  padding:11px 12px;
  margin-bottom:10px;
  border-radius:8px;
  border:1px solid rgba(255,255,255,.2);
  background:rgba(255,255,255,.08);
  color:#fff;
  font:inherit;
  outline:none
  }
  .auth-box input:focus{
  border-color:#f28a6a
  }
  .auth-box .go{
  width:100%;
  padding:11px;
  border-radius:8px;
  border:0;
  background:#f28a6a;
  color:#14131d;
  font-weight:600;
  cursor:pointer
  }
  .auth-box .go:disabled{
  opacity:.5
  }
  .auth-tabs{
  display:flex;
  gap:18px;
  margin-bottom:16px
  }
  .auth-tabs button{
  background:none;
  border:0;
  color:#fff;
  opacity:.5;
  font:inherit;
  cursor:pointer;
  padding:0
  }
  .auth-tabs button.on{
  opacity:1;
  border-bottom:2px solid #f28a6a
  }
  .auth-err{
  color:#ffb4a2;
  font-size:13px;
  min-height:18px;
  margin-bottom:8px
  }
  .auth-x{
  position:absolute;
  top:8px;
  right:12px;
  background:none;
  border:0;
  color:#fff;
  font-size:22px;
  cursor:pointer
  }`;
  document.head.appendChild(css);

  const overlay = document.createElement("div");
  overlay.className = "auth-overlay";
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="auth-box">
      <button class="auth-x" type="button" aria-label="Close">×</button>
      <div class="auth-tabs"><button type="button" data-mode="login" class="on">Sign in</button><button type="button" data-mode="register">Create account</button></div>
      <form id="authForm" autocomplete="on">
        <input name="username" placeholder="Username" required autocomplete="username">
        <input name="email" type="email" placeholder="Email (optional)" autocomplete="email" hidden>
        <input name="password" type="password" placeholder="Password" required autocomplete="current-password">
        <div class="auth-err" id="authErr"></div>
        <button class="go" type="submit">Sign in</button>
      </form>
    </div>`;
  document.body.appendChild(overlay);

  const form = overlay.querySelector("#authForm");
  const err = overlay.querySelector("#authErr");
  const go = overlay.querySelector(".go");
  const emailInput = form.elements.email;
  let mode = "login ";

  function setMode(m) {
    mode = m;
    overlay.querySelectorAll(".auth-tabs button").forEach(b => b.classList.toggle("on", b.dataset.mode === m));
    emailInput.hidden = m !== "register";
    form.elements.password.autocomplete = m === "register" ? "new-password" : "current-password";
    go.textContent = m === "register" ? "Create account" : "Sign in";
    err.textContent = "";
  }
  const open = () => { overlay.hidden = false; form.elements.username.focus(); };
  const close = () => { overlay.hidden = true; form.reset(); err.textContent = ""; };

  overlay.querySelector(".auth-tabs").onclick = e => { const b = e.target.closest("button"); if (b) setMode(b.dataset.mode); };
  overlay.querySelector(".auth-x").onclick = close;
  overlay.onclick = e => { if (e.target === overlay) close(); };
  signInBtn.onclick = () => { setMode("login"); open(); };

  // ----- greeting next to the buttons
  const hello = document.createElement("span");
  hello.className = "auth-hello";
  logoutBtn.before(hello);

  function show(me) {
    signInBtn.hidden = me.authenticated;
    logoutBtn.hidden = !me.authenticated;
    hello.hidden = !me.authenticated;
    hello.textContent = me.authenticated ? "Hi, " + me.username : "";
    window.currentUser = me.authenticated ? me.username : null;   // other scripts can use this later
    document.dispatchEvent(new CustomEvent("auth-changed", { detail: me }));
  }

  async function sync() {
    if (!store.access && !store.refresh) return show({ authenticated: false });
    try { show(await api("me/")); }
    catch { store.clear(); show({ authenticated: false }); }
  }

  form.onsubmit = async e => {
    e.preventDefault();
    go.disabled = true; err.textContent = "";
    const body = { username: form.elements.username.value, password: form.elements.password.value };
    if (mode === "register") body.email = form.elements.email.value;
    try {
      store.set(await api(mode === "register" ? "register/" : "login/", body));
      close();
      await sync();
    } catch (ex) { err.textContent = ex.message; }
    go.disabled = false;
  };

  logoutBtn.onclick = async () => {
    try { await raw("logout/", { refresh: store.refresh }); } catch {}
    store.clear();
    show({ authenticated: false });
  };

  sync();
})();
