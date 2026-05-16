
// V25 PartyHub sync: retour lobby global depuis ce jeu non-module.
async function partyhubV25ReturnEveryoneToLobby(roomCode) {
  if (!roomCode || roomCode === "----") return;
  try {
    const mod = await import("../../firebase.js");
    const roomRef = mod.doc(mod.db, "rooms", roomCode);
    await mod.updateDoc(roomRef, {
      gameStarted: false,
      roomStatus: "lobby",
      screen: "lobby",
      activeGame: null,
      gameState: {},
      forceNavigation: { target: "lobby", at: Date.now() },
      updatedAt: mod.serverTimestamp()
    });
  } catch (error) {
    console.warn("V25 retour lobby global non synchronisé :", error);
  }
}

function partyhubV25ListenLobbyNavigation(roomCode) {
  if (!roomCode || roomCode === "----") return;
  import("../../firebase.js").then((mod) => {
    const roomRef = mod.doc(mod.db, "rooms", roomCode);
    mod.onSnapshot(roomRef, (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.data();
      if (data.gameStarted === false || data.forceNavigation?.target === "lobby") {
        localStorage.setItem("partyhubReturnLobby", "true");
    partyhubV25ReturnEveryoneToLobby(roomCode);
        window.location.href = `../../index.html?room=${encodeURIComponent(roomCode)}`;
      }
    });
  }).catch(() => {});
}

const COLORS = ["#fb2f74", "#38bdf8", "#34d399", "#fbbf24", "#a78bfa", "#f87171"];
const RANDOM_NAMES = ["Maya", "Nino", "Lina", "Ethan", "Sacha", "Zoé", "Noah", "Jade", "Léo", "Inès"];
const partyhubSavedData = (() => {
  try { return JSON.parse(localStorage.getItem("partyhubGameData") || "{}"); } catch { return {}; }
})();
const partyhubRoomCode = new URLSearchParams(window.location.search).get("room") || partyhubSavedData.roomCode || "";
const partyhubCurrentPlayer = partyhubSavedData.currentPlayer || "";
let partyhubRoomRef = null;
let partyhubFirebase = null;
let partyhubApplyingRemote = false;
let partyhubStateReady = false;

async function partyhubInitMonopolySync() {
  if (!partyhubRoomCode) return;
  try {
    partyhubFirebase = await import("../../firebase.js");
    partyhubRoomRef = partyhubFirebase.doc(partyhubFirebase.db, "rooms", partyhubRoomCode);
    const snap = await partyhubFirebase.getDoc(partyhubRoomRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data.monopolitState?.players?.length) {
        partyhubApplyingRemote = true;
        state = data.monopolitState;
        setupPanel.classList.add("hidden");
        gamePanel.classList.remove("hidden");
        buildBoard();
        render();
        partyhubApplyingRemote = false;
      } else {
        const roomPlayers = data.players || partyhubSavedData.players || [];
        if (roomPlayers.length >= 2) startGameFromPartyHubPlayers(roomPlayers);
      }
    }
    partyhubFirebase.onSnapshot(partyhubRoomRef, (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.data();
      if (data.gameStarted === false || data.forceNavigation?.target === "lobby") {
        localStorage.setItem("partyhubReturnLobby", "true");
        window.location.href = `../../index.html?room=${encodeURIComponent(partyhubRoomCode)}`;
        return;
      }
      if (!data.monopolitState?.players?.length) return;
      partyhubApplyingRemote = true;
      state = data.monopolitState;
      setupPanel.classList.add("hidden");
      gamePanel.classList.remove("hidden");
      buildBoard();
      render();
      partyhubApplyingRemote = false;
    });
  } catch (e) { console.warn("V27 Monopoly sync off", e); }
}

async function publishMonopolyState() {
  if (!partyhubRoomRef || !partyhubFirebase || partyhubApplyingRemote) return;
  try {
    await partyhubFirebase.updateDoc(partyhubRoomRef, {
      monopolitState: state,
      gameState: {
        gameId: "monopolit",
        currentPlayerName: state.players[state.current]?.name || "-",
        round: state.round,
        events: state.events,
        updatedAt: Date.now()
      }
    });
  } catch (e) { console.warn("V27 publish Monopoly state failed", e); }
}

function startGameFromPartyHubPlayers(roomPlayers) {
  state.players = roomPlayers.slice(0, 8).map((player, i) => ({
    name: player.name || player.pseudo || `Joueur ${i + 1}`,
    position: 0, coins: 15, shield: 0, color: COLORS[i % COLORS.length], skip: false
  }));
  state.current = 0;
  state.round = 1;
  state.maxRounds = 15;
  state.intensity = "hard";
  state.events = 0;
  tiles.forEach(tile => tile.owner = null);
  setupPanel.classList.add("hidden");
  gamePanel.classList.remove("hidden");
  buildBoard();
  render();
  addLog("La partie commence avec les joueurs PartyHub.");
  publishMonopolyState();
}


const tiles = [
  { name: "Départ", type: "start", color: "#34d399" },
  { name: "Bar Neon", type: "property", price: 3, rent: 1, color: "#fb2f74" },
  { name: "Carte Chance", type: "chance", color: "#38bdf8" },
  { name: "Taxe soirée", type: "tax", color: "#f87171" },
  { name: "Karaoké Shot", type: "challenge", color: "#a78bfa" },
  { name: "Snack", type: "bonus", color: "#34d399" },
  { name: "Club Luna", type: "property", price: 4, rent: 2, color: "#fb2f74" },
  { name: "Prison chill", type: "jail", color: "#64748b" },
  { name: "Rooftop", type: "property", price: 5, rent: 2, color: "#fbbf24" },
  { name: "Duel", type: "duel", color: "#ef4444" },
  { name: "Mystère", type: "chance", color: "#38bdf8" },
  { name: "After", type: "property", price: 6, rent: 3, color: "#fbbf24" },
  { name: "Pause Bonus", type: "bonus", color: "#34d399" },
  { name: "Punition", type: "truth", color: "#8b5cf6" },
  { name: "Casino", type: "casino", color: "#f59e0b" },
  { name: "Boîte Mirage", type: "property", price: 7, rent: 3, color: "#06b6d4" },
  { name: "Social", type: "social", color: "#ec4899" },
  { name: "Défi alcool", type: "challenge", color: "#a78bfa" },
  { name: "Taxi", type: "move", color: "#38bdf8" },
  { name: "Pub Royal", type: "property", price: 8, rent: 4, color: "#06b6d4" },
  { name: "Carte Chaos", type: "chance", color: "#ef4444" },
  { name: "Repos", type: "bonus", color: "#34d399" },
  { name: "Duel final", type: "duel", color: "#ef4444" },
  { name: "Penthouse", type: "property", price: 10, rent: 5, color: "#fbbf24" },
  { name: "Impôt fun", type: "tax", color: "#f87171" },
  { name: "Défi shot", type: "challenge", color: "#a78bfa" },
  { name: "Carte Chance", type: "chance", color: "#38bdf8" },
  { name: "VIP Club", type: "property", price: 12, rent: 6, color: "#fb2f74" }
];

const chanceCards = [
  "Distribue 5 gorgées à qui tu veux.",
  "Choisis quelqu’un : il boit 2 gorgées avec toi.",
  "Tout le monde boit 1 gorgée.",
  "Tu gagnes 2 jetons grâce à une tournée offerte.",
  "Avance de 3 cases et applique la nouvelle case.",
  "Tu peux annuler ta prochaine sanction. +1 bouclier.",
  "Échange ta position avec le joueur de ton choix.",
  "Roi de soirée : distribue 8 gorgées.",
  "La personne à ta gauche boit 3 gorgées.",
  "Reverse : la prochaine sanction que tu prends est envoyée à quelqu’un d’autre."
];

const challenges = [
  "Cul sec de ton verre actuel.",
  "Boire 3 shots d’affilée.",
  "Boire un verre entier en moins de 30 secondes.",
  "Faire un mélange dégueu créé par les autres et le boire.",
  "Boire à l’envers, ou boire 4 gorgées si impossible.",
  "Choisir quelqu’un qui boit avec toi : double peine.",
  "Boire 2 gorgées pour chaque personne qui a déjà couché avec quelqu’un dans la pièce.",
  "Finir la bouteille ouverte, ou boire 5 gorgées si c’est abusé.",
  "Boire sans utiliser les mains.",
  "Chanter une chanson entière en buvant à chaque refrain.",
  "Danser sexy pendant 1 minute en buvant toutes les 10 secondes.",
  "Faire 10 pompes puis boire 1 shot.",
  "Imitation d’un animal en buvant à chaque bruit.",
  "Parler avec l’accent le plus pourri pendant 3 tours. À chaque phrase normale : 1 gorgée.",
  "Dire un compliment à tout le monde en buvant entre chaque personne.",
  "Boire un shot à chaque fois que tu dis « euh » pendant 2 minutes.",
  "Faire un mini show version soft puis boire 3 gorgées.",
  "Boire cul sec après avoir fait 20 jumping jacks.",
  "Choisir 3 personnes qui doivent boire avec toi.",
  "Boire tout ce qui reste dans le verre de la personne à ta gauche.",
  "Shot de la boisson la plus chaude ou épicée disponible.",
  "Boire en faisant la roue, ou boire 5 gorgées si impossible.",
  "Prendre un shot les yeux bandés.",
  "Boire un verre en une seule gorgée sans respirer.",
  "Faire un bisou à la bouteille avant de boire.",
  "Boire à chaque fois que quelqu’un rit pendant 3 minutes.",
  "Changer de boisson avec la personne en face.",
  "Boire 4 gorgées en tournant sur toi-même.",
  "Cul sec + crier « JE SUIS UNE LÉGENDE » après.",
  "Boire en position de planche pendant 20 secondes.",
  "Boire tout en racontant ton pire râteau.",
  "Prendre un shot à chaque fois que tu touches ton téléphone pendant 10 minutes.",
  "Boire un mélange bière + vin + shot.",
  "Faire la statue en buvant toutes les 15 secondes.",
  "Boire cul sec après avoir embrassé 3 personnes sur la joue.",
  "Choisir la personne qui boit le plus mal et lui faire boire 2 shots.",
  "Boire en mode avion : quelqu’un te fait boire.",
  "Finir ton verre + en commencer un nouveau direct.",
  "Tout le monde vote : le perdant boit 2 shots.",
  "La personne à droite choisit ta sanction alcool."
];

const penalties = {
  soft: { unit: "gorgée", tax: 1, rent: 1, jail: 1, social: "tout le monde boit 1 gorgée" },
  classic: { unit: "gorgées", tax: 3, rent: 2, jail: 4, social: "tout le monde boit 2 gorgées" },
  hard: { unit: "gorgées", tax: 5, rent: 3, jail: 6, social: "tout le monde boit 3 gorgées" }
};

let state = {
  players: [],
  current: 0,
  round: 1,
  maxRounds: 15,
  intensity: "classic",
  events: 0,
  canRoll: true
};

const setupPanel = document.getElementById("setupPanel");
const gamePanel = document.getElementById("gamePanel");
const playerCount = document.getElementById("playerCount");
const nameList = document.getElementById("nameList");
const board = document.getElementById("board");
const playersList = document.getElementById("playersList");
const currentPlayerName = document.getElementById("currentPlayerName");
const dice = document.getElementById("dice");
const rollBtn = document.getElementById("rollBtn");
const actionTitle = document.getElementById("actionTitle");
const actionText = document.getElementById("actionText");
const actionButtons = document.getElementById("actionButtons");
const logBox = document.getElementById("log");
const roundInfo = document.getElementById("roundInfo");
const ownedCount = document.getElementById("ownedCount");
const eventCount = document.getElementById("eventCount");
const modal = document.getElementById("cardModal");
const modalType = document.getElementById("modalType");
const modalTitle = document.getElementById("modalTitle");
const modalText = document.getElementById("modalText");



function setupReturnToPartyHubRoom() {
  const btn = document.getElementById("backPartyHubRoom");
  if (!btn) return;

  const params = new URLSearchParams(window.location.search);

  const savedGameData = (() => {
    try { return JSON.parse(localStorage.getItem("partyhubGameData") || "{}"); }
    catch { return {}; }
  })();

  const roomCode =
    params.get("room") ||
    params.get("code") ||
    savedGameData.roomCode ||
    localStorage.getItem("partyhubRoomCode") ||
    localStorage.getItem("partyhubRoomId") ||
    "";

  btn.href = roomCode
    ? `../../index.html?room=${encodeURIComponent(roomCode)}`
    : "../../index.html";

  btn.addEventListener("click", () => {
    localStorage.setItem("partyhubReturnLobby", "true");
    partyhubV25ReturnEveryoneToLobby(roomCode);

    if (roomCode) {
      partyhubV25ListenLobbyNavigation(roomCode);
      savedGameData.roomCode = roomCode;
      localStorage.setItem("partyhubGameData", JSON.stringify(savedGameData));
    }
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function diceFace(value) {
  return ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"][value] || value;
}

function buildNameInputs() {
  const count = Number(playerCount.value);
  nameList.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const label = document.createElement("label");
    label.innerHTML = `Joueur ${i + 1}<input value="Joueur ${i + 1}" maxlength="14" />`;
    nameList.appendChild(label);
  }
}

function randomizeNames() {
  [...nameList.querySelectorAll("input")].forEach((input, index) => {
    input.value = RANDOM_NAMES[(index + Math.floor(Math.random() * RANDOM_NAMES.length)) % RANDOM_NAMES.length];
  });
}

function startGame() {
  const inputs = [...nameList.querySelectorAll("input")];
  state.players = inputs.map((input, i) => ({
    name: input.value.trim() || `Joueur ${i + 1}`,
    position: 0,
    coins: 15,
    shield: 0,
    color: COLORS[i],
    skip: false
  }));
  state.current = 0;
  state.round = 1;
  state.maxRounds = Number(document.getElementById("maxRounds").value);
  state.intensity = document.getElementById("intensity").value;
  state.events = 0;
  tiles.forEach(tile => tile.owner = null);
  setupPanel.classList.add("hidden");
  gamePanel.classList.remove("hidden");
  buildBoard();
  render();
  addLog("La partie commence.");
}

function boardPathPositions() {
  const pos = [];
  for (let c = 1; c <= 8; c++) pos.push([8, c]);
  for (let r = 7; r >= 1; r--) pos.push([r, 8]);
  for (let c = 7; c >= 1; c--) pos.push([1, c]);
  for (let r = 2; r <= 7; r++) pos.push([r, 1]);
  return pos;
}

function buildBoard() {
  const path = boardPathPositions();
  board.innerHTML = "";
  for (let r = 1; r <= 8; r++) {
    for (let c = 1; c <= 8; c++) {
      const index = path.findIndex(([rr, cc]) => rr === r && cc === c);
      const cell = document.createElement("div");
      if (index === -1 || !tiles[index]) {
        cell.className = "tile empty";
      } else {
        const tile = tiles[index];
        cell.className = "tile";
        cell.style.setProperty("--tile-color", tile.color);
        cell.dataset.index = index;
        cell.innerHTML = `
          <div class="tile-type">${tile.type}</div>
          <div class="tile-title">${tile.name}</div>
          <div class="tile-owner" data-owner></div>
          <div class="pawns"></div>
        `;
      }
      board.appendChild(cell);
    }
  }
}

function render() {
  const p = state.players[state.current];
  currentPlayerName.textContent = p.name;
  roundInfo.textContent = state.maxRounds === 999 ? `Tour ${state.round}` : `Tour ${state.round}/${state.maxRounds}`;
  playersList.innerHTML = state.players.map((player, i) => `
    <div class="player-card ${i === state.current ? "active" : ""}">
      <div class="player-top"><span class="player-name">${player.name}</span><span class="badge">${player.coins} jetons</span></div>
      <div class="player-meta"><span>Case ${player.position + 1}</span><span>Bouclier ${player.shield}</span><span>Biens ${tiles.filter(t => t.owner === i).length}</span></div>
    </div>`).join("");

  document.querySelectorAll(".pawns").forEach(el => el.innerHTML = "");
  document.querySelectorAll("[data-owner]").forEach(el => el.textContent = "");
  tiles.forEach((tile, i) => {
    const cell = document.querySelector(`.tile[data-index="${i}"]`);
    if (!cell) return;
    const owner = cell.querySelector("[data-owner]");
    if (tile.owner !== null && tile.owner !== undefined) owner.textContent = `Proprio: ${state.players[tile.owner].name}`;
  });
  state.players.forEach((player) => {
    const cell = document.querySelector(`.tile[data-index="${player.position}"] .pawns`);
    if (cell) {
      const pawn = document.createElement("span");
      pawn.className = "pawn";
      pawn.style.background = player.color;
      cell.appendChild(pawn);
    }
  });
  ownedCount.textContent = `${tiles.filter(t => t.owner !== null && t.owner !== undefined).length} lieux achetés`;
  eventCount.textContent = `${state.events} événements`;
  publishMonopolyState();
}

async function rollDice() {
  if (!state.canRoll) return;

  const player = state.players[state.current];
  const isMyTurn = !partyhubCurrentPlayer || player.name === partyhubCurrentPlayer || partyhubSavedData.isHost;
  if (!isMyTurn) {
    addLog(`C'est le tour de ${player.name}.`);
    return;
  }

  if (player.skip) {
    player.skip = false;
    addLog(`${player.name} passe son tour.`);
    nextTurn();
    return;
  }

  state.canRoll = false;
  rollBtn.disabled = true;
  dice.classList.add("rolling");

  for (let i = 0; i < 16; i++) {
    const fakeRoll = Math.floor(Math.random() * 6) + 1;
    dice.textContent = diceFace(fakeRoll);
    await sleep(65 + i * 4);
  }

  const roll = Math.floor(Math.random() * 6) + 1;

  dice.textContent = diceFace(roll);
  dice.classList.remove("rolling");
  dice.classList.add("dice-final");

  setTimeout(() => dice.classList.remove("dice-final"), 650);

  addLog(`${player.name} lance le dé : ${roll}.`);

  rollBtn.disabled = false;
  movePlayer(roll);
}

function movePlayer(steps) {
  const player = state.players[state.current];
  const old = player.position;
  player.position = (player.position + steps) % tiles.length;
  if (player.position < old) {
    player.coins += 4;
    addLog(`${player.name} passe par Départ et gagne 4 jetons.`);
  }
  render();
  handleTile();
}

function handleTile() {
  const player = state.players[state.current];
  const tile = tiles[player.position];
  const rule = penalties[state.intensity];
  actionButtons.innerHTML = "";
  state.events++;

  if (tile.type === "property") {
    if (tile.owner === null || tile.owner === undefined) {
      setAction(tile.name, `${player.name} peut acheter ce lieu pour ${tile.price} jetons. Loyer: ${tile.rent} ${rule.unit}.`);
      addButton("Acheter", () => buyTile(tile));
      addButton("Passer", nextTurn, "ghost");
    } else if (tile.owner !== state.current) {
      const owner = state.players[tile.owner];
      const amount = tile.rent * rule.rent;
      applyPenalty(player, `${amount} ${rule.unit}`);
      owner.coins += 1;
      setAction(tile.name, `${player.name} tombe chez ${owner.name}. Sanction: ${amount} ${rule.unit}. ${owner.name} gagne 1 jeton.`);
      addButton("Continuer", nextTurn);
    } else {
      player.coins += 1;
      setAction(tile.name, `${player.name} est chez lui et gagne 1 jeton.`);
      addButton("Continuer", nextTurn);
    }
  } else if (tile.type === "chance") {
    const card = pick(chanceCards);
    showModal("Carte Chance", tile.name, card);
    resolveChance(card);
    setAction(tile.name, card);
    addButton("Continuer", nextTurn);
  } else if (tile.type === "tax") {
    applyPenalty(player, `${rule.tax} ${rule.unit}`);
    setAction(tile.name, `${player.name} prend une taxe de ${rule.tax} ${rule.unit}.`);
    addButton("Continuer", nextTurn);
  } else if (tile.type === "jail") {
    applyPenalty(player, `${rule.jail} ${rule.unit}`);
    player.skip = true;
    setAction(tile.name, `${player.name} va en Prison Chill : ${rule.jail} ${rule.unit} et passe le prochain tour.`);
    addButton("Continuer", nextTurn);
  } else if (tile.type === "bonus") {
    player.shield += 1;
    player.coins += 2;
    setAction(tile.name, `${player.name} gagne 2 jetons et 1 bouclier.`);
    addButton("Continuer", nextTurn);
  } else if (tile.type === "duel") {
    const target = nextPlayerIndex();
    setAction(tile.name, `${player.name} défie ${state.players[target].name}. Perdant: 2 ${rule.unit}.`);
    addButton(`${player.name} perd`, () => { applyPenalty(player, `2 ${rule.unit}`); nextTurn(); }, "warning");
    addButton(`${state.players[target].name} perd`, () => { applyPenalty(state.players[target], `2 ${rule.unit}`); nextTurn(); }, "warning");
  } else if (tile.type === "social") {
    setAction(tile.name, rule.social);
    addLog(`Social: ${rule.social}.`);
    addButton("Continuer", nextTurn);
  } else if (tile.type === "challenge" || tile.type === "truth") {
    const challenge = pick(challenges);
    showModal("Punition alcool", tile.name, challenge);
    setAction(tile.name, challenge);
    addButton("Défi réussi +1 jeton", () => { player.coins += 1; nextTurn(); });
    addButton("Refus / échec", () => { applyPenalty(player, `3 ${rule.unit}`); nextTurn(); }, "warning");
  } else if (tile.type === "casino") {
    setAction(tile.name, "Mise 2 jetons : pile tu gagnes 5, face tu perds ta mise.");
    addButton("Jouer", () => casino(player));
    addButton("Ne pas jouer", nextTurn, "ghost");
  } else if (tile.type === "move") {
    setAction(tile.name, `${player.name} prend le taxi et avance de 2 cases.`);
    addButton("Avancer", () => { player.position = (player.position + 2) % tiles.length; render(); handleTile(); });
  } else {
    setAction(tile.name, `${player.name} arrive au départ.`);
    addButton("Continuer", nextTurn);
  }
  render();
}

function buyTile(tile) {
  const player = state.players[state.current];
  if (player.coins >= tile.price) {
    player.coins -= tile.price;
    tile.owner = state.current;
    addLog(`${player.name} achète ${tile.name}.`);
  } else {
    addLog(`${player.name} n'a pas assez de jetons pour acheter ${tile.name}.`);
  }
  nextTurn();
}

function casino(player) {
  if (player.coins < 2) {
    addLog(`${player.name} n'a pas assez de jetons pour jouer au casino.`);
    nextTurn();
    return;
  }
  player.coins -= 2;
  if (Math.random() > 0.5) {
    player.coins += 5;
    setAction("Casino", `${player.name} gagne ! +3 jetons net.`);
    addLog(`${player.name} gagne au casino.`);
  } else {
    setAction("Casino", `${player.name} perd sa mise.`);
    addLog(`${player.name} perd au casino.`);
  }
  addButton("Continuer", nextTurn);
  render();
}

function resolveChance(card) {
  const player = state.players[state.current];
  if (card.includes("gagnes 2")) player.coins += 2;
  if (card.includes("bouclier")) player.shield += 1;
  if (card.includes("Avance de 3")) player.position = (player.position + 3) % tiles.length;
  addLog(`${player.name} pioche: ${card}`);
}

function applyPenalty(player, text) {
  if (player.shield > 0) {
    player.shield -= 1;
    addLog(`${player.name} utilise un bouclier et annule: ${text}.`);
    return;
  }
  addLog(`${player.name} reçoit: ${text}.`);
}

function setAction(title, text) {
  actionTitle.textContent = title;
  actionText.textContent = text;
}

function addButton(label, handler, variant = "primary") {
  const btn = document.createElement("button");
  btn.className = `btn ${variant}`;
  btn.textContent = label;
  btn.addEventListener("click", handler);
  actionButtons.appendChild(btn);
}

function nextTurn() {
  state.canRoll = true;
  state.current = (state.current + 1) % state.players.length;
  if (state.current === 0) state.round++;
  if (state.round > state.maxRounds && state.maxRounds !== 999) return endGame();
  actionButtons.innerHTML = "";
  setAction("À toi de jouer", `${state.players[state.current].name}, lance le dé.`);
  render();
}

function endGame() {
  state.canRoll = false;
  const ranking = [...state.players].sort((a, b) => b.coins - a.coins);
  setAction("Fin de partie", `${ranking[0].name} gagne avec ${ranking[0].coins} jetons !`);
  actionButtons.innerHTML = "";
  addButton("Nouvelle partie", resetAll);
  addLog(`Fin de partie: ${ranking[0].name} gagne.`);
}

function resetAll() {
  gamePanel.classList.add("hidden");
  setupPanel.classList.remove("hidden");
  logBox.innerHTML = "";
  dice.textContent = "?";
  setAction("Prêt ?", "Lance le dé pour commencer la partie.");
}

function showModal(type, title, text) {
  modalType.textContent = type;
  modalTitle.textContent = title;
  modalText.textContent = text;
  modal.classList.remove("hidden");
}

function addLog(text) {
  const entry = document.createElement("div");
  entry.className = "log-entry";
  entry.textContent = text;
  logBox.prepend(entry);
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function nextPlayerIndex() { return (state.current + 1) % state.players.length; }

document.getElementById("startGameBtn").addEventListener("click", startGame);
document.getElementById("randomNamesBtn").addEventListener("click", randomizeNames);
playerCount.addEventListener("change", buildNameInputs);
rollBtn.addEventListener("click", rollDice);
document.getElementById("resetBtn").addEventListener("click", resetAll);
document.getElementById("closeModal").addEventListener("click", () => modal.classList.add("hidden"));
document.getElementById("modalOk").addEventListener("click", () => modal.classList.add("hidden"));

setupReturnToPartyHubRoom();
buildNameInputs();
buildBoard();
partyhubInitMonopolySync();
