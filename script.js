let rawBattles = [];
let playerProfile = {};
let charts = {};

document.addEventListener("DOMContentLoaded", () => {
  Promise.all([
    fetch("player.json?t=" + Date.now()).then((r) => r.json()),
    fetch("battlelog_master.json?t=" + Date.now()).then((r) => r.json()),
  ])
    .then(([playerData, battleData]) => {
      playerProfile = playerData;
      rawBattles = battleData;

      // Header Info
      document.getElementById("player-name").innerText =
        playerProfile.name || "Unknown";
      document.getElementById("player-level").innerText =
        playerProfile.expLevel || "0";
      document.getElementById("clan-name").innerText = playerProfile.clan
        ? playerProfile.clan.name
        : "No Clan";

      // Season Card
      document.getElementById("current-trophies").innerText =
        playerProfile.trophies || 0;
      document.getElementById("best-trophies").innerText =
        playerProfile.bestTrophies || 0;
      document.getElementById("total-wins").innerText = playerProfile.wins || 0;

      if (playerProfile.currentFavouriteCard) {
        document.getElementById("fav-card").src =
          playerProfile.currentFavouriteCard.iconUrls.medium;
      }

      // Timestamp
      if (rawBattles.length > 0) {
        const latestDate = parseClashDate(rawBattles[0].battleTime);
        if (latestDate) {
          const istTime = latestDate.toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          });
          document.getElementById("last-updated").innerText = istTime;
        }
      }
      updateDashboard();
    })
    .catch((e) => console.error("Data Error:", e));

  document
    .getElementById("modeFilter")
    .addEventListener("change", updateDashboard);
});

function parseClashDate(str) {
  if (!str) return null;
  const formatted = str.replace(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})\.(\d{3})Z$/,
    "$1-$2-$3T$4:$5:$6.$7Z"
  );
  return new Date(formatted);
}

function updateDashboard() {
  const filterMode = document.getElementById("modeFilter").value;
  const battles = rawBattles.filter((b) => {
    if (filterMode === "PvP_Ladder")
      return b.type === "PvP" && b.gameMode.name === "Ladder";
    if (filterMode === "PvP_All") return b.type === "PvP";
    return true;
  });

  const stats = calculateStats(battles);

  renderWinChart(stats.wins, stats.losses, stats.draws);
  renderForm(battles.slice(0, 30).reverse());
  renderTrophyChart(battles.slice(0, 50).reverse());
  renderHourlyChart(stats.hourlyCounts); // RESTORED
  renderNemesisList(stats.nemesisMap);
  renderHistory(battles.slice(0, 20));
}

function calculateStats(battles) {
  let s = {
    wins: 0,
    losses: 0,
    draws: 0,
    nemesisMap: {},
    hourlyCounts: new Array(24).fill(0),
  };

  // IST Formatter
  const istHourFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    hour12: false,
  });

  battles.forEach((b) => {
    const tChange = b.team[0].trophyChange || 0;

    // Win/Loss
    if (tChange > 0) s.wins++;
    else if (tChange < 0) {
      s.losses++;
      b.opponent[0].cards.forEach((c) => {
        if (!s.nemesisMap[c.name])
          s.nemesisMap[c.name] = { count: 0, img: c.iconUrls.medium };
        s.nemesisMap[c.name].count++;
      });
    } else s.draws++;

    // Hourly Activity
    const dateObj = parseClashDate(b.battleTime);
    if (dateObj) {
      try {
        let hour = parseInt(istHourFormatter.format(dateObj));
        if (hour === 24) hour = 0;
        if (!isNaN(hour)) s.hourlyCounts[hour]++;
      } catch (e) {}
    }
  });
  return s;
}

// --- RENDERERS ---

function renderWinChart(w, l, d) {
  destroyChart("winRateChart");
  const ctx = document.getElementById("winRateChart").getContext("2d");
  const total = w + l + d;
  const pct = total ? Math.round((w / total) * 100) : 0;
  document.getElementById("win-pct").innerText = pct + "%";

  charts["winRateChart"] = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Wins", "Losses", "Draws"],
      datasets: [
        {
          data: [w, l, d],
          backgroundColor: ["#00d26a", "#f94144", "#577590"],
          borderWidth: 0,
          cutout: "75%",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
    },
  });
}

function renderHourlyChart(hourlyData) {
  destroyChart("hourChart");
  const ctx = document.getElementById("hourChart").getContext("2d");

  // Gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, 200);
  gradient.addColorStop(0, "rgba(255, 193, 7, 0.4)");
  gradient.addColorStop(1, "rgba(255, 193, 7, 0)");

  charts["hourChart"] = new Chart(ctx, {
    type: "bar",
    data: {
      labels: [...Array(24).keys()].map((h) => `${h}:00`),
      datasets: [
        {
          label: "Games Played",
          data: hourlyData,
          backgroundColor: "#ffc107",
          borderRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { grid: { color: "#333" }, ticks: { stepSize: 1 } },
        x: { grid: { display: false } },
      },
      plugins: { legend: { display: false } },
    },
  });
}

function renderTrophyChart(battles) {
  destroyChart("trophyChart");
  const ctx = document.getElementById("trophyChart").getContext("2d");

  // We add trophyChange to startTrophies to get "Ending Trophies"
  const dataPoints = battles.map(
    (b) => (b.team[0].startingTrophies || 0) + (b.team[0].trophyChange || 0)
  );
  const labels = battles.map((_, i) => i + 1);

  charts["trophyChart"] = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Trophies",
          data: dataPoints,
          borderColor: "#ffc107",
          backgroundColor: "rgba(255, 193, 7, 0.05)",
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: "#fff",
          fill: true,
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { grid: { color: "#333" }, ticks: { color: "#888" } },
        x: { display: false },
      },
      plugins: { legend: { display: false } },
    },
  });
}

function renderNemesisList(map) {
  const list = document.getElementById("nemesis-list");
  list.innerHTML = "";
  const sorted = Object.entries(map)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10);
  sorted.forEach(([name, data], i) => {
    const div = document.createElement("div");
    div.className = "nemesis-item";
    div.innerHTML = `<span class="nemesis-rank">#${i + 1}</span><img src="${
      data.img
    }" class="nemesis-img"><span class="nemesis-name">${name}</span><span class="nemesis-count">${
      data.count
    } L</span>`;
    list.appendChild(div);
  });
}

function renderForm(battles) {
  const bar = document.getElementById("form-bar");
  bar.innerHTML = "";
  let net = 0;
  let streak = 0;
  battles.forEach((b) => {
    const ch = b.team[0].trophyChange || 0;
    net += ch;
    if (ch > 0) streak = streak >= 0 ? streak + 1 : 1;
    else if (ch < 0) streak = streak <= 0 ? streak - 1 : -1;
    const el = document.createElement("div");
    el.className = "form-segment";
    el.style.backgroundColor =
      ch > 0 ? "#00d26a" : ch < 0 ? "#f94144" : "#577590";
    bar.appendChild(el);
  });
  document.getElementById("current-streak").innerText =
    (streak > 0 ? "+" : "") + streak;
  document.getElementById("current-streak").style.color =
    streak > 0 ? "#00d26a" : "#f94144";
  document.getElementById("net-trophies").innerText =
    (net > 0 ? "+" : "") + net;
  document.getElementById("net-trophies").style.color =
    net >= 0 ? "#00d26a" : "#f94144";
}

function renderHistory(battles) {
  const list = document.getElementById("match-list");
  list.innerHTML = "";
  battles.forEach((b) => {
    const me = b.team[0];
    const change = me.trophyChange || 0;
    const isWin = change > 0;
    const oppDeckHtml = b.opponent[0].cards
      .slice(0, 8)
      .map((c) => `<img src="${c.iconUrls.medium}">`)
      .join("");
    const dateObj = parseClashDate(b.battleTime);
    const timeStr = dateObj
      ? dateObj.toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit" })
      : "--:--";

    const row = document.createElement("div");
    row.className = `match-row ${isWin ? "win" : "loss"}`;
    row.innerHTML = `<div><div class="res-box ${isWin ? "win" : "loss"}">${
      change > 0 ? "+" : ""
    }${change}</div><span class="vs-name">vs ${
      b.opponent[0].name
    }</span></div><div class="deck-strip">${oppDeckHtml}</div><div style="text-align:right; color:#666; font-size:0.85rem;">${timeStr}</div>`;
    list.appendChild(row);
  });
}

function destroyChart(id) {
  if (charts[id]) charts[id].destroy();
}
