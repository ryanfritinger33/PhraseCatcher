// ===== CONFIG: set your project values =====
const SUPABASE_URL = "https://fqlqqgjblnksfluzhnpf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxbHFxZ2pibG5rc2ZsdXpobnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ4NTQzMjEsImV4cCI6MjA3MDQzMDMyMX0.EKBrkuxyNWGWmSL8f9nVFKrjR5XNMrYyfwJmaGrM8IE";
const PAGE_SIZE = 20;
// ==========================================

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const el = (id) => document.getElementById(id);
const loginForm = el("login-form");
const logoutBtn = el("logout");
const copyTokenBtn = el("copyToken");
const whoami = el("whoami");
const controls = el("controls");
const list = el("list");
const rows = el("rows");
const q = el("q");
const verified = el("verified");
const sort = el("sort");
const exportBtn = el("exportCsv");
const prevBtn = el("prev");
const nextBtn = el("next");
const pageInfo = el("pageInfo");

let page = 1;
let session = null;

init();

async function init() {
  supabase.auth.onAuthStateChange((_event, s) => {
    session = s;
    renderAuth();
    if (s) load();
  });
  const { data } = await supabase.auth.getSession();
  session = data.session;
  renderAuth();
  if (session) load();
}

function renderAuth() {
  const isLoggedIn = !!session?.user;
  loginForm.hidden = isLoggedIn;
  logoutBtn.hidden = !isLoggedIn;
  copyTokenBtn.hidden = !isLoggedIn;
  whoami.textContent = isLoggedIn ? `Signed in as ${session.user.email}` : "";
  controls.hidden = !isLoggedIn;
  list.hidden = !isLoggedIn;
}

loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = el("email").value.trim();
  if (!email) return;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: location.href }
  });
  alert(error ? error.message : "Check your email for the sign-in link.");
});

logoutBtn.addEventListener("click", async () => {
  await supabase.auth.signOut();
});

copyTokenBtn.addEventListener("click", async () => {
  const token = session?.access_token;
  if (!token) return alert("No token");
  await navigator.clipboard.writeText(token);
  alert("Access token copied to clipboard.");
});

[q, verified, sort].forEach(c => c.addEventListener("input", () => { page = 1; load(); }));
prevBtn.addEventListener("click", () => { if (page > 1) { page--; load(); }});
nextBtn.addEventListener("click", () => { page++; load(); });
exportBtn.addEventListener("click", exportCSV);

async function load() {
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase.from("phrases").select("*", { count: "exact" });

  const text = q?.value?.trim();
  if (text) {
    query = query.or([
      `original.ilike.%${text}%`,
      `translation.ilike.%${text}%`,
      `tags.cs.{${text}}`
    ].join(","));
  }

  if (verified.value === "true") query = query.eq("verified", true);
  if (verified.value === "false") query = query.eq("verified", false);

  const [col, dir] = sort.value.split(".");
  query = query.order(col, { ascending: dir === "asc" }).range(from, to);

  const { data, error, count } = await query;
  if (error) {
    rows.innerHTML = `<p class="muted">Error loading: ${error.message}</p>`;
    return;
  }

  renderRows(data || []);
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  pageInfo.textContent = `Page ${page} / ${totalPages} • ${total} items`;
  nextBtn.disabled = page >= totalPages;
  prevBtn.disabled = page <= 1;
}

function renderRows(items) {
  rows.innerHTML = "";
  if (!items.length) {
    rows.innerHTML = `<p class="muted">No results yet.</p>`;
    return;
  }
  for (const r of items) {
    const div = document.createElement("div");
    div.className = "row";
    div.innerHTML = `
      <div>
        <strong>${escapeHtml(r.original)}</strong>
        <div class="muted"><small>${tryHost(r.source_url)}</small></div>
        ${r.tags?.length ? r.tags.map(t => `<span class="pill">${escapeHtml(t)}</span>`).join(" ") : ""}
      </div>
      <div>
        <textarea data-field="translation" rows="2">${escapeHtml(r.translation || "")}</textarea>
        <label class="muted nowrap"><input type="checkbox" data-field="verified" ${r.verified ? "checked":""}/> Verified</label>
      </div>
      <div>
        <textarea data-field="note" rows="2" placeholder="Add a note…">${escapeHtml(r.note || "")}</textarea>
        <input data-field="tags" placeholder="tags,comma,separated" value="${escapeHtml((r.tags||[]).join(","))}">
      </div>
      <div class="controls">
        <button data-act="save">Save</button>
        <button data-act="del" class="secondary">Delete</button>
        <a class="secondary" href="${r.source_url || "#"}" target="_blank">Open</a>
      </div>
    `;
    div.querySelector('[data-act="save"]').addEventListener("click", () => saveRow(r.id, div));
    div.querySelector('[data-act="del"]').addEventListener("click", () => delRow(r.id));
    rows.appendChild(div);
  }
}

async function saveRow(id, container) {
  const get = (sel) => container.querySelector(sel);
  const translation = get('textarea[data-field="translation"]').value.trim();
  const note = get('textarea[data-field="note"]').value.trim();
  const tags = get('input[data-field="tags"]').value.split(",").map(s=>s.trim()).filter(Boolean);
  const verified = get('input[data-field="verified"]').checked;

  const { error } = await supabase.from("phrases").update({ translation, note, tags, verified }).eq("id", id);
  if (error) return alert("Save failed: " + error.message);
  alert("Saved!");
}

async function delRow(id) {
  if (!confirm("Delete this item?")) return;
  const { error } = await supabase.from("phrases").delete().eq("id", id);
  if (error) return alert("Delete failed: " + error.message);
  load();
}

async function exportCSV() {
  let query = supabase.from("phrases").select("*");
  const text = q?.value?.trim();
  if (text) query = query.or([
    `original.ilike.%${text}%`,
    `translation.ilike.%${text}%`,
    `tags.cs.{${text}}`
  ].join(","));
  if (verified.value === "true") query = query.eq("verified", true);
  if (verified.value === "false") query = query.eq("verified", false);
  const [col, dir] = sort.value.split(".");
  query = query.order(col, { ascending: dir === "asc" });

  const { data, error } = await query;
  if (error) return alert("Export failed: " + error.message);

  const headers = ["original","translation","note","tags","source_url","source_title","created_at","verified"];
  const lines = [headers.join(",")];
  for (const r of data) {
    const row = [
      csv(r.original),
      csv(r.translation || ""),
      csv(r.note || ""),
      csv((r.tags||[]).join("|")),
      csv(r.source_url || ""),
      csv(r.source_title || ""),
      csv(r.created_at || ""),
      csv(r.verified ? "true" : "false"),
    ];
    lines.push(row.join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: "phrases.csv" });
  a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 2000);
}

function csv(v) {
  const s = (v ?? "").toString().replaceAll('"','""');
  return `"${s}"`;
}
function escapeHtml(s="") {
  return s.replace(/[&<>"']/g, (c) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#39;"
}[c]));

}
function tryHost(u="") {
  try { return new URL(u).hostname; } catch { return ""; }
}
