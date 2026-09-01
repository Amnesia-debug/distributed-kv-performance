const concurrency = [8, 16, 32, 64];

const matrixData = [
  { workload: "Put", phase: "cold", c: 8, qps: 1618, putP50: 4.78, putP95: 5.76, putP99: 7.93, rangeP50: null, rangeP95: null, rangeP99: null, retries: 8 },
  { workload: "Put", phase: "cold", c: 16, qps: 2994, putP50: 5.17, putP95: 6.24, putP99: 9.49, rangeP50: null, rangeP95: null, rangeP99: null, retries: 0 },
  { workload: "Put", phase: "cold", c: 32, qps: 5527, putP50: 5.39, putP95: 8.13, putP99: 12.42, rangeP50: null, rangeP95: null, rangeP99: null, retries: 0 },
  { workload: "Put", phase: "cold", c: 64, qps: 7817, putP50: 7.34, putP95: 13.05, putP99: 18.76, rangeP50: null, rangeP95: null, rangeP99: null, retries: 64 },
  { workload: "Put", phase: "warm", c: 8, qps: 1661, putP50: 4.66, putP95: 5.31, putP99: 7.32, rangeP50: null, rangeP95: null, rangeP99: null, retries: 8 },
  { workload: "Put", phase: "warm", c: 16, qps: 2948, putP50: 5.20, putP95: 6.20, putP99: 9.63, rangeP50: null, rangeP95: null, rangeP99: null, retries: 0 },
  { workload: "Put", phase: "warm", c: 32, qps: 5595, putP50: 5.38, putP95: 8.05, putP99: 12.46, rangeP50: null, rangeP95: null, rangeP99: null, retries: 32 },
  { workload: "Put", phase: "warm", c: 64, qps: 7797, putP50: 7.19, putP95: 13.57, putP99: 20.25, rangeP50: null, rangeP95: null, rangeP99: null, retries: 0 },
  { workload: "Range", phase: "warm", c: 8, qps: 23827, putP50: null, putP95: null, putP99: null, rangeP50: 0.31, rangeP95: 0.49, rangeP99: 0.90, retries: 8 },
  { workload: "Range", phase: "warm", c: 16, qps: 35702, putP50: null, putP95: null, putP99: null, rangeP50: 0.40, rangeP95: 0.74, rangeP99: 1.39, retries: 16 },
  { workload: "Range", phase: "warm", c: 32, qps: 49727, putP50: null, putP95: null, putP99: null, rangeP50: 0.57, rangeP95: 1.08, rangeP99: 1.74, retries: 0 },
  { workload: "Range", phase: "warm", c: 64, qps: 59207, putP50: null, putP95: null, putP99: null, rangeP50: 0.88, rangeP95: 2.04, rangeP99: 3.30, retries: 64 },
  { workload: "Mixed", phase: "cold", c: 8, qps: 3315, putP50: 4.45, putP95: 6.04, putP99: 7.70, rangeP50: 1.53, rangeP95: 3.17, rangeP99: 3.89, retries: 8 },
  { workload: "Mixed", phase: "cold", c: 16, qps: 5802, putP50: 4.65, putP95: 6.45, putP99: 8.62, rangeP50: 1.82, rangeP95: 3.61, rangeP99: 4.86, retries: 16 },
  { workload: "Mixed", phase: "cold", c: 32, qps: 9498, putP50: 5.20, putP95: 8.45, putP99: 11.12, rangeP50: 2.32, rangeP95: 4.48, rangeP99: 6.65, retries: 32 },
  { workload: "Mixed", phase: "cold", c: 64, qps: 13414, putP50: 7.04, putP95: 12.73, putP99: 16.50, rangeP50: 3.11, rangeP95: 7.03, rangeP99: 10.66, retries: 0 },
  { workload: "Mixed", phase: "warm", c: 8, qps: 3358, putP50: 4.35, putP95: 5.87, putP99: 8.36, rangeP50: 1.50, rangeP95: 3.15, rangeP99: 3.87, retries: 8 },
  { workload: "Mixed", phase: "warm", c: 16, qps: 5892, putP50: 4.48, putP95: 6.30, putP99: 10.14, rangeP50: 1.80, rangeP95: 3.55, rangeP99: 4.99, retries: 16 },
  { workload: "Mixed", phase: "warm", c: 32, qps: 9528, putP50: 5.15, putP95: 8.28, putP99: 13.82, rangeP50: 2.29, rangeP95: 4.35, rangeP99: 7.94, retries: 0 },
  { workload: "Mixed", phase: "warm", c: 64, qps: 12424, putP50: 7.09, putP95: 15.07, putP99: 23.74, rangeP50: 3.34, rangeP95: 7.75, rangeP99: 14.84, retries: 0 }
];

const workloads = [
  { id: "put", name: "Put", tableType: "standard" },
  { id: "range", name: "Range", tableType: "standard" },
  { id: "mixed", name: "Mixed", tableType: "mixed" }
];

const svgNamespace = "http://www.w3.org/2000/svg";
const numberFormat = new Intl.NumberFormat("en-US");

function svgElement(tag, attributes = {}, text = "") {
  const element = document.createElementNS(svgNamespace, tag);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  if (text) element.textContent = text;
  return element;
}

function formatQps(value) {
  if (value >= 1000) return `${Math.round(value / 1000)}K`;
  return String(value);
}

function formatLatency(value) {
  return `${value.toFixed(2)} ms`;
}

function formatPercentageChange(value, baseline) {
  const change = ((value - baseline) / baseline) * 100;
  return `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`;
}

function latencyDetails(item, definition) {
  const average = formatLatency((item.c * 1000) / item.qps);
  if (definition.id === "mixed") {
    return `<span class="tooltip-latency-metrics three-metrics">
      <span><small>Avg</small><b>${average}</b></span>
      <span><small>Put P99</small><b>${formatLatency(item.putP99)}</b></span>
      <span><small>Range P99</small><b>${formatLatency(item.rangeP99)}</b></span>
    </span>`;
  }
  const p99 = definition.id === "put" ? item.putP99 : item.rangeP99;
  return `<span class="tooltip-latency-metrics">
    <span><small>Avg</small><b>${average}</b></span>
    <span><small>P99</small><b>${formatLatency(p99)}</b></span>
  </span>`;
}

function workloadRows(id) {
  return matrixData.filter(item => item.workload.toLowerCase() === id);
}

function baselineRows(id) {
  return workloadRows(id).filter(item => item.phase === "warm");
}

function niceMaximum(values) {
  const maximum = Math.max(...values);
  let step = 1;
  if (maximum >= 10000) step = 5000;
  else if (maximum >= 1000) step = 1000;
  return Math.ceil((maximum * 1.08) / step) * step;
}

function latencySeries(rows, definition) {
  const series = [{
    name: "平均延迟",
    color: "var(--avg-latency)",
    values: rows.map(item => (item.c * 1000) / item.qps)
  }];
  if (definition.id === "mixed") {
    series.push(
      { name: "Put P99", color: "var(--tail-latency)", dash: "7 5", values: rows.map(item => item.putP99) },
      { name: "Range P99", color: "var(--tail-latency)", dash: "2 5", values: rows.map(item => item.rangeP99) }
    );
  } else {
    const key = definition.id === "put" ? "putP99" : "rangeP99";
    series.push({ name: "P99 延迟", color: "var(--tail-latency)", dash: "7 5", values: rows.map(item => item[key]) });
  }
  return series;
}

function renderCompositeChart(svg, tooltip, rows, definition) {
  const shell = svg.parentElement;
  const width = Math.max(320, Math.floor(shell.clientWidth));
  const height = window.innerWidth <= 900 ? 340 : Math.max(250, (workloadRows(definition.id).length + 1) * 43);
  const margin = { top: 18, right: width < 420 ? 58 : 66, bottom: 52, left: width < 420 ? 58 : 64 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const allRows = workloadRows(definition.id);
  const qpsGroups = [
    { phase: "cold", name: "空库 QPS", color: "var(--qps-empty)", values: concurrency.map(c => allRows.find(item => item.phase === "cold" && item.c === c)?.qps ?? null) },
    { phase: "warm", name: "已有数据 QPS", color: "var(--qps-loaded)", values: concurrency.map(c => allRows.find(item => item.phase === "warm" && item.c === c)?.qps ?? null) }
  ].filter(group => group.values.some(value => value !== null));
  const qpsValues = qpsGroups.flatMap(group => group.values.filter(value => value !== null));
  const delaySeries = latencySeries(rows, definition);
  const qpsMax = niceMaximum(qpsValues);
  const latencyMax = niceMaximum(delaySeries.flatMap(item => item.values));
  const groupWidth = Math.min(54, plotWidth / 6);
  const barGap = qpsGroups.length > 1 ? 3 : 0;
  const barWidth = qpsGroups.length > 1 ? (groupWidth - barGap) / 2 : Math.min(34, groupWidth);
  const x = index => margin.left + groupWidth / 2 + ((plotWidth - groupWidth) * index) / (concurrency.length - 1);
  const yQps = value => margin.top + plotHeight - (value / qpsMax) * plotHeight;
  const yLatency = value => margin.top + plotHeight - (value / latencyMax) * plotHeight;

  svg.replaceChildren();
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("height", height);
  svg.style.height = `${height}px`;
  svg.appendChild(svgElement("rect", {
    x: margin.left, y: margin.top, width: plotWidth, height: plotHeight, class: "chart-frame"
  }));

  for (let tick = 0; tick <= 5; tick += 1) {
    const qpsTick = (qpsMax / 5) * tick;
    const latencyTick = (latencyMax / 5) * tick;
    const yPosition = yQps(qpsTick);
    svg.appendChild(svgElement("line", {
      x1: margin.left, y1: yPosition, x2: width - margin.right, y2: yPosition, class: "chart-gridline"
    }));
    svg.appendChild(svgElement("text", {
      x: margin.left - 9, y: yPosition + 4, "text-anchor": "end", class: "chart-label"
    }, formatQps(qpsTick)));
    svg.appendChild(svgElement("text", {
      x: width - margin.right + 9, y: yPosition + 4, "text-anchor": "start", class: "chart-label"
    }, latencyTick.toFixed(1)));
  }

  concurrency.forEach((value, index) => {
    svg.appendChild(svgElement("text", {
      x: x(index), y: height - 19, "text-anchor": "middle", class: "chart-label"
    }, String(value)));
  });
  svg.appendChild(svgElement("text", {
    x: margin.left + plotWidth / 2, y: height - 3, "text-anchor": "middle", class: "chart-axis-title"
  }, "并发客户端（c）"));
  svg.appendChild(svgElement("text", {
    x: 15,
    y: margin.top + plotHeight / 2,
    transform: `rotate(-90 15 ${margin.top + plotHeight / 2})`,
    "text-anchor": "middle",
    class: "chart-axis-title"
  }, "吞吐量（QPS）"));
  svg.appendChild(svgElement("text", {
    x: width - 15,
    y: margin.top + plotHeight / 2,
    transform: `rotate(90 ${width - 15} ${margin.top + plotHeight / 2})`,
    "text-anchor": "middle",
    class: "chart-axis-title"
  }, "延迟（ms）"));

  qpsGroups.forEach((group, groupIndex) => {
    group.values.forEach((value, index) => {
      if (value === null) return;
      const offset = qpsGroups.length === 1 ? -barWidth / 2 : -groupWidth / 2 + groupIndex * (barWidth + barGap);
      const top = yQps(value);
      svg.appendChild(svgElement("rect", {
        x: x(index) + offset,
        y: top,
        width: barWidth,
        height: margin.top + plotHeight - top,
        fill: group.color,
        class: "chart-bar",
        "data-phase": group.phase
      }));
    });
  });

  delaySeries.forEach(series => {
    const points = series.values.map((value, index) => `${x(index)},${yLatency(value)}`).join(" ");
    svg.appendChild(svgElement("polyline", {
      points, class: "chart-line", stroke: series.color, "stroke-dasharray": series.dash || "none"
    }));
    series.values.forEach((value, index) => {
      svg.appendChild(svgElement("circle", {
        cx: x(index), cy: yLatency(value), r: 4.2,
        fill: series.dash ? "var(--paper)" : series.color,
        style: `--point-stroke:${series.color}`,
        class: "chart-point"
      }));
    });
  });

  const lastIndex = concurrency.length - 1;
  delaySeries.forEach(series => {
    svg.appendChild(svgElement("text", {
      x: x(lastIndex) - barWidth / 2 - 5,
      y: yLatency(series.values[lastIndex]) - 6,
      "text-anchor": "end", class: "chart-value-label",
      fill: series.color
    }, series.values[lastIndex].toFixed(2)));
  });

  const guide = svgElement("line", {
    x1: 0, y1: margin.top, x2: 0, y2: margin.top + plotHeight, class: "chart-guide", opacity: 0
  });
  svg.appendChild(guide);

  function showTooltip(index, event) {
    guide.setAttribute("x1", x(index));
    guide.setAttribute("x2", x(index));
    guide.setAttribute("opacity", 1);
    const currentConcurrency = concurrency[index];
    const empty = allRows.find(item => item.phase === "cold" && item.c === currentConcurrency);
    const loaded = allRows.find(item => item.phase === "warm" && item.c === currentConcurrency);
    const qpsDelta = empty && loaded ? formatPercentageChange(loaded.qps, empty.qps) : "";
    const throughputRows = [
      empty ? `<div class="tooltip-metric-row"><span class="tooltip-name"><span class="tooltip-dot" style="--series-color:var(--qps-empty)"></span>空库（0 条）</span><span class="tooltip-value">${numberFormat.format(empty.qps)} QPS</span></div>` : "",
      loaded ? `<div class="tooltip-metric-row"><span class="tooltip-name"><span class="tooltip-dot" style="--series-color:var(--qps-loaded)"></span>已有 100,000 条</span><span class="tooltip-value">${numberFormat.format(loaded.qps)} QPS${qpsDelta ? ` <small>${qpsDelta}</small>` : ""}</span></div>` : ""
    ].join("");
    const latencyRows = [
      empty ? `<div class="tooltip-latency-row"><strong>空库</strong>${latencyDetails(empty, definition)}</div>` : "",
      loaded ? `<div class="tooltip-latency-row"><strong>已有数据</strong>${latencyDetails(loaded, definition)}</div>` : ""
    ].join("");
    tooltip.innerHTML = `
      <div class="tooltip-title">并发客户端 ${currentConcurrency}</div>
      <div class="tooltip-section">
        <div class="tooltip-section-title">吞吐量</div>
        ${throughputRows}
      </div>
      <div class="tooltip-section">
        <div class="tooltip-section-title">延迟</div>
        ${latencyRows}
      </div>`;
    tooltip.hidden = false;
    const shellRect = shell.getBoundingClientRect();
    const pointerX = event.clientX ? event.clientX - shellRect.left : x(index);
    tooltip.style.left = `${Math.min(Math.max(8, pointerX + 12), width - tooltip.offsetWidth - 8)}px`;
    tooltip.style.top = `${margin.top + 8}px`;
    setTableHighlight(definition.id, concurrency[index]);
  }

  concurrency.forEach((value, index) => {
    const previous = index === 0 ? margin.left : (x(index - 1) + x(index)) / 2;
    const next = index === concurrency.length - 1 ? width - margin.right : (x(index) + x(index + 1)) / 2;
    const hit = svgElement("rect", {
      x: previous, y: margin.top, width: next - previous, height: plotHeight,
      fill: "transparent", tabindex: 0, role: "button",
      "aria-label": `并发客户端 ${value}，${qpsGroups.filter(group => group.values[index] !== null).map(group => `${group.name} ${numberFormat.format(group.values[index])}`).join("，")}，平均延迟 ${formatLatency(delaySeries[0].values[index])}`
    });
    hit.addEventListener("pointerenter", event => showTooltip(index, event));
    hit.addEventListener("pointermove", event => showTooltip(index, event));
    hit.addEventListener("focus", event => showTooltip(index, event));
    hit.addEventListener("click", event => showTooltip(index, event));
    hit.addEventListener("blur", () => { tooltip.hidden = true; guide.setAttribute("opacity", 0); clearTableHighlight(definition.id); });
    svg.appendChild(hit);
  });
  svg.onpointerleave = () => {
    tooltip.hidden = true;
    guide.setAttribute("opacity", 0);
    clearTableHighlight(definition.id);
  };
}

function setTableHighlight(workload, concurrencyValue) {
  document.querySelectorAll(`#${workload}-panel tbody tr`).forEach(row => {
    row.classList.toggle("is-chart-highlighted", Number(row.dataset.concurrency) === concurrencyValue);
  });
}

function clearTableHighlight(workload) {
  document.querySelectorAll(`#${workload}-panel tbody tr.is-chart-highlighted`).forEach(row => {
    row.classList.remove("is-chart-highlighted");
  });
}

function tableHeader(columns) {
  return `<thead><tr>${columns.map(column => `<th scope="col" class="${column.numeric ? "numeric" : ""}">${column.label}</th>`).join("")}</tr></thead>`;
}

function metricValue(item, key) {
  if (key === "clients") return String(item.c);
  if (key === "qps") return numberFormat.format(item.qps);
  if (key === "latency") return formatLatency((item.c * 1000) / item.qps);
  return formatLatency(item[key]);
}

function tableColumns(definition) {
  const common = [
    { label: "初始数据量", key: "load" },
    { label: "并发客户端（c）", key: "clients", numeric: true },
    { label: "QPS", key: "qps", numeric: true },
    { label: "平均延迟", key: "latency", numeric: true }
  ];
  if (definition.tableType === "mixed") {
    return [...common,
      { label: "Put P99", key: "putP99", numeric: true },
      { label: "Range P99", key: "rangeP99", numeric: true }
    ];
  }
  const prefix = definition.id === "put" ? "put" : "range";
  return [...common,
    { label: "P95 延迟", key: `${prefix}P95`, numeric: true },
    { label: "P99 延迟", key: `${prefix}P99`, numeric: true }
  ];
}

function renderTable(definition) {
  const columns = tableColumns(definition);
  const groups = ["cold", "warm"].map(phase => ({
    phase,
    rows: workloadRows(definition.id).filter(item => item.phase === phase)
  })).filter(group => group.rows.length);
  const body = groups.map(group => group.rows.map((item, index) => `
    <tr data-concurrency="${item.c}" data-phase="${group.phase}">
      ${index === 0 ? `<th scope="rowgroup" rowspan="${group.rows.length}" class="load-cell">${group.phase === "cold" ? "空库（0 条）" : "已有 100,000 条数据"}</th>` : ""}
      ${columns.slice(1).map(column => `<td class="numeric ${column.key === "qps" ? "qps-cell" : ""}">${metricValue(item, column.key)}</td>`).join("")}
    </tr>`).join("")).join("");

  return `
    <div class="table-wrap" tabindex="0" aria-label="${definition.name} 测试结果，可横向滚动">
      <table class="matrix-table ${definition.id}-table">
        ${tableHeader(columns)}
        <tbody>${body}</tbody>
      </table>
    </div>`;
}

function renderWorkloadPanel(definition, selected) {
  const hasEmptyResults = workloadRows(definition.id).some(item => item.phase === "cold");
  const p99Legend = definition.id === "mixed"
    ? '<span><i class="legend-line p99-line"></i>Put P99</span><span><i class="legend-line range-p99-line"></i>Range P99</span>'
    : '<span><i class="legend-line p99-line"></i>P99 延迟</span>';
  return `
    <section class="workload-panel" id="${definition.id}-panel" role="tabpanel" aria-labelledby="${definition.id}-tab" ${selected ? "" : "hidden"}>
      <div class="workload-layout">
        <div class="workload-charts" aria-label="${definition.name} 性能趋势">
          <figure class="chart-figure">
            <figcaption class="figure-header">
              <div><h3>吞吐量与延迟趋势</h3><p>柱状图展示吞吐对比；折线展示已有 100,000 条数据的延迟（悬浮查看完整数据）</p></div>
              <div class="composite-legend" aria-label="图例">
                ${hasEmptyResults ? '<span><i class="legend-bar" style="--series-color:var(--qps-empty)"></i>空库 QPS</span>' : ""}
                <span><i class="legend-bar" style="--series-color:var(--qps-loaded)"></i>已有数据 QPS</span>
                <span><i class="legend-line average-line"></i>平均延迟</span>
                ${p99Legend}
              </div>
            </figcaption>
            <div class="plot-shell">
              <svg class="line-chart composite-chart" id="${definition.id}-chart" role="img" aria-label="${definition.name} QPS、平均延迟与 P99 延迟随并发客户端数变化"></svg>
              <div class="chart-tooltip" id="${definition.id}-tooltip" role="tooltip" hidden></div>
            </div>
          </figure>
        </div>
        <section class="workload-detail" aria-labelledby="${definition.id}-detail-title">
          <div class="detail-heading">
            <h3 id="${definition.id}-detail-title">详细数据</h3>
            ${definition.id === "mixed" ? "<p>70% Range / 30% Put</p>" : ""}
          </div>
          ${renderTable(definition)}
        </section>
      </div>
    </section>`;
}

function initializeWorkloads() {
  document.getElementById("workload-panels").innerHTML = workloads
    .map((definition, index) => renderWorkloadPanel(definition, index === 0))
    .join("");
}

function renderWorkloadCharts(definition) {
  const rows = baselineRows(definition.id);
  renderCompositeChart(
    document.getElementById(`${definition.id}-chart`),
    document.getElementById(`${definition.id}-tooltip`),
    rows,
    definition
  );
}

function initializeCharts() {
  workloads.forEach(renderWorkloadCharts);
  const observer = new ResizeObserver(() => {
    const activeId = document.querySelector('[role="tab"][aria-selected="true"]').dataset.workload;
    renderWorkloadCharts(workloads.find(item => item.id === activeId));
  });
  document.querySelectorAll(".workload-panel").forEach(panel => observer.observe(panel));
}

function initializeTabs() {
  const tabs = [...document.querySelectorAll('[role="tab"]')];

  function selectTab(tab) {
    tabs.forEach(item => {
      const selected = item === tab;
      item.setAttribute("aria-selected", String(selected));
      item.tabIndex = selected ? 0 : -1;
      document.getElementById(item.getAttribute("aria-controls")).hidden = !selected;
    });
    requestAnimationFrame(() => renderWorkloadCharts(workloads.find(item => item.id === tab.dataset.workload)));
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => selectTab(tab));
    tab.addEventListener("keydown", event => {
      let nextIndex = null;
      if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
      if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
      if (event.key === "Home") nextIndex = 0;
      if (event.key === "End") nextIndex = tabs.length - 1;
      if (nextIndex === null) return;
      event.preventDefault();
      tabs[nextIndex].focus();
      selectTab(tabs[nextIndex]);
    });
  });

  const requestedPanel = window.location.hash.slice(1);
  const requestedTab = tabs.find(tab => tab.getAttribute("aria-controls") === requestedPanel);
  if (requestedTab) selectTab(requestedTab);
}

document.addEventListener("DOMContentLoaded", () => {
  initializeWorkloads();
  initializeTabs();
  initializeCharts();
});
