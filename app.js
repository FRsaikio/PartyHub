import {
  db,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  runTransaction,
  deleteDoc
} from "./firebase.js";

import {
  AVATARS,
  loadProfile,
  saveProfile,
  addProfileXP,
  updateProfileStats,
  getCachedProfile,
  saveCustomAvatar
} from "./profile.js";

const MAX_PLAYERS = 20;
const ACTIVITY_LIMIT = 6;
const ROOM_CODE_LENGTH = 4;

const GAME_CONFIG = {
  "most-likely": {
    label: "Qui est le plus susceptible ?",
    url: "games/most-likely/most-likely.html"
  },
  roulette: {
    label: "Roulette Chaos",
    url: "games/roulette/roulette.html"
  },
  "never-have-i-ever": {
    label: "Je n’ai jamais",
    url: "games/never-have-i-ever/never-have-i-ever.html"
  },
  "chaos-kings": {
    label: "Chaos Kings",
    url: "games/chaos-kings/chaos-kings.html"
  },
  survivor: {
    label: "Survivor",
    url: "games/survivor/survivor.html"
  },
  bomb: {
    label: "Bomb Timer",
    url: "games/bomb-timer/bomb-timer.html"
  },
  "truth-or-drink": {
    label: "Vérité ou Bois",
    url: "games/truth-or-drink/truth-or-drink.html"
  },
  "verite-ou-bois": {
    label: "Vérité ou Bois",
    url: "games/verite-ou-bois/truth-or-drink.html"
  },
  traitor: {
    label: "Mission Traître",
    url: "games/mission-traitre/mission-traitre.html"
  },
  monopolit: {
    label: "Monopoly",
    url: "games/monopolit/index.html"
  },
  "casino-night": {
    label: "Casino Night",
    url: "games/casino-night/index.html"
  }
};

const DEFAULT_GAME_ID = "most-likely";
const DEFAULT_MODE = "Chill";

const homeScreen = document.getElementById("home");
const lobbyScreen = document.getElementById("lobby");

const pseudoInput = document.getElementById("pseudo");
const roomCodeInput = document.getElementById("roomCodeInput");
const avatarSelect = document.getElementById("avatarSelect");
const avatarUploadBtn = document.getElementById("avatarUploadBtn");
const avatarFileInput = document.getElementById("avatarFileInput");
const avatarEmojiGrid = document.getElementById("avatarEmojiGrid");
const profileAvatarPreview = document.getElementById("profileAvatarPreview");
const profileNamePreview = document.getElementById("profileNamePreview");
const profileSyncText = document.getElementById("profileSyncText");
const profileXpBar = document.getElementById("profileXpBar");
const profileLevel = document.getElementById("profileLevel");
const profileXp = document.getElementById("profileXp");
const profileRooms = document.getElementById("profileRooms");
const profileBadges = document.getElementById("profileBadges");
const lobbyProfileMini = document.getElementById("lobbyProfileMini");

const createRoomBtn = document.getElementById("createRoomBtn");
const createTvRoomBtn = document.getElementById("createTvRoomBtn");
const joinRoomBtn = document.getElementById("joinRoomBtn");
const leaveBtn = document.getElementById("leaveBtn");
const startGameBtn = document.getElementById("startGameBtn");
const openTvBtn = document.getElementById("openTvBtn");
const soundToggleBtn = document.getElementById("soundToggleBtn");
const endPartyBtn = document.getElementById("endPartyBtn");
const endPartyOverlay = document.getElementById("endPartyOverlay");
const closeEndPartyBtn = document.getElementById("closeEndPartyBtn");
const endPartyStats = document.getElementById("endPartyStats");
const endPartyAwards = document.getElementById("endPartyAwards");
const copyEndSummaryBtn = document.getElementById("copyEndSummaryBtn");
const v22Level = document.getElementById("v22Level");
const v22XpText = document.getElementById("v22XpText");
const v22Title = document.getElementById("v22Title");
const v22BadgeCount = document.getElementById("v22BadgeCount");
const v22BadgePreview = document.getElementById("v22BadgePreview");

const copyCodeBtn = document.getElementById("copyCodeBtn");
const copyInviteBtn = document.getElementById("copyInviteBtn");
const toggleQrBtn = document.getElementById("toggleQrBtn");
const qrInvitePanel = document.getElementById("qrInvitePanel");
const inviteLinkInput = document.getElementById("inviteLinkInput");
const roomQrImage = document.getElementById("roomQrImage");
const fakePlayerInput = document.getElementById("fakePlayerInput");
const addFakePlayerBtn = document.getElementById("addFakePlayerBtn");

const alcoholMode = document.getElementById("alcoholMode");
const drinkLevel = document.getElementById("drinkLevel");
const gameDuration = document.getElementById("gameDuration");
const autoRotation = document.getElementById("autoRotation");

const errorMsg = document.getElementById("errorMsg");
const roomCodeDisplay = document.getElementById("roomCodeDisplay");
const playersList = document.getElementById("playersList");
const playerCount = document.getElementById("playerCount");

const partyModeText = document.getElementById("partyModeText");
const selectedGameText = document.getElementById("selectedGameText");
const modeText = document.getElementById("modeText");
const drinkText = document.getElementById("drinkText");
const durationText = document.getElementById("durationText");
const rotationText = document.getElementById("rotationText");
const activityList = document.getElementById("activityList");
const syncStatus = document.getElementById("syncStatus");

let currentPlayer = "";
let currentRoom = "";
let isHost = false;
let currentProfile = getCachedProfile();

let selectedGameId = DEFAULT_GAME_ID;
let selectedGame = GAME_CONFIG[DEFAULT_GAME_ID].label;
let selectedPartyMode = DEFAULT_MODE;
let players = [];
let unsubscribeRoom = null;
let presenceTimer = null;
let isReturningToLobby = false;
let lastForceNavigationAt = Number(localStorage.getItem("partyhubLastForceNavigationAt") || 0);

let v22SoundEnabled = localStorage.getItem("partyhubSoundEnabled") !== "false";
let v22AudioContext = null;
let v22LastActivitySize = 0;

function v22Tone(freq = 440, duration = 0.12, type = "sine", volume = 0.04) {
  if (!v22SoundEnabled) return;
  try {
    v22AudioContext = v22AudioContext || new (window.AudioContext || window.webkitAudioContext)();
    const osc = v22AudioContext.createOscillator();
    const gain = v22AudioContext.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = volume;
    osc.connect(gain);
    gain.connect(v22AudioContext.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, v22AudioContext.currentTime + duration);
    osc.stop(v22AudioContext.currentTime + duration);
  } catch {}
}

function v22Sound(event = "click") {
  if (event === "join") {
    v22Tone(520, .10, "triangle", .05);
    setTimeout(() => v22Tone(760, .12, "triangle", .045), 90);
  } else if (event === "start") {
    v22Tone(260, .12, "square", .04);
    setTimeout(() => v22Tone(520, .18, "square", .05), 130);
  } else if (event === "end") {
    v22Tone(440, .12, "triangle", .05);
    setTimeout(() => v22Tone(660, .12, "triangle", .05), 120);
    setTimeout(() => v22Tone(880, .22, "triangle", .06), 240);
  } else {
    v22Tone(390, .08, "sine", .03);
  }
}

function v22UpdateSoundButton() {
  if (!soundToggleBtn) return;
  soundToggleBtn.textContent = v22SoundEnabled ? "🔊 Sons" : "🔇 Sons";
}

function v22RenderProgress(profile = currentProfile) {
  if (!profile) return;
  const badges = profile.badges || [];
  const title = badges[badges.length - 1] || "Nouveau joueur";
  if (v22Level) v22Level.textContent = profile.level || 1;
  if (v22XpText) v22XpText.textContent = `${profile.xp || 0} XP`;
  if (v22Title) v22Title.textContent = title;
  if (v22BadgeCount) v22BadgeCount.textContent = badges.length;
  if (v22BadgePreview) v22BadgePreview.textContent = badges.slice(-2).join(" • ") || "Aucun badge";
}

function v22BuildEndSummary() {
  const playerCount = players.length;
  const host = players.find(p => p.host)?.name || currentPlayer || "Host";
  const topLevel = [...players].sort((a,b) => (b.level || 1) - (a.level || 1))[0]?.name || "Aucun";
  const randomPlayer = players[Math.floor(Math.random() * Math.max(players.length, 1))]?.name || "À définir";
  return {
    stats: [
      ["👥 Joueurs", playerCount],
      ["🎮 Jeu final", selectedGame || "Aucun"],
      ["🍻 Mode", selectedPartyMode || "Chill"],
      ["👑 Host", host]
    ],
    awards: [
      ["MVP de la soirée", topLevel, "meilleur niveau présent dans la room"],
      ["Roi du chaos", randomPlayer, "désigné par PartyHub"],
      ["Jeu signature", selectedGame || "À définir", "dernier jeu sélectionné"],
      ["Room code légendaire", currentRoom || "----", "à garder pour les souvenirs"]
    ]
  };
}

async function v22ShowEndParty() {
  const summary = v22BuildEndSummary();
  if (endPartyStats) {
    endPartyStats.innerHTML = summary.stats.map(([label, value]) => `
      <div class="v22-end-stat"><span>${label}</span><strong>${value}</strong></div>
    `).join("");
  }
  if (endPartyAwards) {
    endPartyAwards.innerHTML = summary.awards.map(([title, value, desc]) => `
      <div class="v22-award"><b>${title}</b><strong>${value}</strong><small>${desc}</small></div>
    `).join("");
  }
  endPartyOverlay?.classList.remove("hidden");
  v22Sound("end");
  try {
    currentProfile = await updateProfileStats({ endScreensViewed: 1 }, "Bilan de soirée généré");
    currentProfile = await addProfileXP(35, "Bilan fin de soirée");
    renderProfile(currentProfile);
  } catch {}
}

function v22EndSummaryText() {
  const summary = v22BuildEndSummary();
  return ["🏁 Résumé PartyHub", ...summary.stats.map(([l,v]) => `${l} : ${v}`), "", ...summary.awards.map(([t,v]) => `${t} : ${v}`)].join("\\n");
}


function setupAvatarSelect() {
  if (avatarSelect) {
    avatarSelect.innerHTML = "";

    AVATARS.forEach(avatar => {
      const option = document.createElement("option");
      option.value = avatar;
      option.textContent = `${avatar} Avatar ${avatar}`;
      avatarSelect.appendChild(option);
    });
  }

  if (avatarEmojiGrid) {
    avatarEmojiGrid.remove();
  }
}

function avatarMarkup(profileOrPlayer = {}) {
  const customUrl = profileOrPlayer.avatarUrl || profileOrPlayer.avatarBase64;

  if (customUrl) {
    return `<img class="avatar-img" src="${customUrl}" alt="Avatar" />`;
  }

  return `<span class="avatar-emoji">${profileOrPlayer.avatar || "🍻"}</span>`;
}

function renderAvatarElement(element, profileOrPlayer = {}) {
  if (!element) return;
  element.innerHTML = avatarMarkup(profileOrPlayer);
}

function buildInviteLink(roomCode = currentRoom) {
  const url = new URL(window.location.href);
  url.hash = "";
  url.searchParams.set("room", roomCode || "");
  return url.toString();
}

function updateInviteTools() {
  if (!currentRoom) return;

  const inviteLink = buildInviteLink(currentRoom);

  if (inviteLinkInput) inviteLinkInput.value = inviteLink;

  if (roomQrImage) {
    roomQrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=12&data=${encodeURIComponent(inviteLink)}`;
  }
}

function applyRoomCodeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const code = normalizeRoomCode(params.get("room") || params.get("code") || "");

  if (code && roomCodeInput) {
    roomCodeInput.value = code.slice(0, ROOM_CODE_LENGTH);
  }
}

function renderProfile(profile = currentProfile) {
  currentProfile = profile;

  const xp = profile.xp || 0;
  const level = profile.level || 1;
  const rooms = (profile.stats?.roomsCreated || 0) + (profile.stats?.roomsJoined || 0);
  const xpPercent = Math.min(100, xp % 100);

  if (
    pseudoInput &&
    document.activeElement !== pseudoInput &&
    !pseudoInput.value
  ) {
    pseudoInput.value = profile.pseudo || "";
  }

  if (avatarSelect) avatarSelect.value = profile.avatar || AVATARS[0];

  renderAvatarElement(profileAvatarPreview, profile);

  if (profileNamePreview) {
    profileNamePreview.textContent = profile.pseudo || "Player";
  }

  if (profileXpBar) profileXpBar.style.width = `${xpPercent}%`;
  if (profileLevel) profileLevel.textContent = level;
  if (profileXp) profileXp.textContent = xp;
  if (profileRooms) profileRooms.textContent = rooms;

  if (profileBadges) {
    profileBadges.innerHTML = "";

    (profile.badges || ["Nouveau joueur"]).slice(0, 25).forEach(badge => {
      const span = document.createElement("span");
      span.textContent = badge;
      profileBadges.appendChild(span);
    });
  }

  if (lobbyProfileMini) {
    lobbyProfileMini.innerHTML =
      `<span class="mini-avatar">${avatarMarkup(profile)}</span> ` +
      `${profile.pseudo || "Player"} · Niv. ${level}`;
  }
}

async function bootProfile() {
  setupAvatarSelect();
  renderProfile(currentProfile);

  try {
    currentProfile = await loadProfile();

    if (profileSyncText) {
      profileSyncText.textContent = "Profil synchronisé avec Firebase ✅";
    }

    renderProfile(currentProfile);
  } catch (error) {
    console.warn("Erreur chargement profil :", error);

    if (profileSyncText) {
      profileSyncText.textContent = "Mode local, resync Firebase plus tard";
    }
  }
}

async function syncProfileFromForm() {
  const pseudo = normalizePseudo(pseudoInput.value || currentProfile.pseudo || "Player");
  const avatar = avatarSelect?.value || currentProfile.avatar || "🍻";
  const keepCustomAvatar =
    currentProfile.avatarType === "custom" &&
    (currentProfile.avatarBase64 || currentProfile.avatarUrl);

  currentProfile = await saveProfile({
    ...currentProfile,
    pseudo,
    avatar: keepCustomAvatar ? "📸" : avatar,
    avatarUrl: keepCustomAvatar ? (currentProfile.avatarBase64 || currentProfile.avatarUrl) : "",
    avatarBase64: keepCustomAvatar ? (currentProfile.avatarBase64 || currentProfile.avatarUrl) : "",
    avatarType: keepCustomAvatar ? "custom" : "emoji"
  });

  renderProfile(currentProfile);
  return currentProfile;
}

function showError(message) {
  if (errorMsg) errorMsg.textContent = message;
}

function clearError() {
  if (errorMsg) errorMsg.textContent = "";
}

function normalizeRoomCode(value) {
  return value.trim().toUpperCase();
}

function normalizePseudo(value) {
  return value.trim().replace(/\s+/g, " ").slice(0, 14);
}

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }

  return code;
}

async function generateUniqueRoomCode() {
  for (let attempt = 0; attempt < 20; attempt++) {
    const roomCode = generateRoomCode();
    const roomSnap = await getDoc(getRoomRef(roomCode));

    if (!roomSnap.exists()) return roomCode;
  }

  throw new Error("Impossible de générer un code unique.");
}

function validatePseudo() {
  const pseudo = normalizePseudo(pseudoInput.value || "");

  if (pseudo.length < 1) {
    showError("Entre un pseudo.");
    return null;
  }

  return pseudo;
}

function getRoomRef(roomCode) {
  return doc(db, "rooms", roomCode);
}

function activityWith(message, previous = []) {
  return [message, ...previous].slice(0, ACTIVITY_LIMIT);
}

function getGameIdFromLabel(label) {
  return Object.entries(GAME_CONFIG).find(([, game]) => game.label === label)?.[0] || DEFAULT_GAME_ID;
}

function refreshSelectedGameFromId(gameId) {
  selectedGameId = GAME_CONFIG[gameId] ? gameId : DEFAULT_GAME_ID;
  selectedGame = GAME_CONFIG[selectedGameId].label;
}

async function createOnlineRoom(roomCode, pseudo) {
  const roomRef = getRoomRef(roomCode);

  await setDoc(roomRef, {
    roomCode,
    hostName: pseudo,
    selectedGame,
    selectedGameId,
    selectedPartyMode,
    alcoholMode: alcoholMode.checked,
    drinkLevel: drinkLevel.value,
    gameDuration: gameDuration.value,
    autoRotation: autoRotation.checked,
    gameStarted: false,
    roomStatus: "lobby",
    screen: "lobby",
    activeGame: null,
    gameState: {},
    forceNavigation: { target: "lobby", at: Date.now() },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    players: [
      {
        name: pseudo,
        profileId: currentProfile.id,
        avatar: currentProfile.avatar || "🍻",
        avatarUrl: currentProfile.avatarBase64 || currentProfile.avatarUrl || "",
        avatarBase64: currentProfile.avatarBase64 || currentProfile.avatarUrl || "",
        level: currentProfile.level || 1,
        host: true,
        ready: true,
        online: true,
        lastSeen: Date.now(),
        joinedAt: Date.now()
      }
    ],
    activity: [
      `👑 ${pseudo} a créé la room ${roomCode}`,
      "🍺 PartyHub est prêt à lancer la soirée"
    ]
  });
}


async function createOnlineTvRoom(roomCode, hostName = "Écran TV") {
  const roomRef = getRoomRef(roomCode);

  await setDoc(roomRef, {
    roomCode,
    hostName,
    tvMode: true,
    tvHostOnly: true,
    selectedGame,
    selectedGameId,
    selectedPartyMode,
    alcoholMode: alcoholMode.checked,
    drinkLevel: drinkLevel.value,
    gameDuration: gameDuration.value,
    autoRotation: autoRotation.checked,
    gameStarted: false,
    roomStatus: "lobby",
    screen: "lobby",
    activeGame: null,
    gameState: {},
    forceNavigation: { target: "lobby", at: Date.now() },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    players: [],
    activeGame: null,
    roomStatus: "lobby",
    activity: [
      `📺 ${hostName} a créé une room écran TV ${roomCode}`,
      "📱 Les joueurs doivent rejoindre depuis leur téléphone"
    ]
  });
}

async function joinOnlineRoom(roomCode, pseudo) {
  const roomRef = getRoomRef(roomCode);
  const roomSnap = await getDoc(roomRef);

  if (!roomSnap.exists()) {
    showError("Cette room n’existe pas.");
    return false;
  }

  const roomData = roomSnap.data();
  const existingPlayers = roomData.players || [];

  if (existingPlayers.length >= MAX_PLAYERS) {
    showError("La room est pleine.");
    return false;
  }

  const alreadyExists = existingPlayers.some(
    player => player.name.toLowerCase() === pseudo.toLowerCase()
  );

  if (alreadyExists) {
    showError("Ce pseudo est déjà utilisé dans cette room.");
    return false;
  }

  await updateDoc(roomRef, {
    players: arrayUnion({
      name: pseudo,
      profileId: currentProfile.id,
      avatar: currentProfile.avatar || "🍻",
      avatarUrl: currentProfile.avatarBase64 || currentProfile.avatarUrl || "",
      avatarBase64: currentProfile.avatarBase64 || currentProfile.avatarUrl || "",
      level: currentProfile.level || 1,
      host: false,
      ready: true,
      online: true,
      lastSeen: Date.now(),
      joinedAt: Date.now()
    }),
    updatedAt: serverTimestamp(),
    activity: activityWith(`🍻 ${pseudo} a rejoint la room`, roomData.activity || [])
  });

  return true;
}

function startPresence(roomCode, pseudo) {
  stopPresence();

  const ping = async () => {
    if (!roomCode || !pseudo) return;

    try {
      const roomRef = getRoomRef(roomCode);

      await runTransaction(db, async transaction => {
        const snap = await transaction.get(roomRef);
        if (!snap.exists()) return;

        const data = snap.data();

        const nextPlayers = (data.players || []).map(player =>
          player.name === pseudo
            ? { ...player, online: true, lastSeen: Date.now() }
            : player
        );

        transaction.update(roomRef, {
          players: nextPlayers,
          updatedAt: serverTimestamp()
        });
      });
    } catch (error) {
      console.warn("Présence non synchronisée :", error);
    }
  };

  ping();
  presenceTimer = setInterval(ping, 15000);
}

function stopPresence() {
  if (presenceTimer) {
    clearInterval(presenceTimer);
    presenceTimer = null;
  }
}


function handleGlobalNavigation(data) {
  const nav = data.forceNavigation;
  if (!nav || !nav.target || !nav.at) return;
  if (Number(nav.at) <= lastForceNavigationAt) return;

  lastForceNavigationAt = Number(nav.at);
  localStorage.setItem("partyhubLastForceNavigationAt", String(lastForceNavigationAt));

  if (nav.target === "lobby") {
    isReturningToLobby = true;
    localStorage.removeItem("partyhubReturnLobby");
    homeScreen.classList.remove("active");
    lobbyScreen.classList.add("active");
    setTimeout(() => { isReturningToLobby = false; }, 900);
  }

  if (nav.target === "game" && nav.gameId && data.gameStarted) {
    goToSelectedGame(data.activeGame || { id: nav.gameId });
  }
}

function listenToRoom(roomCode) {
  if (unsubscribeRoom) unsubscribeRoom();

  const roomRef = getRoomRef(roomCode);

  unsubscribeRoom = onSnapshot(roomRef, snapshot => {
    if (!snapshot.exists()) {
      showError("La room a été supprimée.");
      resetToHome(false);
      return;
    }

    const data = snapshot.data();

    currentRoom = data.roomCode;
    refreshSelectedGameFromId(data.selectedGameId || getGameIdFromLabel(data.selectedGame));
    selectedPartyMode = data.selectedPartyMode || DEFAULT_MODE;
    players = data.players || [];
    isHost = players.some(player => player.name === currentPlayer && player.host);

    alcoholMode.checked = data.alcoholMode ?? true;
    drinkLevel.value = data.drinkLevel === "danger" ? "extreme" : (data.drinkLevel || "normal");
    gameDuration.value = data.gameDuration || "medium";
    autoRotation.checked = data.autoRotation ?? false;

    roomCodeDisplay.textContent = currentRoom;

    renderPlayers();
    updatePreview();
    renderActivity(data.activity || []);
    if ((data.activity || []).length > v22LastActivitySize) v22Sound('join');
    v22LastActivitySize = (data.activity || []).length;
    updateSyncStatus(data);
    syncSelectedCards();
    lockLobbyControlsForGuests();
    handleGlobalNavigation(data);

    localStorage.setItem(
      "partyhubGameData",
      JSON.stringify({
        roomCode: currentRoom,
        players,
        selectedGame,
        selectedGameId,
        selectedPartyMode,
        alcoholMode: alcoholMode.checked,
        drinkLevel: drinkLevel.value,
        gameDuration: gameDuration.value,
        autoRotation: autoRotation.checked,
        isHost,
        currentPlayer,
        currentProfileId: currentProfile?.id || localStorage.getItem("partyhubProfileId") || "",
        currentProfileName: currentProfile?.name || currentPlayer || ""
      })
    );

    if (data.gameStarted && !isReturningToLobby) {
      v22Sound('start');
      goToSelectedGame(data.activeGame);
    }
  }, error => {
    console.error("Erreur Firestore :", error);
    showError("Connexion à la room impossible. Vérifie ta connexion ou les règles Firebase.");
  });
}

function syncSelectedCards() {
  document.querySelectorAll(".game-card").forEach(card => {
    const gameId = card.dataset.game;
    const fallbackName = card.querySelector("strong")?.textContent;
    card.classList.toggle("selected", gameId === selectedGameId || fallbackName === selectedGame);
  });

  document.querySelectorAll(".mode-card").forEach(card => {
    const modeName = card.querySelector("strong").textContent;
    card.classList.toggle("selected", modeName === selectedPartyMode);
  });
}

function lockLobbyControlsForGuests() {
  const shouldLock = !isHost;

  document.querySelectorAll(".game-card").forEach(card => {
    card.classList.toggle("locked", shouldLock);
  });

  document.querySelectorAll(".mode-card").forEach(card => {
    card.classList.toggle("locked", shouldLock);
  });

  alcoholMode.disabled = shouldLock;
  drinkLevel.disabled = shouldLock;
  gameDuration.disabled = shouldLock;
  autoRotation.disabled = shouldLock;
  startGameBtn.disabled = shouldLock;
  addFakePlayerBtn.disabled = shouldLock;
  fakePlayerInput.disabled = shouldLock;
}

function renderActivity(activity) {
  activityList.innerHTML = "";

  activity.slice(0, ACTIVITY_LIMIT).forEach(item => {
    const li = document.createElement("li");
    li.textContent = item;
    activityList.appendChild(li);
  });
}

function openLobby(roomCode, pseudo, hostStatus) {
  currentRoom = roomCode;
  currentPlayer = pseudo;
  isHost = hostStatus;

  renderProfile(currentProfile);

  roomCodeDisplay.textContent = currentRoom;
  updateInviteTools();

  homeScreen.classList.remove("active");
  lobbyScreen.classList.add("active");

  startPresence(roomCode, pseudo);
  listenToRoom(roomCode);
}

function updateSyncStatus(data) {
  if (!syncStatus) return;

  const status = data.roomStatus === "in-game" ? "Partie lancée" : "Lobby synchronisé";

  const onlineCount = (data.players || []).filter(player => {
    return player.online !== false && (!player.lastSeen || Date.now() - player.lastSeen < 45000);
  }).length;

  syncStatus.textContent = `🟢 ${status} · ${onlineCount}/${(data.players || []).length} en ligne`;
}

function renderPlayers() {
  playersList.innerHTML = "";
  playerCount.textContent = `${players.length}/${MAX_PLAYERS}`;

  const now = Date.now();

  players.forEach(player => {
    const li = document.createElement("li");

    const left = document.createElement("span");
    left.className = "player-left";
    left.innerHTML =
      `${player.host ? '<span class="crown">👑</span>' : ""}` +
      `<span class="mini-avatar">${avatarMarkup(player)}</span>` +
      `<span>${player.name}${player.level ? ` · Nv.${player.level}` : ""}</span>`;

    const right = document.createElement("span");
    const isOnline = player.online !== false && (!player.lastSeen || now - player.lastSeen < 45000);

    right.className = `player-pill ${isOnline ? "online" : "offline"}`;
    right.textContent = player.host ? "Host" : isOnline ? "En ligne" : "Hors ligne";

    li.appendChild(left);
    li.appendChild(right);
    playersList.appendChild(li);
  });
}

function updatePreview() {
  partyModeText.textContent = selectedPartyMode;
  selectedGameText.textContent = selectedGame;
  modeText.textContent = alcoholMode.checked ? "Activé" : "Désactivé";
  drinkText.textContent = drinkLevel.options[drinkLevel.selectedIndex]?.text || "Normal";
  durationText.textContent = gameDuration.options[gameDuration.selectedIndex]?.text || "Moyenne";
  rotationText.textContent = autoRotation.checked ? "Activée" : "Désactivée";
}

async function updateRoomSettings(activityMessage = null) {
  if (!currentRoom || !isHost) return;

  try {
    const roomRef = getRoomRef(currentRoom);
    const roomSnap = await getDoc(roomRef);

    if (!roomSnap.exists()) return;

    const oldActivity = roomSnap.data().activity || [];

    await updateDoc(roomRef, {
      selectedGame,
      selectedGameId,
      selectedPartyMode,
      alcoholMode: alcoholMode.checked,
      drinkLevel: drinkLevel.value,
      gameDuration: gameDuration.value,
      autoRotation: autoRotation.checked,
      updatedAt: serverTimestamp(),
      activity: activityMessage
        ? activityWith(activityMessage, oldActivity)
        : oldActivity
    });
  } catch (error) {
    console.error("Erreur réglages room :", error);
    showError("Impossible de modifier la room pour le moment.");
  }
}

function goToSelectedGame(activeGame = null) {
  const activeGameId = activeGame?.id || selectedGameId;
  const game = GAME_CONFIG[activeGameId] || GAME_CONFIG[getGameIdFromLabel(selectedGame)];

  if (game?.url) {
    window.location.href = `${game.url}?room=${encodeURIComponent(currentRoom)}`;
    return;
  }

  alert("Ce mini-jeu arrive bientôt 😄");
}

function resetToHome(shouldUnsubscribe = true) {
  if (shouldUnsubscribe && unsubscribeRoom) unsubscribeRoom();

  stopPresence();

  lobbyScreen.classList.remove("active");
  homeScreen.classList.add("active");

  currentPlayer = "";
  currentRoom = "";
  isHost = false;
  refreshSelectedGameFromId(DEFAULT_GAME_ID);
  selectedPartyMode = DEFAULT_MODE;
  players = [];

  localStorage.removeItem("partyhubGameData");
  localStorage.removeItem("partyhubReturnLobby");

  if (qrInvitePanel) qrInvitePanel.hidden = true;
}

async function leaveCurrentRoom() {
  if (!currentRoom || !currentPlayer) {
    resetToHome();
    return;
  }

  const roomCode = currentRoom;
  const playerName = currentPlayer;
  const roomRef = getRoomRef(roomCode);

  try {
    const roomSnap = await getDoc(roomRef);

    if (roomSnap.exists()) {
      const roomData = roomSnap.data();
      const oldPlayers = roomData.players || [];
      const remainingPlayers = oldPlayers.filter(player => player.name !== playerName);

      if (remainingPlayers.length === 0) {
        await deleteDoc(roomRef);
      } else {
        const nextPlayers = remainingPlayers.map((player, index) => ({
          ...player,
          host: oldPlayers.find(old => old.name === playerName)?.host && index === 0 ? true : player.host
        }));

        if (!nextPlayers.some(player => player.host)) {
          nextPlayers[0].host = true;
        }

        await updateDoc(roomRef, {
          players: nextPlayers,
          hostName: nextPlayers.find(player => player.host)?.name || nextPlayers[0].name,
          updatedAt: serverTimestamp(),
          activity: activityWith(`👋 ${playerName} a quitté la room`, roomData.activity || [])
        });
      }
    }
  } catch (error) {
    console.error("Erreur sortie room :", error);
    showError("Tu as quitté l’interface, mais la mise à jour de la room a peut-être échoué.");
  } finally {
    resetToHome();
  }
}

createRoomBtn.addEventListener("click", async () => {
  clearError();

  const pseudo = validatePseudo();
  if (!pseudo) return;

  createRoomBtn.disabled = true;

  try {
    await syncProfileFromForm();

    const roomCode = await generateUniqueRoomCode();

    await createOnlineRoom(roomCode, pseudo);

    currentProfile = await updateProfileStats({ roomsCreated: 1 }, `Room ${roomCode} créée`);
    currentProfile = await addProfileXP(25, "Création de room");

    renderProfile(currentProfile);
    openLobby(roomCode, pseudo, true);
  } catch (error) {
    console.error("Erreur création room :", error);
    showError("Impossible de créer la room pour le moment.");
  } finally {
    createRoomBtn.disabled = false;
  }
});


if (createTvRoomBtn) {
  createTvRoomBtn.addEventListener("click", async () => {
    clearError();

    const pseudo = normalizePseudo(pseudoInput.value || "Écran TV") || "Écran TV";
    createTvRoomBtn.disabled = true;

    try {
      await syncProfileFromForm();

      const roomCode = await generateUniqueRoomCode();

      await createOnlineTvRoom(roomCode, pseudo);

      currentProfile = await updateProfileStats({ roomsCreated: 1, tvSessions: 1 }, `Room TV ${roomCode} créée`);
      currentProfile = await addProfileXP(30, "Création room écran TV");

      renderProfile(currentProfile);

      localStorage.setItem("partyhubTvRoomCode", roomCode);
      window.location.href = `tv.html?room=${encodeURIComponent(roomCode)}`;
    } catch (error) {
      console.error("Erreur création room TV :", error);
      showError("Impossible de créer la room écran TV pour le moment.");
    } finally {
      createTvRoomBtn.disabled = false;
    }
  });
}

joinRoomBtn.addEventListener("click", async () => {
  clearError();

  const pseudo = validatePseudo();
  if (!pseudo) return;

  const roomCode = normalizeRoomCode(roomCodeInput.value);
  roomCodeInput.value = roomCode;

  if (roomCode.length !== ROOM_CODE_LENGTH) {
    showError("Entre un code room de 4 caractères.");
    return;
  }

  joinRoomBtn.disabled = true;

  try {
    await syncProfileFromForm();

    const joined = await joinOnlineRoom(roomCode, pseudo);

    if (joined) {
      currentProfile = await updateProfileStats({ roomsJoined: 1 }, `Room ${roomCode} rejointe`);
      currentProfile = await addProfileXP(15, "Room rejointe");

      renderProfile(currentProfile);
      openLobby(roomCode, pseudo, false);
    }
  } catch (error) {
    console.error("Erreur rejoindre room :", error);
    showError("Impossible de rejoindre la room pour le moment.");
  } finally {
    joinRoomBtn.disabled = false;
  }
});

leaveBtn.addEventListener("click", leaveCurrentRoom);

copyCodeBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(currentRoom);
    copyCodeBtn.textContent = "Copié ✅";

    setTimeout(() => {
      copyCodeBtn.textContent = "Copier le code";
    }, 1400);
  } catch {
    alert(`Code room : ${currentRoom}`);
  }
});

copyInviteBtn?.addEventListener("click", async () => {
  const inviteLink = buildInviteLink(currentRoom);

  try {
    await navigator.clipboard.writeText(inviteLink);
    copyInviteBtn.textContent = "Lien copié ✅";

    setTimeout(() => {
      copyInviteBtn.textContent = "Lien invite";
    }, 1400);
  } catch {
    alert(inviteLink);
  }
});

toggleQrBtn?.addEventListener("click", () => {
  updateInviteTools();

  if (qrInvitePanel) {
    qrInvitePanel.hidden = !qrInvitePanel.hidden;
  }
});

inviteLinkInput?.addEventListener("click", () => inviteLinkInput.select());

addFakePlayerBtn.addEventListener("click", async () => {
  clearError();

  if (!isHost) {
    showError("Seul le host peut ajouter des joueurs test.");
    return;
  }

  const name = normalizePseudo(fakePlayerInput.value);
  fakePlayerInput.value = name;

  if (name.length < 2) return;

  if (players.length >= MAX_PLAYERS) {
    showError("La room est pleine.");
    return;
  }

  if (players.some(player => player.name.toLowerCase() === name.toLowerCase())) {
    showError("Ce pseudo existe déjà dans la room.");
    return;
  }

  try {
    const roomRef = getRoomRef(currentRoom);
    const roomSnap = await getDoc(roomRef);
    const oldActivity = roomSnap.exists() ? roomSnap.data().activity || [] : [];

    await updateDoc(roomRef, {
      players: arrayUnion({
        name,
        host: false,
        ready: true,
        online: true,
        lastSeen: Date.now(),
        fake: true,
        joinedAt: Date.now()
      }),
      updatedAt: serverTimestamp(),
      activity: activityWith(`🧪 ${name} a été ajouté en test`, oldActivity)
    });

    fakePlayerInput.value = "";
  } catch (error) {
    console.error("Erreur ajout joueur test :", error);
    showError("Impossible d’ajouter ce joueur test.");
  }
});

document.querySelectorAll(".game-card").forEach(card => {
  card.addEventListener("click", async () => {
    clearError();

    if (!isHost) {
      showError("Seul le host peut changer de mini-jeu.");
      return;
    }

    const gameId =
      card.dataset.game ||
      getGameIdFromLabel(card.querySelector("strong").textContent);

    refreshSelectedGameFromId(gameId);

    syncSelectedCards();
    updatePreview();

    await updateRoomSettings(`🎮 Mini-jeu sélectionné : ${selectedGame}`);
  });
});

document.querySelectorAll(".mode-card").forEach(card => {
  card.addEventListener("click", async () => {
    clearError();

    if (!isHost) {
      showError("Seul le host peut changer le mode.");
      return;
    }

    selectedPartyMode = card.querySelector("strong").textContent;

    syncSelectedCards();
    updatePreview();

    await updateRoomSettings(`🔥 Mode soirée activé : ${selectedPartyMode}`);
  });
});

alcoholMode.addEventListener("change", async () => {
  if (!isHost) return;

  updatePreview();

  await updateRoomSettings(
    alcoholMode.checked ? "🍺 Mode alcool activé" : "😇 Mode alcool désactivé"
  );
});

drinkLevel.addEventListener("change", async () => {
  if (!isHost) return;

  updatePreview();

  await updateRoomSettings(
    `🍻 Niveau alcool : ${drinkLevel.options[drinkLevel.selectedIndex].text}`
  );
});

gameDuration.addEventListener("change", async () => {
  if (!isHost) return;

  updatePreview();

  await updateRoomSettings(
    `⏱️ Durée choisie : ${gameDuration.options[gameDuration.selectedIndex].text}`
  );
});

autoRotation.addEventListener("change", async () => {
  if (!isHost) return;

  updatePreview();

  await updateRoomSettings(
    autoRotation.checked
      ? "🔁 Rotation automatique activée"
      : "⏸️ Rotation automatique désactivée"
  );
});

startGameBtn.addEventListener("click", async () => {
  clearError();

  if (!isHost) {
    showError("Seul le host peut lancer la soirée.");
    return;
  }

  startGameBtn.disabled = true;

  try {
    const roomRef = getRoomRef(currentRoom);

    const v22GameStats = { gamesStarted: 1, partiesPlayed: 1 };
    if (selectedGameId === "casino-night") v22GameStats.casinoGames = 1;
    if (selectedGameId === "monopolit") v22GameStats.monopolyGames = 1;

    currentProfile = await updateProfileStats(
      v22GameStats,
      `Partie lancée : ${selectedGame}`
    );

    currentProfile = await addProfileXP(40, `Partie lancée : ${selectedGame}`);

    renderProfile(currentProfile);

    await updateDoc(roomRef, {
      gameStarted: true,
      roomStatus: "in-game",
      screen: "game",
      activeGame: {
        id: selectedGameId,
        label: selectedGame,
        url: (GAME_CONFIG[selectedGameId] || {}).url || "",
        startedAt: Date.now(),
        hostName: currentPlayer
      },
      gameState: {
        round: 1,
        updatedBy: currentPlayer,
        updatedAt: Date.now()
      },
      forceNavigation: {
        target: "game",
        gameId: selectedGameId,
        at: Date.now()
      },
      updatedAt: serverTimestamp(),
      activity: [`🚀 La soirée est lancée : ${selectedGame}`, ...activityListItems()].slice(0, ACTIVITY_LIMIT)
    });
  } catch (error) {
    console.error("Erreur lancement partie :", error);
    showError("Impossible de lancer la soirée pour le moment.");
    startGameBtn.disabled = false;
  }
});

function activityListItems() {
  return Array.from(activityList.children).map(li => li.textContent);
}

async function restoreLobbyFromGame() {
  const shouldReturnLobby = localStorage.getItem("partyhubReturnLobby");

  if (shouldReturnLobby !== "true") return;

  isReturningToLobby = true;

  const savedGameData = JSON.parse(localStorage.getItem("partyhubGameData"));

  if (!savedGameData) {
    localStorage.removeItem("partyhubReturnLobby");
    isReturningToLobby = false;
    return;
  }

  currentRoom = savedGameData.roomCode || "";
  currentPlayer = savedGameData.currentPlayer || "";
  isHost = savedGameData.isHost || false;

  refreshSelectedGameFromId(
    savedGameData.selectedGameId ||
    getGameIdFromLabel(savedGameData.selectedGame)
  );

  homeScreen.classList.remove("active");
  lobbyScreen.classList.add("active");

  if (currentRoom) {
    const roomRef = getRoomRef(currentRoom);

    try {
      await updateDoc(roomRef, {
        gameStarted: false,
        roomStatus: "lobby",
        screen: "lobby",
        activeGame: null,
        gameState: {},
        forceNavigation: { target: "lobby", at: Date.now() },
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Erreur retour lobby :", error);
      showError("Retour lobby effectué, mais la room n’a pas pu être synchronisée.");
    }

    listenToRoom(currentRoom);
  }

  localStorage.removeItem("partyhubReturnLobby");

  setTimeout(() => {
    isReturningToLobby = false;
  }, 1500);
}


if (openTvBtn) {
  openTvBtn.addEventListener("click", async () => {
    if (!currentRoom) return;
    const url = `tv.html?room=${encodeURIComponent(currentRoom)}`;
    window.open(url, "_blank");
    v22Sound("start");
    try {
      currentProfile = await updateProfileStats({ tvSessions: 1 }, "Mode TV ouvert");
      currentProfile = await addProfileXP(20, "Mode TV central");
      renderProfile(currentProfile);
    } catch {}
  });
}

if (soundToggleBtn) {
  soundToggleBtn.addEventListener("click", () => {
    v22SoundEnabled = !v22SoundEnabled;
    localStorage.setItem("partyhubSoundEnabled", String(v22SoundEnabled));
    v22UpdateSoundButton();
    v22Sound("click");
  });
}

if (endPartyBtn) endPartyBtn.addEventListener("click", v22ShowEndParty);
if (closeEndPartyBtn) closeEndPartyBtn.addEventListener("click", () => endPartyOverlay?.classList.add("hidden"));
if (copyEndSummaryBtn) {
  copyEndSummaryBtn.addEventListener("click", async () => {
    await navigator.clipboard?.writeText(v22EndSummaryText());
    copyEndSummaryBtn.textContent = "Résumé copié ✅";
    setTimeout(() => copyEndSummaryBtn.textContent = "Copier le résumé", 1500);
  });
}

v22UpdateSoundButton();

window.addEventListener("beforeunload", () => {
  stopPresence();
});

bootProfile();

if (pseudoInput) {
  pseudoInput.addEventListener("input", () => {
    const typedPseudo = pseudoInput.value
      .replace(/\s+/g, " ")
      .slice(0, 14);

    currentProfile = {
      ...currentProfile,
      pseudo: typedPseudo
    };

    if (profileNamePreview) {
      profileNamePreview.textContent = typedPseudo || "Player";
    }

    if (lobbyProfileMini) {
      lobbyProfileMini.innerHTML =
        `<span class="mini-avatar">${avatarMarkup(currentProfile)}</span> ` +
        `${typedPseudo || "Player"} · Niv. ${currentProfile.level || 1}`;
    }

    clearError();
  });
}

if (avatarSelect) {
  avatarSelect.addEventListener("change", async () => {
    currentProfile = await saveProfile({
      ...currentProfile,
      avatar: avatarSelect.value,
      avatarUrl: "",
      avatarBase64: "",
      avatarType: "emoji"
    });

    renderProfile(currentProfile);
  });
}

if (avatarUploadBtn && avatarFileInput) {
  avatarUploadBtn.addEventListener("click", event => {
    event.preventDefault();
    avatarFileInput.click();
  });

  avatarUploadBtn.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      avatarFileInput.click();
    }
  });
}

avatarFileInput?.addEventListener("change", async () => {
  const file = avatarFileInput.files?.[0];
  if (!file) return;

  try {
    avatarUploadBtn?.classList.add("is-loading");

    if (avatarUploadBtn) {
      avatarUploadBtn.textContent = "Traitement...";
    }

    currentProfile = await saveCustomAvatar(file);

    renderProfile(currentProfile);
    clearError();

    if (profileSyncText) {
      profileSyncText.textContent = "Photo sauvegardée sans Storage ✅";
    }
  } catch (error) {
    showError(error.message || "Impossible d’importer cette photo.");
  } finally {
    avatarUploadBtn?.classList.remove("is-loading");

    if (avatarUploadBtn) {
      avatarUploadBtn.textContent = "Photo";
    }

    avatarFileInput.value = "";
  }
});

applyRoomCodeFromUrl();
restoreLobbyFromGame();