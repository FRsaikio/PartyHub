// Poker Night — salle de poker du casino.
// Même joueur et mêmes jetons que le hall (wallet.js) : on prend une cave en s'asseyant,
// on récupère son tapis en se levant. La table elle-même est gérée par poker-table.js.

import { db, doc, onSnapshot } from "../../../../firebase.js";
import { resolveIsHost, watchHost } from "../../../../game-common.js";
import { createWallet, walletKeyFor, legacyWalletKeyFor } from "../../js/wallet.js";
import { sound, toast, formatChips } from "../../js/ui.js";
import { createPokerRoom } from "./poker-table.js?v=4";

const params = new URLSearchParams(window.location.search);
// La copie de l'onglet (sessionStorage) passe avant celle du navigateur (localStorage).
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
const spectator = params.get("spectator") === "1" || params.get("tv") === "1";
const online = Boolean(roomCode) && roomCode !== "----";
const myName = savedData.currentPlayer || savedData.playerName || savedData.currentProfileName || "Joueur";
const me = {
  name: myName,
  key: walletKeyFor(savedData.currentProfileId, myName),
  legacyKey: legacyWalletKeyFor(savedData.currentProfileId)
};
let isHost = resolveIsHost(savedData);

if (params.get("embed") === "1") document.body.classList.add("pk-embed");
if (spectator) document.body.classList.add("pk-spectator");

document.getElementById("roomBadge").textContent = online ? `Room ${roomCode}` : "Hors room";

const casinoUrl = online ? `../index.html?room=${encodeURIComponent(roomCode)}` : "../index.html";
document.getElementById("backCasinoBtn").addEventListener("click", () => { window.location.href = casinoUrl; });

// ---------- Hors room : le poker a besoin des autres joueurs ----------

if (!online) {
  document.getElementById("pkOffline").hidden = false;
  document.getElementById("pkRoom").hidden = true;
} else {
  start();
}

function start() {
  const chipsEl = document.getElementById("walletChips");
  let players = [];
  let api = null;

  const wallet = createWallet({
    roomCode,
    me,
    spectator,
    onChange: ({ mine }) => {
      chipsEl.textContent = formatChips(mine.chips);
      api?.refresh();
    },
    onEvent: event => {
      sound.chip();
      toast(`${event.name} ${event.text}`, event.tone === "pink" ? "pink" : "gold");
    }
  });

  const ctx = {
    wallet,
    toast,
    sanctionChoices() {
      if (wallet.shields <= 0) return [];
      return [
        {
          label: "🛡️ Utiliser une protection",
          variant: "primary",
          onClick: () => { if (wallet.useShield()) toast("🛡️ Protection utilisée : sanction annulée.", "info"); }
        },
        { label: "J'assume la sanction", variant: "secondary" }
      ];
    }
  };

  // Avatars des joueurs de la room (photo ou emoji), retrouvés par pseudo.
  const avatarFor = name => players.find(p => p?.name === name) || null;

  onSnapshot(doc(db, "rooms", roomCode), snapshot => {
    if (!snapshot.exists()) return;
    const data = snapshot.data();
    // L'hôte a ramené tout le monde au lobby.
    if (!spectator && data.gameStarted === false) {
      localStorage.setItem("partyhubReturnLobby", "true");
      window.location.href = `../../../index.html?room=${encodeURIComponent(roomCode)}`;
      return;
    }
    const before = JSON.stringify(players.map(p => [p?.name, p?.avatar, Boolean(p?.avatarBase64 || p?.avatarUrl)]));
    players = Array.isArray(data.players) ? data.players : [];
    me.avatar = avatarFor(me.name)?.avatar || "🎲";
    if (api && before !== JSON.stringify(players.map(p => [p?.name, p?.avatar, Boolean(p?.avatarBase64 || p?.avatarUrl)]))) api.render();
  }, error => console.error("Poker : synchro de la room impossible", error));

  api = createPokerRoom(ctx, { roomCode, me, isHost: () => isHost, spectator, avatarFor });
  // Si l'hôte ne répond plus, un autre joueur reprend la main (bouton « faire jouer l'absent »).
  if (!spectator) watchHost(roomCode, savedData, value => { isHost = value; api.refresh(); });
  wallet.start();
}
