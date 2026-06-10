const stateClass = {
  active: "st-active",
  unknown: "st-unknown",
  expired: "st-expired",
  watch: "st-watch",
  rolling: "st-watch",
};

const gradeClass = {
  A: "gr-a",
  B: "gr-b",
  C: "gr-c",
  source: "gr-source",
};

const gradeOrder = { A: 0, B: 1, C: 2, source: 3 };

async function loadData() {
  const res = await fetch("./leads_ui_data.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Не удалось загрузить leads_ui_data.json");
  return res.json();
}

function buildMeta(summary) {
  const el = document.getElementById("meta");
  const chips = [
    `Run: ${summary.run_id || "-"}`,
    `Refined: ${summary.refined_count ?? "-"}`,
    `Наши (A+B): ${summary.our_leads_count ?? "-"}`,
    `Strong A: ${summary.strong_lead_count ?? "-"}`,
    `Review B: ${summary.review_needed_count ?? "-"}`,
    `Excluded C: ${summary.excluded_count ?? "-"}`,
    `Source pages: ${summary.source_pages_count ?? "-"}`,
    `Rules: v${summary.filter_rules_version || "-"}`,
    `Updated: ${summary.updated_at || "-"}`,
  ];
  el.innerHTML = chips.map((c) => `<span class="chip">${c}</span>`).join("");
}

function renderSourcesFilter(items) {
  const sourceSel = document.getElementById("sourceFilter");
  sourceSel.innerHTML = `<option value="">Все источники</option>`;
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
  if (item.fit_reasons?.length) {
    parts.push(item.fit_reasons.join("; "));
  }
  if (item.fit_unknown?.length) {
    parts.push(`? ${item.fit_unknown.join("; ")}`);
  }
  if (item.exclude_reason) {
    parts.push(`✕ ${item.exclude_reason}`);
  }
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
  if (!items.length) {
    list.innerHTML = `<div class="card empty">Ничего не найдено по текущим фильтрам.</div>`;
    return;
  }

  const showGrade = mode !== "source";
  const showLeadReason = mode === "application" || mode === "our";
  const showFitWhy = mode !== "source";

  const rows = items
    .map((i, idx) => {
      const stClass = stateClass[i.status] || stateClass.unknown;
      const gClass = gradeClass[i.fit_grade] || "gr-b";
      const deadline = i.deadline_date || "не найден";
      const start = i.start_date || "не найден";
      const pub = i.publication_date || "не найден";
      const gradeCell = showGrade
        ? `<td><span class="grade ${gClass}">${i.fit_grade || "?"}</span></td>`
        : "";
      const leadReasonCell = showLeadReason
        ? `<td class="reason">${i.lead_reason || "—"}</td>`
        : "";
      const fitWhyCell = showFitWhy
        ? `<td class="reason">${formatFitWhy(i)}</td>`
        : "";

      return `
      <tr>
        <td>${idx + 1}</td>
        <td>
          <div class="t">${i.title}</div>
          <div class="d">${i.description}</div>
        </td>
        <td>${i.source_label || i.source_name}</td>
        ${gradeCell}
        ${leadReasonCell}
        ${fitWhyCell}
        <td>${pub}</td>
        <td>${start}</td>
        <td>${deadline}</td>
        <td><span class="status ${stClass}">${i.status}</span></td>
        <td><a href="${i.url}" target="_blank" rel="noreferrer">Открыть</a></td>
      </tr>`;
    })
    .join("");

  const gradeCol = showGrade ? `<th>Оценка</th>` : "";
  const leadReasonCol = showLeadReason ? `<th>Почему lead</th>` : "";
  const fitWhyCol = showFitWhy ? `<th>Почему A/B/C</th>` : "";

  list.innerHTML = `
    <div class="tableWrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Лид</th>
            <th>Источник</th>
            ${gradeCol}
            ${leadReasonCol}
            ${fitWhyCol}
            <th>Публикация</th>
            <th>Старт</th>
            <th>Дедлайн</th>
            <th>Статус</th>
            <th>Ссылка</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
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
    buildMeta(payload.summary);
    wireFilters(payload);
  } catch (e) {
    const list = document.getElementById("list");
    list.innerHTML = `<div class="card empty">Ошибка: ${String(e.message || e)}</div>`;
  }
}

main();
