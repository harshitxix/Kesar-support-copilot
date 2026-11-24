let emailsData = [];
let auditData = [];
let ticketsData = [];
let ordersData = [];

document.addEventListener("DOMContentLoaded", () => {
  initApp();
});

async function initApp() {
  await Promise.all([
    fetchEmails(),
    fetchAuditLog(),
    fetchTickets(),
    fetchOrders(),
    fetchFAQ()
  ]);
  if (emailsData.length > 0) {
    loadSelectedEmail();
  }
}

async function fetchEmails() {
  try {
    const res = await fetch("/api/emails");
    emailsData = await res.json();
    const select = document.getElementById("email-select");
    select.innerHTML = "";
    emailsData.forEach(e => {
      const opt = document.createElement("option");
      opt.value = e.id;
      opt.textContent = `[${e.id}] ${e.from.name} - ${e.subject.slice(0, 45)}`;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error("Failed to load emails:", err);
  }
}

function loadSelectedEmail() {
  const select = document.getElementById("email-select");
  const selectedId = select.value;
  const email = emailsData.find(e => e.id === selectedId);
  if (!email) return;

  document.getElementById("preview-from").textContent = email.from.name;
  document.getElementById("preview-email").textContent = email.from.email;
  document.getElementById("preview-subject").textContent = email.subject;
  document.getElementById("preview-body").textContent = email.body;

  // Reset steps & draft
  resetPipelineUI();
}

function resetPipelineUI() {
  for (let i = 1; i <= 5; i++) {
    const el = document.getElementById(`step-${i}`);
    el.className = "p-2.5 rounded-xl border border-slate-800 bg-slate-900 transition";
  }
  document.getElementById("pipeline-status").textContent = "Ready";
  document.getElementById("pipeline-status").className = "text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono";
  document.getElementById("diagnostic-badges").innerHTML = "";
}

async function runCopilotOnSelected() {
  const select = document.getElementById("email-select");
  const emailId = select.value;
  const btn = document.getElementById("btn-run");

  btn.disabled = true;
  btn.classList.add("opacity-60");
  resetPipelineUI();

  // Step 1: Ingest
  highlightStep(1, "Ingesting Untrusted Email");
  await sleep(250);

  // Step 2: Classify
  highlightStep(2, "Extracting LLM Schema");
  await sleep(300);

  // Step 3: Guards
  highlightStep(3, "Evaluating Security & Privacy Guards");
  await sleep(250);

  // Step 4: Tools
  highlightStep(4, "Executing Agent Tools");
  await sleep(250);

  // Step 5: Logging
  highlightStep(5, "Syncing Sheets & Generating Draft");

  try {
    const res = await fetch("/api/process-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: emailId })
    });
    const result = await res.json();
    renderExecutionResult(result);
  } catch (err) {
    console.error("Processing failed:", err);
  } finally {
    btn.disabled = false;
    btn.classList.remove("opacity-60");
    document.getElementById("pipeline-status").textContent = "Completed (200 OK)";
    document.getElementById("pipeline-status").className = "text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono";
  }
}

function highlightStep(stepNum, statusText) {
  for (let i = 1; i <= stepNum; i++) {
    const el = document.getElementById(`step-${i}`);
    el.className = "p-2.5 rounded-xl border border-amber-500/60 bg-amber-500/10 text-amber-300 transition shadow-sm";
  }
  document.getElementById("pipeline-status").textContent = statusText;
}

function renderExecutionResult(result) {
  const cl = result.classification;
  const audit = result.audit_record;

  // Draft box
  const draftBox = document.getElementById("draft-output");
  draftBox.textContent = audit.reply_draft ? audit.reply_draft.replace(/\\n/g, "\n") : "[No customer reply required — logged only]";

  // Audit box
  document.getElementById("audit-action").textContent = audit.action_taken;
  document.getElementById("audit-ticket").textContent = audit.ticket_id || "None";
  document.getElementById("audit-human").textContent = audit.needs_human === "TRUE" ? "YES (Escalated)" : "No (Auto-Draft)";

  // Badges
  const badgesContainer = document.getElementById("diagnostic-badges");
  badgesContainer.innerHTML = `
    <span class="px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
      <i class="fa-solid fa-tag mr-1"></i>${cl.intent}
    </span>
    <span class="px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
      <i class="fa-solid fa-chart-line mr-1"></i>Conf: ${(cl.confidence * 100).toFixed(0)}%
    </span>
    <span class="px-2.5 py-1 rounded-md text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
      <i class="fa-solid fa-language mr-1"></i>${cl.language.toUpperCase()}
    </span>
    <span class="px-2.5 py-1 rounded-md text-xs font-semibold ${audit.needs_human === 'TRUE' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'}">
      <i class="fa-solid ${audit.needs_human === 'TRUE' ? 'fa-user-shield' : 'fa-robot'} mr-1"></i>${audit.needs_human === 'TRUE' ? 'Needs Human' : 'Auto-Draft Safe'}
    </span>
  `;

  if (cl.has_injection) {
    badgesContainer.innerHTML += `
      <span class="px-2.5 py-1 rounded-md text-xs font-semibold bg-red-600/30 text-red-300 border border-red-500 animate-pulse">
        <i class="fa-solid fa-shield-virus mr-1"></i>Prompt Injection Neutralized
      </span>
    `;
  }

  if (audit.action_taken.includes("privacy_blocked")) {
    badgesContainer.innerHTML += `
      <span class="px-2.5 py-1 rounded-md text-xs font-semibold bg-orange-600/30 text-orange-300 border border-orange-500">
        <i class="fa-solid fa-lock mr-1"></i>Privacy Protected (Unauthorized Email)
      </span>
    `;
  }

  if (audit.action_taken.includes("ticket_updated")) {
    badgesContainer.innerHTML += `
      <span class="px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-600/30 text-indigo-300 border border-indigo-500">
        <i class="fa-solid fa-link mr-1"></i>Deduplicated: Attached to ${audit.ticket_id}
      </span>
    `;
  }
}

async function fetchAuditLog() {
  try {
    const res = await fetch("/api/audit-log");
    auditData = await res.json();
    renderAuditTable(auditData);
  } catch (err) {
    console.error("Failed to fetch audit log:", err);
  }
}

function renderAuditTable(data) {
  const tbody = document.getElementById("audit-table-body");
  tbody.innerHTML = "";

  data.forEach(row => {
    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-900/60 transition";

    const humanBadge = row.needs_human === "TRUE" 
      ? '<span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">YES</span>'
      : '<span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">NO</span>';

    tr.innerHTML = `
      <td class="p-3 font-mono text-amber-400 font-bold">${row.email_id}</td>
      <td class="p-3">${row.from_email}</td>
      <td class="p-3"><span class="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[11px]">${row.intent}</span></td>
      <td class="p-3 font-mono text-slate-400">${row.order_id || "-"}</td>
      <td class="p-3 uppercase text-[11px] font-mono text-slate-400">${row.language}</td>
      <td class="p-3 capitalize">${row.sentiment}</td>
      <td class="p-3 font-mono text-slate-300">${row.confidence}</td>
      <td class="p-3 text-[11px] text-slate-400 max-w-xs truncate">${row.action_taken}</td>
      <td class="p-3">${humanBadge}</td>
      <td class="p-3 font-mono text-indigo-400 font-semibold">${row.ticket_id || "-"}</td>
      <td class="p-3">
        <button onclick="previewDraftModal('${row.email_id}')" class="text-xs text-amber-400 hover:text-amber-300 underline">View</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function filterAuditTable() {
  const query = document.getElementById("audit-search").value.toLowerCase();
  const filtered = auditData.filter(r => 
    r.email_id.toLowerCase().includes(query) ||
    r.from_email.toLowerCase().includes(query) ||
    r.intent.toLowerCase().includes(query) ||
    (r.order_id && r.order_id.toLowerCase().includes(query)) ||
    (r.action_taken && r.action_taken.toLowerCase().includes(query))
  );
  renderAuditTable(filtered);
}

async function fetchTickets() {
  try {
    const res = await fetch("/api/tickets");
    ticketsData = await res.json();
    renderTicketsTable(ticketsData);
  } catch (err) {
    console.error("Failed to fetch tickets:", err);
  }
}

function renderTicketsTable(data) {
  const tbody = document.getElementById("tickets-table-body");
  tbody.innerHTML = "";

  data.forEach(t => {
    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-900/60 transition";

    let priorityBadge = "";
    if (t.priority === "High") {
      priorityBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">HIGH</span>';
    } else if (t.priority === "Medium") {
      priorityBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">MEDIUM</span>';
    } else {
      priorityBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400">LOW</span>';
    }

    const emailIdsHighlighted = t.email_ids.includes(",")
      ? `<span class="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded font-mono font-bold">${t.email_ids} (Dedup)</span>`
      : `<span class="font-mono text-slate-300">${t.email_ids}</span>`;

    tr.innerHTML = `
      <td class="p-3 font-mono font-bold text-amber-400">${t.ticket_id}</td>
      <td class="p-3 font-mono text-slate-300">${t.order_id}</td>
      <td class="p-3 text-slate-400">${t.customer_email}</td>
      <td class="p-3">${emailIdsHighlighted}</td>
      <td class="p-3"><span class="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[11px]">${t.intent}</span></td>
      <td class="p-3">${priorityBadge}</td>
      <td class="p-3 text-emerald-400 font-semibold">${t.status}</td>
      <td class="p-3 text-slate-300 max-w-sm truncate">${t.summary}</td>
      <td class="p-3 text-slate-400 max-w-md text-[11px] leading-tight">${t.notes}</td>
    `;
    tbody.appendChild(tr);
  });
}

async function fetchOrders() {
  try {
    const res = await fetch("/api/orders");
    ordersData = await res.json();
    const container = document.getElementById("orders-container");
    container.innerHTML = "";
    ordersData.forEach(o => {
      const card = document.createElement("div");
      card.className = "bg-slate-900 p-3 rounded-xl border border-slate-800/80 hover:border-slate-700 transition";
      card.innerHTML = `
        <div class="flex items-center justify-between font-mono font-semibold">
          <span class="text-amber-400">${o.order_id}</span>
          <span class="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">${o.status}</span>
        </div>
        <div class="text-slate-300 font-medium mt-1">${o.customer_name} <span class="text-slate-500 text-[11px]">(${o.customer_email})</span></div>
        <div class="text-slate-400 text-[11px] mt-1">Placed: ${o.order_date} | Total: ₹${o.total} (${o.payment_method.toUpperCase()})</div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error("Failed to fetch orders:", err);
  }
}

async function fetchFAQ() {
  try {
    const res = await fetch("/api/faq");
    const data = await res.json();
    document.getElementById("faq-container").textContent = data.faq;
  } catch (err) {
    console.error("Failed to fetch FAQ:", err);
  }
}

function switchTab(tabName) {
  document.querySelectorAll(".tab-content").forEach(el => el.classList.add("hidden"));
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.className = "tab-btn px-4 py-2 rounded-lg font-medium transition-all text-slate-400 hover:text-white";
  });

  document.getElementById(`tab-${tabName}`).classList.remove("hidden");
  const activeBtn = document.getElementById(`tab-btn-${tabName}`);
  activeBtn.className = "tab-btn px-4 py-2 rounded-lg font-medium transition-all text-white bg-amber-600 shadow-sm";
}

function previewDraftModal(emailId) {
  const row = auditData.find(r => r.email_id === emailId);
  if (!row) return;

  document.getElementById("modal-title").textContent = `Audit Record [${row.email_id}] - ${row.from_email}`;
  document.getElementById("modal-content").textContent = row.reply_draft ? row.reply_draft.replace(/\\n/g, "\n") : "[No customer reply draft - logged only]";
  document.getElementById("draft-modal").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("draft-modal").classList.add("hidden");
}

function copyDraft() {
  const text = document.getElementById("draft-output").textContent;
  navigator.clipboard.writeText(text);
  alert("Draft copied to clipboard!");
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
