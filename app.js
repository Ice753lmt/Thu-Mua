/* Thu Mua PWA - Supabase JS v2 */
(() => {
  "use strict";
  const cfg = window.APP_CONFIG || {};
  const $ = id => document.getElementById(id);
  const money = n => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(Number(n) || 0);
  const dateVN = s => s ? new Date(s + "T00:00:00").toLocaleDateString("vi-VN") : "—";
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const toast = msg => { const t = $("toast"); t.textContent = msg; t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 2800) };
  let db = null, user = null, profile = null, currentPage = "notifications", customers = [], currentInvoice = null, allInvoices = [], deferredInstall = null;
  const isAdmin = () => profile?.role === "admin";
  const configOK = () => cfg.SUPABASE_URL?.startsWith("https://") && !cfg.SUPABASE_URL.includes("YOUR-PROJECT") && cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_ANON_KEY.includes("YOUR_");
  function init() {
    if (!window.supabase) { $("authMessage").textContent = "Không tải được Supabase SDK. Kiểm tra kết nối Internet."; return; }
    if (!configOK()) { $("authMessage").textContent = "Hãy điền SUPABASE_URL và SUPABASE_ANON_KEY trong config.js trước khi đăng nhập."; return; }
    db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    $("adminLogin").addEventListener("submit", adminLogin);
    $("googleLogin").addEventListener("click", googleLogin);
    $("logoutBtn").addEventListener("click", logout);
    document.querySelectorAll("[data-page]").forEach(b => b.addEventListener("click", () => navigate(b.dataset.page)));
    document.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => $(b.dataset.close).close()));
    $("invoiceCustomer").addEventListener("change", updateCustomerPhone);
    $("addLineBtn").addEventListener("click", () => addInvoiceLine());
    $("invoiceLines").addEventListener("input", calculateTotal);
    $("invoiceLines").addEventListener("click", e => { if (e.target.closest("[data-remove-line]")) { e.target.closest("tr").remove(); renumberLines(); calculateTotal(); } });
    $("invoiceForm").addEventListener("submit", saveInvoice);
    $("userForm").addEventListener("submit", saveUserEdit);
    $("exportTextBtn").addEventListener("click", exportText);
    $("exportXlsxBtn").addEventListener("click", exportXlsx);
    $("exportPdfBtn").addEventListener("click", exportPdf);
    $("installBtn").addEventListener("click", installPWA);
    window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferredInstall = e; $("installBtn").classList.remove("hidden") });
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(console.warn);
    db.auth.onAuthStateChange(async (_event, session) => { if (session?.user) await loadApp(session.user); else showAuth(); });
    db.auth.getSession().then(({ data }) => data.session?.user ? loadApp(data.session.user) : showAuth());
  }
  function showAuth() { $("authView").classList.remove("hidden"); $("appView").classList.add("hidden"); user = null; profile = null }
  async function adminLogin(e) { e.preventDefault(); const { error } = await db.auth.signInWithPassword({ email: $("adminEmail").value.trim(), password: $("adminPassword").value }); if (error) $("authMessage").textContent = error.message; }
  async function googleLogin() { const { error } = await db.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin + location.pathname, queryParams: { prompt: "select_account" } } }); if (error) $("authMessage").textContent = error.message; }
  async function logout() { await db.auth.signOut(); showAuth() }
  async function loadApp(authUser) {
    user = authUser;
    let { data: p, error } = await db.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (error) { toast("Không tải được hồ sơ: " + error.message); return; }
    if (!p) {
      const { data: created, error: ce } = await db.from("profiles").insert({ id: user.id, full_name: user.user_metadata?.full_name || user.user_metadata?.name || "", avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null, role: "customer" }).select().single();
      if (ce) { toast("Tạo hồ sơ thất bại: " + ce.message); return; } p = created;
    }
    profile = p;
    if (!isAdmin() && (!profile.full_name || !profile.phone || !profile.birth_year)) { await renderOnboarding(); return; }
    $("authView").classList.add("hidden"); $("appView").classList.remove("hidden");
    $("sideName").textContent = profile.full_name || user.email; $("sideRole").textContent = isAdmin() ? "Quản trị viên" : "Khách hàng";
    $("sideAvatar").innerHTML = profile.avatar_url ? `<img src="${esc(profile.avatar_url)}" alt="">` : esc((profile.full_name || "U").slice(0, 1).toUpperCase());
    $("todayLabel").textContent = new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
    await loadStoreName(); navigate(currentPage);
  }
  async function renderOnboarding() {
    $("authView").classList.remove("hidden"); $("appView").classList.add("hidden");
    $("authView").innerHTML = `<section class="auth-card"><div class="brand-mark">TM</div><p class="eyebrow">THIẾT LẬP TÀI KHOẢN</p><h1>Hoàn thiện hồ sơ</h1><p class="muted">Thông tin giúp cửa hàng liên hệ và lập hóa đơn chính xác.</p><form id="onboardForm" class="stack"><label>Họ và tên<input id="obName" value="${esc(profile.full_name || "")}" required></label><label>Năm sinh<input id="obYear" type="number" min="1900" max="${new Date().getFullYear()}" value="${esc(profile.birth_year || "")}" required></label><label>Số điện thoại<input id="obPhone" type="tel" value="${esc(profile.phone || "")}" required></label><label>Ảnh đại diện<input id="obAvatar" type="file" accept="image/*"></label><button class="btn primary">Hoàn tất</button><button type="button" id="obLogout" class="btn outline">Đăng xuất</button></form><p id="obMsg" class="message"></p></section>`;
    $("obLogout").onclick = logout;
    $("onboardForm").onsubmit = async e => {
      e.preventDefault(); let avatar = profile.avatar_url; const f = $("obAvatar").files[0]; if (f) avatar = await uploadAvatar(f);
      const upd = { full_name: $("obName").value.trim(), birth_year: Number($("obYear").value), phone: $("obPhone").value.trim(), avatar_url: avatar };
      const { data, error } = await db.from("profiles").update(upd).eq("id", user.id).select().single();
      if (error) { $("obMsg").textContent = error.message; return; } profile = data; await loadApp(user);
    };
  }
  async function uploadAvatar(file) {
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) throw new Error("Ảnh phải là định dạng hình ảnh và nhỏ hơn 5 MB.");
    const path = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error } = await db.storage.from(cfg.AVATAR_BUCKET || "avatars").upload(path, file, { upsert: true, contentType: file.type });
    if (error) throw error; return db.storage.from(cfg.AVATAR_BUCKET || "avatars").getPublicUrl(path).data.publicUrl;
  }
  async function loadStoreName() { const { data } = await db.from("store_info").select("store_name").eq("id", 1).maybeSingle(); $("sideStoreName").textContent = data?.store_name || "Thu Mua"; }
  function navigate(page) { currentPage = page; document.querySelectorAll("[data-page]").forEach(b => b.classList.toggle("active", b.dataset.page === page)); const titles = { notifications: "Thông báo", invoices: "Hóa đơn", account: "Tài khoản", settings: "Cài đặt" }; $("pageTitle").textContent = titles[page] || "Thu Mua"; $("pageEyebrow").textContent = isAdmin() ? "KHU VỰC QUẢN TRỊ" : "KHU VỰC KHÁCH HÀNG"; ({ notifications: renderNotifications, invoices: renderInvoices, account: renderAccount, settings: renderSettings }[page] || renderNotifications)(); }
  async function renderNotifications() {
    const { data, error } = await db.from("notifications").select("*,profiles:recipient_id(full_name)").order("created_at", { ascending: false }).limit(100);
    if (error) { $("pageContent").innerHTML = errorBox(error); return; }
    const rows = data || [];
    $("pageContent").innerHTML = `${isAdmin() ? `<section class="panel"><div class="panel-head"><div><h2>Đăng thông báo</h2><p>Gửi thông báo đến một khách hàng hoặc toàn bộ khách hàng.</p></div></div><form id="noticeForm" class="stack"><label>Người nhận<select id="noticeRecipient"><option value="all">Tất cả khách hàng</option>${(await getCustomers()).map(c => `<option value="${c.id}">${esc(c.full_name || c.email || c.id)}</option>`).join("")}</select></label><label>Tiêu đề<input id="noticeTitle" required maxlength="120"></label><label>Nội dung<textarea id="noticeBody" rows="3" required></textarea></label><button class="btn primary">Đăng thông báo</button></form></section>` : ""}<section class="panel"><div class="panel-head"><div><h2>Lịch sử thông báo</h2><p>${rows.length} thông báo gần đây</p></div></div>${rows.length ? rows.map(n => `<article class="notice"><h3>${esc(n.title)}</h3><p>${esc(n.body)}</p><small>${new Date(n.created_at).toLocaleString("vi-VN")} ${isAdmin() ? (n.recipient_id ? ` · Gửi: ${esc(n.profiles?.full_name || "Khách hàng")}` : " · Tất cả khách hàng") : ""}</small></article>`).join("") : emptyState("Chưa có thông báo", "Thông báo từ cửa hàng sẽ xuất hiện tại đây.")}</section>`;
    if (isAdmin()) $("noticeForm").onsubmit = async e => { e.preventDefault(); const recipient = $("noticeRecipient").value; let inserts; if (recipient === "all") { const cs = await getCustomers(); inserts = cs.map(c => ({ recipient_id: c.id, title: $("noticeTitle").value.trim(), body: $("noticeBody").value.trim(), created_by: user.id })); } else inserts = [{ recipient_id: recipient, title: $("noticeTitle").value.trim(), body: $("noticeBody").value.trim(), created_by: user.id }]; if (!inserts.length) { toast("Chưa có khách hàng để gửi."); return; } const { error } = await db.from("notifications").insert(inserts); if (error) { toast(error.message); return; } toast("Đã đăng thông báo."); renderNotifications(); };
  }
  async function getCustomers(force = false) { if (customers.length && !force) return customers; const { data, error } = await db.from("profiles").select("id,full_name,phone,birth_year,avatar_url,role").eq("role", "customer").order("full_name"); if (error) throw error; customers = data || []; return customers; }
  function emptyState(title, desc) { return `<div class="empty"><b>${esc(title)}</b>${esc(desc)}</div>` }
  function errorBox(e) { return `<div class="panel danger">Lỗi: ${esc(e.message || e)}</div>` }
  async function renderInvoices() {
    const q = db.from("invoices").select("*,profiles:customer_id(full_name,phone)").order("invoice_date", { ascending: false }).order("created_at", { ascending: false });
    const { data, error } = await q; if (error) { $("pageContent").innerHTML = errorBox(error); return; } allInvoices = data || [];
    const total = allInvoices.reduce((s, i) => s + Number(i.total_amount || 0), 0);
    $("pageContent").innerHTML = `<div class="stats"><div class="stat-card"><span>Tổng hóa đơn</span><strong>${allInvoices.length}</strong></div><div class="stat-card"><span>Tổng giá trị hiển thị</span><strong>${money(total)}</strong></div><div class="stat-card"><span>Vai trò</span><strong>${isAdmin() ? "Admin" : "Khách hàng"}</strong></div></div><section class="panel"><div class="panel-head"><div><h2>Danh sách hóa đơn</h2><p>${isAdmin() ? "Tất cả hóa đơn trong hệ thống" : "Hóa đơn của bạn"}</p></div>${isAdmin() ? '<button id="newInvoiceBtn" class="btn primary">＋ Tạo hóa đơn</button>' : ""}</div><div class="toolbar"><input id="invoiceSearch" placeholder="Tìm theo mã hóa đơn hoặc khách hàng..."></div><div class="table-wrap"><table><thead><tr><th>Mã hóa đơn</th>${isAdmin() ? "<th>Khách hàng</th>" : ""}<th>Ngày lập</th><th>Tổng tiền</th><th>Người lập</th><th></th></tr></thead><tbody id="invoiceRows">${invoiceRows(allInvoices)}</tbody></table></div></section>`;
    if (isAdmin()) $("newInvoiceBtn").onclick = openInvoiceForm;
    $("invoiceSearch").oninput = () => { $("invoiceRows").innerHTML = invoiceRows(allInvoices.filter(i => (i.invoice_no || "").toLowerCase().includes($("invoiceSearch").value.toLowerCase()) || (i.profiles?.full_name || "").toLowerCase().includes($("invoiceSearch").value.toLowerCase()))); };
    $("invoiceRows").addEventListener("click", e => { const b = e.target.closest("[data-invoice]"); if (b) openInvoiceDetail(b.dataset.invoice); });
  }
  function invoiceRows(rows) { if (!rows.length) return `<tr><td colspan="6">${emptyState("Chưa có hóa đơn", "Hóa đơn sẽ được hiển thị tại đây.")}</td></tr>`; return rows.map(i => `<tr><td><strong>${esc(i.invoice_no)}</strong></td>${isAdmin() ? `<td>${esc(i.profiles?.full_name || "—")}</td>` : ""}<td>${dateVN(i.invoice_date)}</td><td class="amount">${money(i.total_amount)}</td><td>${esc(i.created_by_name || "—")}</td><td><button class="btn outline compact" data-invoice="${i.id}">Xem</button></td></tr>`).join(""); }
  async function openInvoiceForm() {
    try {
      const cs = await getCustomers(true); if (!cs.length) { toast("Chưa có hồ sơ khách hàng. Khách cần đăng nhập Google ít nhất một lần."); return; }
      $("invoiceCustomer").innerHTML = cs.map(c => `<option value="${c.id}">${esc(c.full_name)} · ${esc(c.phone || "Chưa có SĐT")}</option>`).join("");
      $("invoiceDate").value = new Date().toISOString().slice(0, 10); $("invoiceNote").value = ""; $("invoiceLines").innerHTML = ""; addInvoiceLine(); updateCustomerPhone(); $("invoiceDialog").showModal();
    } catch (e) { toast(e.message) }
  }
  function updateCustomerPhone() { const c = customers.find(x => x.id === $("invoiceCustomer").value); $("customerPhone").textContent = "Số điện thoại khách hàng: " + (c?.phone || "Chưa cập nhật"); }
  function addInvoiceLine() { const tr = document.createElement("tr"); tr.innerHTML = `<td class="line-stt"></td><td><input class="line-name" placeholder="Ví dụ: Lúa, gạo..." required></td><td><input class="line-num qty" type="number" min="0.001" step="any" value="1" required></td><td><input class="line-num price" type="number" min="0" step="1" value="0" required></td><td class="line-sub amount">0 ₫</td><td><button type="button" class="icon-btn" data-remove-line title="Xóa dòng">✕</button></td>`; $("invoiceLines").appendChild(tr); renumberLines(); calculateTotal(); }
  function renumberLines() { [...$("invoiceLines").rows].forEach((r, i) => r.querySelector(".line-stt").textContent = i + 1); }
  function calculateTotal() { let total = 0;[...$("invoiceLines").rows].forEach(r => { const v = (Number(r.querySelector(".qty").value) || 0) * (Number(r.querySelector(".price").value) || 0); r.querySelector(".line-sub").textContent = money(v); total += v; }); $("invoiceTotal").textContent = money(total); }
  async function saveInvoice(e) {
    e.preventDefault(); if (!isAdmin()) return; const c = customers.find(x => x.id === $("invoiceCustomer").value); if (!c) return;
    const lines = [...$("invoiceLines").rows].map(r => ({ item_name: r.querySelector(".line-name").value.trim(), quantity: Number(r.querySelector(".qty").value), unit_price: Number(r.querySelector(".price").value) }));
    if (!lines.length || lines.some(x => !x.item_name || x.quantity <= 0 || x.unit_price < 0)) { toast("Vui lòng kiểm tra các dòng hàng."); return; }
    const total = lines.reduce((s, x) => s + x.quantity * x.unit_price, 0);
    const { data: inv, error } = await db.from("invoices").insert({ customer_id: c.id, invoice_date: $("invoiceDate").value, total_amount: total, created_by: user.id, created_by_name: profile.full_name, notes: $("invoiceNote").value.trim() }).select().single();
    if (error) { toast(error.message); return; }
    const details = lines.map(x => ({ ...x, invoice_id: inv.id, line_total: x.quantity * x.unit_price }));
    const { error: de } = await db.from("invoice_details").insert(details);
    if (de) { await db.from("invoices").delete().eq("id", inv.id); toast("Không lưu được chi tiết: " + de.message); return; }
    const { error: ne } = await db.from("notifications").insert({ recipient_id: c.id, title: "Hóa đơn thu mua mới", body: `Bạn có hóa đơn ${inv.invoice_no} với tổng tiền ${money(total)}. Vui lòng mở ứng dụng để xem chi tiết.`, created_by: user.id });
    if (ne) console.warn("Notification insert failed", ne);
    $("invoiceDialog").close(); toast("Đã tạo hóa đơn thành công."); navigate("invoices");
  }
  async function openInvoiceDetail(id) {
    const { data: inv, error } = await db.from("invoices").select("*,profiles:customer_id(full_name,phone)").eq("id", id).single(); if (error) { toast(error.message); return; }
    const { data: lines, error: le } = await db.from("invoice_details").select("*").eq("invoice_id", id).order("id"); if (le) { toast(le.message); return; }
    const { data: store } = await db.from("store_info").select("*").eq("id", 1).maybeSingle();
    currentInvoice = { ...inv, lines: lines || [], store: store || {} };
    $("invoiceDetail").innerHTML = invoicePaper(currentInvoice); $("detailDialog").showModal();
  }
  function invoicePaper(i) { return `<div class="detail-paper" id="printArea"><h2>${esc(i.store.store_name || "HÓA ĐƠN THU MUA")}</h2><p class="center">${esc(i.store.address || "")}${i.store.hotline ? " · Hotline: " + esc(i.store.hotline) : ""}</p><h2>HÓA ĐƠN THU MUA</h2><p class="center">Mã: ${esc(i.invoice_no)} · Ngày ${dateVN(i.invoice_date)}</p><div class="invoice-meta"><div><b>Khách hàng:</b> ${esc(i.profiles?.full_name || "")}<br><b>Số điện thoại:</b> ${esc(i.profiles?.phone || "—")}</div><div><b>Người lập hóa đơn:</b> ${esc(i.created_by_name || "")}</div></div><table><thead><tr><th>STT</th><th>Loại hàng</th><th>Số lượng</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead><tbody>${i.lines.map((l, n) => `<tr><td>${n + 1}</td><td>${esc(l.item_name)}</td><td>${Number(l.quantity).toLocaleString("vi-VN")}</td><td>${money(l.unit_price)}</td><td>${money(l.line_total)}</td></tr>`).join("")}</tbody></table><div class="invoice-total"><span><b>TỔNG CỘNG</b></span><strong>${money(i.total_amount)}</strong></div>${i.notes ? `<p><b>Ghi chú:</b> ${esc(i.notes)}</p>` : ""}<div class="signature"><div><b>Khách hàng</b><span>(Ký và ghi rõ họ tên)</span></div><div><b>Người lập hóa đơn</b><span>${esc(i.created_by_name || "")}</span></div></div></div>`; }
  function exportText() { if (!currentInvoice) return; const i = currentInvoice; const textOut = [i.store.store_name || "HÓA ĐƠN THU MUA", `Mã: ${i.invoice_no}`, `Ngày: ${dateVN(i.invoice_date)}`, `Khách hàng: ${i.profiles?.full_name || ""}`, `SĐT: ${i.profiles?.phone || ""}`, "", ...i.lines.map((l, n) => `${n + 1}. ${l.item_name} | SL ${l.quantity} | ${money(l.unit_price)} | ${money(l.line_total)}`), "", `TỔNG TIỀN: ${money(i.total_amount)}`, `Người lập: ${i.created_by_name || ""}`, i.notes || ""].join("\n"); downloadBlob(new Blob([textOut], { type: "text/plain;charset=utf-8" }), `${i.invoice_no}.txt`); }
  function exportXlsx() { if (!currentInvoice) return; if (!window.XLSX) { toast("Không tải được thư viện Excel."); return; } const i = currentInvoice; const rows = [["HÓA ĐƠN THU MUA"], ["Mã hóa đơn", i.invoice_no], ["Ngày lập", dateVN(i.invoice_date)], ["Khách hàng", i.profiles?.full_name || ""], ["Số điện thoại", i.profiles?.phone || ""], [], ["STT", "Loại hàng", "Số lượng", "Đơn giá", "Thành tiền"], ...i.lines.map((l, n) => [n + 1, l.item_name, l.quantity, l.unit_price, l.line_total]), [], ["", "", "", "TỔNG TIỀN", i.total_amount], ["Người lập hóa đơn", i.created_by_name || ""]]; const ws = XLSX.utils.aoa_to_sheet(rows); ws["!cols"] = [{ wch: 8 }, { wch: 30 }, { wch: 15 }, { wch: 20 }, { wch: 20 }]; const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Hoa don"); XLSX.writeFile(wb, `${i.invoice_no}.xlsx`); }
  function exportPdf() { if (!currentInvoice) return; window.print(); }
  function downloadBlob(blob, name) { const url = URL.createObjectURL(blob), a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url); }
  async function renderAccount() {
    const avatar = profile.avatar_url ? `<img src="${esc(profile.avatar_url)}" alt="">` : esc((profile.full_name || "U").slice(0, 1).toUpperCase());
    $("pageContent").innerHTML = `<section class="panel"><div class="panel-head"><div><h2>Thông tin cá nhân</h2><p>Thông tin hồ sơ được sử dụng trên hóa đơn và liên hệ.</p></div></div><div class="profile-layout"><div class="profile-photo"><div class="avatar">${avatar}</div><label class="btn outline compact">Đổi ảnh<input id="profileAvatar" type="file" accept="image/*" hidden></label><small class="muted">Tối đa 5 MB</small></div><form id="profileForm"><div class="form-grid"><label>Họ và tên<input id="profileName" value="${esc(profile.full_name || "")}" required></label><label>Năm sinh<input id="profileYear" type="number" min="1900" max="${new Date().getFullYear()}" value="${esc(profile.birth_year || "")}"></label><label>Số điện thoại<input id="profilePhone" type="tel" value="${esc(profile.phone || "")}"></label><label>Email<input value="${esc(user.email || "")}" disabled></label></div><div class="form-actions"><button class="btn primary">Lưu thay đổi</button></div></form></div></section>${isAdmin() ? `<section class="panel"><div class="panel-head"><div><h2>Quản lý khách hàng</h2><p>Khách hàng xuất hiện sau khi đăng nhập Google lần đầu.</p></div><button id="refreshUsers" class="btn outline compact">Làm mới</button></div><div class="table-wrap"><table><thead><tr><th>Họ tên</th><th>Số điện thoại</th><th>Năm sinh</th><th></th></tr></thead><tbody id="customerRows"></tbody></table></div></section>` : ""}`;
    $("profileForm").onsubmit = async e => { e.preventDefault(); const { data, error } = await db.from("profiles").update({ full_name: $("profileName").value.trim(), birth_year: $("profileYear").value ? Number($("profileYear").value) : null, phone: $("profilePhone").value.trim() }).eq("id", user.id).select().single(); if (error) { toast(error.message); return; } profile = data; toast("Đã cập nhật hồ sơ."); loadApp(user); };
    $("profileAvatar").onchange = async e => { const f = e.target.files[0]; if (!f) return; try { const url = await uploadAvatar(f); const { error } = await db.from("profiles").update({ avatar_url: url }).eq("id", user.id); if (error) throw error; profile.avatar_url = url; toast("Đã cập nhật ảnh đại diện."); renderAccount(); } catch (err) { toast(err.message) } };
    if (isAdmin()) { await renderCustomerRows(); $("refreshUsers").onclick = () => renderCustomerRows(); }
  }
  async function renderCustomerRows() { try { const cs = await getCustomers(true); $("customerRows").innerHTML = cs.map(c => `<tr><td>${esc(c.full_name || "—")}</td><td>${esc(c.phone || "—")}</td><td>${esc(c.birth_year || "—")}</td><td><button class="btn outline compact" data-edit-user="${c.id}">Sửa</button></td></tr>`).join("") || `<tr><td colspan="4">${emptyState("Chưa có khách hàng", "Khách hàng đăng nhập Google sẽ xuất hiện tại đây.")}</td></tr>`; $("customerRows").onclick = e => { const b = e.target.closest("[data-edit-user]"); if (!b) return; const c = cs.find(x => x.id === b.dataset.editUser); $("editUserId").value = c.id; $("editUserName").value = c.full_name || ""; $("editUserPhone").value = c.phone || ""; $("editUserYear").value = c.birth_year || ""; $("userDialog").showModal(); }; } catch (e) { $("customerRows").innerHTML = `<tr><td>${esc(e.message)}</td></tr>` } }
  async function saveUserEdit(e) { e.preventDefault(); const id = $("editUserId").value; const { error } = await db.from("profiles").update({ full_name: $("editUserName").value.trim(), phone: $("editUserPhone").value.trim(), birth_year: $("editUserYear").value ? Number($("editUserYear").value) : null }).eq("id", id); if (error) { toast(error.message); return; } $("userDialog").close(); toast("Đã cập nhật khách hàng."); renderCustomerRows(); }
  async function renderSettings() {
    const { data: store } = await db.from("store_info").select("*").eq("id", 1).maybeSingle();
    $("pageContent").innerHTML = `<div class="settings-grid"><section class="setting-card"><h3>Thông tin cửa hàng</h3><form id="storeForm"><label>Tên cửa hàng<input id="storeName" value="${esc(store?.store_name || "Thu Mua")}"></label><label>Địa chỉ<input id="storeAddress" value="${esc(store?.address || "")}"></label><label>Hotline<input id="storeHotline" value="${esc(store?.hotline || "")}"></label>${isAdmin() ? '<button class="btn primary">Lưu thông tin</button>' : '<p class="tiny muted">Chỉ Admin được chỉnh sửa.</p>'}</form></section><section class="setting-card"><h3>Tài khoản & bảo mật</h3><p class="muted">Đang đăng nhập: <b>${esc(user.email || "")}</b></p><p class="muted">Vai trò: <b>${isAdmin() ? "Quản trị viên" : "Khách hàng"}</b></p><button id="pushToggle" class="btn outline">Bật thông báo trên thiết bị</button><p class="tiny muted"></p><button id="deleteAccount" class="btn outline danger">Xóa tài khoản</button></section><section class="setting-card"><h3>Tên hiển thị:</h3><form id="adminNameForm"><label>Tên người lập hóa đơn<input id="adminDisplayName" value="${esc(profile.full_name || "")}" ${isAdmin() ? "" : "disabled"}></label>${isAdmin() ? '<button class="btn primary">Cập nhật tên</button>' : ""}</form></section></div>`;
    if (!isAdmin()) { $("storeForm").querySelectorAll("input").forEach(x => x.disabled = true); }
    $("storeForm").onsubmit = async e => { e.preventDefault(); if (!isAdmin()) return; const row = { id: 1, store_name: $("storeName").value.trim(), address: $("storeAddress").value.trim(), hotline: $("storeHotline").value.trim(), updated_by: user.id }; const { error } = await db.from("store_info").upsert(row); if (error) { toast(error.message); return; } toast("Đã lưu thông tin cửa hàng."); loadStoreName(); };
    $("adminNameForm").onsubmit = async e => { e.preventDefault(); if (!isAdmin()) return; const name = $("adminDisplayName").value.trim(); const { data, error } = await db.from("profiles").update({ full_name: name }).eq("id", user.id).select().single(); if (error) { toast(error.message); return; } profile = data; toast("Đã cập nhật tên Admin."); loadApp(user); };
    $("pushToggle").onclick = enableLocalNotifications;
    $("deleteAccount").onclick = async () => { if (!confirm("Đăng xuất khỏi ứng dụng? Việc xóa tài khoản Auth cần Admin thực hiện qua chức năng quản trị bảo mật.")) return; await logout(); };
  }
  async function enableLocalNotifications() { if (!("Notification" in window) || !("serviceWorker" in navigator)) { toast("Trình duyệt không hỗ trợ thông báo."); return; } const permission = await Notification.requestPermission(); if (permission === "granted") { toast("Đã cho phép thông báo trên trình duyệt. Cần máy chủ Web Push để gửi khi ứng dụng đóng."); } else toast("Bạn chưa cấp quyền thông báo."); }
  async function installPWA() { if (!deferredInstall) return; deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; $("installBtn").classList.add("hidden"); }
  document.addEventListener("DOMContentLoaded", init);
  // BỔ SUNG TÊN NGƯỜI LẬP VÀ NGƯỜI ĐƯỢC LẬP HÓA ĐƠN
const originalInvoicePaper = invoicePaper;

invoicePaper = function(i) {
    let html = originalInvoicePaper(i);

    html = html.replace(
        "<b>Khách hàng:</b>",
        "<b>Người được lập hóa đơn:</b>"
    );

    html = html.replace(
        "<b>Người lập hóa đơn:</b>",
        "<b>Tên người lập hóa đơn:</b>"
    );

    return html;
};
})();