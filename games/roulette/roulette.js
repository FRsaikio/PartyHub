import {
  db,
  doc,
  getDoc,
  updateDoc,
  onSnapshot
} from "../../firebase.js";

const backToLobbyBtn = document.getElementById("backToLobbyBtn");
const roomBadge = document.getElementById("roomBadge");

const wheel = document.getElementById("wheel");
const spinBtn = document.getElementById("spinBtn");
const rerollBtn = document.getElementById("rerollBtn");

const resultBox = document.getElementById("resultBox");
const targetPlayer = document.getElementById("targetPlayer");
const categoryText = document.getElementById("categoryText");
const challengeText = document.getElementById("challengeText");
const penaltyText = document.getElementById("penaltyText");

const modeText = document.getElementById("modeText");
const drinkLevelText = document.getElementById("drinkLevelText");
const playersText = document.getElementById("playersText");

const historyList = document.getElementById("historyList");
const confettiLayer = document.getElementById("confettiLayer");

const eventBanner = document.getElementById("eventBanner");

const mostTargeted = document.getElementById("mostTargeted");
const topCategory = document.getElementById("topCategory");
const spinCount = document.getElementById("spinCount");

const savedData = JSON.parse(localStorage.getItem("partyhubGameData"));

if (!savedData) {
  alert("Aucune partie trouvée. Retour au lobby.");
  window.location.href = "../../index.html";
}

let players = savedData.players || [];
const selectedPartyMode = savedData.selectedPartyMode || "Party";
const drinkLevel = savedData.drinkLevel || "normal";
const alcoholMode = savedData.alcoholMode;
const roomCode = savedData.roomCode || "----";
const isHost = savedData.isHost || savedData.enablePlayerControl !== false;
const currentPlayerName = savedData.currentPlayer || savedData.playerName || "Joueur";

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


let currentRotation = 0;
let isSpinning = false;
let history = [];
let totalSpins = 0;
let lastSpinId = null;

const playerStats = {};
const categoryStats = {};

const wheelCategories = [
  "BOIS",
  "DISTRIBUE",
  "GAGE",
  "DUEL",
  "TOUS",
  "CHANCE",
  "CHAOS",
  "SECRET"
];

const actions = {
  Party: {
    BOIS: [
      "Bois 3 gorgées 🍻",
      "Mini cul-sec 🍺",
      "Shot soft 🥃",
      "Waterfall de 5 secondes 🌊",
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
    "Cul-sec total de spiritueux pur 🥃",
    "Double Shot inversé",
    "Boire 4 shots d’affilée sans respirer 🔥",
    "Verre de la Mort Extrême : tout le monde verse un alcool fort dedans",
    "Shot préparé par tout le groupe (ils peuvent tout mettre)",
    "Cascade Royale : tout le monde boit en même temps que toi jusqu’à ce que tu arrêtes",
    "Boire un grand verre de bière + shot de vodka dedans 🍺🥃",
    "3 Gorgées + 1 shot toutes les 60 secondes pendant 5 minutes",
    "Le Tunnel : 5 gorgées sans respirer puis un shot direct",
    "Boire ton verre actuel cul-sec avec la main non dominante derrière le dos",
    "Boire une gorgée de chaque verre + finir par un shot du plus fort",
    "Roi/Reine de la Terreur : pendant 4 tours tu distribues un shot à chaque perdant",
    "Mélange du Diable : la personne en face te prépare un shot avec minimum 3 alcools",
    "Boire sans mains (bouteille ou verre posé sur la table)",
    "Shot toutes les 90 secondes pendant 15 minutes ⏰",
    "Finir une canette de bière en moins de 20 secondes",
    "Double Punition : 2 shots + tu choisis 2 personnes qui en boivent un",
    "Alcool Roulette Russe : tu choisis l’alcool après avoir tourné la bouteille",
    "Verre sans Fond Extrême : ton verre doit rester plein pendant 5 tours",
    "Boire un shot dans le dos de quelqu’un ou se le faire faire",
    "Le Serpent Infernal : tu bois à chaque phrase jusqu’à ce qu’un autre perde",
    "4 Shots d’affilée (maximum 10 secondes entre chaque)",
    "Mélange Surprise : le groupe te prépare un grand verre avec tout ce qu’ils veulent",
    "Boire en faisant des pompes",
    "Shot de la Honte 2.0 : tout le monde crache dedans avant que tu boives",
    "Tour du Monde Hard : une gorgée de 8 verres/alcools différents minimum",
    "Boire un cul-sec les yeux bandés",
    "Le Dernier Souffle : finir ton verre + un shot en moins de 30 secondes",
    "Punition Combo : 1 shot + 1 gorgée de chaque personne autour de la table",
    "Boire un grand verre en une seule traite sans poser 🌊",
    "Shot préparé par la personne que tu aimes le moins 😈",
    "Cascade de 10 secondes + shot direct",
    "Le Traître : tu bois 2 shots puis tu choisis quelqu’un qui en boit 3"
    ],

    DISTRIBUE: [
      "Distribue 4 gorgées",
      "Distribue 6 gorgées",
      "Choisis 2 personnes qui boivent",
      "Distribue un shot soft",
      "Distribue 2 gorgées",
      "Distribue 8 gorgées",
      "Distribue 10 gorgées",
      "Choisis quelqu’un qui boit un shot avec toi",
      "Punition Double : tu bois 2 shots et tu choisis qui boit avec toi",
      "Distribue 3 shots à qui tu veux",
    "Distribue 12 gorgées comme tu veux",
    "Tout le monde boit 2 gorgées sauf les 2 personnes que tu choisis",
    "Distribue un cul-sec de bière",
    "Choisis 3 personnes qui boivent un shot",
    "Distribue 15 gorgées",
    "Distribue 2 shots d’affilée à une personne",
    "Choisis quelqu’un qui finit son verre",
    "Distribue un grand verre mélangé à qui tu veux",
    "Tout le monde boit 1 shot sauf 2 personnes que tu protèges",
    "Distribue 4 shots comme bon te semble",
    "Choisis 2 personnes qui boivent un cul-sec",
    "Distribue un Verre de la Honte (tout le monde verse dedans) à quelqu’un",
    "Distribue 20 gorgées en plusieurs fois",
    "Punition Double Extrême : tu bois 3 shots et tu fais boire 3 shots à d’autres",
    "Distribue un shot préparé par toi à qui tu veux",
    "Choisis 4 personnes qui boivent 3 gorgées chacune",
    "Distribue un Tour du Monde (gorgée de 5 verres)",
    "Tout le groupe boit 3 gorgées sauf toi et une autre personne",
    "Distribue 2 shots à la personne à ta gauche et à ta droite",
    "Choisis quelqu’un qui boit sans mains",
    "Distribue un Shot de la Mort à qui tu veux",
    "Distribue 5 shots en tout (tu décides qui et comment)",
    "Cascade à distribuer : choisis qui commence la cascade avec toi",
    "Distribue 1 shot + 4 gorgées à chaque personne que tu veux",
    "Roi/Reine de la Distribution : pendant 3 tours tu distribues à chaque perdant",
    "Distribue un mélange créé par tout le groupe à quelqu’un"
    
    ],

    GAGE: [
      "Fais un toast ridicule",
      "Fais une danse de 10 secondes",
      "Imite quelqu’un du groupe",
      "Raconte une vérité gênante ou bois"
    ],

    DUEL: [
      "Duel regard : perdant boit 3 gorgées",
      "Duel pierre-feuille-ciseaux : perdant boit",
      "Duel shot soft : le perdant prend la sanction",
      "Duel rapidité : dernier à lever la main boit",
      "Duel bras de fer : perdant boit 2 shots",
    "Duel qui rit le premier : perdant boit 3 gorgées",
    "Duel regard sans cligner : perdant boit un shot",
    "Duel devinette : celui qui ne trouve pas boit",
    "Duel rapidité de shot : premier à finir son shot gagne",
    "Duel pouce en l’air : dernier à mettre le pouce boit",
    "Duel chanson : celui qui se trompe dans les paroles boit",
    "Duel mime : le groupe devine, si échec le perdant boit un cul-sec",
    "Duel claquement de doigts : celui qui rate boit",
    "Duel ne pas sourire : le premier qui sourit boit 4 gorgées",
    "Duel combat de regards + grimace : perdant boit",
    "Duel pierre-feuille-ciseaux best of 5 : perdant boit 2 shots",
    "Duel qui parle le plus longtemps sans répéter : perdant boit",
    "Duel rapidité à dire l’alphabet à l’envers",
    "Duel duel de pompes : perdant boit un grand verre",
    "Duel qui tient le plus longtemps en équilibre sur une jambe",
    "Duel jeu du ni oui ni non : perdant boit",
    "Duel duel de slap (tape dans la main) : perdant boit",
    "Duel celui qui cligne des yeux en premier boit",
    "Duel deviner l’alcool les yeux bandés : erreur = shot",
    "Duel battle de rap (même 4 lignes) : le moins bon boit",
    "Duel ne pas rire : le groupe essaie de faire rire l’autre",
    "Duel duel de souffle (tenir la respiration) : perdant boit",
    "Duel rapidité à finir une phrase commune",
    "Duel pierre-feuille-ciseaux avec gage spécial : perdant boit un mélange",
    "Duel qui fait la meilleure grimace : le groupe vote, perdant boit",
    "Duel duel de noms : dire des prénoms sans se répéter, le premier bloqué boit",
    "Duel bras de fer à une main + shot dans l’autre main",
    "Duel regard + celui qui parle en premier perd",
    "Duel duel de push-ups : le moins de pompes boit 3 shots"
    ],

    TOUS: [
      "Tout le monde boit 2 gorgées",
      "Waterfall collectif 🌊",
      "Tout le monde trinque",
      "Tout le monde boit sauf la cible",
      "Cascade : tout le monde boit en même temps que toi jusqu’à ce que tu arrêtes",
      "Tout le monde boit une gorgée",
      "Verre de la Honte : tout le monde verse un peu dedans",
    "Tout le monde boit 4 gorgées d’affilée",
    "Tout le monde fait un shot 🥃",
    "Tout le monde boit 2 shots d’affilée",
    "Waterfall général hardcore : tout le monde commence en même temps et ne s’arrête que quand le perdant arrête",
    "Tout le monde finit son verre actuel cul-sec",
    "Ronde de shots : tout le groupe boit un shot",
    "Tout le monde boit un cul-sec de bière",
    "Cascade Royale Extrême : tout le monde boit tant que le perdant boit",
    "Verre de la Mort : tout le monde verse un alcool fort dedans et le perdant le boit cul-sec",
    "Tout le monde boit sans utiliser les mains",
    "Tout le groupe boit une gorgée de chaque alcool sur la table",
    "Tout le monde boit 5 gorgées sans respirer",
    "Shot collectif : tout le monde boit un shot en même temps",
    "Tout le monde finit son verre en moins de 25 secondes",
    "Waterfall inversé : tout le monde boit, le dernier qui s’arrête boit 2 shots en plus",
    "Tout le groupe fait un Tour du Monde Hard (gorgée de 7 alcools différents)",
    "Tout le monde boit un mélange préparé par le perdant (minimum 3 alcools forts)",
    "Cascade infinie : tout le monde boit pendant toute la durée de la chanson",
    "Tout le monde boit 1 shot + 3 gorgées",
    "Tout le groupe boit un Shot de la Honte (tout le monde crache dedans avant)",
    "Tout le monde doit avoir son verre plein pendant 4 tours (sinon shot obligatoire)",
    "Cascade + Shot : tout le monde fait une cascade de 10 secondes puis un shot direct",
    "Tout le monde boit un grand verre mélangé (bière + spiritueux)",
    "Règle du Roi Extrême : tout le monde boit à chaque fois que le Roi boit pendant 5 tours",
    "Tout le groupe boit 2 shots d’affilée",
    "Trinque général + cul-sec pour les 3 dernières personnes",
    "Tout le monde boit sans respirer entre les gorgées (jusqu’à 6 gorgées)",
    "Tout le groupe fait un cul-sec de spiritueux"
    ],

    CHANCE: [
      "Immunité pour ce tour 😇",
      "Choisis quelqu’un qui boit",
      "Annule ta punition",
      "Transforme ta punition en distribution",
      "Tout le monde boit sauf toi",
    "Tout le monde boit sauf toi",
    "Immunité pour 2 tours 😇",
    "Choisis 2 personnes qui boivent un shot",
    "Renvoie la punition à la personne à ta gauche",
    "Renvoie la punition à la personne à ta droite",
    "Tout le groupe boit 2 gorgées sauf toi",
    "Transforme ta punition en punition pour tout le monde",
    "Choisis quelqu’un qui boit à ta place + tu distribues un shot",
    "Sauvetage divin : annule ta punition et distribue 2 shots",
    "Immunité collective : tout le monde boit 1 gorgée sauf toi",
    "Vol de punition : donne ta punition à quelqu’un d’autre",
    "Double chance : tu choisis qui boit 2 shots",
    "Annule la punition du prochain perdant",
    "Choisis 3 personnes qui doivent boire",
    "Transforme ta punition en Waterfall collectif",
    "Immunité + tu fais boire la personne en face de toi",
    "Carte Joker : tu peux annuler n’importe quelle punition ce tour",
    "Renvoie la punition à celui qui t’a choisi",
    "Tout le monde boit un shot sauf toi et une autre personne de ton choix",
    "Sauvegarde : garde cette carte et utilise-la plus tard",
    "Choisis quelqu’un qui finit son verre",
    "Transforme ta punition en duel (tu choisis l’adversaire)",
    "Immunité Royale : personne ne boit ce tour",
    "Redistribue : tout le monde boit sauf les 2 personnes que tu choisis",
    "Vol d’alcool : fais boire 2 gorgées à la personne de ton choix",
    "Chance du Diable : annule ta punition mais tout le monde boit 3 gorgées",
    "Super Immunité : immunisé pour les 3 prochains tours",
    "Choisis qui boit un cul-sec"
    ],

    CHAOS: [
      "Le groupe invente un gage",
      "Double peine 💀",
      "Le prochain joueur ciblé boit double",
      "Tout le monde vote une sanction",
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
      "Chaos Total : le groupe a 15 secondes pour inventer la punition la plus sale possible",
    "Anarchie Extrême : tout le monde te prépare un shot en même temps → tu bois tout",
    "Double Roulette Russe : tu tournes deux fois, les deux visés boivent un shot fort avec toi",
    "Chaos Collectif : tout le monde boit 3 shots, toi tu en bois 5",
    "Explosion Apocalyptique : distribue 1 shot à tout le monde puis bois 4 d’affilée",
    "Mélange du Diable : tout le groupe verse ce qu’il veut (fort) dans un grand verre → cul-sec",
    "Chaos Timer : 15 secondes pour finir un grand verre sinon tout le monde te rajoute un shot",
    "Le Grand Bordel : tu dois tirer et enchaîner 4 punitions d’affilée",
    "Retour de Flamme Extrême : la personne à gauche ET à droite + en face inventent chacune une punition",
    "Tout le monde vote la punition la plus hardcore possible",
    "Cascade Chaotique Extrême : minimum 20 secondes, tout le monde boit en même temps",
    "Boire 6 shots d’affilée (max 6 secondes entre chaque)",
    "Verre du Démon : tout le monde crache + verse de l’alcool pur dedans → tu le finis",
    "Le Serpent Infernal : tu bois une gorgée à CHAQUE mot prononcé pendant 3 tours",
    "Punition Aléatoire Hard : tire 4 cartes Chaos et fais-les toutes",
    "Chaos Sans Limite : tu bois sans mains jusqu’à la fin de la partie",
    "Inversion Totale + Double : ta punition s’applique à tout le monde x2",
    "Bataille Royale : tu fais un duel shot contre TOUT le groupe un par un",
    "Fin du Monde : tout le monde finit son verre + un shot en plus",
    "Règle du Chaos : pendant 6 tours, tout le monde boit à chaque fois que quelqu’un parle ou rit",
    "Shot dans le nombril + cul-sec direct après",
    "Tout le groupe te prépare un Shot de la Mort (le plus dégueu possible)",
    "Cascade + Verre sans fond : tu commences une cascade et ton verre doit rester plein après",
    "Chaos Ultime : tu deviens la cible de tout le monde pendant 3 tours"
    ],

    SECRET: [
      "Lis ton dernier message",
      "Dis une vérité gênante",
      "Raconte une anecdote interdite",
      "Réponds honnêtement ou bois"
    ]
  }
};

async function initRoulette() {
  const roomSnap = await getDoc(roomRef);

  if (roomSnap.exists()) {
    const roomData = roomSnap.data();
    players = roomData.players || players;
  }

  roomBadge.textContent = `Room ${roomCode}`;
  modeText.textContent = selectedPartyMode;
  drinkLevelText.textContent = drinkLevel;
  playersText.textContent = players.length;

  players.forEach(player => {
    playerStats[player.name] = 0;
  });

  wheelCategories.forEach(category => {
    categoryStats[category] = 0;
  });

  if (players.length < 2) {
    challengeText.textContent = "Ajoute au moins 2 joueurs pour jouer.";
    spinBtn.disabled = true;
    rerollBtn.disabled = true;
    return;
  }

  spinBtn.disabled = false;
  rerollBtn.disabled = false;
  spinBtn.textContent = isHost ? "Lancer la roulette 🎡" : "Faire tourner la roue 🎡";
  rerollBtn.textContent = isHost ? "Relancer 🎲" : "Relancer si c'est ton tour 🎲";

  listenToRouletteState();
}

function getRandomPlayer() {
  return players[Math.floor(Math.random() * players.length)];
}

function getRandomCategory() {
  return wheelCategories[Math.floor(Math.random() * wheelCategories.length)];
}

function getActionPool(category) {
  const modeActions = actions[selectedPartyMode] || actions.Party;
  return modeActions[category] || modeActions.GAGE;
}

function getRandomAction(category) {
  const pool = getActionPool(category);
  return pool[Math.floor(Math.random() * pool.length)];
}

function applyDrinkLevel(action) {
  if (!alcoholMode) {
    return action
      .replaceAll("Shot", "Mini-gage")
      .replaceAll("shot", "mini-gage")
      .replaceAll("Cul-sec", "Gros gage")
      .replaceAll("cul-sec", "gros gage")
      .replaceAll("cul sec", "gros gage")
      .replaceAll("Waterfall", "Défi collectif")
      .replaceAll("boit", "fait un gage")
      .replaceAll("Bois", "Fais un gage");
  }

  if (drinkLevel === "soft") {
    return action
      .replaceAll("Shot soft 🥃", "2 gorgées 🍺")
      .replaceAll("Mini cul-sec 🍺", "2 gorgées 🍺")
      .replaceAll("Waterfall de 5 secondes 🌊", "Waterfall de 3 secondes 🌊");
  }

  if (drinkLevel === "hard") {
    return action
      .replaceAll("3 gorgées", "5 gorgées")
      .replaceAll("2 gorgées", "4 gorgées")
      .replaceAll("Shot soft 🥃", "Shot complet 🥃")
      .replaceAll("Mini cul-sec 🍺", "Cul sec 🍺")
      .replaceAll("Waterfall de 5 secondes 🌊", "Waterfall de 8 secondes 🌊");
  }

  if (drinkLevel === "danger") {
    return action
      .replaceAll("3 gorgées", "SHOT ☠️")
      .replaceAll("2 gorgées", "4 gorgées 💀")
      .replaceAll("Shot soft 🥃", "DOUBLE SHOT ☠️")
      .replaceAll("Mini cul-sec 🍺", "CUL SEC COMPLET 💀")
      .replaceAll("Waterfall de 5 secondes 🌊", "Waterfall de 10 secondes 🌊")
      .replaceAll("boit", "prend une grosse sanction")
      .replaceAll("Bois", "Prends une grosse sanction");
  }

  return action;
}

function buildSpinResult() {
  const category = getRandomCategory();
  const player = getRandomPlayer();

  const rawAction = getRandomAction(category);
  const finalAction = applyDrinkLevel(rawAction);

  const categoryIndex = wheelCategories.indexOf(category);
  const segmentAngle = 360 / wheelCategories.length;

  const categoryCenter = categoryIndex * segmentAngle + segmentAngle / 2;
  const pointerAngle = 270;
  const safeJitter = (Math.random() * (segmentAngle - 12)) - ((segmentAngle - 12) / 2);
  const targetAngle = ((pointerAngle - categoryCenter + safeJitter) % 360 + 360) % 360;
  const currentAngle = ((currentRotation % 360) + 360) % 360;
  const deltaToTarget = ((targetAngle - currentAngle) % 360 + 360) % 360;

  const extraRotation = 1440 + deltaToTarget;

  const newRotation = currentRotation + extraRotation;

  const rareRoll = Math.random();

  let rareEvent = null;

  if (rareRoll < 0.08) {
    const rareEvents = [
      "💀 MEGA CHAOS",
      "🔥 DOUBLE SPIN",
      "☠️ MORT SUBITE",
      "🎯 JACKPOT",
      "⚡ MODE FURIE"
    ];

    rareEvent = rareEvents[Math.floor(Math.random() * rareEvents.length)];
  }

  return {
    spinId: Date.now(),
    status: "spinning",
    rotation: newRotation,
    playerName: player.name,
    category,
    action: finalAction,
    rareEvent,
    createdAt: Date.now(),
    launchedBy: currentPlayerName,
    totalSpins: totalSpins + 1
  };
}

async function spinWheel() {
  if (isSpinning) return;

  const spinData = buildSpinResult();

  await updateDoc(roomRef, {
    rouletteState: spinData,
    gameState: {
      type: "roulette",
      roulette: spinData,
      rotation: spinData.rotation,
      category: spinData.category,
      playerName: spinData.playerName,
      action: spinData.action,
      status: spinData.status,
      totalSpins: spinData.totalSpins,
      updatedAt: Date.now()
    },
    activity: [
      `🎡 ${currentPlayerName} lance la roulette`,
      `${spinData.playerName} tombe sur ${spinData.category}`,
      ...(history || []).map(item => `🎯 ${item.playerName} — ${item.category}`).slice(0, 4)
    ]
  });
}

function listenToRouletteState() {
  onSnapshot(roomRef, snapshot => {
    if (!snapshot.exists()) return;

    const data = snapshot.data();

    if (handleGlobalLobbyReturn(data)) return;

    const rouletteState = data.rouletteState;

    if (!rouletteState) return;
    if (rouletteState.spinId === lastSpinId) return;

    lastSpinId = rouletteState.spinId;
    playSyncedSpin(rouletteState);
  });
}

function playSyncedSpin(state) {
  isSpinning = true;

  spinBtn.disabled = true;
  rerollBtn.disabled = true;

  eventBanner.classList.add("hidden");
  resultBox.classList.add("hidden");
  resultBox.classList.remove("rare");

  wheel.classList.add("spinning");

  currentRotation = state.rotation;
  wheel.style.transform = `rotate(${currentRotation}deg)`;

  setTimeout(() => {
    targetPlayer.textContent = `🎯 ${state.playerName}`;
    categoryText.textContent = `Catégorie : ${state.category}`;
    challengeText.textContent = state.action;
    penaltyText.textContent = "";

    if (state.rareEvent) {
      eventBanner.textContent = state.rareEvent;
      eventBanner.classList.remove("hidden");
      resultBox.classList.add("rare");

      document.body.classList.add("screen-shake");

      setTimeout(() => {
        document.body.classList.remove("screen-shake");
      }, 450);
    }

    resultBox.classList.remove("hidden");

    updateStats(state.playerName, state.category);
    addHistory(state.playerName, state.category, state.action);

    launchConfetti();

    wheel.classList.remove("spinning");
    isSpinning = false;

    spinBtn.disabled = false;
    rerollBtn.disabled = false;
  }, 4400);
}

function updateStats(playerName, category) {
  totalSpins++;

  if (!playerStats[playerName]) {
    playerStats[playerName] = 0;
  }

  if (!categoryStats[category]) {
    categoryStats[category] = 0;
  }

  playerStats[playerName]++;
  categoryStats[category]++;

  spinCount.textContent = totalSpins;

  let topPlayer = "-";
  let topPlayerScore = 0;

  for (const player in playerStats) {
    if (playerStats[player] > topPlayerScore) {
      topPlayer = player;
      topPlayerScore = playerStats[player];
    }
  }

  let topCat = "-";
  let topCatScore = 0;

  for (const categoryName in categoryStats) {
    if (categoryStats[categoryName] > topCatScore) {
      topCat = categoryName;
      topCatScore = categoryStats[categoryName];
    }
  }

  mostTargeted.textContent = topPlayer;
  topCategory.textContent = topCat;
}

function addHistory(playerName, category, action) {
  history.unshift({
    playerName,
    category,
    action
  });

  if (history.length > 5) {
    history.pop();
  }

  renderHistory();
}

function renderHistory() {
  historyList.innerHTML = "";

  history.forEach(item => {
    const li = document.createElement("li");

    li.textContent =
      `${item.playerName} — ${item.category} — ${item.action}`;

    historyList.appendChild(li);
  });
}

function launchConfetti() {
  const colors = [
    "#ff007a",
    "#7b2cff",
    "#00b7ff",
    "#ffb000",
    "#00d084"
  ];

  for (let i = 0; i < 35; i++) {
    const confetti = document.createElement("div");

    confetti.className = "confetti";
    confetti.style.left = `${Math.random() * 100}%`;
    confetti.style.background =
      colors[Math.floor(Math.random() * colors.length)];
    confetti.style.animationDelay = `${Math.random() * 0.3}s`;
    confetti.style.transform = `rotate(${Math.random() * 360}deg)`;

    confettiLayer.appendChild(confetti);

    setTimeout(() => {
      confetti.remove();
    }, 2200);
  }
}

spinBtn.addEventListener("click", spinWheel);
rerollBtn.addEventListener("click", spinWheel);


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
initRoulette();