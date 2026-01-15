document.addEventListener("DOMContentLoaded", () => {
  fetch("battlelog_master.json")
    .then((response) => {
      if (!response.ok) throw new Error("JSON not found");
      return response.json();
    })
    .then((data) => processData(data))
    .catch((err) => console.error("Error loading data:", err));
});

function processData(battles) {
  let totalGames = 0;
  let wins = 0;
  let losses = 0;
  let opponentCardLosses = {};
  const historyList = document.getElementById("matchHistory");

  // We only want the last 10 matches for the list
  const recentBattles = battles.slice(0, 10);

  battles.forEach((battle) => {
    // Filter: PvP and Ladder only
    if (battle.type !== "PvP" || battle.gameMode.name !== "Ladder") return;

    const myTeam = battle.team[0];
    const opponent = battle.opponent[0];
    const trophyChange = myTeam.trophyChange || 0;

    totalGames++;

    // Determine Win/Loss
    let result = "Draw";
    if (trophyChange > 0) {
      wins++;
      result = "Win";
    } else if (trophyChange < 0) {
      losses++;
      result = "Loss";

      // Logic: Count opponent cards that caused this loss
      opponent.cards.forEach((card) => {
        if (card.name) {
          opponentCardLosses[card.name] =
            (opponentCardLosses[card.name] || 0) + 1;
        }
      });
    }
  });

  // 1. Render Win Rate Chart
  renderPieChart(wins, losses, totalGames - wins - losses);

  // 2. Render Nemesis Chart (Top 10)
  const sortedNemesis = Object.entries(opponentCardLosses)
    .sort((a, b) => b[1] - a[1]) // Sort desc by count
    .slice(0, 10); // Top 10

  renderBarChart(sortedNemesis);

  // 3. Populate Recent Matches List
  recentBattles.forEach((battle) => {
    if (battle.type !== "PvP") return;

    const myTeam = battle.team[0];
    const opponent = battle.opponent[0];
    const isWin = (myTeam.trophyChange || 0) > 0;
    const className = isWin ? "win" : "loss";
    const sign = isWin ? "+" : "";

    const li = document.createElement("li");
    li.className = `match-item ${className}`;
    li.innerHTML = `
            <span><strong>vs ${opponent.name}</strong></span>
            <span>${sign}${myTeam.trophyChange || 0} 🏆</span>
        `;
    historyList.appendChild(li);
  });
}

function renderPieChart(wins, losses, draws) {
  const ctx = document.getElementById("winRateChart").getContext("2d");
  new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Wins", "Losses", "Draws"],
      datasets: [
        {
          data: [wins, losses, draws],
          backgroundColor: ["#4caf50", "#f44336", "#9e9e9e"],
          borderWidth: 0,
        },
      ],
    },
    options: { responsive: true, maintainAspectRatio: false },
  });
}

function renderBarChart(dataEntries) {
  const labels = dataEntries.map((e) => e[0]);
  const values = dataEntries.map((e) => e[1]);
  const ctx = document.getElementById("nemesisChart").getContext("2d");

  new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Losses Against",
          data: values,
          backgroundColor: "#ffcc00",
          borderRadius: 5,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, grid: { color: "#444" } },
        x: { grid: { display: false } },
      },
      plugins: { legend: { display: false } },
    },
  });
}
