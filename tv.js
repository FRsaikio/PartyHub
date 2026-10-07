import {
  db,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp
} from "./firebase.js";
import { safeImageSrc } from "./html-safe.js";

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
  "verite-ou-bois": { label: "Vérité ou Bois", url: "games/truth-or-drink/truth-or-drink.html" },
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
const bombModeSelect = document.getElementById("tvBombModeSelect");
const bombModeLabel = document.getElementById("tvBombModeLabel");
const drinkSelect = document.getElementById("tvDrinkSelect");
const durationSelect = document.getElementById("tvDurationSelect");
const alcoholBtn = document.getElementById("tvAlcoholBtn");
const soundBtn = document.getElementById("tvSoundBtn");
const applyBtn = document.getElementById("tvApplySettingsBtn");
const launchBtn = document.getElementById("tvLaunchGameBtn");
const backLobbyBtn = document.getElementById("tvBackLobbyBtn");
const kickInactiveBtn = document.getElementById("tvKickInactiveBtn");
const quitRoomBtn = document.getElementById("tvQuitRoomBtn");
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
let lastBroadcastRevealKey = "";
let broadcastRevealRunning = false;


let voteBreakdownTimers = [];
let voteBreakdownKey = "";
let voteBreakdownSnapshot = null;

function clearVoteBreakdownTimers(){
  voteBreakdownTimers.forEach(timer => clearTimeout(timer));
  voteBreakdownTimers = [];
}

function buildProgressCounts(voteSequence){
  const counts = {};
  voteSequence.forEach(name => {
    if(!name) return;
    counts[name] = (counts[name] || 0) + 1;
  });
  return counts;
}

function getVoteNames(votes){
  return Object.values(votes || {}).filter(Boolean);
}

function startVoteBreakdown(key, votes, players, onComplete){
  const sequence = getVoteNames(votes);
  if(!key || !sequence.length){
    voteBreakdownSnapshot = null;
    if(typeof onComplete === "function") onComplete();
    return;
  }

  if(voteBreakdownKey === key) return;

  clearVoteBreakdownTimers();
  voteBreakdownKey = key;
  voteBreakdownSnapshot = {
    key,
    phase: "counting",
    current: 0,
    total: sequence.length,
    counts: {},
    players: Array.isArray(players) ? players : [],
    completed: false
  };

  sequence.forEach((name, index) => {
    voteBreakdownTimers.push(setTimeout(() => {
      const partial = sequence.slice(0, index + 1);
      voteBreakdownSnapshot = {
        ...voteBreakdownSnapshot,
        current: index + 1,
        counts: buildProgressCounts(partial)
      };
      tone(index === sequence.length - 1 ? 620 : 420, .07, "triangle", .035);
      renderLiveGame(latestRoomData || {});
    }, 450 + index * 420));
  });

  voteBreakdownTimers.push(setTimeout(() => {
    voteBreakdownSnapshot = {
      ...voteBreakdownSnapshot,
      phase: "done",
      current: sequence.length,
      counts: buildProgressCounts(sequence),
      completed: true
    };
    renderLiveGame(latestRoomData || {});
    if(typeof onComplete === "function") onComplete();
  }, 700 + sequence.length * 420));
}

function renderProgressVoteBars(counts, players=[], options={}){
  const safeCounts = counts || {};
  const totalVotes = Object.values(safeCounts).reduce((sum, value) => sum + Number(value || 0), 0);
  const expectedTotal = Number(options.expectedTotal || Math.max(totalVotes, Array.isArray(players) ? players.length : 0) || 1);
  const knownNames = Array.isArray(players) ? players.map(p => p?.name || p?.pseudo || p?.displayName).filter(Boolean) : [];
  const names = [...new Set([...knownNames, ...Object.keys(safeCounts)])]
    .sort((a,b) => Number(safeCounts[b] || 0) - Number(safeCounts[a] || 0));

  if(!names.length) return `<p class="tv-live-muted">Votes en attente...</p>`;

  return `
    <div class="tv-vote-arena tv-vote-arena-progress" aria-label="Dépouillement TV">
      <div class="tv-vote-total">
        <span>${escapeHtml(options.title || "Dépouillement des votes")}</span>
        <strong>${Number(options.current || totalVotes)}/${expectedTotal}</strong>
      </div>
      ${names.map((name, index) => {
        const count = Number(safeCounts[name] || 0);
        const pct = expectedTotal ? Math.round((count / expectedTotal) * 100) : 0;
        return `
          <div class="tv-vote-row ${index === 0 && count ? "leader" : ""}" style="--row-delay:${index * 70}ms">
            <div class="tv-vote-name">${index === 0 && count ? "👑 " : ""}${escapeHtml(name)}</div>
            <div class="tv-vote-track"><div class="tv-vote-fill" style="--vote-width:${pct}%"></div></div>
            <div class="tv-vote-count" data-count="${count}">${count}</div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderGaugeBars(items=[], title="Progression"){
  const safeItems = Array.isArray(items) ? items : [];
  if(!safeItems.length) return "";
  return `
    <div class="tv-vote-arena tv-gauge-arena">
      <div class="tv-vote-total"><span>${escapeHtml(title)}</span><strong>LIVE</strong></div>
      ${safeItems.map((item, index) => {
        const value = Math.max(0, Math.min(100, Number(item.value || 0)));
        return `
          <div class="tv-vote-row" style="--row-delay:${index * 90}ms">
            <div class="tv-vote-name">${escapeHtml(item.name || "Score")}</div>
            <div class="tv-vote-track"><div class="tv-vote-fill" style="--vote-width:${value}%"></div></div>
            <div class="tv-vote-count">${escapeHtml(item.label ?? Math.round(value))}</div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}


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

function isPlayerOnline(player){
  return player?.online !== false && (!player?.lastSeen || Date.now() - player.lastSeen < 45000);
}

function activityWith(message, previous = []){
  return [message, ...(previous || [])].slice(0, 6);
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


function getVoteCounts(votes){
  const counts = {};
  Object.values(votes || {}).forEach(name => {
    if(!name) return;
    counts[name] = (counts[name] || 0) + 1;
  });
  return counts;
}

function renderVoteBars(votes, players=[]){
  const counts = getVoteCounts(votes);
  const total = Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0);
  const knownNames = Array.isArray(players) ? players.map(p => p?.name || p?.pseudo || p?.displayName).filter(Boolean) : [];
  const names = [...new Set([...knownNames, ...Object.keys(counts)])];

  if(!names.length){
    return `<p class="tv-live-muted">Votes en attente...</p>`;
  }

  return `
    <div class="tv-vote-arena" aria-label="Votes animés">
      <div class="tv-vote-total"><span>Votes reçus</span><strong>${total}/${Math.max(knownNames.length, total)}</strong></div>
      ${names.map(name => {
        const count = Number(counts[name] || 0);
        const pct = total ? Math.round((count / total) * 100) : 0;
        return `
          <div class="tv-vote-row">
            <div class="tv-vote-name">${escapeHtml(name)}</div>
            <div class="tv-vote-track"><div class="tv-vote-fill" style="--vote-width:${pct}%"></div></div>
            <div class="tv-vote-count" data-count="${count}">${count}</div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function showBroadcastReveal(key, payload){
  if(!key || key === lastBroadcastRevealKey || broadcastRevealRunning) return;
  lastBroadcastRevealKey = key;
  broadcastRevealRunning = true;

  const overlay = document.createElement("div");
  overlay.className = "tv-broadcast-reveal";
  overlay.innerHTML = `
    <div class="tv-broadcast-kicker">${escapeHtml(payload.kicker || "RÉVÉLATION")}</div>
    <div class="tv-broadcast-count">3</div>
    <div class="tv-broadcast-subtitle">${escapeHtml(payload.subtitle || "Résultat dans...")}</div>
  `;
  document.body.appendChild(overlay);

  const countEl = overlay.querySelector(".tv-broadcast-count");
  const kickerEl = overlay.querySelector(".tv-broadcast-kicker");
  const subEl = overlay.querySelector(".tv-broadcast-subtitle");
  const steps = ["2", "1"];

  tone(330,.09,"triangle",.045);
  setTimeout(() => {
    countEl.textContent = steps[0];
    countEl.classList.remove("pop"); void countEl.offsetWidth; countEl.classList.add("pop");
    tone(392,.09,"triangle",.045);
  }, 650);
  setTimeout(() => {
    countEl.textContent = steps[1];
    countEl.classList.remove("pop"); void countEl.offsetWidth; countEl.classList.add("pop");
    tone(494,.1,"triangle",.05);
  }, 1300);
  setTimeout(() => {
    overlay.classList.add("is-result");
    kickerEl.textContent = payload.icon || "👑";
    countEl.textContent = payload.title || "RÉSULTAT";
    subEl.textContent = payload.text || "";
    fanfare();
  }, 2050);
  setTimeout(() => {
    overlay.classList.add("hide");
    setTimeout(() => {
      overlay.remove();
      broadcastRevealRunning = false;
    }, 500);
  }, 4700);
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
  const img = safeImageSrc(player.avatarBase64 || player.avatarUrl);
  if(img) return `<img src="${img}" alt="">`;
  return escapeHtml(player.avatar || "🍻");
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
    bombGameMode: bombModeSelect?.value || "free",
    alcohol: alcoholBtn?.dataset.enabled !== "false"
  };
}

function applyControlsFromData(data){
  if(!data) return;

  if(gameSelect) gameSelect.value = data.selectedGameId || "most-likely";
  if(modeSelect) modeSelect.value = String(data.selectedPartyMode || "chill").toLowerCase();
  if(drinkSelect) drinkSelect.value = data.drinkLevel || "normal";
  if(durationSelect) durationSelect.value = data.gameDuration || "medium";
  if(bombModeSelect) bombModeSelect.value = data.bombGameMode || data.gameState?.bombGameMode || "free";
  if(bombModeLabel) bombModeLabel.style.display = (data.selectedGameId === "bomb" || gameSelect?.value === "bomb") ? "block" : "none";

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
    bombGameMode: settings.bombGameMode,
    updatedAt: serverTimestamp(),
    activity: [
      `🎛️ Réglages TV : ${settings.game.label} · ${titleCase(settings.mode)}${settings.gameId === "bomb" ? ` · Bomb ${settings.bombGameMode === "syllables" ? "Syllabes" : "Libre"}` : ""} · ${settings.alcohol ? "alcool ON" : "alcool OFF"}`,
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
    bombGameMode: settings.bombGameMode,
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
      bombGameMode: settings.bombGameMode,
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

async function quitRoomForEveryone(){
  const confirmed = window.confirm("Quitter la room pour tout le monde ? Tous les joueurs seront renvoyés à l'accueil.");
  if(!confirmed) return;

  try {
    setHostStatus("Fermeture de la room en cours...");

    // 1) On force d'abord tous les jeux/téléphones à revenir vers l'accueil/lobby.
    // Les jeux PartyHub écoutent gameStarted=false et quittent automatiquement la page jeu.
    await updateDoc(roomRef, {
      gameStarted: false,
      roomStatus: "closed",
      screen: "home",
      activeGame: null,
      gameState: {},
      forceNavigation: { target: "lobby", at: Date.now() },
      updatedAt: serverTimestamp(),
      activity: [
        "🚪 L'écran TV ferme la room pour tout le monde",
        ...(latestRoomData?.activity || [])
      ].slice(0, 6)
    });

    // 2) Petit délai volontaire : laisse le temps aux clients en jeu de recevoir le retour global.
    window.setTimeout(async () => {
      try {
        await deleteDoc(roomRef);
      } catch (error) {
        console.error("Erreur suppression room TV :", error);
      } finally {
        localStorage.removeItem("partyhubTvRoomCode");
        window.location.href = "index.html";
      }
    }, 900);
  } catch(error) {
    console.error("Erreur fermeture room TV :", error);
    setHostStatus("Impossible de fermer la room pour le moment.");
    tone(140,.18);
  }
}

async function kickPlayerFromTv(playerName){
  if(!playerName) return;

  const confirmed = window.confirm(`Kick ${playerName} de la room ?`);
  if(!confirmed) return;

  try {
    const roomSnap = await getDoc(roomRef);
    if(!roomSnap.exists()) return;

    const roomData = roomSnap.data();
    const oldPlayers = getPlayers(roomData);
    const kickedPlayer = oldPlayers.find(player => player.name === playerName);
    const nextPlayers = oldPlayers.filter(player => player.name !== playerName);

    if(nextPlayers.length === 0){
      await updateDoc(roomRef, {
        players: [],
        hostName: "",
        updatedAt: serverTimestamp(),
        activity: activityWith(`🦶 ${playerName} a été kick depuis la TV`, roomData.activity || [])
      });
    } else {
      if(kickedPlayer?.host && !nextPlayers.some(player => player.host)){
        nextPlayers[0].host = true;
      }

      await updateDoc(roomRef, {
        players: nextPlayers,
        hostName: nextPlayers.find(player => player.host)?.name || nextPlayers[0]?.name || "",
        updatedAt: serverTimestamp(),
        activity: activityWith(`🦶 ${playerName} a été kick depuis la TV`, roomData.activity || [])
      });
    }

    setHostStatus(`${playerName} a été retiré de la room ✅`);
    tone(320,.12);
  } catch(error) {
    console.error("Erreur kick joueur TV :", error);
    setHostStatus("Impossible de kick ce joueur pour le moment.");
    tone(140,.18);
  }
}

async function kickInactivePlayersFromTv(){
  const roomSnap = await getDoc(roomRef);
  if(!roomSnap.exists()) return;

  const roomData = roomSnap.data();
  const oldPlayers = getPlayers(roomData);
  const inactivePlayers = oldPlayers.filter(player => !isPlayerOnline(player));

  if(!inactivePlayers.length){
    setHostStatus("Aucun joueur inactif à retirer.");
    tone(520,.1);
    return;
  }

  const confirmed = window.confirm(`Kick ${inactivePlayers.length} joueur(s) inactif(s) ?`);
  if(!confirmed) return;

  const nextPlayers = oldPlayers.filter(player => isPlayerOnline(player));
  if(nextPlayers.length && !nextPlayers.some(player => player.host)){
    nextPlayers[0].host = true;
  }

  await updateDoc(roomRef, {
    players: nextPlayers,
    hostName: nextPlayers.find(player => player.host)?.name || nextPlayers[0]?.name || "",
    updatedAt: serverTimestamp(),
    activity: activityWith(`🧹 ${inactivePlayers.length} joueur(s) inactif(s) retiré(s) depuis la TV`, roomData.activity || [])
  });

  setHostStatus(`${inactivePlayers.length} joueur(s) inactif(s) retiré(s) ✅`);
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
  // Déjà affichée : on ne recrée pas l'iframe (sinon la page du jeu se rechargeait à chaque mise à jour de la room).
  const current = liveGameEl.querySelector(".tv-game-stream");
  if(current && current.getAttribute("src") === url) return true;
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
  // Casino Night a sa propre vue TV (classement + annonces), pas de page intégrée :
  // l'intégrer créerait un faux portefeuille « TV » dans la room.
  // Survivor, Mission Traître, la Bombe, Chaos Kings et la Roulette : la page du jeu a sa propre vue TV (?tv=1), en lecture seule (aucun rôle affiché).
  const wantsStream = activeId === "monopolit" || activeId === "poker-night" || activeId === "survivor" || activeId === "traitor" || activeId === "bomb" || activeId === "chaos-kings" || activeId === "roulette" || labelLower.includes("poker") || labelLower.includes("monopoly");
  if(wantsStream && renderGameStream(activeId, data, label)) return;

  if(data.roomStatus !== "in-game" && !data.gameStarted){
    liveGameEl.innerHTML = `<div class="tv-live-empty">La room est au lobby. Lance un jeu pour voir la partie en direct.</div>`;
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
    const players = getPlayers(data);
    const resultName = state.tie ? "Égalité" : (state.resultPlayer || state.winnerName || "Résultat");
    const revealKey = state.voteComplete ? `most-likely:${state.actionId || state.round}:${resultName}:${Object.keys(state.votes || {}).length}` : "";
    let voteBarsHtml = renderVoteBars(state.votes, players);
    let revealReady = true;

    if(state.voteComplete){
      const expected = Math.max(players.length, Object.keys(state.votes || {}).length);
      const sameBreakdown = voteBreakdownSnapshot?.key === revealKey;
      if(!sameBreakdown || !voteBreakdownSnapshot?.completed){
        revealReady = false;
        if(!sameBreakdown){
          startVoteBreakdown(revealKey, state.votes, players, () => {
            showBroadcastReveal(revealKey, {
              kicker: "QUI EST LE PLUS SUSCEPTIBLE ?",
              icon: state.tie ? "🤝" : "👑",
              title: resultName,
              subtitle: "Dépouillement terminé",
              text: state.tie ? "Personne ne prend la majorité." : (state.penalty || "Majorité du groupe")
            });
          });
        }
      }
      const counts = sameBreakdown && voteBreakdownSnapshot ? voteBreakdownSnapshot.counts : {};
      voteBarsHtml = renderProgressVoteBars(counts, players, {
        title: voteBreakdownSnapshot?.completed ? "Résultat des votes" : "Dépouillement en direct",
        current: voteBreakdownSnapshot?.current || 0,
        expectedTotal: expected
      });
    }

    liveGameEl.innerHTML = `
      <div class="tv-live-focus ${state.voteComplete ? "tv-live-revealed" : ""}">
        <span class="tv-live-kicker">🏆 Qui est le plus susceptible ? · Manche ${formatLiveValue(state.round, "1")}</span>
        <h3>${formatLiveValue(state.question, "Question en chargement...")}</h3>
        <p>${state.voteComplete ? (revealReady ? "Votes terminés" : "Analyse des votes...") : "Vote en cours"}</p>
        ${voteBarsHtml}
        ${state.voteComplete && revealReady ? `<div class="tv-result-chip ${state.tie ? "tie" : ""}"><span>${state.tie ? "🤝" : "👑"}</span><strong>${escapeHtml(resultName)}</strong><em>${escapeHtml(state.penalty || state.hint || "Résultat validé")}</em></div>` : ""}
        <ul class="tv-live-scoreboard">${scoreRows || "<li>Aucun score pour le moment.</li>"}</ul>
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

  if(activeId === "casino-night" || labelLower.includes("casino")){
    // Portefeuilles partagés écrits par games/casino-night/js/wallet.js
    const casino = data.casino || {};
    const rows = Object.values(casino.wallets || {})
      .filter(Boolean) // anciennes clés vidées lors d'une reprise de compte
      .map(w => ({ name: w?.name || "Joueur", chips: Math.max(0, Number(w?.chips) || 0) }))
      .sort((a, b) => b.chips - a.chips)
      .slice(0, 8);
    const event = casino.lastEvent;
    const fmt = n => Math.round(n).toLocaleString("fr-FR").replace(/\u202f/g, "\u00a0");
    const eventFresh = event?.at && Date.now() - Number(event.at) < 5 * 60 * 1000;

    // Salle de blackjack (games/casino-night/blackjack/) : la table la plus remplie.
    const bj = Object.values(casino.blackjack || {})
      .filter(t => t && Object.keys(t.seats || {}).length)
      .sort((x, y) => Object.keys(y.seats).length - Object.keys(x.seats).length)[0] || null;
    const bjSeats = Object.entries(bj?.seats || {}).sort((a, b) => a[1].index - b[1].index);
    const bjCardValue = code => { const r = String(code).slice(0, -1); return r === "A" ? 1 : ["J", "Q", "K"].includes(r) ? 10 : Number(r); };
    const bjTotal = codes => {
      let sum = (codes || []).reduce((s, c) => s + bjCardValue(c), 0);
      let aces = (codes || []).filter(c => String(c).startsWith("A")).length;
      while (aces-- > 0 && sum + 10 <= 21) sum += 10;
      return sum;
    };
    const bjCard = (code, hidden = false) => hidden
      ? `<span class="tv-bj-card back"></span>`
      : `<span class="tv-bj-card ${/[♥♦]$/.test(code) ? "red" : ""}">${escapeHtml(code)}</span>`;
    const bjHoleHidden = bj?.phase === "insurance" || bj?.phase === "playing";
    const bjActive = bj && bjSeats.length && (bj.phase !== "betting" || bjSeats.some(([, s]) => s.bet > 0));
    const bjHtml = !bjActive ? "" : `
      <div class="tv-bj">
        <div class="tv-bj-dealer">
          <h4>Blackjack · Banque ${bj.dealer?.length ? `<em>${bjHoleHidden ? "?" : bjTotal(bj.dealer)}</em>` : ""}</h4>
          <div class="tv-bj-cards">${(bj.dealer || []).map((c, i) => bjCard(c, bjHoleHidden && i === 1)).join("") || `<span class="tv-live-muted">Mises en cours…</span>`}</div>
        </div>
        <div class="tv-bj-seats">
          ${bjSeats.map(([key, seat]) => `
            <div class="tv-bj-seat ${bj.turn?.key === key ? "turn" : ""}">
              <strong>${escapeHtml(seat.name)}</strong>
              <small>${seat.bet ? `Mise ${fmt(seat.bet)}` : "Pas de mise"}${bj.phase === "done" && seat.result ? ` · <b class="${seat.result.net >= 0 ? "up" : "down"}">${seat.result.net > 0 ? "+" : ""}${fmt(seat.result.net)}</b>` : ""}</small>
              ${(seat.hands || []).map(h => `<div class="tv-bj-cards">${h.cards.map(c => bjCard(c)).join("")}<em>${bjTotal(h.cards)}</em></div>`).join("")}
            </div>`).join("")}
        </div>
      </div>`;

    liveGameEl.innerHTML = `
      <div class="tv-casino">
        <div class="tv-casino-event ${eventFresh ? "fresh" : ""}">
          <span class="tv-live-kicker">🎰 Casino Night</span>
          ${eventFresh
            ? `<h3>${escapeHtml(event.name)}</h3><p>${escapeHtml(event.text)}</p>`
            : `<h3>Les tables sont ouvertes</h3><p>Machine à sous, blackjack, dés du diable et poker.</p>`}
        </div>
        <div class="tv-casino-board">
          <h4>Les plus riches</h4>
          ${rows.length
            ? `<ol>${rows.map((row, i) => `<li class="${i === 0 ? "leader" : ""}"><span>${i === 0 ? "👑" : i + 1}</span><strong>${escapeHtml(row.name)}</strong><em>${fmt(row.chips)}</em></li>`).join("")}</ol>`
            : `<p class="tv-live-muted">Personne n'a encore joué.</p>`}
        </div>
        ${bjHtml}
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
    ? players.map(p => {
      const online = isPlayerOnline(p);
      const safeName = String(p.name || "").replace(/"/g, "&quot;");
      return `
      <div class="tv-player ${online ? "online" : "offline"}">
        <div class="tv-avatar">${avatarMarkup(p)}</div>
        <div class="tv-player-info"><strong>${escapeHtml(p.name || "Joueur")}</strong><small>Niv. ${p.level || 1}${p.host ? " · Host" : ""} · ${online ? "En ligne" : "Inactif"}</small></div>
        ${!online ? `<button class="tv-kick-btn" type="button" data-kick-player="${safeName}">Kick</button>` : ""}
      </div>
      `;
    }).join("")
    : `<div class="tv-player"><div class="tv-avatar">📱</div><div><strong>En attente</strong><small>Scanne le QR code</small></div></div>`;

  activityEl.innerHTML = activity.slice(0,8).map(item => `<li>${escapeHtml(item)}</li>`).join("");

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

gameSelect?.addEventListener("change", () => {
  if(bombModeLabel) bombModeLabel.style.display = gameSelect.value === "bomb" ? "block" : "none";
});

applyBtn?.addEventListener("click", updateRoomSettingsOnly);
launchBtn?.addEventListener("click", launchSelectedGame);
backLobbyBtn?.addEventListener("click", backToLobby);
kickInactiveBtn?.addEventListener("click", kickInactivePlayersFromTv);
quitRoomBtn?.addEventListener("click", quitRoomForEveryone);
playersEl?.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-kick-player]");
  if(!btn) return;
  kickPlayerFromTv(btn.dataset.kickPlayer);
});
endSummaryBtn?.addEventListener("click", showSummary);
cinemaBtn?.addEventListener("click", toggleCinemaMode);
document.addEventListener("fullscreenchange", () => { if(!document.fullscreenElement && cinemaMode){ cinemaMode = false; localStorage.setItem("partyhubTvCinema", "false"); applyCinemaMode(); } });
applyCinemaMode();

onSnapshot(roomRef, snap => {
  if(!snap.exists()){
    statusEl.textContent = "Room fermée.";
    localStorage.removeItem("partyhubTvRoomCode");
    window.location.href = "index.html";
    return;
  }
  render(snap.data());
});


function showTvReveal(name='RESULTAT'){
 const wrap=document.createElement('div');
 wrap.className='tv-reveal-overlay';
 document.body.appendChild(wrap);
 let n=3;
 function step(){
   if(n>0){
     wrap.innerHTML='<div class="tv-reveal-count">'+n+'</div>';
     n--; setTimeout(step,900);
   }else{
     wrap.innerHTML='<div class="tv-reveal-winner">🏆<br>'+name+'</div>';
     setTimeout(()=>wrap.remove(),2500);
   }
 }
 step();
}
window.partyhubTvReveal=showTvReveal;
