import {
  db,
  doc,
  getDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp
} from "./firebase.js";

const params = new URLSearchParams(window.location.search);
const roomCode =
  params.get("room") ||
  params.get("code") ||
  localStorage.getItem("partyhubTvRoomCode") ||
  "----";

const GAME_CONFIG = {
  "most-likely": { label: "Qui est le plus susceptible ?", url: "games/most-likely/most-likely.html" },
  roulette: { label: "Roulette Chaos", url: "games/roulette/roulette.html" },
  "never-have-i-ever": { label: "Je n’ai jamais", url: "games/never-have-i-ever/never-have-i-ever.html" },
  "chaos-kings": { label: "Chaos Kings", url: "games/chaos-kings/chaos-kings.html" },
  survivor: { label: "Survivor", url: "games/survivor/survivor.html" },
  bomb: { label: "Bomb Timer", url: "games/bomb-timer/bomb-timer.html" },
  "truth-or-drink": { label: "Vérité ou Bois", url: "games/truth-or-drink/truth-or-drink.html" },
  "verite-ou-bois": { label: "Vérité ou Bois", url: "games/verite-ou-bois/truth-or-drink.html" },
  traitor: { label: "Mission Traître", url: "games/mission-traitre/mission-traitre.html" },
  monopolit: { label: "Monopoly", url: "games/monopolit/index.html" },
  "casino-night": { label: "Casino Night", url: "games/casino-night/index.html" },
  "poker-night": { label: "Poker Night", url: "games/casino-night/poker/index.html" }
};

const roomRef = doc(db, "rooms", roomCode);

const roomCodeEl = document.getElementById("tvRoomCode");
const qrEl = document.getElementById("tvQr");
const statusEl = document.getElementById("tvStatus");
const playersEl = document.getElementById("tvPlayers");
const activityEl = document.getElementById("tvActivity");
const currentGameEl = document.getElementById("tvCurrentGame");
const phaseEl = document.getElementById("tvPhase");
const modeEl = document.getElementById("tvMode");
const alcoholEl = document.getElementById("tvAlcohol");
const drinkEl = document.getElementById("tvDrink");

const gameSelect = document.getElementById("tvGameSelect");
const modeSelect = document.getElementById("tvModeSelect");
const drinkSelect = document.getElementById("tvDrinkSelect");
const durationSelect = document.getElementById("tvDurationSelect");
const alcoholBtn = document.getElementById("tvAlcoholBtn");
const soundBtn = document.getElementById("tvSoundBtn");
const applyBtn = document.getElementById("tvApplySettingsBtn");
const launchBtn = document.getElementById("tvLaunchGameBtn");
const backLobbyBtn = document.getElementById("tvBackLobbyBtn");
const endSummaryBtn = document.getElementById("tvEndSummaryBtn");
const hostStatus = document.getElementById("tvHostStatus");
const summaryBox = document.getElementById("tvSummaryBox");
const liveGameEl = document.getElementById("tvLiveGame");
const cinemaBtn = document.getElementById("tvCinemaBtn");

const overlay = document.getElementById("tvEventOverlay");
const eventIcon = document.getElementById("tvEventIcon");
const eventTitle = document.getElementById("tvEventTitle");
const eventText = document.getElementById("tvEventText");
const rain = document.getElementById("tvGoldRain");

let audioCtx = null;
let soundEnabled = localStorage.getItem("partyhubTvSound") !== "false";
let lastActivityCount = 0;
let lastGameLabel = "";
let lastRoomStatus = "";
let lastPlayerCount = 0;
let latestRoomData = null;
let cinemaMode = localStorage.getItem("partyhubTvCinema") === "true";
let bombCountdownTimer = null;

function titleCase(value){
  const txt = String(value || "");
  return txt ? txt.charAt(0).toUpperCase() + txt.slice(1) : "";
}

function normalizePartyMode(value){
  const key = String(value || "chill").toLowerCase();
  if(key === "party") return "Party";
  if(key === "chaos") return "Chaos";
  if(key === "hardcore") return "Hardcore";
  return "Chill";
}

function escapeHtml(value){
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeDeg(value){
  return ((Number(value || 0) % 360) + 360) % 360;
}

function formatLiveValue(value, fallback="-"){
  return value === undefined || value === null || value === "" ? fallback : escapeHtml(value);
}


function getPlayers(data){
  const players = data?.players || [];
  return Array.isArray(players) ? players : Object.values(players || {});
}

function getPlayerNameFromIndex(data, index){
  const players = getPlayers(data);
  const player = players[Number(index || 0)];
  return player?.name || player?.pseudo || player?.displayName || "-";
}

function historyList(items, empty="Aucun historique pour le moment."){
  const list = Array.isArray(items) ? items : [];
  if(!list.length) return `<p class="tv-live-muted">${empty}</p>`;
  return `<ul class="tv-live-history-list">${list.slice(0,6).map(item => `<li>${escapeHtml(typeof item === "string" ? item : item?.text || item?.message || "Événement")}</li>`).join("")}</ul>`;
}

function applyCinemaMode(){
  document.body.classList.toggle("tv-cinema-mode", cinemaMode);
  if(cinemaBtn) cinemaBtn.textContent = cinemaMode ? "⛶ Quitter plein écran live" : "⛶ Plein écran live";
}

async function toggleCinemaMode(){
  cinemaMode = !cinemaMode;
  localStorage.setItem("partyhubTvCinema", String(cinemaMode));
  applyCinemaMode();

  try{
    if(cinemaMode && !document.fullscreenElement){
      await document.documentElement.requestFullscreen();
    }else if(!cinemaMode && document.fullscreenElement){
      await document.exitFullscreen();
    }
  }catch{}
}

function startBombCountdown(state){
  if(bombCountdownTimer){
    clearInterval(bombCountdownTimer);
    bombCountdownTimer = null;
  }

  const valueEl = document.getElementById("tvBombCountdownValue");
  if(!valueEl || !state?.startedAt || !state?.duration || state.type === "explode") return;

  const tick = () => {
    const elapsed = Math.floor((Date.now() - Number(state.startedAt)) / 1000);
    const left = Math.max(0, Number(state.duration) - elapsed);
    valueEl.textContent = left;
    valueEl.classList.toggle("danger", left <= 5);
  };
  tick();
  bombCountdownTimer = setInterval(tick, 500);
}

function setHostStatus(text){
  if(hostStatus) hostStatus.textContent = text;
}

function tone(freq, duration=.12, type="triangle", volume=.04){
  if(!soundEnabled) return;
  try{
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = volume;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    osc.stop(audioCtx.currentTime + duration);
  }catch{}
}

function fanfare(){
  tone(392,.12,"triangle",.055);
  setTimeout(()=>tone(523,.14,"triangle",.055),120);
  setTimeout(()=>tone(659,.18,"triangle",.06),260);
  setTimeout(()=>tone(784,.25,"triangle",.065),430);
}

function alarm(){
  tone(220,.16,"sawtooth",.045);
  setTimeout(()=>tone(440,.16,"sawtooth",.045),160);
  setTimeout(()=>tone(220,.16,"sawtooth",.045),320);
}

function tvEvent(icon, title, text, rainCoins=false){
  if(!overlay) return;

  eventIcon.textContent = icon;
  eventTitle.textContent = title;
  eventText.textContent = text;

  overlay.classList.remove("hidden");

  if(rainCoins) createGoldRain();

  setTimeout(() => {
    overlay.classList.add("hidden");
  }, 3200);
}

function createGoldRain(){
  if(!rain) return;
  rain.innerHTML = "";

  for(let i=0;i<45;i++){
    const coin = document.createElement("div");
    coin.className = "tv-coin";
    coin.textContent = Math.random() > .5 ? "💰" : "🎰";
    coin.style.left = Math.random()*100 + "vw";
    coin.style.animationDuration = (2.4 + Math.random()*2.6) + "s";
    coin.style.animationDelay = Math.random()*0.5 + "s";
    rain.appendChild(coin);
  }

  setTimeout(() => rain.innerHTML = "", 5200);
}

function avatarMarkup(player){
  const img = player.avatarBase64 || player.avatarUrl;
  if(img) return `<img src="${img}" alt="">`;
  return player.avatar || "🍻";
}

function currentSettings(){
  const gameId = gameSelect?.value || "most-likely";
  const game = GAME_CONFIG[gameId] || GAME_CONFIG["most-likely"];

  return {
    gameId,
    game,
    mode: normalizePartyMode(modeSelect?.value || "chill"),
    drink: drinkSelect?.value || "normal",
    duration: durationSelect?.value || "medium",
    alcohol: alcoholBtn?.dataset.enabled !== "false"
  };
}

function applyControlsFromData(data){
  if(!data) return;

  if(gameSelect) gameSelect.value = data.selectedGameId || "most-likely";
  if(modeSelect) modeSelect.value = String(data.selectedPartyMode || "chill").toLowerCase();
  if(drinkSelect) drinkSelect.value = data.drinkLevel || "normal";
  if(durationSelect) durationSelect.value = data.gameDuration || "medium";

  if(alcoholBtn){
    alcoholBtn.dataset.enabled = data.alcoholMode ? "true" : "false";
    alcoholBtn.textContent = data.alcoholMode ? "🍻 Alcool ON" : "🚫 Alcool OFF";
  }

  if(soundBtn){
    soundBtn.textContent = soundEnabled ? "🔊 Sons ON" : "🔇 Sons OFF";
  }
}

async function updateRoomSettingsOnly(){
  const settings = currentSettings();

  await updateDoc(roomRef, {
    selectedGame: settings.game.label,
    selectedGameId: settings.gameId,
    selectedPartyMode: settings.mode,
    alcoholMode: settings.alcohol,
    drinkLevel: settings.drink,
    gameDuration: settings.duration,
    updatedAt: serverTimestamp(),
    activity: [
      `🎛️ Réglages TV : ${settings.game.label} · ${titleCase(settings.mode)} · ${settings.alcohol ? "alcool ON" : "alcool OFF"}`,
      ...(latestRoomData?.activity || [])
    ].slice(0, 6)
  });

  setHostStatus("Réglages appliqués ✅");
  tone(620,.12);
}

async function launchSelectedGame(){
  const settings = currentSettings();

  await updateDoc(roomRef, {
    selectedGame: settings.game.label,
    selectedGameId: settings.gameId,
    selectedPartyMode: settings.mode,
    alcoholMode: settings.alcohol,
    drinkLevel: settings.drink,
    gameDuration: settings.duration,
    gameStarted: true,
    roomStatus: "in-game",
    screen: "game",
    activeGame: {
      id: settings.gameId,
      label: settings.game.label,
      url: settings.game.url,
      startedAt: Date.now(),
      hostName: "Écran TV"
    },
    gameState: {
      round: 1,
      updatedBy: "Écran TV",
      updatedAt: Date.now()
    },
    forceNavigation: {
      target: "game",
      gameId: settings.gameId,
      at: Date.now()
    },
    updatedAt: serverTimestamp(),
    activity: [
      `🚀 L'écran TV lance : ${settings.game.label}`,
      ...(latestRoomData?.activity || [])
    ].slice(0, 6)
  });

  setHostStatus(`Jeu lancé : ${settings.game.label} 🚀`);
  fanfare();
  tvEvent("🚀", "Jeu lancé", settings.game.label, true);
}

async function backToLobby(){
  await updateDoc(roomRef, {
    gameStarted: false,
    roomStatus: "lobby",
    screen: "lobby",
    activeGame: null,
    gameState: {},
    forceNavigation: { target: "lobby", at: Date.now() },
    updatedAt: serverTimestamp(),
    activity: [
      "↩️ L'écran TV ramène la room au lobby",
      ...(latestRoomData?.activity || [])
    ].slice(0, 6)
  });

  setHostStatus("Room revenue au lobby ✅");
  tone(360,.12);
}

function buildSummary(){
  const data = latestRoomData || {};
  const players = getPlayers(data);
  const game = data.activeGame?.label || data.selectedGame || "Aucun";
  const topPlayer = [...players].sort((a,b)=>(b.level || 1)-(a.level || 1))[0];

  return [
    "🏁 Bilan PartyHub",
    `Room : ${roomCode}`,
    `Joueurs : ${players.length}`,
    `Dernier jeu : ${game}`,
    `Ambiance : ${titleCase(data.selectedPartyMode || "chill")}`,
    `Alcool : ${data.alcoholMode ? "Activé" : "Désactivé"}`,
    "",
    `🏆 MVP : ${topPlayer?.name || "À définir"}`,
    `🎲 Roi du chaos : ${players[Math.floor(Math.random()*Math.max(players.length,1))]?.name || "À définir"}`,
    `📺 Écran TV : session terminée`
  ].join("\n");
}

function showSummary(){
  const text = buildSummary();
  if(summaryBox) summaryBox.textContent = text;
  tvEvent("🏁", "Bilan généré", "Résumé de la soirée prêt", true);
  fanfare();
}


function getLiveStreamUrl(activeId, data){
  let id = activeId || data.activeGame?.id || data.selectedGameId || "";
  let cfg = GAME_CONFIG[id];

  const label = String(data.activeGame?.label || data.selectedGame || "").toLowerCase();
  if(!cfg && label.includes("poker")) cfg = GAME_CONFIG["poker-night"];
  if(!cfg && label.includes("monopoly")) cfg = GAME_CONFIG["monopolit"];
  if(!cfg && label.includes("casino")) cfg = GAME_CONFIG["casino-night"];
  if(!cfg) return "";

  const sep = cfg.url.includes("?") ? "&" : "?";
  return `${cfg.url}${sep}room=${encodeURIComponent(roomCode)}&tv=1&spectator=1&embed=1`;
}

function renderGameStream(activeId, data, title){
  const url = getLiveStreamUrl(activeId, data);
  if(!url) return false;
  liveGameEl.innerHTML = `
    <div class="tv-stream-live">
      <div class="tv-stream-topbar">
        <strong>📺 ${escapeHtml(title || data.activeGame?.label || data.selectedGame || "Live PartyHub")}</strong>
        <span>Mode émission TV · vue publique</span>
      </div>
      <iframe class="tv-game-stream" src="${url}" title="PartyHub live game" loading="eager"></iframe>
    </div>
  `;
  return true;
}

function renderLiveGame(data){
  if(!liveGameEl) return;

  const activeId = data.activeGame?.id || data.selectedGameId || "";
  const label = data.activeGame?.label || data.selectedGame || "Jeu actif";

  const labelLower = String(label || "").toLowerCase();
  const wantsStream = activeId === "monopolit" || activeId === "casino-night" || activeId === "poker-night" || labelLower.includes("poker") || labelLower.includes("casino") || labelLower.includes("monopoly");
  if(wantsStream && renderGameStream(activeId, data, label)) return;

  if(data.roomStatus !== "in-game" && !data.gameStarted){
    liveGameEl.innerHTML = `<div class="tv-live-empty">La room est au lobby. Lance un jeu pour voir la partie en direct.</div>`;
    return;
  }

  if(activeId === "roulette" || String(label).toLowerCase().includes("roulette")){
    const state = data.rouletteState || data.gameState?.roulette || data.gameState || {};
    const rotation = Number(state.rotation || 0);
    const category = state.category || state.lastCategory || "En attente";
    const playerName = state.playerName || state.currentPlayerName || state.targetPlayerName || "-";
    const action = state.action || state.lastResult || "La prochaine action apparaîtra ici.";
    const spinCount = state.totalSpins || data.gameState?.totalSpins || "-";
    const isSpinning = state.status === "spinning";

    liveGameEl.innerHTML = `
      <div class="tv-roulette-live ${isSpinning ? "is-spinning" : ""}">
        <div class="tv-roulette-stage">
          <div class="tv-roulette-pointer">▼</div>
          <div class="tv-live-wheel" style="transform: rotate(${rotation}deg)">
            <span class="tv-wheel-label tv-label-1">BOIS</span>
            <span class="tv-wheel-label tv-label-2">DISTRIBUE</span>
            <span class="tv-wheel-label tv-label-3">GAGE</span>
            <span class="tv-wheel-label tv-label-4">DUEL</span>
            <span class="tv-wheel-label tv-label-5">TOUS</span>
            <span class="tv-wheel-label tv-label-6">CHANCE</span>
            <span class="tv-wheel-label tv-label-7">CHAOS</span>
            <span class="tv-wheel-label tv-label-8">SECRET</span>
            <strong>LIVE</strong>
          </div>
        </div>
        <div class="tv-live-result-card">
          <span class="tv-live-kicker">Roulette Chaos</span>
          <h3>${formatLiveValue(category, "En attente")}</h3>
          <p class="tv-live-player">🎯 ${formatLiveValue(playerName)}</p>
          <p class="tv-live-action">${formatLiveValue(action)}</p>
          <div class="tv-live-stats">
            <span>🎡 Spins : <strong>${formatLiveValue(spinCount)}</strong></span>
            <span>📡 Statut : <strong>${isSpinning ? "Ça tourne" : "Résultat"}</strong></span>
          </div>
        </div>
      </div>
    `;
    return;
  }

  if(activeId === "bomb"){
    const state = data.bombTimerState || data.gameState?.bomb || data.gameState || {};
    const playerName = state.loser || state.currentPlayerName || getPlayerNameFromIndex(data, state.playerIndex);
    const exploded = state.type === "explode";
    liveGameEl.innerHTML = `
      <div class="tv-live-bomb ${exploded ? "exploded" : ""}">
        <div class="tv-bomb-visual">
          <div class="tv-bomb-fuse"></div>
          <div class="tv-bomb-circle"><span id="tvBombCountdownValue">${exploded ? "💥" : formatLiveValue(state.duration, "--")}</span></div>
        </div>
        <div class="tv-live-result-card">
          <span class="tv-live-kicker">💣 Bomb Timer · Manche ${formatLiveValue(state.round, "1")}</span>
          <h3>${exploded ? "Explosion" : formatLiveValue(state.category, "Question")}</h3>
          <p class="tv-live-player">🎯 ${formatLiveValue(playerName)}</p>
          <p class="tv-live-action">${exploded ? formatLiveValue(state.punishment, "Punition !") : formatLiveValue(state.question, "Question en attente...")}</p>
        </div>
      </div>
    `;
    startBombCountdown(state);
    return;
  }

  if(activeId === "never-have-i-ever"){
    const state = data.neverHaveIEverState || data.gameState?.never || data.gameState || {};
    liveGameEl.innerHTML = `
      <div class="tv-live-focus">
        <span class="tv-live-kicker">🙋 Je n’ai jamais · Question ${formatLiveValue(state.number, "1")}</span>
        <h3>${formatLiveValue(state.questionText, "Question en chargement...")}</h3>
        <p>${formatLiveValue(state.instruction, "Ceux qui l’ont déjà fait boivent.")}</p>
        <div class="tv-live-stats big">
          <span>🍻 Ont bu : <strong>${formatLiveValue(state.drinkCount, 0)}</strong></span>
          <span>😇 Sauvés : <strong>${formatLiveValue(state.safeCount, 0)}</strong></span>
          <span>🌟 Rare : <strong>${state.rare ? "Oui" : "Non"}</strong></span>
        </div>
        ${historyList(state.history)}
      </div>
    `;
    return;
  }

  if(activeId === "truth-or-drink" || activeId === "verite-ou-bois"){
    const state = data.truthOrDrinkState || data.gameState?.truth || data.gameState || {};
    const target = state.currentTarget?.name || state.currentTarget?.pseudo || state.targetName || "-";
    liveGameEl.innerHTML = `
      <div class="tv-live-focus">
        <span class="tv-live-kicker">🍻 Vérité ou Bois · Question ${formatLiveValue(state.currentQuestion, "1")}</span>
        <h3>${formatLiveValue(state.question, "Question en chargement...")}</h3>
        <p class="tv-live-player">🎯 Joueur ciblé : ${formatLiveValue(target)}</p>
        <p class="tv-live-action">🍺 Punition : ${formatLiveValue(state.currentPunishment, "-")}</p>
        <div class="tv-live-stats big">
          <span>🎤 Réponses : <strong>${formatLiveValue(state.answered, 0)}</strong></span>
          <span>🍺 Boissons : <strong>${formatLiveValue(state.drinks, 0)}</strong></span>
        </div>
        ${historyList(state.history)}
      </div>
    `;
    return;
  }

  if(activeId === "most-likely"){
    const state = data.mostLikelyState || data.gameState?.mostLikely || {};
    const scores = state.scores || state.scoreboard || {};
    const scoreRows = Object.entries(scores).slice(0,5).map(([name, score], i) => `<li><strong>${i+1}. ${escapeHtml(name)}</strong><span>${escapeHtml(score)}</span></li>`).join("");
    liveGameEl.innerHTML = `
      <div class="tv-live-focus">
        <span class="tv-live-kicker">🏆 Qui est le plus susceptible ? · Manche ${formatLiveValue(state.round, "1")}</span>
        <h3>${formatLiveValue(state.question, "Question en chargement...")}</h3>
        <p>${formatLiveValue(state.category, "Vote en cours")}</p>
        <ul class="tv-live-scoreboard">${scoreRows || "<li>Aucun vote pour le moment.</li>"}</ul>
      </div>
    `;
    return;
  }

  if(activeId === "chaos-kings"){
    const state = data.chaosKingsState || data.gameState?.chaosKings || {};
    liveGameEl.innerHTML = `
      <div class="tv-live-cardgame">
        <div class="tv-big-card">
          <div>${formatLiveValue(state.cardValue, "?")}${formatLiveValue(state.cardSuit, "")}</div>
          <span>${formatLiveValue(state.cardIcon, "👑")}</span>
        </div>
        <div class="tv-live-result-card">
          <span class="tv-live-kicker">👑 Chaos Kings · Tour ${formatLiveValue(state.turn, "1")}</span>
          <h3>${formatLiveValue(state.ruleName, "Pioche une carte")}</h3>
          <p class="tv-live-player">🎯 ${formatLiveValue(state.playerName, "-")}</p>
          <p class="tv-live-action">${formatLiveValue(state.ruleText, "La règle apparaîtra ici.")}</p>
          <div class="tv-live-stats"><span>🔥 Chaos : <strong>${formatLiveValue(state.chaosLevel, 0)}%</strong></span><span>👑 Rois : <strong>${formatLiveValue(state.kingCount, 0)}/4</strong></span></div>
          ${historyList(state.historyItems)}
        </div>
      </div>
    `;
    return;
  }

  if(activeId === "survivor"){
    const state = data.survivorState || data.gameState?.survivor || {};
    const lives = state.lives || state.playersLives || {};
    const rows = Object.entries(lives).map(([name, life]) => `<li><strong>${escapeHtml(name)}</strong><span>${"💗".repeat(Math.max(0, Number(life)||0)) || "💀"}</span></li>`).join("");
    liveGameEl.innerHTML = `
      <div class="tv-live-focus">
        <span class="tv-live-kicker">⚡ Survivor · Round ${formatLiveValue(state.round, "1")}</span>
        <h3>${formatLiveValue(state.challenge, "Défi en attente...")}</h3>
        <p>${formatLiveValue(state.instruction, "Le perdant perd une vie et prend une punition.")}</p>
        <ul class="tv-live-scoreboard">${rows || "<li>Survivants en attente.</li>"}</ul>
        ${historyList(state.history)}
      </div>
    `;
    return;
  }

  if(activeId === "traitor"){
    const state = data.traitorState || data.gameState?.traitor || {};
    liveGameEl.innerHTML = `
      <div class="tv-live-focus">
        <span class="tv-live-kicker">🕵️ Mission Traître</span>
        <h3>Rôles distribués</h3>
        <p>Les rôles restent privés sur les téléphones des joueurs.</p>
        <div class="tv-live-stats big"><span>👥 Joueurs : <strong>${getPlayers(data).length}</strong></span><span>🕵️ Traître : <strong>caché</strong></span></div>
        ${historyList(state.publicHistory || state.history)}
      </div>
    `;
    return;
  }

  if(activeId === "monopolit"){
    const state = data.monopolitState || data.monopolyState || data.gameState?.monopolit || data.gameState || {};
    const players = state.players || getPlayers(data);
    const rows = (Array.isArray(players) ? players : Object.values(players || {})).slice(0,8).map((p,i)=>`<li><strong>${escapeHtml(p.name || p.pseudo || `Joueur ${i+1}`)}</strong><span>${formatLiveValue(p.tokens ?? p.money ?? p.score ?? "-")} jetons</span></li>`).join("");
    liveGameEl.innerHTML = `
      <div class="tv-live-focus">
        <span class="tv-live-kicker">🏠 Monopoly Party</span>
        <h3>Tour : ${formatLiveValue(state.currentPlayerName || state.turnPlayerName || getPlayerNameFromIndex(data, state.currentPlayerIndex), "-")}</h3>
        <p>Case : ${formatLiveValue(state.currentTileName || state.tileName || "-")}</p>
        <ul class="tv-live-scoreboard">${rows || "<li>Joueurs en synchronisation...</li>"}</ul>
        ${historyList(state.history || state.logs)}
      </div>
    `;
    return;
  }

  if(activeId === "casino-night"){
    const state = data.casinoState || data.casinoNightState || data.gameState?.casino || data.gameState || {};
    liveGameEl.innerHTML = `
      <div class="tv-live-focus">
        <span class="tv-live-kicker">🎰 Casino Night</span>
        <h3>${formatLiveValue(state.currentCasinoGame || state.phase || "Table ouverte")}</h3>
        <p>Tour : ${formatLiveValue(state.currentPlayerName || state.turnPlayerName, "-")}</p>
        <div class="tv-live-stats big"><span>💰 Pot : <strong>${formatLiveValue(state.pot, 0)}</strong></span><span>🎲 Manche : <strong>${formatLiveValue(state.round, "-")}</strong></span></div>
        ${historyList(state.history || state.logs)}
      </div>
    `;
    return;
  }

  liveGameEl.innerHTML = `
    <div class="tv-live-generic">
      <strong>${escapeHtml(label)}</strong>
      <p>Vue spectateur générique active.</p>
      <p>Les infos privées des joueurs restent cachées.</p>
    </div>
  `;
}
function render(data){
  const previousGameLabel = lastGameLabel;
  const previousRoomStatus = lastRoomStatus;
  const previousPlayerCount = lastPlayerCount;

  latestRoomData = data;
  roomCodeEl.textContent = roomCode;

  const joinUrl = `${location.origin}${location.pathname.replace("tv.html","index.html")}?room=${encodeURIComponent(roomCode)}`;
  qrEl.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(joinUrl)}`;

  const players = getPlayers(data);
  const activity = data.activity || [];

  statusEl.textContent = data.tvMode
    ? "Mode TV actif : cet écran ne compte pas comme joueur."
    : "Room active : écran central PartyHub.";

  currentGameEl.textContent = data.activeGame?.label || data.selectedGame || "En attente...";
  phaseEl.textContent = data.roomStatus === "in-game" ? "Partie lancée" : "Lobby";
  modeEl.textContent = titleCase(data.selectedPartyMode || "Chill");
  alcoholEl.textContent = data.alcoholMode ? "Activé" : "Désactivé";
  drinkEl.textContent = titleCase(data.drinkLevel || "Normal");

  playersEl.innerHTML = players.length
    ? players.map(p => `
      <div class="tv-player">
        <div class="tv-avatar">${avatarMarkup(p)}</div>
        <div><strong>${p.name}</strong><small>Niv. ${p.level || 1}${p.host ? " · Host" : ""}</small></div>
      </div>
    `).join("")
    : `<div class="tv-player"><div class="tv-avatar">📱</div><div><strong>En attente</strong><small>Scanne le QR code</small></div></div>`;

  activityEl.innerHTML = activity.slice(0,8).map(item => `<li>${item}</li>`).join("");

  applyControlsFromData(data);
  renderLiveGame(data);

  if(activity.length > lastActivityCount){
    tone(520); setTimeout(()=>tone(760,.16),100);
  }

  const currentGameLabel = data.activeGame?.label || data.selectedGame || "";
  const currentRoomStatus = data.roomStatus || "lobby";

  if(previousPlayerCount && players.length > previousPlayerCount){
    const newest = players[players.length - 1]?.name || "Un joueur";
    tvEvent("📱", "Nouveau joueur", `${newest} rejoint la soirée`);
  }

  if(previousRoomStatus !== "in-game" && currentRoomStatus === "in-game"){
    fanfare();
    tvEvent("🚀", "Soirée lancée", `${currentGameLabel || "Mini-jeu"} commence maintenant`, true);
  }

  if(previousGameLabel && currentGameLabel && previousGameLabel !== currentGameLabel){
    alarm();
    tvEvent("🎮", "Changement de jeu", currentGameLabel, false);
  }

  if((currentGameLabel || "").toLowerCase().includes("casino")){
    currentGameEl.classList.add("tv-status-hot");
  }else{
    currentGameEl.classList.remove("tv-status-hot");
  }

  lastActivityCount = activity.length;
  lastGameLabel = currentGameLabel;
  lastRoomStatus = currentRoomStatus;
  lastPlayerCount = players.length;
}

if(alcoholBtn){
  alcoholBtn.addEventListener("click", () => {
    const enabled = alcoholBtn.dataset.enabled !== "false";
    alcoholBtn.dataset.enabled = enabled ? "false" : "true";
    alcoholBtn.textContent = enabled ? "🚫 Alcool OFF" : "🍻 Alcool ON";
    tone(420,.1);
  });
}

if(soundBtn){
  soundBtn.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    localStorage.setItem("partyhubTvSound", String(soundEnabled));
    soundBtn.textContent = soundEnabled ? "🔊 Sons ON" : "🔇 Sons OFF";
    tone(520,.1);
  });
}

applyBtn?.addEventListener("click", updateRoomSettingsOnly);
launchBtn?.addEventListener("click", launchSelectedGame);
backLobbyBtn?.addEventListener("click", backToLobby);
endSummaryBtn?.addEventListener("click", showSummary);
cinemaBtn?.addEventListener("click", toggleCinemaMode);
document.addEventListener("fullscreenchange", () => { if(!document.fullscreenElement && cinemaMode){ cinemaMode = false; localStorage.setItem("partyhubTvCinema", "false"); applyCinemaMode(); } });
applyCinemaMode();

onSnapshot(roomRef, snap => {
  if(!snap.exists()){
    statusEl.textContent = "Room introuvable.";
    return;
  }
  render(snap.data());
});
