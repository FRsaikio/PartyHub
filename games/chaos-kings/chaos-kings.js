import {
  db,
  doc,
  getDoc,
  updateDoc,
  onSnapshot
} from "../../firebase.js";

const backToLobbyBtn = document.getElementById("backToLobbyBtn");

const roomBadge = document.getElementById("roomBadge");
const modeBadge = document.getElementById("modeBadge");
const levelBadge = document.getElementById("levelBadge");
const turnBadge = document.getElementById("turnBadge");
const chaosBadge = document.getElementById("chaosBadge");

const kingCard = document.getElementById("kingCard");
const cardValue = document.getElementById("cardValue");
const cardIcon = document.getElementById("cardIcon");
const cardSuit = document.getElementById("cardSuit");

const targetText = document.getElementById("targetText");
const effectTitle = document.getElementById("effectTitle");
const effectDescription = document.getElementById("effectDescription");

const drawCardBtn = document.getElementById("drawCardBtn");
const resetGameBtn = document.getElementById("resetGameBtn");

const modeText = document.getElementById("modeText");
const drinkLevelText = document.getElementById("drinkLevelText");
const playersText = document.getElementById("playersText");
const kingCountText = document.getElementById("kingCountText");

const activeEffectsList = document.getElementById("activeEffectsList");
const historyList = document.getElementById("historyList");
const eventBanner = document.getElementById("eventBanner");
const confettiLayer = document.getElementById("confettiLayer");

const savedData = JSON.parse(localStorage.getItem("partyhubGameData"));

if (!savedData) {
  alert("Aucune partie trouvée.");
  window.location.href = "../../index.html";
}

let players = savedData.players || [];
const selectedPartyMode = savedData.selectedPartyMode || "Party";
const alcoholMode = savedData.alcoholMode;
const drinkLevel = savedData.drinkLevel || "normal";
const roomCode = savedData.roomCode || "----";
const isHost = savedData.isHost || false;

const roomRef = doc(db, "rooms", roomCode);

function handleGlobalLobbyReturn(data) {
  if (data && data.gameStarted === false) {
    localStorage.setItem(
      "partyhubReturnLobby",
      "true"
    );

    window.location.href =
      "../../index.html";

    return true;
  }

  return false;
}


let turn = 1;
let chaosLevel = 0;
let kingCount = 0;
let history = [];
let activeEffects = [];
let lastActionId = null;
let isDrawing = false;

const cardIcons = {
  A: "🅰️",
  "2": "✌️",
  "3": "🍺",
  "4": "👇",
  "5": "👦",
  "6": "👧",
  "7": "☝️",
  "8": "🤝",
  "9": "🎤",
  "10": "🧠",
  J: "📜",
  Q: "❓",
  K: "👑"
};

const suits = ["♠️", "♥️", "♦️", "♣️"];

const baseRules = {
  A: {
    name: "Waterfall",
    Chill: "Tout le monde commence en même temps. Le joueur qui a pioché peut s’arrêter quand il veut, puis chaque joueur ne peut s’arrêter que quand la personne avant lui s’est arrêtée. Version soft possible avec mini-gages.",
    Party: "Tout le monde commence à boire en même temps. Le joueur qui a pioché arrête en premier, puis les autres arrêtent dans l’ordre du cercle.",
    Chaos: "Waterfall classique, mais le dernier joueur à s’arrêter reçoit aussi une règle chaos temporaire choisie par le groupe.",
    Hardcore: "Waterfall hardcore : personne ne peut s’arrêter avant la personne juste avant lui. Le dernier à arrêter prend aussi une punition bonus."
  },
  "2": {
    name: "You",
    Chill: "Choisis un joueur. Il doit faire un mini-gage simple choisi par toi.",
    Party: "Choisis un joueur. Il prend la punition indiquée par le niveau d’alcool.",
    Chaos: "Choisis un joueur. Il prend la punition, puis tu lui imposes une mini-règle jusqu’au prochain tour.",
    Hardcore: "Choisis un joueur. Il doit choisir entre une double punition ou répondre honnêtement à une vérité gênante choisie par le groupe."
  },
  "3": {
    name: "Me",
    Chill: "Tu t’auto-infliges un mini-gage drôle. Le groupe valide si c’est accepté.",
    Party: "Tu prends directement la punition indiquée par le niveau d’alcool.",
    Chaos: "Tu prends la punition, puis le groupe ajoute une contrainte à ton prochain tour.",
    Hardcore: "Tu prends la punition maximale autorisée par le niveau actuel. Si tu refuses, le groupe choisit un gros gage."
  },
  "4": {
    name: "Floor",
    Chill: "Tout le monde doit toucher le sol. Le dernier fait un mini-gage.",
    Party: "Tout le monde doit toucher le sol. Le dernier prend la punition.",
    Chaos: "Le dernier à toucher le sol prend la punition et devient automatiquement la cible du prochain effet.",
    Hardcore: "Le dernier à toucher le sol prend une double punition ou doit accepter un défi imposé par le groupe."
  },
  "5": {
    name: "Guys",
    Chill: "Tous les gars font un mini-gage léger ou désignent une personne pour le faire.",
    Party: "Tous les gars prennent la punition indiquée par le niveau d’alcool.",
    Chaos: "Tous les gars prennent la punition, puis désignent une personne protégée pour le prochain tour.",
    Hardcore: "Tous les gars prennent une punition renforcée ou réalisent un défi collectif choisi par les filles."
  },
  "6": {
    name: "Girls",
    Chill: "Toutes les filles font un mini-gage léger ou désignent une personne pour le faire.",
    Party: "Toutes les filles prennent la punition indiquée par le niveau d’alcool.",
    Chaos: "Toutes les filles prennent la punition, puis créent une règle temporaire pour tout le groupe.",
    Hardcore: "Toutes les filles prennent une punition renforcée ou imposent un défi collectif aux autres joueurs."
  },
  "7": {
    name: "Heaven",
    Chill: "Tout le monde lève les mains. Le dernier fait un mini-gage.",
    Party: "Tout le monde lève les mains. Le dernier prend la punition.",
    Chaos: "Le dernier à lever les mains prend la punition et perd son droit de transférer une punition au prochain tour.",
    Hardcore: "Le dernier à lever les mains prend une punition de groupe : le groupe décide s’il boit, fait un gage ou répond à une vérité."
  },
  "8": {
    name: "Mate",
    Chill: "Choisis un mate. Pendant 2 tours, si tu fais un gage, ton mate en fait un petit aussi.",
    Party: "Choisis un mate. Pendant 3 tours, chaque fois que tu bois, ton mate boit aussi.",
    Chaos: "Choisis un mate maudit pendant 3 tours. Si l’un de vous est ciblé, l’autre reçoit une mini-punition aussi.",
    Hardcore: "Choisis un mate jusqu’au prochain roi. Vos punitions sont liées : si l’un est ciblé, l’autre prend une version réduite."
  },
  "9": {
    name: "Rhyme",
    Chill: "Choisis un mot simple. Chaque joueur doit donner une rime. Celui qui bloque fait un mini-gage.",
    Party: "Choisis un mot. Chacun donne une rime rapidement. Celui qui bloque ou répète une réponse prend la punition.",
    Chaos: "Battle de rimes piégée : les rimes trop faciles peuvent être refusées par le groupe. Celui qui bloque boit double.",
    Hardcore: "Battle de rimes rapide : 3 secondes maximum par joueur. Erreur, répétition ou hésitation = punition renforcée."
  },
  "10": {
    name: "Categories",
    Chill: "Choisis une catégorie simple. Chacun donne une réponse. Celui qui bloque fait un mini-gage.",
    Party: "Choisis une catégorie. Chaque joueur répond à son tour. Celui qui bloque, répète ou donne une mauvaise réponse prend la punition.",
    Chaos: "Catégorie piégée : le groupe peut refuser une réponse trop faible. Celui qui se fait refuser prend la punition.",
    Hardcore: "Catégorie hardcore : 3 secondes maximum par joueur. Si tu bloques, tu prends une punition renforcée."
  },
  J: {
    name: "Rule Master",
    Chill: "Crée une règle drôle pendant 2 tours. Exemple : parler avec un accent, interdiction de dire un prénom, obligation de dire merci.",
    Party: "Crée une règle active pendant 3 tours. Toute personne qui l’oublie prend la punition.",
    Chaos: "Crée une règle chaos qui touche tout le groupe pendant plusieurs tours. Le groupe peut la rendre plus sévère si elle est oubliée.",
    Hardcore: "Crée une règle permanente jusqu’au prochain roi. Toute erreur déclenche une punition immédiate."
  },
  Q: {
    name: "Question Master",
    Chill: "Tu deviens Question Master. Si quelqu’un répond naturellement à une de tes questions, il fait un mini-gage.",
    Party: "Tu deviens Question Master. Si quelqu’un répond à une de tes questions, il prend la punition.",
    Chaos: "Question Master amélioré : si quelqu’un répond à ta question ou dit un mot interdit choisi par toi, il prend la punition.",
    Hardcore: "Question Master jusqu’au prochain roi. Toute réponse à tes questions déclenche une punition renforcée."
  },
  K: {
    name: "King",
    Chill: "Le roi crée une règle drôle ou annule une règle active. Le quatrième roi déclenche la finale Chaos Cup.",
    Party: "Le roi ajoute une règle au Chaos Cup. Au quatrième roi, le groupe déclenche la punition finale.",
    Chaos: "Le roi déclenche automatiquement une règle chaos active. Au quatrième roi, finale Chaos Cup.",
    Hardcore: "Le roi augmente fortement le chaos, ajoute une règle active et rapproche la finale Chaos Cup. Au quatrième roi, punition finale du groupe."
  }
};

const chaosEffects = {
  Chill: [
    "Interdiction de dire les prénoms pendant 2 tours",
    "Tout le monde doit parler avec un accent pendant 1 tour",
    "Obligation de complimenter avant de parler pendant 2 tours"
  ],
  Party: [
    "Double peine pendant 2 tours",
    "Le prochain qui touche son téléphone boit",
    "Interdiction de dire “quoi” pendant 3 tours",
    "Le joueur ciblé choisit quelqu’un qui boit avec lui"
  ],
  Chaos: [
    "Double peine pendant 3 tours",
    "Le prochain joueur ciblé peut transférer sa punition une seule fois",
    "Interdiction de dire les prénoms pendant 4 tours",
    "Le prochain qui regarde son téléphone boit double",
    "Le groupe vote une cible au prochain tour",
    "Toutes les punitions touchent aussi le mate du joueur ciblé"
  ],
  Hardcore: [
    "Triple tension : les punitions sont renforcées pendant 3 tours",
    "Mort subite : le prochain qui hésite prend une punition",
    "Le prochain roi déclenche une punition collective",
    "Le joueur ciblé doit choisir entre boire ou vérité hardcore",
    "Toutes les règles actives durent +2 tours",
    "La prochaine carte est doublée",
    "Le groupe peut refuser une excuse pendant 3 tours"
  ]
};

const rareEvents = {
  Chill: [
    "✨ PAUSE ROYALE : tout le monde est safe ce tour",
    "🎭 THÉÂTRE : tout le monde doit surjouer pendant 1 tour"
  ],
  Party: [
    "🔥 DOUBLE DRAW : pioche deux cartes",
    "🍻 TOURNÉE ROYALE : tout le monde trinque",
    "🎯 TARGET LOCK : le prochain joueur ciblé prend +1 gorgée"
  ],
  Chaos: [
    "💀 CHAOS TOTAL : une règle active est ajoutée automatiquement",
    "🔁 REVERSE : le joueur ciblé peut renvoyer la punition",
    "⚡ MODE FURIE : chaos +20%",
    "🧨 DOUBLE IMPACT : la prochaine carte touche deux joueurs"
  ],
  Hardcore: [
    "☠️ MODE FURIE : chaos +30%",
    "👑 ROI SOMBRE : la prochaine carte est doublée",
    "💀 CHAOS CUP : tout le monde prend une mini-punition",
    "🩸 NO ESCAPE : impossible de transférer la prochaine punition",
    "🔥 APOCALYPSE : ajoute deux effets actifs"
  ]
};

async function initGame() {
  const roomSnap = await getDoc(roomRef);

  if (roomSnap.exists()) {
    const roomData = roomSnap.data();
    players = roomData.players || players;
  }

  roomBadge.textContent = `Room ${roomCode}`;
  modeBadge.textContent = `Mode ${selectedPartyMode}`;
  levelBadge.textContent = getDrinkLevelLabel();

  modeText.textContent = selectedPartyMode;
  drinkLevelText.textContent = getDrinkLevelLabel();
  playersText.textContent = players.length;

  updateUI();
  renderActiveEffects();

  if (players.length < 2) {
    effectTitle.textContent = "Pas assez de joueurs";
    effectDescription.textContent = "Ajoute au moins 2 joueurs pour lancer Chaos Kings.";
    drawCardBtn.disabled = true;
    resetGameBtn.disabled = true;
    return;
  }

  if (!isHost) {
    drawCardBtn.disabled = true;
    resetGameBtn.disabled = true;
    drawCardBtn.textContent = "Attente du host";
    resetGameBtn.textContent = "Seul le host peut reset";
  }

  listenToChaosKingsState();
}

function getDrinkLevelLabel() {
  if (drinkLevel === "soft") return "Soft";
  if (drinkLevel === "normal") return "Normal";
  if (drinkLevel === "hard") return "Hard";
  if (drinkLevel === "danger" || drinkLevel === "extreme") return "Extrême";
  return "Normal";
}

function getRandomPlayer() {
  return players[Math.floor(Math.random() * players.length)];
}

function getRandomCard() {
  const values = Object.keys(baseRules);
  const value = values[Math.floor(Math.random() * values.length)];
  const suit = suits[Math.floor(Math.random() * suits.length)];

  return {
    value,
    suit,
    icon: cardIcons[value],
    rule: baseRules[value]
  };
}

const chaosKingsPenaltyTexts = {
  soft: [
    "Punition : 1 gorgée ou mini-gage.",
    "Boire 1 shot",
    "Boire 2 gorgées de ton verre actuel",
    "Boire 3 gorgées",
    "Choisir quelqu’un qui boit un shot avec toi",
    "Boire un shot de bière",
    "Boire un mélange que le groupe te prépare (petit)",
    "Boire ton verre avec la main non dominante",
    "Boire en regardant quelqu’un dans les yeux",
    "Faire un shot inversé",
    "Boire une gorgée de chaque verre sur la table",
  ],
  normal: [
    "Punition : 2 gorgées.",
    "Boire un cul sec de bière",
    "Boire 2 shots d’affilée",
    "Boire un grand verre d’alcool mélangé",
    "Boire un shot préparé par la personne à ta gauche",
    "Boire un shot préparé par la personne à ta droite",
    "Boire un Verre de la Honte : tout le monde verse un peu dedans",
    "Boire 4 gorgées d’affilée",
    "Boire sans utiliser tes mains avec une paille ou directement",
    "Faire un shot dans le nombril de quelqu’un ou se le faire faire",
    "Boire un shot à chaque fois que quelqu’un dit un mot interdit pendant 2 tours",
    "Le Serpent : tu bois une gorgée à chaque question/réponse jusqu’à ce que quelqu’un d’autre perde",
    "Cascade : tout le monde boit en même temps que toi jusqu’à ce que tu arrêtes",
    "Punition Double : tu bois 2 shots et tu choisis qui boit avec toi",
    "Le Dernier Verre : tu finis entièrement ton verre actuel",
    "Alcool Roulette : tu tournes une bouteille, la personne visée boit avec toi",
    "Verre sans fond : tu dois toujours avoir ton verre plein pendant 3 tours",
    "Shot ou Vérité : tu choisis entre boire 2 shots ou répondre à une question très gênante",
  ],
  hard: [
    "Punition : 3 gorgées ou défi imposé par le groupe.",
    "Boire 3 shots d’affilée",
    "Boire un cul sec de spiritueux",
    "Boire un grand verre entier en moins de 45 secondes",
    "Boire 2 verres d’affilée",
    "Boire un mélange créé par tout le groupe",
    "Tour du Monde : boire une gorgée de 5 verres différents",
    "Boire sans respirer entre chaque gorgée jusqu’à 5 gorgées",
    "Boire un shot toutes les 2 minutes pendant 10 minutes",
    "Boire un Shot de la Mort très fort ou très bizarre",
    "Être Roi/Reine du Shot pendant 3 tours : tu dois servir un shot à chaque personne qui perd",
    "Le Serpent : tu bois une gorgée à chaque question/réponse jusqu’à ce que quelqu’un d’autre perde",
    "Cascade : tout le monde boit en même temps que toi jusqu’à ce que tu arrêtes",
    "Punition Double : tu bois 2 shots et tu choisis qui boit avec toi",
    "Le Dernier Verre : tu finis entièrement ton verre actuel",
    "Alcool Roulette : tu tournes une bouteille, la personne visée boit avec toi",
    "Verre sans fond : tu dois toujours avoir ton verre plein pendant 3 tours",
    "Shot ou Vérité : tu choisis entre boire 2 shots ou répondre à une question très gênante",
  ],
  danger: [
    "Punition : 4 gorgées max ou gros gage. Le groupe peut adapter.",
    "Boire 3 shots d’affilée",
    "Boire un cul sec de spiritueux",
    "Boire un grand verre entier en moins de 45 secondes",
    "Boire 2 verres d’affilée",
    "Boire un mélange créé par tout le groupe",
    "Tour du Monde : boire une gorgée de 5 verres différents",
    "Boire sans respirer entre chaque gorgée jusqu’à 5 gorgées",
    "Boire un shot toutes les 2 minutes pendant 10 minutes",
    "Boire un Shot de la Mort très fort ou très bizarre",
    "Être Roi/Reine du Shot pendant 3 tours : tu dois servir un shot à chaque personne qui perd",
    "Le Serpent : tu bois une gorgée à chaque question/réponse jusqu’à ce que quelqu’un d’autre perde",
    "Cascade : tout le monde boit en même temps que toi jusqu’à ce que tu arrêtes",
    "Punition Double : tu bois 2 shots et tu choisis qui boit avec toi",
    "Le Dernier Verre : tu finis entièrement ton verre actuel",
    "Alcool Roulette : tu tournes une bouteille, la personne visée boit avec toi",
    "Verre sans fond : tu dois toujours avoir ton verre plein pendant 3 tours",
    "Shot ou Vérité : tu choisis entre boire 2 shots ou répondre à une question très gênante",
    "Boire un cul sec de bière",
    "Boire 2 shots d’affilée",
    "Boire un grand verre d’alcool mélangé",
    "Boire un shot préparé par la personne à ta gauche",
    "Boire un shot préparé par la personne à ta droite",
    "Boire un Verre de la Honte : tout le monde verse un peu dedans",
    "Boire 4 gorgées d’affilée",
    "Boire sans utiliser tes mains avec une paille ou directement",
    "Faire un shot dans le nombril de quelqu’un ou se le faire faire",
    "Boire un shot à chaque fois que quelqu’un dit un mot interdit pendant 2 tours",
  ],
};

function getPenaltyText() {
  if (!alcoholMode) {
    return "Mode soft : remplace l’alcool par un gage choisi par le groupe.";
  }

  const pool = chaosKingsPenaltyTexts[drinkLevel] || chaosKingsPenaltyTexts.normal;
  return pool[Math.floor(Math.random() * pool.length)];
}

function getChaosGain() {
  if (selectedPartyMode === "Chill") return 5;
  if (selectedPartyMode === "Party") return 9;
  if (selectedPartyMode === "Chaos") return 14;
  if (selectedPartyMode === "Hardcore") return 19;
  return 9;
}

function getRareChance() {
  if (selectedPartyMode === "Chill") return 0.04;
  if (selectedPartyMode === "Party") return 0.08;
  if (selectedPartyMode === "Chaos") return 0.14;
  if (selectedPartyMode === "Hardcore") return 0.20;
  return 0.08;
}

function getEffectDuration() {
  if (drinkLevel === "soft") return 2;
  if (drinkLevel === "normal") return 3;
  if (drinkLevel === "hard") return 4;
  if (drinkLevel === "danger") return 5;
  return 3;
}

function addChaosValue(baseAmount, currentChaos) {
  let amount = baseAmount;

  if (drinkLevel === "normal") amount += 2;
  if (drinkLevel === "hard") amount += 6;
  if (drinkLevel === "danger") amount += 11;

  return Math.min(100, currentChaos + amount);
}

function getRandomActiveEffect() {
  const pool = chaosEffects[selectedPartyMode] || chaosEffects.Party;
  return {
    text: pool[Math.floor(Math.random() * pool.length)],
    turns: getEffectDuration()
  };
}

function decayEffects(effects) {
  return effects
    .map(effect => ({
      ...effect,
      turns: effect.turns - 1
    }))
    .filter(effect => effect.turns > 0);
}

function getRandomRareEvent() {
  const pool = rareEvents[selectedPartyMode] || rareEvents.Party;
  return pool[Math.floor(Math.random() * pool.length)];
}

function buildDrawState() {
  const card = getRandomCard();
  const player = getRandomPlayer();
  const ruleText = card.rule[selectedPartyMode] || card.rule.Party;

  let nextKingCount = kingCount;
  let nextChaosLevel = chaosLevel;
  let nextActiveEffects = decayEffects(activeEffects);
  let rareEvent = null;
  let historyItems = [];

  if (card.value === "K") {
    nextKingCount++;
    nextChaosLevel = addChaosValue(22, nextChaosLevel);

    const kingEffect = getRandomActiveEffect();
    nextActiveEffects.unshift(kingEffect);
    historyItems.push(`⚡ Effet actif : ${kingEffect.text}`);
  } else {
    nextChaosLevel = addChaosValue(getChaosGain(), nextChaosLevel);
  }

  if (Math.random() < getRareChance()) {
    rareEvent = getRandomRareEvent();
    nextChaosLevel = addChaosValue(14, nextChaosLevel);
    historyItems.push(`💀 Rare event : ${rareEvent}`);

    if (
      rareEvent.includes("CHAOS TOTAL") ||
      rareEvent.includes("FURIE") ||
      rareEvent.includes("APOCALYPSE")
    ) {
      const effect = getRandomActiveEffect();
      nextActiveEffects.unshift(effect);
      historyItems.push(`⚡ Effet actif : ${effect.text}`);
    }

    if (rareEvent.includes("APOCALYPSE")) {
      const effect = getRandomActiveEffect();
      nextActiveEffects.unshift(effect);
      historyItems.push(`⚡ Effet actif : ${effect.text}`);
    }
  }

  if (nextActiveEffects.length > 5) {
    nextActiveEffects = nextActiveEffects.slice(0, 5);
  }

  historyItems.unshift(`${player.name} a pioché ${card.value}${card.suit} — ${card.rule.name}`);

  return {
    actionId: Date.now(),
    type: "draw",
    turn,
    chaosLevel: nextChaosLevel,
    kingCount: nextKingCount,
    activeEffects: nextActiveEffects,
    cardValue: card.value,
    cardSuit: card.suit,
    cardIcon: card.icon,
    ruleName: card.rule.name,
    ruleText,
    playerName: player.name,
    penaltyText: getPenaltyText(),
    rareEvent,
    historyItems,
    finalKing: nextKingCount >= 4
  };
}

async function drawCard() {
  if (!isHost || isDrawing) return;

  const state = buildDrawState();

  await updateDoc(roomRef, {
    chaosKingsState: state
  });
}

async function resetGame() {
  if (!isHost) return;

  await updateDoc(roomRef, {
    chaosKingsState: {
      actionId: Date.now(),
      type: "reset"
    }
  });
}

function listenToChaosKingsState() {
  onSnapshot(roomRef, snapshot => {
    if (!snapshot.exists()) return;

    const data = snapshot.data();

    if (handleGlobalLobbyReturn(data)) return;

    const state = data.chaosKingsState;

    if (!state) return;
    if (state.actionId === lastActionId) return;

    lastActionId = state.actionId;

    if (state.type === "reset") {
      applyResetState();
      return;
    }

    if (state.type === "draw") {
      applyDrawState(state);
    }
  });
}

function applyDrawState(state) {
  isDrawing = true;

  if (isHost) {
    drawCardBtn.disabled = true;
    resetGameBtn.disabled = true;
  }

  eventBanner.classList.add("hidden");
  kingCard.classList.remove("draw", "rare");

  cardValue.textContent = state.cardValue;
  cardIcon.textContent = state.cardIcon;
  cardSuit.textContent = state.cardSuit;

  void kingCard.offsetWidth;
  kingCard.classList.add("draw");

  targetText.textContent = `🎯 Joueur ciblé : ${state.playerName}`;
  effectTitle.textContent = `${state.cardValue}${state.cardSuit} — ${state.ruleName}`;
  effectDescription.innerHTML = `
    <span class="effect-label">Effet de la carte</span>
    <strong>${state.ruleText}</strong>

    <span class="effect-label">Intensité alcool</span>
    <strong>${state.penaltyText}</strong>
  `;

  if (state.rareEvent) {
    eventBanner.textContent = state.rareEvent;
    eventBanner.classList.remove("hidden");

    kingCard.classList.add("rare");
    document.body.classList.add("screen-shake");

    setTimeout(() => {
      document.body.classList.remove("screen-shake");
    }, 450);

    launchConfetti(55);
  }

  if (state.cardValue === "K") {
    launchConfetti(45);
  }

  chaosLevel = state.chaosLevel;
  kingCount = state.kingCount;
  activeEffects = state.activeEffects || [];

  state.historyItems.forEach(item => addHistory(item));

  updateUI();

  turn = state.turn + 1;

  if (state.finalKing) {
    triggerFinalKingSynced();
    return;
  }

  isDrawing = false;

  if (isHost) {
    drawCardBtn.disabled = false;
    resetGameBtn.disabled = false;
  }
}

function triggerFinalKingSynced() {
  drawCardBtn.disabled = true;

  eventBanner.textContent = "👑💀 CHAOS CUP FINAL — Les 4 rois sont tombés";
  eventBanner.classList.remove("hidden");

  effectTitle.textContent = "Fin royale";
  effectDescription.innerHTML = `
    <span class="effect-label">Finale Chaos Cup</span>
    <strong>
      Les 4 rois sont tombés. Le groupe choisit une punition finale adaptée à l’état de la soirée.
    </strong>
  `;

  launchConfetti(90);
  addHistory("👑 Les 4 rois ont été tirés : finale Chaos Cup");
}

function applyResetState() {
  turn = 1;
  chaosLevel = 0;
  kingCount = 0;
  history = [];
  activeEffects = [];
  isDrawing = false;

  eventBanner.classList.add("hidden");

  cardValue.textContent = "?";
  cardIcon.textContent = "👑";
  cardSuit.textContent = "CHAOS";

  targetText.textContent = "Pioche une carte pour commencer";
  effectTitle.textContent = "Chaos Kings";
  effectDescription.textContent =
    "Chaque carte applique une règle. Plus la partie avance, plus le chaos monte.";

  if (isHost) {
    drawCardBtn.disabled = false;
    resetGameBtn.disabled = false;
  }

  updateUI();
  renderHistory();
}

function updateUI() {
  turnBadge.textContent = `Tour ${turn}`;
  chaosBadge.textContent = `Chaos ${chaosLevel}%`;
  kingCountText.textContent = `${kingCount}/4`;

  renderActiveEffects();
}

function renderActiveEffects() {
  activeEffectsList.innerHTML = "";

  if (activeEffects.length === 0) {
    const li = document.createElement("li");
    li.textContent = "Aucun effet actif.";
    activeEffectsList.appendChild(li);
    return;
  }

  activeEffects.forEach(effect => {
    const li = document.createElement("li");
    li.textContent = `${effect.text} — ${effect.turns} tour(s)`;
    activeEffectsList.appendChild(li);
  });
}

function addHistory(message) {
  history.unshift(message);

  if (history.length > 8) {
    history.pop();
  }

  renderHistory();
}

function renderHistory() {
  historyList.innerHTML = "";

  history.forEach(item => {
    const li = document.createElement("li");
    li.textContent = item;
    historyList.appendChild(li);
  });
}

function launchConfetti(power = 35) {
  const colors = ["#ff007a", "#7b2cff", "#00b7ff", "#ffb000", "#00d084"];

  for (let i = 0; i < power; i++) {
    const confetti = document.createElement("div");
    confetti.className = "confetti";
    confetti.style.left = `${Math.random() * 100}%`;
    confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.animationDelay = `${Math.random() * 0.25}s`;
    confetti.style.transform = `rotate(${Math.random() * 360}deg)`;

    confettiLayer.appendChild(confetti);

    setTimeout(() => {
      confetti.remove();
    }, 2200);
  }
}

drawCardBtn.addEventListener("click", drawCard);
resetGameBtn.addEventListener("click", resetGame);



backToLobbyBtn.addEventListener("click", async () => {

  if (isHost) {
    try {
      await updateDoc(roomRef, {
        gameStarted: false,
        roomStatus: "lobby",
        screen: "lobby",
        activeGame: null,
        gameState: {},
        forceNavigation: { target: "lobby", at: Date.now() }
      });
    } catch (error) {
      console.error("Erreur retour lobby global :", error);
    }
  }

  localStorage.setItem(
    "partyhubReturnLobby",
    "true"
  );

  window.location.href =
    "../../index.html";

});

initGame();