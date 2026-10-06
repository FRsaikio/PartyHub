// Casino Night — hall du casino.
// Relie le portefeuille partagé (wallet.js), la mise, les onglets et les trois tables
// (slots.js, blackjack.js, dice.js). Le Poker reste une page à part (poker/).

import { db, doc, updateDoc, onSnapshot } from "../../../firebase.js";
import { resolveIsHost, lobbyWrite } from "../../../game-common.js";
import { createWallet, walletKeyFor, legacyWalletKeyFor, SHIELD_PRICE } from "./wallet.js";
import { sound, toast, formatChips } from "./ui.js";
import { initSlots } from "./slots.js";
import { initBlackjack } from "./blackjack.js";
import { initBjTable } from "./bj-table.js";
import { initDice } from "./dice.js";

const MIN_BET = 50;
const BET_STEPS = [50, 100, 250, 500, 1000];
const LOAN = 500;

// ---------- Qui joue, dans quelle room ----------

const params = new URLSearchParams(window.location.search);
// La copie de l'onglet (sessionStorage) passe avant celle du navigateur (localStorage) :
// avec deux onglets ouverts, chacun garde son propre joueur.
const savedData = (() => {
  for (const store of [sessionStorage, localStorage]) {
    try {
      const data = JSON.parse(store.getItem("partyhubGameData") || "null");
      if (data) return data;
    } catch { /* stockage indisponible */ }
  }
  return {};
})();

const roomCode = params.get("room") || params.get("code") || savedData.roomCode || "";
const spectator = params.get("spectator") === "1";
const myName = savedData.currentPlayer || savedData.playerName || savedData.currentProfileName || "Joueur";
const me = {
  name: myName,
  key: walletKeyFor(savedData.currentProfileId, myName),
  legacyKey: legacyWalletKeyFor(savedData.currentProfileId)
};
const isHost = resolveIsHost(savedData);

// ---------- Éléments ----------

const chipsEl = document.getElementById("walletChips");
const shieldsEl = document.getElementById("walletShields");
const betValueEl = document.getElementById("betValue");
const betStepsEl = document.getElementById("betSteps");
const allInBtn = document.getElementById("allInBtn");
const shieldBtn = document.getElementById("buyShieldBtn");
const ruinBanner = document.getElementById("ruinBanner");
const loanBtn = document.getElementById("loanBtn");
const leaderboardEl = document.getElementById("leaderboard");
const roomBadge = document.getElementById("roomBadge");
const syncHint = document.getElementById("syncHint");

roomBadge.textContent = roomCode ? `Room ${roomCode}` : "Hors room";

// ---------- Portefeuille partagé ----------

let blackjackApi = null;
let bjTableApi = null;
let displayedChips = null;

const wallet = createWallet({
  roomCode,
  me,
  spectator,
  onChange: ({ mine, leaderboard }) => {
    renderWallet(mine);
    renderLeaderboard(leaderboard);
    blackjackApi?.refresh();
    bjTableApi?.refresh();
  },
  onEvent: event => {
    sound.chip();
    toast(`${event.name} ${event.text}`, event.tone === "pink" ? "pink" : "gold");
  }
});

syncHint.textContent = wallet.online
  ? "Jetons partagés avec la room"
  : "Hors room : jetons gardés sur ce téléphone";

function renderWallet(mine) {
  // petit effet quand le solde change
  if (displayedChips !== null && mine.chips !== displayedChips) {
    chipsEl.classList.remove("bump-up", "bump-down");
    void chipsEl.offsetWidth;
    chipsEl.classList.add(mine.chips > displayedChips ? "bump-up" : "bump-down");
  }
  displayedChips = mine.chips;
  chipsEl.textContent = formatChips(mine.chips);
  shieldsEl.textContent = mine.shields;
  shieldBtn.disabled = mine.chips < SHIELD_PRICE;
  ruinBanner.hidden = mine.chips >= MIN_BET;
  renderBet();
}

function renderLeaderboard(rows) {
  leaderboardEl.replaceChildren(...rows.map((row, index) => {
    const li = document.createElement("li");
    if (row.isMe) li.classList.add("me");
    if (index === 0 && row.chips > 0) li.classList.add("leader");

    const rank = document.createElement("span");
    rank.className = "lb-rank";
    rank.textContent = index === 0 && row.chips > 0 ? "👑" : `${index + 1}`;

    const name = document.createElement("span");
    name.className = "lb-name";
    name.textContent = row.isMe ? `${row.name} (toi)` : row.name;

    const chips = document.createElement("span");
    chips.className = "lb-chips";
    chips.textContent = `${formatChips(row.chips)}${row.shields ? `  🛡️${row.shields}` : ""}`;

    li.append(rank, name, chips);
    return li;
  }));
}

// ---------- Mise ----------

let bet = (() => {
  const saved = Number(localStorage.getItem("partyhubCasinoBet"));
  return BET_STEPS.includes(saved) ? saved : 100;
})();
let allInArmed = false;

function renderBet() {
  bjTableApi?.refresh(); // le bouton « Miser » de la table affiche la mise choisie
  const chips = wallet.chips;
  betValueEl.textContent = allInArmed ? `ALL IN · ${formatChips(chips)}` : formatChips(bet);
  betStepsEl.querySelectorAll("button").forEach(btn => {
    const step = Number(btn.dataset.step);
    btn.classList.toggle("selected", !allInArmed && step === bet);
    btn.disabled = step > chips;
  });
  allInBtn.classList.toggle("armed", allInArmed);
  allInBtn.setAttribute("aria-pressed", String(allInArmed));
  allInBtn.disabled = chips < MIN_BET;
}

betStepsEl.replaceChildren(...BET_STEPS.map(step => {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "bet-chip";
  btn.dataset.step = step;
  btn.textContent = formatChips(step);
  btn.addEventListener("click", () => {
    bet = step;
    allInArmed = false;
    try { localStorage.setItem("partyhubCasinoBet", String(step)); } catch { /* ignoré */ }
    sound.chip();
    renderBet();
  });
  return btn;
}));

allInBtn.addEventListener("click", () => {
  allInArmed = !allInArmed;
  sound.click();
  if (allInArmed) toast("🔥 ALL IN armé : toute ta fortune sur la prochaine partie. Gain doublé si tu gagnes.", "pink");
  renderBet();
});

shieldBtn.addEventListener("click", () => {
  if (wallet.buyShield()) {
    sound.chip();
    toast(`🛡️ Protection achetée (-${SHIELD_PRICE}). Elle peut annuler une sanction.`, "info");
  }
});

loanBtn.addEventListener("click", () => {
  wallet.add(LOAN);
  sound.chip();
  toast(`🏦 Le casino te prête ${LOAN} jetons… contre un cul sec !`, "pink");
  wallet.announce(`a emprunté ${LOAN} jetons au casino (cul sec obligatoire) !`, "pink");
});

// ---------- Contexte partagé avec les tables ----------

const ctx = {
  wallet,
  toast,

  // Prélève la mise. Renvoie { amount, allIn } ou null si impossible.
  placeBet() {
    if (spectator) return null;
    const chips = wallet.chips;
    const allIn = allInArmed;
    const amount = allIn ? chips : bet;

    if (chips < MIN_BET) {
      toast("💀 Tu es à sec : emprunte au casino pour continuer.", "lose");
      return null;
    }
    if (amount > chips) {
      toast(`Pas assez de jetons pour miser ${formatChips(amount)}.`, "lose");
      return null;
    }

    allInArmed = false;
    wallet.add(-amount);
    sound.chip();
    renderBet();
    return { amount, allIn };
  },

  // Pour la table multijoueur : la mise choisie, SANS la prélever (la transaction de la
  // table s'en charge). null si impossible.
  peekBet() {
    if (spectator) return null;
    const chips = wallet.chips;
    const amount = allInArmed ? chips : bet;
    if (chips < MIN_BET || amount > chips) return null;
    return { amount, allIn: allInArmed };
  },

  // La mise a été posée à la table : on désarme ALL IN.
  betUsed() {
    allInArmed = false;
    sound.chip();
    renderBet();
  },

  // Boutons proposés après une sanction : utiliser une protection ou assumer.
  sanctionChoices() {
    if (wallet.shields <= 0) return [];
    return [
      {
        label: "🛡️ Utiliser une protection",
        variant: "primary",
        onClick: () => {
          if (wallet.useShield()) toast("🛡️ Protection utilisée : sanction annulée (la mise reste perdue).", "info");
        }
      },
      { label: "J'assume la sanction", variant: "secondary" }
    ];
  }
};

// ---------- Onglets des tables ----------

const tabs = [...document.querySelectorAll(".casino-tab")];
const panels = [...document.querySelectorAll(".casino-panel")];

function openTab(name) {
  tabs.forEach(tab => {
    const active = tab.dataset.tab === name;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  panels.forEach(panel => { panel.hidden = panel.dataset.panel !== name; });
  try { localStorage.setItem("partyhubCasinoTab", name); } catch { /* ignoré */ }
}

tabs.forEach(tab => tab.addEventListener("click", () => { sound.click(); openTab(tab.dataset.tab); }));

openTab((() => {
  try {
    const saved = localStorage.getItem("partyhubCasinoTab");
    return tabs.some(t => t.dataset.tab === saved) ? saved : "slots";
  } catch { return "slots"; }
})());

// Lien Poker : garde la room
const pokerLink = document.getElementById("pokerNightBtn");
if (pokerLink && roomCode) pokerLink.href = `poker/index.html?room=${encodeURIComponent(roomCode)}&v=3`;

// ---------- Retour au lobby (même logique que les autres jeux) ----------

const backBtn = document.getElementById("backToLobbyBtn");

function goToLobby() {
  localStorage.setItem("partyhubReturnLobby", "true");
  window.location.href = roomCode ? `../../index.html?room=${encodeURIComponent(roomCode)}` : "../../index.html";
}

backBtn.addEventListener("click", async () => {
  if (isHost && roomCode) {
    try {
      await lobbyWrite(updateDoc(doc(db, "rooms", roomCode), {
        gameStarted: false,
        roomStatus: "lobby",
        screen: "lobby",
        activeGame: null,
        gameState: {},
        forceNavigation: { target: "lobby", at: Date.now() }
      }));
    } catch (error) {
      console.error("Erreur retour lobby global :", error);
    }
  }
  goToLobby();
});

if (roomCode && !spectator) {
  onSnapshot(doc(db, "rooms", roomCode), snapshot => {
    if (snapshot.exists() && snapshot.data().gameStarted === false) goToLobby();
  });
}

// ---------- C'est parti ----------

// Blackjack : table partagée de la room ou partie solo.
const bjModeButtons = [...document.querySelectorAll(".bj-mode-btn")];

function setBjMode(mode) {
  bjModeButtons.forEach(btn => {
    const active = btn.dataset.mode === mode;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", String(active));
  });
  document.getElementById("bjTableMode").hidden = mode !== "table";
  document.getElementById("bjSoloMode").hidden = mode !== "solo";
  try { localStorage.setItem("partyhubBjMode", mode); } catch { /* ignoré */ }
}

bjModeButtons.forEach(btn => btn.addEventListener("click", () => { sound.click(); setBjMode(btn.dataset.mode); }));
setBjMode((() => {
  if (!wallet.online) return "solo";
  try { return localStorage.getItem("partyhubBjMode") === "solo" ? "solo" : "table"; } catch { return "table"; }
})());

initSlots(ctx);
blackjackApi = initBlackjack(ctx);
bjTableApi = initBjTable(ctx, { roomCode: wallet.online && !spectator ? roomCode : "", me, isHost });
initDice(ctx);
wallet.start();
renderBet();
