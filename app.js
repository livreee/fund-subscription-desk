const rows = [];
const fundCache = new Map();

const $ = (selector) => document.querySelector(selector);
const formatMoney = (value) => {
  if (value === null || value === undefined || value === "unlimited") return "无限额";
  if (typeof value !== "number" || Number.isNaN(value)) return "待确认";
  return `${value.toLocaleString("zh-CN", { maximumFractionDigits: 2 })} 元`;
};
const nowText = () => new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(new Date());

function validCode(code) { return /^\d{6}$/.test(String(code).trim()); }

function renderRows() {
  const body = $("#portfolioBody");
  body.innerHTML = rows.map((row, index) => `
    <tr data-index="${index}">
      <td>${String(index + 1).padStart(2, "0")}</td>
      <td><input class="table-input code-input" inputmode="numeric" maxlength="6" value="${row.primary}" placeholder="基金代码" /></td>
      <td><input class="table-input ratio-input" inputmode="decimal" value="${row.primaryRatio}" placeholder="100%" /></td>
      <td><input class="table-input code-input" inputmode="numeric" maxlength="6" value="${row.alternative}" placeholder="备选代码" /></td>
      <td><input class="table-input ratio-input" inputmode="decimal" value="${row.ratio}" placeholder="100%" /></td>
      <td><span class="row-limit ${row.state || "pending"}">${row.contribution || "待测算"}</span></td>
      <td><button type="button" class="delete-row" aria-label="删除第 ${index + 1} 行">×</button></td>
    </tr>`).join("");
  body.querySelectorAll("tr").forEach((tr, index) => {
    tr.querySelectorAll("input").forEach((input, field) => input.addEventListener("input", (event) => {
      if (field === 0) rows[index].primary = event.target.value.replace(/\D/g, "").slice(0, 6);
      if (field === 1) rows[index].primaryRatio = event.target.value;
      if (field === 2) rows[index].alternative = event.target.value.replace(/\D/g, "").slice(0, 6);
      if (field === 3) rows[index].ratio = event.target.value;
    }));
    tr.querySelector(".delete-row").addEventListener("click", () => { rows.splice(index, 1); renderRows(); });
  });
}

function parseLimit(text) {
  const normalized = String(text || "").replace(/,/g, "");
  if (/暂停申购|停止申购|暂不开放/.test(normalized)) return { paused: true };
  if (/不限|无限额|大额/.test(normalized)) return { value: "unlimited" };
  const matches = normalized.match(/(?:购买上限|申购上限|限额)[^\d]{0,12}(\d+(?:\.\d+)?)(万|万元|元)?/i) || normalized.match(/(\d+(?:\.\d+)?)(万|万元|元)/i);
  if (!matches) return null;
  const number = Number(matches[1]);
  return { value: matches[2] && matches[2].includes("万") ? number * 10000 : number };
}

async function fetchFund(code) {
  if (fundCache.has(code)) return fundCache.get(code);
  const result = { code, name: `基金 ${code}`, value: null, paused: false, source: "待确认" };
  const endpoints = [`/api/fund/${code}`];
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, { mode: "cors" });
      if (!response.ok) continue;
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        Object.assign(result, await response.json());
        break;
      }
      const text = await response.text();
      const nameMatch = text.match(/<title>\s*([^<(]+)/i) || text.match(/fS_name\s*=\s*["']([^"']+)/);
      if (nameMatch) result.name = nameMatch[1].trim();
      const statusMatch = text.match(/交易状态[：:]<\/span>\s*<span[^>]*>([\s\S]*?)<\/span>/i);
      const statusText = statusMatch ? statusMatch[1].replace(/<[^>]+>/g, "").trim() : "";
      const fee = parseLimit(statusText || text);
      if (/暂停申购|停止申购|暂不开放/.test(statusText)) {
        result.paused = true;
        result.value = null;
      } else if (fee) {
        result.value = fee.value;
      } else if (statusText || /fundBuyStatus/.test(text)) {
        result.value = "unlimited";
      }
      result.source = "公开接口";
      break;
    } catch (error) {
      // Try the next public endpoint when a browser blocks the current host.
    }
  }
  fundCache.set(code, result);
  return result;
}

function showLookup(data) {
  const result = $("#lookupResult");
  const statusText = data.paused ? "暂停申购" : data.value === "unlimited" ? "开放申购" : "限额申购";
  result.className = "result-card";
  result.innerHTML = `<div class="result-head"><div><p class="result-name">${data.name}</p><span class="result-code">${data.code}</span></div><span class="status-badge ${data.paused ? "paused" : ""}">${statusText}</span></div>
    <div class="limit-box"><span class="limit-number">${data.paused ? "暂停申购" : data.value === "unlimited" ? "∞" : data.value === null ? "待确认" : Number(data.value).toLocaleString("zh-CN", { maximumFractionDigits: 2 })}</span><span class="limit-unit">${data.paused ? "" : data.value === "unlimited" ? "无限额" : data.value === null ? "" : "元 / 当日"}</span></div>
    <div class="result-meta"><span>${data.source === "待确认" ? "接口暂不可用，建议以销售页面为准" : "已读取公开基金数据"}</span><span>${nowText()} 更新</span></div>`;
}

$("#lookupForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const code = $("#fundCode").value.trim();
  if (!validCode(code)) { $("#fundCode").focus(); $("#fundCode").setCustomValidity("请输入 6 位基金代码"); $("#fundCode").reportValidity(); return; }
  $("#fundCode").setCustomValidity("");
  const result = $("#lookupResult"); result.className = "result-card empty-result"; result.innerHTML = `<div class="result-placeholder"><span class="placeholder-icon">…</span><p>正在读取公开数据</p></div>`;
  showLookup(await fetchFund(code)); $("#lastUpdated").textContent = `${nowText()} 更新`;
});

function addRow(primary = "", primaryRatio = "100%", alternative = "", ratio = "100%") { rows.push({ primary, primaryRatio, alternative, ratio, contribution: "待测算", state: "pending" }); renderRows(); }
$("#addRow").addEventListener("click", () => addRow());
$("#clearRows").addEventListener("click", () => { rows.splice(0, rows.length); renderRows(); updateSummary(null); });
$("#chooseFile").addEventListener("click", () => $("#csvInput").click());
$("#csvInput").addEventListener("change", (event) => { const file = event.target.files[0]; if (file) readCodes(file); });
function downloadTemplate() {
  if (!window.XLSX) { window.location.href = "组合导入模板.csv"; return; }
  const worksheet = XLSX.utils.aoa_to_sheet([
    ["主选基金代码", "主选占比", "备选基金代码", "备选占比"],
    ["110011", "50%", "", ""]
  ]);
  worksheet["!cols"] = [{ wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "组合导入模板");
  XLSX.writeFile(workbook, "组合导入模板.xlsx");
}
$("#downloadTemplate").addEventListener("click", (event) => { event.preventDefault(); downloadTemplate(); });
$("#fileDrop").addEventListener("dragover", (event) => { event.preventDefault(); $("#fileDrop").classList.add("dragging"); });
$("#fileDrop").addEventListener("dragleave", () => $("#fileDrop").classList.remove("dragging"));
$("#fileDrop").addEventListener("drop", (event) => { event.preventDefault(); $("#fileDrop").classList.remove("dragging"); const file = event.dataTransfer.files[0]; if (file) readCodes(file); });
function normalizeCode(value) {
  const text = String(value ?? "").trim();
  return /^\d{1,6}$/.test(text) ? text.padStart(6, "0") : text;
}
function setImportStatus(message, type = "") {
  const status = $("#importStatus");
  status.className = `import-status ${type}`.trim();
  status.textContent = message;
}
function setImportedRows(data) {
  const imported = data.map((row) => ({
    primary: normalizeCode(row[0]),
    primaryRatio: String(row[1] ?? "100%").trim() || "100%",
    alternative: normalizeCode(row[2]),
    ratio: String(row[3] ?? "100%").trim() || "100%",
    contribution: "待测算",
    state: "pending"
  })).filter((row) => validCode(row.primary));
  if (!imported.length) throw new Error("未找到有效的 6 位主选基金代码");
  rows.splice(0, rows.length, ...imported);
  renderRows();
  return imported.length;
}
function parseCsvLine(line) {
  const cells = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"' && quoted) { value += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if ((char === ',' || char === '，' || char === '\t') && !quoted) { cells.push(value.trim()); value = ""; }
    else value += char;
  }
  cells.push(value.trim());
  return cells;
}
function removeHeader(data) {
  if (!data.length) return data;
  return /基金|代码|占比/.test(data[0].join("")) ? data.slice(1) : data;
}
function readCodes(file) {
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      let data;
      if (/\.xlsx?$/i.test(file.name)) {
        if (!window.XLSX) throw new Error("Excel 解析组件未加载，请使用下载的 CSV 模板导入");
        const workbook = XLSX.read(reader.result, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        data = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
      } else {
        data = String(reader.result).replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim()).map(parseCsvLine);
      }
      const count = setImportedRows(removeHeader(data));
      setImportStatus(`成功导入 ${count} 行，正在计算组合最高限额…`, "success");
      await calculatePortfolio();
      setImportStatus(`成功导入并完成 ${count} 行测算。`, "success");
      $("#summaryPanel").scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (error) {
      setImportStatus(`导入失败：${error.message}`, "error");
    } finally {
      $("#csvInput").value = "";
    }
  };
  if (/\.xlsx?$/i.test(file.name)) reader.readAsArrayBuffer(file); else reader.readAsText(file, "utf-8");
}
function parseRatio(value) {
  const raw = String(value || "").trim();
  const number = Number(raw.replace(/%/g, ""));
  if (!Number.isFinite(number) || number <= 0) return null;
  return raw.includes("%") || number > 1 ? number / 100 : number;
}

async function calculateRow(row) {
  const primary = validCode(row.primary) ? await fetchFund(row.primary) : null;
  const alternative = validCode(row.alternative) ? await fetchFund(row.alternative) : null;
  const primaryRatio = parseRatio(row.primaryRatio);
  const alternativeRatio = parseRatio(row.ratio);
  if (!primary || !primaryRatio) return { text: "待确认", state: "pending", numeric: null };
  const funds = [{ fund: primary, ratio: primaryRatio }];
  if (alternative) {
    if (!alternativeRatio) return { text: "待确认", state: "pending", numeric: null };
    funds.push({ fund: alternative, ratio: alternativeRatio });
  }
  const active = funds.filter(({ fund }) => !fund.paused);
  if (!active.length) return { text: "暂停申购", state: "pending", numeric: null };
  if (active.some(({ fund }) => fund.value === null)) return { text: "待确认", state: "pending", numeric: null };
  if (active.some(({ fund }) => fund.value === "unlimited")) return { text: "无限额", state: "unlimited", numeric: null };
  const total = active.reduce((sum, { fund, ratio }) => sum + Number(fund.value) / ratio, 0);
  return { text: formatMoney(total), state: "ready", numeric: total };
}

async function calculatePortfolio() {
  if (!rows.length) { updateSummary(null); return; }
  $("#calculatePortfolio").disabled = true;
  for (const row of rows) { row.contribution = "计算中…"; row.state = "pending"; }
  renderRows();
  const results = await Promise.all(rows.map(calculateRow));
  results.forEach((result, index) => { rows[index].contribution = result.text; rows[index].state = result.state; });
  renderRows();
  const numeric = results.map((r) => r.numeric).filter((v) => typeof v === "number");
  const hasUnlimited = results.some((r) => r.state === "unlimited");
  updateSummary(hasUnlimited ? "unlimited" : numeric.length ? Math.max(...numeric) : "pending", rows.length);
  $("#calculatePortfolio").disabled = false; $("#lastUpdated").textContent = `${nowText()} 更新`;
}
function updateSummary(value, count = 0) { const valueEl = $("#summaryValue"); const note = $("#summaryNote"); if (value === null) { valueEl.innerHTML = `— <small>待测算</small>`; note.textContent = "导入组合并测算后，取所有行限额贡献的最大值。"; return; } if (value === "unlimited") { valueEl.innerHTML = `∞ <small>无限额</small>`; note.textContent = `已完成 ${count} 行测算；存在未展示购买上限的行，因此组合不设额度上限。`; return; } if (value === "pending") { valueEl.innerHTML = `— <small>待确认</small>`; note.textContent = "请检查基金代码，或稍后重试公开接口。"; return; } valueEl.innerHTML = `${formatMoney(value)} <small>组合上限</small>`; note.textContent = `已完成 ${count} 行测算，取其中限额贡献最大值作为组合上限。`; }
$("#calculatePortfolio").addEventListener("click", calculatePortfolio);
addRow(); addRow();
