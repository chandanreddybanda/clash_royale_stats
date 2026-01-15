document.addEventListener("DOMContentLoaded", () => {
  fetch("battlelog_master.json?t=" + Date.now())
    .then((res) => res.json())
    .then((data) => initDashboard(data))
    .catch((e) => console.error(e));
});

function initDashboard(battles) {
  // 1. Filter Data
  const validBattles = battles.filter(
    (b) => b.type === "PvP" && b.gameMode.name === "Ladder"
  );
  const recent30 = [...validBattles]
    .sort((a, b) => a.battleTime.localeCompare(b.battleTime))
    .slice(-30); // Oldest to Newest

  // 2. Calculate Stats
  let stats = {
    wins: 0,
    losses: 0,
    draws: 0,
    totalTrophies: 0,
    myLeakTotal: 0,
    oppLeakTotal: 0,
    hourlyCounts: new Array(24).fill(0),
    nemesisMap: {},
    currentStreak: 0,
  };

  validBattles.forEach((b) => {
    const me = b.team[0];
    const opp = b.opponent[0];
    const tChange = me.trophyChange || 0;

    // Win/Loss
    if (tChange > 0) stats.wins++;
    else if (tChange < 0) stats.losses++;
    else stats.draws++;

    // Hourly Activity [Cite: 4.4]
    // battleTime format: "20260115T171439.000Z"
    try {
      const hour = parseInt(b.battleTime.split("T")[1].substring(0, 2));
      stats.hourlyCounts[hour]++;
    } catch (e) {}

    // Elixir Leaked (If available in JSON)
    if (me.elixirLeaked) stats.myLeakTotal += me.elixirLeaked;
    if (opp.elixirLeaked) stats.oppLeakTotal += opp.elixirLeaked;

    // Nemesis Logic (Only on losses)
    if (tChange < 0) {
      opp.cards.forEach((card) => {
        if (!stats.nemesisMap[card.name]) {
          stats.nemesisMap[card.name] = { count: 0, img: card.iconUrls.medium };
        }
        stats.nemesisMap[card.name].count++;
      });
    }
  });

  // Streak Logic (on recent 30)
  let currentStreak = 0;
  for (let i = recent30.length - 1; i >= 0; i--) {
    const change = recent30[i].team[0].trophyChange || 0;
    if (change > 0) {
      if (currentStreak >= 0) currentStreak++;
      else break;
    } else if (change < 0) {
      if (currentStreak <= 0) currentStreak--;
      else break;
    }
  }

  // 3. Render Components
  renderWinChart(stats, validBattles.length);
  renderFormBar(recent30);
  renderElixir(stats, validBattles.length);
  renderHourlyChart(stats.hourlyCounts);
  renderNemesis(stats.nemesisMap);
  renderHistory(validBattles.slice(0, 15)); // Show last 15 in list

  // KPI Text
  document.getElementById("current-streak").innerText =
    currentStreak > 0 ? `+${currentStreak} W` : `${currentStreak} L`;
  document.getElementById("current-streak").style.color =
    currentStreak > 0 ? "#00d26a" : "#f94144";
}

// --- RENDER FUNCTIONS ---

function renderWinChart(stats, total) {
  const ctx = document.getElementById("winRateChart").getContext("2d");
  const winPct = Math.round((stats.wins / total) * 100);
  document.getElementById("win-pct").innerText = `${winPct}%`;

  new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Wins", "Losses", "Draws"],
      datasets: [
        {
          data: [stats.wins, stats.losses, stats.draws],
          backgroundColor: ["#00d26a", "#f94144", "#577590"],
          borderWidth: 0,
          cutout: "70%",
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

function renderFormBar(battles) {
  const container = document.getElementById("form-bar");
  let netTrophies = 0;

  battles.forEach((b) => {
    const change = b.team[0].trophyChange || 0;
    netTrophies += change;

    const el = document.createElement("div");
    el.className = "form-segment";
    el.style.backgroundColor =
      change > 0 ? "#00d26a" : change < 0 ? "#f94144" : "#577590";
    el.title = `${change > 0 ? "Win" : "Loss"} (${change} 🏆)`;
    container.appendChild(el);
  });

  const netEl = document.getElementById("net-trophies");
  netEl.innerText = (netTrophies > 0 ? "+" : "") + netTrophies;
  netEl.style.color = netTrophies >= 0 ? "#00d26a" : "#f94144";
}

function renderElixir(stats, total) {
  // Prevent divide by zero if total is 0
  if (total < 1) return;

  document.getElementById("my-leak").innerText = (
    stats.myLeakTotal / total
  ).toFixed(2);
  document.getElementById("opp-leak").innerText = (
    stats.oppLeakTotal / total
  ).toFixed(2);
}

function renderHourlyChart(hourlyData) {
  const ctx = document.getElementById("hourChart").getContext("2d");
  // Simple gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, 200);
  gradient.addColorStop(0, "rgba(255, 193, 7, 0.5)");
  gradient.addColorStop(1, "rgba(255, 193, 7, 0)");

  new Chart(ctx, {
    type: "line",
    data: {
      labels: [...Array(24).keys()].map((h) => `${h}:00`),
      datasets: [
        {
          label: "Games Played",
          data: hourlyData,
          borderColor: "#ffc107",
          backgroundColor: gradient,
          fill: true,
          tension: 0.4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { grid: { color: "#333" } },
        x: { grid: { display: false } },
      },
      plugins: { legend: { display: false } },
    },
  });
}

function renderNemesis(map) {
  const container = document.getElementById("nemesis-grid");
  const sorted = Object.entries(map)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8);

  sorted.forEach(([name, data]) => {
    const div = document.createElement("div");
    div.className = "nemesis-card";
    div.innerHTML = `
            <img src="${data.img}" alt="${name}">
            <span class="nemesis-count">${data.count} L</span>
        `;
    container.appendChild(div);
  });
}

function renderHistory(battles) {
  const container = document.getElementById("match-list");

  battles.forEach((b) => {
    const me = b.team[0];
    const opp = b.opponent[0];
    const isWin = (me.trophyChange || 0) > 0;

    // Get first 4 cards of opponent for "Deck Preview"
    const oppCardsHtml = opp.cards
      .slice(0, 5)
      .map((c) => `<img src="${c.iconUrls.medium}">`)
      .join("");

    const div = document.createElement("div");
    div.className = `match-item ${isWin ? "win" : "loss"}`;
    div.innerHTML = `
            <div>
                <div style="font-weight:bold; font-size:1.1rem;">vs ${
                  opp.name
                }</div>
                <div style="color:#888; font-size:0.8rem;">${new Date(
                  b.battleTime
                ).toLocaleDateString()}</div>
            </div>
            <div class="opp-deck">${oppCardsHtml}</div>
            <div style="font-weight:800; font-size:1.2rem; color:${
              isWin ? "#00d26a" : "#f94144"
            }">
                ${me.trophyChange > 0 ? "+" : ""}${me.trophyChange}
            </div>
        `;
    container.appendChild(div);
  });
}
