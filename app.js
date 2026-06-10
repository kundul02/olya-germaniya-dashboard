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

const sectionTitles = {
  our: "Целевые лиды (A + B)",
  strong: "Сильные (A)",
  review: "На проверку (B)",
  excluded: "Отсеянные (C)",
  application: "Все заявки",
  source: "Страницы источников",
};

const KPI_TABS = [
  { key: "our", cls: "kpi-target", label: "Целевые", sub: "A + B" },
  { key: "strong", cls: "kpi-a", label: "Сильные", sub: "оценка A" },
  { key: "review", cls: "kpi-b", label: "На проверку", sub: "оценка B" },
  { key: "excluded", cls: "kpi-c", label: "Отсеянные", sub: "оценка C" },
  { key: "application", cls: "kpi-app", label: "Все заявки", sub: "до фильтра" },
  { key: "source", cls: "kpi-src", label: "Источники", sub: "страницы" },
];

function countForTab(summary, key) {
  const map = {
    our: summary.our_leads_count,
    strong: summary.strong_lead_count,
    review: summary.review_needed_count,
    excluded: summary.excluded_count,
    application: summary.application_count,
    source: summary.source_pages_count,
  };
  return map[key] ?? 0;
}

async function loadData() {
  const res = await fetch("./leads_ui_data.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Не удалось загрузить leads_ui_data.json");
  return res.json();
}

function buildHeroMeta(summary) {
  const el = document.getElementById("heroMeta");
  const chips = [
    `Прогон: ${summary.run_id || "—"}`,
    `Правила v${summary.filter_rules_version || "—"}`,
    summary.updated_at || "—",
  ];
  el.innerHTML = chips.map((c) => `<span>${escapeHtml(c)}</span>`).join("");
}

function buildKpiTabs(summary, onSelect) {
  const el = document.getElementById("stats");
  el.innerHTML = KPI_TABS.map(
    (t) => `
    <button type="button" class="kpi-card ${t.cls}" data-tab="${t.key}" role="tab" aria-selected="false">
      <div class="val">${countForTab(summary, t.key)}</div>
      <div class="lbl">${t.label}<br>${t.sub}</div>
    </button>`,
  ).join("");

  el.querySelectorAll(".kpi-card").forEach((btn) => {
    btn.addEventListener("click", () => onSelect(btn.dataset.tab));
  });
}

function setActiveKpi(tabKey) {
  document.querySelectorAll(".kpi-card").forEach((btn) => {
    const active = btn.dataset.tab === tabKey;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", active ? "true" : "false");
  });
}

function svgFunnelChart(summary) {
  const W = 920;
  const H = 220;
  const padL = 44;
  const padR = 20;
  const padB = 44;
  const padT = 16;
  const plotH = H - padB - padT;

  const raw = summary.raw_count ?? 0;
  const refined = summary.refined_count ?? 0;
  const apps = summary.application_count ?? 0;
  const target = summary.our_leads_count ?? 0;
  const excluded = summary.excluded_count ?? 0;

  const max = Math.max(raw, 1);
  const cols = 4;
  const gap = 18;
  const barW = (W - padL - padR - gap * (cols - 1)) / cols;

  function barHeight(v) {
    return (plotH * v) / max;
  }

  const stages = [
    { label: "Сырые", value: raw, color: COLORS.gray },
    { label: "Очищённые", value: refined, color: COLORS.blue },
    { label: "Заявки", value: apps, color: COLORS.schwarz },
  ];

  let svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="Воронка обработки лидов">`;
  svg += `<line x1="${padL}" y1="${H - padB}" x2="${W - padR}" y2="${H - padB}" stroke="#d4d4d4"/>`;

  stages.forEach((s, i) => {
    const h = barHeight(s.value);
    const x = padL + i * (barW + gap);
    const y = H - padB - h;
    svg += `<rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="5" fill="${s.color}" opacity="0.9"/>`;
    svg += `<text x="${x + barW / 2}" y="${y - 8}" text-anchor="middle" font-size="13" font-weight="600" fill="#1c1c1c">${s.value}</text>`;
    svg += `<text x="${x + barW / 2}" y="${H - 16}" text-anchor="middle" font-size="11" fill="#555">${s.label}</text>`;
  });

  const stackX = padL + 3 * (barW + gap);
  const totalH = barHeight(apps);
  const targetH = apps > 0 ? (totalH * target) / apps : 0;
  const excludedH = apps > 0 ? (totalH * excluded) / apps : 0;
  const baseY = H - padB;

  if (apps > 0) {
    svg += `<rect x="${stackX}" y="${baseY - targetH}" width="${barW}" height="${targetH}" rx="5" fill="${COLORS.gold}" opacity="0.95"/>`;
    if (excludedH > 0) {
      svg += `<rect x="${stackX}" y="${baseY - targetH - excludedH}" width="${barW}" height="${excludedH}" rx="5" fill="${COLORS.rot}" opacity="0.9"/>`;
    }
    svg += `<text x="${stackX + barW / 2}" y="${baseY - totalH - 10}" text-anchor="middle" font-size="13" font-weight="600" fill="#1c1c1c">${apps}</text>`;
    if (targetH > 18) {
      svg += `<text x="${stackX + barW / 2}" y="${baseY - targetH / 2}" text-anchor="middle" font-size="11" font-weight="600" fill="#5c4a00">${target}</text>`;
    }
    if (excludedH > 14) {
      svg += `<text x="${stackX + barW / 2}" y="${baseY - targetH - excludedH / 2}" text-anchor="middle" font-size="11" font-weight="600" fill="#fff">${excluded}</text>`;
    }
  }

  svg += `<text x="${stackX + barW / 2}" y="${H - 16}" text-anchor="middle" font-size="11" fill="#555">Разбор заявок</text>`;
  svg += `<text x="${stackX + barW / 2}" y="${H - 4}" text-anchor="middle" font-size="9" fill="#888">целевые + отсеянные</text>`;
  svg += `</svg>`;

  return svg;
}

function buildCharts(summary) {
  const el = document.getElementById("charts");
  el.innerHTML = `
    <div class="panel">
      <div class="panel-head">Воронка обработки лидов</div>
      <div class="panel-body">
        ${svgFunnelChart(summary)}
        <div class="chart-legend">
          <span><i style="background:${COLORS.gray}"></i> Сырые записи</span>
          <span><i style="background:${COLORS.blue}"></i> После очистки</span>
          <span><i style="background:${COLORS.schwarz}"></i> Заявки (application)</span>
          <span><i style="background:${COLORS.gold}"></i> Целевые (${summary.our_leads_count ?? 0})</span>
          <span><i style="background:${COLORS.rot}"></i> Отсеянные (${summary.excluded_count ?? 0})</span>
        </div>
        <div class="chart-caption">
          Последний столбец — состав из ${summary.application_count ?? 0} заявок:
          ${summary.our_leads_count ?? 0} целевых + ${summary.excluded_count ?? 0} отсеянных = ${(summary.our_leads_count ?? 0) + (summary.excluded_count ?? 0)}
        </div>
      </div>
    </div>`;
}

function renderSourcesFilter(items) {
  const sourceSel = document.getElementById("sourceFilter");
  const current = sourceSel.value;
  sourceSel.innerHTML = `<option value="">Все</option>`;
  const sources = [...new Set(items.map((x) => x.source_name))].sort();
  for (const s of sources) {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    sourceSel.appendChild(opt);
  }
  if ([...sourceSel.options].some((o) => o.value === current)) {
    sourceSel.value = current;
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
  const title = sectionTitles[mode] || "Лиды";

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
        <td>${i.publication_date || "—"}</td>
        <td>${i.start_date || "—"}</td>
        <td>${i.deadline_date || "—"}</td>
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
              ${showLeadReason ? "<th>Причина лида</th>" : ""}
              ${showFitWhy ? "<th>Обоснование оценки</th>" : ""}
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

  const getItems = () => tabItems[activeTab] || [];

  const setActiveTab = (name) => {
    activeTab = name;
    setActiveKpi(name);
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

  resetBtn.addEventListener("click", () => {
    q.value = "";
    sourceFilter.value = "";
    statusFilter.value = "";
    gradeFilter.value = "";
    dateFilter.value = "";
    apply();
  });

  buildKpiTabs(payload.summary || {}, setActiveTab);
  setActiveTab("our");
}

async function main() {
  try {
    const payload = await loadData();
    const summary = payload.summary || {};
    buildHeroMeta(summary);
    buildCharts(summary);
    wireFilters(payload);
  } catch (e) {
    const list = document.getElementById("list");
    list.innerHTML = `<div class="error-box">Ошибка загрузки: ${escapeHtml(String(e.message || e))}</div>`;
  }
}

main();
