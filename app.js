const STORAGE_KEY = "no-complaint-band-state-v1";
const DEFAULT_STATE = {
  startTime: Date.now(),
  currentHand: "right",
  history: [],
};

const state = loadState();
let dragOffset = { x: 0, y: 0 };

const els = {
  days: document.querySelector("#days"),
  hours: document.querySelector("#hours"),
  minutes: document.querySelector("#minutes"),
  seconds: document.querySelector("#seconds"),
  startLine: document.querySelector("#startLine"),
  currentStat: document.querySelector("#currentStat"),
  bestStat: document.querySelector("#bestStat"),
  switchStat: document.querySelector("#switchStat"),
  avgStat: document.querySelector("#avgStat"),
  totalStat: document.querySelector("#totalStat"),
  historyList: document.querySelector("#historyList"),
  handsSection: document.querySelector(".hands-section"),
  bracelet: document.querySelector("#bracelet"),
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || !Number.isFinite(saved.startTime)) return { ...DEFAULT_STATE };
    return {
      startTime: saved.startTime,
      currentHand: saved.currentHand === "left" ? "left" : "right",
      history: Array.isArray(saved.history) ? saved.history : [],
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function durationParts(totalSeconds) {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds };
}

function formatDuration(totalSeconds, compact = false) {
  const { days, hours, minutes, seconds } = durationParts(Math.max(0, totalSeconds));
  if (days > 0) return compact ? `${pad(days)}天${pad(hours)}小时` : `${days}天${hours}小时${minutes}分`;
  if (hours > 0) return compact ? `${pad(hours)}小时${pad(minutes)}分` : `${hours}小时${minutes}分${seconds}秒`;
  if (minutes > 0) return compact ? `${pad(minutes)}分钟` : `${minutes}分${seconds}秒`;
  return `${pad(seconds)}秒`;
}

function formatDate(timestamp) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(timestamp)
    .replaceAll("/", "-");
}

function currentSeconds() {
  return Math.max(0, Math.floor((Date.now() - state.startTime) / 1000));
}

function renderTimer() {
  const parts = durationParts(currentSeconds());
  els.days.textContent = pad(parts.days);
  els.hours.textContent = pad(parts.hours);
  els.minutes.textContent = pad(parts.minutes);
  els.seconds.textContent = pad(parts.seconds);
  els.currentStat.textContent = formatDuration(currentSeconds(), true);
}

function renderStats() {
  const durations = state.history.map((item) => item.duration);
  const best = Math.max(currentSeconds(), ...durations, 0);
  const total = durations.reduce((sum, value) => sum + value, 0);
  const avg = durations.length ? Math.round(total / durations.length) : 0;

  els.bestStat.textContent = formatDuration(best, true);
  els.switchStat.textContent = `${pad(state.history.length)}次`;
  els.avgStat.textContent = formatDuration(avg, true);
  els.totalStat.textContent = `累计 ${formatDuration(total, true)}`;
  els.startLine.textContent = `从 ${formatDate(state.startTime)} 开始`;
}

function renderHands() {
  document.querySelectorAll(".hand-slot").forEach((slot) => {
    slot.classList.toggle("active", slot.dataset.hand === state.currentHand);
    slot.classList.remove("drop-target");
  });

  const x = state.currentHand === "left" ? "23%" : "77%";
  els.bracelet.style.setProperty("--bracelet-x", x);
  els.bracelet.style.left = `var(--bracelet-x)`;
  els.bracelet.style.top = "180px";
}

function renderHistory() {
  const records = state.history.slice(0, 5);
  if (!records.length) {
    els.historyList.innerHTML = `<div class="empty-state">第一次换手后，这里会记录你的觉察时刻。</div>`;
    return;
  }

  els.historyList.innerHTML = records
    .map(
      (item) => `
        <article class="history-item">
          <div class="history-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m6 12 4 4 8-9" />
            </svg>
          </div>
          <div>
            <time datetime="${new Date(item.endTime).toISOString()}">${formatDate(item.endTime)}</time>
            <p>${item.fromHand === "left" ? "从左手切换到右手" : "从右手切换到左手"}</p>
          </div>
          <strong class="history-duration">${formatDuration(item.duration, false)}</strong>
        </article>
      `
    )
    .join("");
}

function renderAll() {
  renderTimer();
  renderStats();
  renderHands();
  renderHistory();
}

function getHandFromPoint(clientX, clientY) {
  const stack = document.elementsFromPoint(clientX, clientY);
  const slot = stack.map((element) => element.closest?.(".hand-slot")).find(Boolean);
  return slot?.dataset.hand || null;
}

function setBraceletPosition(clientX, clientY) {
  const bounds = els.handsSection.getBoundingClientRect();
  const x = clientX - bounds.left - dragOffset.x;
  const y = clientY - bounds.top - dragOffset.y;
  els.bracelet.style.left = `${Math.max(44, Math.min(bounds.width - 44, x))}px`;
  els.bracelet.style.top = `${Math.max(86, Math.min(bounds.height - 56, y))}px`;
}

function markDropTarget(hand) {
  document.querySelectorAll(".hand-slot").forEach((slot) => {
    slot.classList.toggle("drop-target", hand && slot.dataset.hand === hand && hand !== state.currentHand);
  });
}

function switchHand(nextHand) {
  if (!nextHand || nextHand === state.currentHand) {
    renderHands();
    return;
  }

  const endTime = Date.now();
  state.history.unshift({
    id: crypto.randomUUID ? crypto.randomUUID() : String(endTime),
    startTime: state.startTime,
    endTime,
    duration: Math.max(0, Math.floor((endTime - state.startTime) / 1000)),
    fromHand: state.currentHand,
    toHand: nextHand,
  });
  state.currentHand = nextHand;
  state.startTime = endTime;
  saveState();
  renderAll();
}

els.bracelet.addEventListener("pointerdown", (event) => {
  els.bracelet.setPointerCapture(event.pointerId);
  const braceletRect = els.bracelet.getBoundingClientRect();
  dragOffset = {
    x: event.clientX - braceletRect.left - braceletRect.width / 2,
    y: event.clientY - braceletRect.top,
  };
  els.bracelet.classList.add("dragging");
  setBraceletPosition(event.clientX, event.clientY);
});

els.bracelet.addEventListener("pointermove", (event) => {
  if (!els.bracelet.classList.contains("dragging")) return;
  setBraceletPosition(event.clientX, event.clientY);
  markDropTarget(getHandFromPoint(event.clientX, event.clientY));
});

els.bracelet.addEventListener("pointerup", (event) => {
  els.bracelet.releasePointerCapture(event.pointerId);
  els.bracelet.classList.remove("dragging");
  const targetHand = getHandFromPoint(event.clientX, event.clientY);
  markDropTarget(null);

  if (targetHand && targetHand !== state.currentHand) {
    switchHand(targetHand);
  } else {
    renderHands();
  }
});

els.bracelet.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  switchHand(state.currentHand === "left" ? "right" : "left");
});

renderAll();
setInterval(() => {
  renderTimer();
  renderStats();
}, 1000);
