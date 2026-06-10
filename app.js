const COLORS = {
  schwarz: "#1c1c1c",
  rot: "#c8102e",
  gold: "#ffce00",
  green: "#2d8a4e",
  amber: "#d48806",
  blue: "#2a4a7a",
  gray: "#9ca3af",
};

const stateClass = {
  active: "st-active",
  unknown: "st-unknown",
  expired: "st-expired",
  watch: "st-watch",
  rolling: "st-watch",
};

const statusRu = {
  active: "активный",
  unknown: "неизвестно",
  expired: "истёк",
  watch: "скоро дедлайн",
  rolling: "постоянный",
};

const gradeClass = {
  A: "gr-a",
  B: "gr-b",
  C: "gr-c",
  source: "gr-source",
};

const gradeOrder = { A: 0, B: 1, C: 2, source: 3 };

const tabTitles = {
  our: "Наши лиды (A + B)",
  strong: "Сильные лиды (A)",
  review: "На проверку (B)",
  excluded: "Отсеянные (C)",
  application: "Все заявки",
  source: "Страницы источников",
};

async function loadData() {
  const res = await fetch("./leads_ui_data.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Не удалось загрузить leads_ui_data.json");
  return res.json();
}

function buildHeroMeta(summary) {
  const el = document.getElementById("heroMeta");
  const chips = [
    `Прогон: ${summary.run_id || "—"}`,
    `Правила: v${summary.filter_rules_version || "—"}`,
    `Обновлено: ${summary.updated_at || "—"}`,
  ];
  el.innerHTML = chips.map((c) => `<span>${c}</span>`).join("");
}

function buildStats(summary) {
  const el = document.getElementById("stats");
  const cards = [
    { cls: "stat-our", val: summary.our_leads_count ?? 0, lbl: "Наши (A+B)" },
    { cls: "stat-a", val: summary.strong_lead_count ?? 0, lbl: "Сильные A" },
    { cls: "stat-b", val: summary.review_needed_count ?? 0, lbl: "На проверку B" },
    { cls: "stat-c", val: summary.excluded_count ?? 0, lbl: "Отсеянные C" },
    { cls: "stat-src", val: summary.source_pages_count ?? 0, lbl: "Страницы источников" },
  ];
  el.innerHTML = cards
    .map(
      (c) => `
    <div class="stat-card ${c.cls}">
      <div class="val">${c.val}</div>
      <div class="lbl">${c.lbl}</div>
    </div>`,
    )
    .join("");
}

function svgBarChart(categories, values, colors) {
  const W = 480;
  const H = 200;
  const padL = 36;
  const padB = 36;
  const padT = 12;
  const max = Math.max(...values, 1);
  const barW = (W - padL - 16) / values.length - 10;

  const bars = values
    .map((v, i) => {
      const h = ((H - padB - padT) * v) / max;
      const x = padL + i * (barW + 10);
      const y = H - padB - h;
      return `
        <rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="4" fill="${colors[i]}" opacity="0.92"/>
        <text x="${x + barW / 2}" y="${H - 14}" text-anchor="middle" font-size="11" fill="#555">${categories[i]}</text>
        <text x="${x + barW / 2}" y="${y - 6}" text-anchor="middle" font-size="12" font-weight="600" fill="#1c1c1c">${v}</text>`;
    })
    .join("");

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="Воронка лидов">${bars}
    <line x1="${padL}" y1="${H - padB}" x2="${W - 8}" y2="${H - padB}" stroke="#d4d4d4"/>
  </svg>`;
}

function svgDonutChart(segments) {
  const size = 180;
  const cx = size / 2;
  const cy = size / 2;
  const r = 68;
  const ir = 42;
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let angle = -Math.PI / 2;

  const arcs = segments
    .map((seg) => {
      const slice = (seg.value / total) * Math.PI * 2;
      const x1 = cx + r * Math.cos(angle);
      const y1 = cy + r * Math.sin(angle);
      angle += slice;
      const x2 = cx + r * Math.cos(angle);
      const y2 = cy + r * Math.sin(angle);
      const xi1 = cx + ir * Math.cos(angle - slice);
      const yi1 = cy + ir * Math.sin(angle - slice);
      const xi2 = cx + ir * Math.cos(angle);
      const yi2 = cy + ir * Math.sin(angle);
      const large = slice > Math.PI ? 1 : 0;
      const d = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${xi2} ${yi2} A ${ir} ${ir} 0 ${large} 0 ${xi1} ${yi1} Z`;
      return `<path d="${d}" fill="${seg.color}"/>`;
    })
    .join("");

  const legend = segments
    .map(
      (s) => `
    <div class="legend-item">
      <span class="legend-dot" style="background:${s.color}"></span>
      ${s.label}: ${s.value}
    </div>`,
    )
    .join("");

  return `
    <div style="display:flex;gap:20px;align-items:center;flex-wrap:wrap">
      <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Распределение A B C">
        ${arcs}
        <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="22" font-weight="700" fill="#1c1c1c">${total}</text>
        <text x="${cx}" y="${cy + 14}" text-anchor="middle" font-size="10" fill="#666">заявок</text>
      </svg>
      <div class="legend">${legend}</div>
    </div>`;
}

function buildCharts(summary) {
  const el = document.getElementById("charts");
  const funnel = svgBarChart(
    ["Сырые", "Очищ.", "Заявки", "Наши"],
    [
      summary.raw_count ?? 0,
      summary.refined_count ?? 0,
      summary.application_count ?? 0,
      summary.our_leads_count ?? 0,
    ],
    [COLORS.gray, COLORS.blue, COLORS.schwarz, COLORS.gold],
  );

  const donut = svgDonutChart([
    { label: "A сильные", value: summary.strong_lead_count ?? 0, color: COLORS.green },
    { label: "B проверка", value: summary.review_needed_count ?? 0, color: COLORS.amber },
    { label: "C отсеять", value: summary.excluded_count ?? 0, color: COLORS.rot },
  ]);

  el.innerHTML = `
    <div class="panel">
      <div class="panel-head">Воронка лидов (количество, шт.)</div>
      <div class="panel-body">${funnel}
        <div class="chart-caption">Источник: leads_ui_data.json · этапы пайплайна мониторинга</div>
      </div>
    </div>
    <div class="panel">
      <div class="panel-head">Заявки по оценке A / B / C</div>
      <div class="panel-body">${donut}
        <div class="chart-caption">Только application leads · страницы источников не включены</div>
      </div>
    </div>`;
}

function setTabCounts(summary) {
  const map = {
    cntOur: summary.our_leads_count,
    cntStrong: summary.strong_lead_count,
    cntReview: summary.review_needed_count,
    cntExcluded: summary.excluded_count,
    cntApp: summary.application_count,
    cntSrc: summary.source_pages_count,
  };
  Object.entries(map).forEach(([id, n]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = n != null ? `(${n})` : "";
  });
}

function renderSourcesFilter(items) {
  const sourceSel = document.getElementById("sourceFilter");
  sourceSel.innerHTML = `<option value="">Все</option>`;
  const sources = [...new Set(items.map((x) => x.source_name))].sort();
  for (const s of sources) {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    sourceSel.appendChild(opt);
  }
}

function formatFitWhy(item) {
  const parts = [];
  if (item.fit_reasons?.length) parts.push(item.fit_reasons.join("; "));
  if (item.fit_unknown?.length) parts.push(`неясно: ${item.fit_unknown.join("; ")}`);
  if (item.exclude_reason) parts.push(`исключено: ${item.exclude_reason}`);
  return parts.join(" · ") || "—";
}

function sortItems(items) {
  return [...items].sort((a, b) => {
    const ga = gradeOrder[a.fit_grade] ?? 9;
    const gb = gradeOrder[b.fit_grade] ?? 9;
    if (ga !== gb) return ga - gb;
    const da = a.deadline_date || "9999-12-31";
    const db = b.deadline_date || "9999-12-31";
    if (da !== db) return da.localeCompare(db);
    return (b.fit_score || 0) - (a.fit_score || 0);
  });
}

function renderList(items, { mode = "our" } = {}) {
  const list = document.getElementById("list");
  const title = tabTitles[mode] || "Лиды";

  if (!items.length) {
    list.innerHTML = `<div class="empty">Ничего не найдено по текущим фильтрам.</div>`;
    return;
  }

  const showGrade = mode !== "source";
  const showLeadReason = mode === "application" || mode === "our";
  const showFitWhy = mode !== "source";

  const rows = items
    .map((i, idx) => {
      const stClass = stateClass[i.status] || stateClass.unknown;
      const gClass = gradeClass[i.fit_grade] || "gr-b";
      const stLabel = statusRu[i.status] || i.status;
      const deadline = i.deadline_date || "—";
      const start = i.start_date || "—";
      const pub = i.publication_date || "—";

      return `
      <tr>
        <td>${idx + 1}</td>
        <td>
          <div class="t">${escapeHtml(i.title)}</div>
          <div class="d">${escapeHtml(i.description || "")}</div>
        </td>
        <td>${escapeHtml(i.source_label || i.source_name)}</td>
        ${showGrade ? `<td><span class="badge ${gClass}">${i.fit_grade || "?"}</span></td>` : ""}
        ${showLeadReason ? `<td class="reason">${escapeHtml(i.lead_reason || "—")}</td>` : ""}
        ${showFitWhy ? `<td class="reason">${escapeHtml(formatFitWhy(i))}</td>` : ""}
        <td>${pub}</td>
        <td>${start}</td>
        <td>${deadline}</td>
        <td><span class="badge ${stClass}">${stLabel}</span></td>
        <td><a class="link-btn" href="${escapeAttr(i.url)}" target="_blank" rel="noreferrer">Открыть</a></td>
      </tr>`;
    })
    .join("");

  list.innerHTML = `
    <div class="table-panel">
      <div class="table-head-bar">
        <h2>${title}</h2>
        <span class="result-count">Показано: ${items.length}</span>
      </div>
      <div class="tableWrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Лид</th>
              <th>Источник</th>
              ${showGrade ? "<th>Оценка</th>" : ""}
              ${showLeadReason ? "<th>Почему lead</th>" : ""}
              ${showFitWhy ? "<th>Почему A/B/C</th>" : ""}
              <th>Публикация</th>
              <th>Старт</th>
              <th>Дедлайн</th>
              <th>Статус</th>
              <th>Ссылка</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

function wireFilters(payload) {
  const tabItems = {
    our: payload.our_leads || [],
    strong: payload.strong_leads || [],
    review: payload.review_needed || [],
    excluded: payload.excluded_leads || [],
    application: payload.application_leads || payload.items || [],
    source: payload.source_pages || [],
  };

  let activeTab = "our";

  const q = document.getElementById("q");
  const sourceFilter = document.getElementById("sourceFilter");
  const statusFilter = document.getElementById("statusFilter");
  const gradeFilter = document.getElementById("gradeFilter");
  const dateFilter = document.getElementById("dateFilter");
  const resetBtn = document.getElementById("resetBtn");

  const tabs = {
    our: document.getElementById("tabOur"),
    strong: document.getElementById("tabStrong"),
    review: document.getElementById("tabReview"),
    excluded: document.getElementById("tabExcluded"),
    application: document.getElementById("tabApplication"),
    source: document.getElementById("tabSources"),
  };

  const getItems = () => tabItems[activeTab] || [];

  const setActiveTab = (name) => {
    activeTab = name;
    Object.entries(tabs).forEach(([key, el]) => {
      if (el) el.classList.toggle("active", key === name);
    });
    const showGradeFilter = activeTab !== "source";
    gradeFilter.closest(".gradeFilterWrap").style.display = showGradeFilter ? "" : "none";
    renderSourcesFilter(getItems());
    apply();
  };

  const apply = () => {
    const query = q.value.trim().toLowerCase();
    const src = sourceFilter.value;
    const st = statusFilter.value;
    const gf = gradeFilter.value;
    const df = dateFilter.value;

    let filtered = getItems().filter((i) => {
      if (src && i.source_name !== src) return false;
      if (st && i.status !== st) return false;
      if (gf && i.fit_grade !== gf) return false;
      if (df === "with_dates" && !i.deadline_date && !i.start_date) return false;
      if (df === "no_dates" && (i.deadline_date || i.start_date)) return false;
      if (query) {
        const hay = `${i.title} ${i.source_name} ${i.url} ${i.description} ${formatFitWhy(i)}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });

    if (activeTab === "our" || activeTab === "application") {
      filtered = sortItems(filtered);
    }

    renderList(filtered, { mode: activeTab });
  };

  [q, sourceFilter, statusFilter, gradeFilter, dateFilter].forEach((el) =>
    el.addEventListener("input", apply),
  );

  Object.entries(tabs).forEach(([name, el]) => {
    if (el) el.addEventListener("click", () => setActiveTab(name));
  });

  resetBtn.addEventListener("click", () => {
    q.value = "";
    sourceFilter.value = "";
    statusFilter.value = "";
    gradeFilter.value = "";
    dateFilter.value = "";
    apply();
  });

  setActiveTab("our");
}

async function main() {
  try {
    const payload = await loadData();
    const summary = payload.summary || {};
    buildHeroMeta(summary);
    buildStats(summary);
    buildCharts(summary);
    setTabCounts(summary);
    wireFilters(payload);
  } catch (e) {
    const list = document.getElementById("list");
    list.innerHTML = `<div class="error-box">Ошибка загрузки: ${escapeHtml(String(e.message || e))}</div>`;
  }
}

main();
