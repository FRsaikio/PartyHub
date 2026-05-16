import {
  db,
  doc,
  getDoc,
  updateDoc,
  onSnapshot
} from "../../firebase.js";

const backToLobbyBtn = document.getElementById("backToLobbyBtn");

const roomBadge = document.getElementById("roomBadge");
const timerText = document.getElementById("timerText");
const bombWrapper = document.getElementById("bombWrapper");

const categoryText = document.getElementById("categoryText");
const questionText = document.getElementById("questionText");
const instructionText = document.getElementById("instructionText");

const passBombBtn = document.getElementById("passBombBtn");
const nextBombBtn = document.getElementById("nextBombBtn");

const modeText = document.getElementById("modeText");
const drinkLevelText = document.getElementById("drinkLevelText");
const playersText = document.getElementById("playersText");
const roundText = document.getElementById("roundText");

const currentPlayerBox = document.getElementById("currentPlayer");
const resultBox = document.getElementById("resultBox");
const resultTitle = document.getElementById("resultTitle");
const resultText = document.getElementById("resultText");

const historyList = document.getElementById("historyList");
const explosionOverlay = document.getElementById("explosionOverlay");
const confettiLayer = document.getElementById("confettiLayer");


function normalizePartyMode(value) {
  const key = String(value || "party").toLowerCase();
  if (key === "chill") return "Chill";
  if (key === "chaos") return "Chaos";
  if (key === "hardcore") return "Hardcore";
  return "Party";
}

const savedData = JSON.parse(localStorage.getItem("partyhubGameData"));

if (!savedData) {
  alert("Aucune partie trouvée. Retour au lobby.");
  window.location.href = "../../index.html";
}

let players = savedData.players || [];

const selectedPartyMode = normalizePartyMode(savedData.selectedPartyMode || "Party");
const alcoholMode = savedData.alcoholMode;
const drinkLevel = savedData.drinkLevel || "normal";
const roomCode = savedData.roomCode || "----";
const isHost = savedData.isHost === true;
const myProfileId = savedData.currentProfileId || localStorage.getItem("partyhubProfileId") || "";

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


let currentPlayerIndex = 0;
let currentRound = 1;
let timeLeft = 15;
let timerInterval = null;
let gameActive = false;
let history = [];
let lastActionId = null;
let firstBombStateChecked = false;

function getPlayerName(player) {
  return String(player?.name || player?.pseudo || player?.displayName || "").trim();
}

function getPlayerKey(player) {
  return String(player?.profileId || player?.id || player?.uid || getPlayerName(player)).trim().toLowerCase();
}

function getMyKey() {
  return String(myProfileId || savedData.currentPlayer || "").trim().toLowerCase();
}

function isSamePlayer(player) {
  const myKey = getMyKey();
  if (!player || !myKey) return false;
  const playerKey = getPlayerKey(player);
  const myName = String(savedData.currentPlayer || "").trim().toLowerCase();
  return playerKey === myKey || (!!myName && getPlayerName(player).toLowerCase() === myName);
}

function isCurrentPlayerTurn() {
  return isSamePlayer(players[currentPlayerIndex]);
}

function updateBombControls() {
  const canAct = gameActive && isCurrentPlayerTurn();
  const canStartNext = !gameActive && (isHost || isCurrentPlayerTurn());

  passBombBtn.disabled = !canAct;
  passBombBtn.textContent = canAct ? "Passer la bombe 💣" : "Attente du joueur concerné";

  if (!gameActive) {
    nextBombBtn.disabled = !canStartNext;
    nextBombBtn.textContent = canStartNext ? "Nouvelle bombe 🔥" : "Attente host / joueur concerné";
  }
}


const questions = {
  Chill: [
    "Cite 3 boissons sans alcool.",
    "Cite 3 boissons sans alcool en moins de 5 secondes.",
    "Cite 3 boissons sans alcool sans hésiter.",
    "Cite 3 boissons sans alcool que tout le monde connaît.",
    "Cite 3 snacks de soirée.",
    "Cite 3 snacks de soirée en moins de 5 secondes.",
    "Cite 3 snacks de soirée sans hésiter.",
    "Cite 3 snacks de soirée que tout le monde connaît.",
    "Cite 3 excuses pour arriver en retard.",
    "Cite 3 excuses pour arriver en retard en moins de 5 secondes.",
    "Cite 3 excuses pour arriver en retard sans hésiter.",
    "Cite 3 excuses pour arriver en retard que tout le monde connaît.",
    "Cite 3 chansons connues.",
    "Cite 3 chansons connues en moins de 5 secondes.",
    "Cite 3 chansons connues sans hésiter.",
    "Cite 3 chansons connues que tout le monde connaît.",
    "Cite 3 films cultes.",
    "Cite 3 films cultes en moins de 5 secondes.",
    "Cite 3 films cultes sans hésiter.",
    "Cite 3 films cultes que tout le monde connaît.",
    "Cite 3 applis sur ton téléphone.",
    "Cite 3 applis sur ton téléphone en moins de 5 secondes.",
    "Cite 3 applis sur ton téléphone sans hésiter.",
    "Cite 3 applis sur ton téléphone que tout le monde connaît.",
    "Cite 3 objets sur la table.",
    "Cite 3 objets sur la table en moins de 5 secondes.",
    "Cite 3 objets sur la table sans hésiter.",
    "Cite 3 objets sur la table que tout le monde connaît.",
    "Cite 3 mots qui font rire.",
    "Cite 3 mots qui font rire en moins de 5 secondes.",
    "Cite 3 mots qui font rire sans hésiter.",
    "Cite 3 mots qui font rire que tout le monde connaît.",
    "Cite 3 prénoms du groupe.",
    "Cite 3 prénoms du groupe en moins de 5 secondes.",
    "Cite 3 prénoms du groupe sans hésiter.",
    "Cite 3 prénoms du groupe que tout le monde connaît.",
    "Cite 3 choses qu’on perd souvent.",
    "Cite 3 choses qu’on perd souvent en moins de 5 secondes.",
    "Cite 3 choses qu’on perd souvent sans hésiter.",
    "Cite 3 choses qu’on perd souvent que tout le monde connaît.",
    "Cite 3 desserts.",
    "Cite 3 desserts en moins de 5 secondes.",
    "Cite 3 desserts sans hésiter.",
    "Cite 3 desserts que tout le monde connaît.",
    "Cite 3 marques de soda.",
    "Cite 3 marques de soda en moins de 5 secondes.",
    "Cite 3 marques de soda sans hésiter.",
    "Cite 3 marques de soda que tout le monde connaît.",
    "Cite 3 plats rapides.",
    "Cite 3 plats rapides en moins de 5 secondes.",
    "Cite 3 plats rapides sans hésiter.",
    "Cite 3 plats rapides que tout le monde connaît.",
    "Cite 3 animaux mignons.",
    "Cite 3 animaux mignons en moins de 5 secondes.",
    "Cite 3 animaux mignons sans hésiter.",
    "Cite 3 animaux mignons que tout le monde connaît.",
    "Cite 3 villes françaises.",
    "Cite 3 villes françaises en moins de 5 secondes.",
    "Cite 3 villes françaises sans hésiter.",
    "Cite 3 villes françaises que tout le monde connaît.",
    "Cite 3 pays d’Europe.",
    "Cite 3 pays d’Europe en moins de 5 secondes.",
    "Cite 3 pays d’Europe sans hésiter.",
    "Cite 3 pays d’Europe que tout le monde connaît.",
    "Cite 3 sports faciles à citer.",
    "Cite 3 sports faciles à citer en moins de 5 secondes.",
    "Cite 3 sports faciles à citer sans hésiter.",
    "Cite 3 sports faciles à citer que tout le monde connaît.",
    "Cite 3 couleurs.",
    "Cite 3 couleurs en moins de 5 secondes.",
    "Cite 3 couleurs sans hésiter.",
    "Cite 3 couleurs que tout le monde connaît.",
    "Cite 3 émoticônes.",
    "Cite 3 émoticônes en moins de 5 secondes.",
    "Cite 3 émoticônes sans hésiter.",
    "Cite 3 émoticônes que tout le monde connaît.",
    "Cite 3 super-héros.",
    "Cite 3 super-héros en moins de 5 secondes.",
    "Cite 3 super-héros sans hésiter.",
    "Cite 3 super-héros que tout le monde connaît.",
    "Cite 3 dessins animés.",
    "Cite 3 dessins animés en moins de 5 secondes.",
    "Cite 3 dessins animés sans hésiter.",
    "Cite 3 dessins animés que tout le monde connaît.",
    "Cite 3 objets dans une cuisine.",
    "Cite 3 objets dans une cuisine en moins de 5 secondes.",
    "Cite 3 objets dans une cuisine sans hésiter.",
    "Cite 3 objets dans une cuisine que tout le monde connaît.",
    "Cite 3 trucs qu’on met dans un sac.",
    "Cite 3 trucs qu’on met dans un sac en moins de 5 secondes.",
    "Cite 3 trucs qu’on met dans un sac sans hésiter.",
    "Cite 3 trucs qu’on met dans un sac que tout le monde connaît.",
    "Cite 3 raisons de faire une pause.",
    "Cite 3 raisons de faire une pause en moins de 5 secondes.",
    "Cite 3 raisons de faire une pause sans hésiter.",
    "Cite 3 raisons de faire une pause que tout le monde connaît.",
    "Cite 3 jeux de société.",
    "Cite 3 jeux de société en moins de 5 secondes.",
    "Cite 3 jeux de société sans hésiter.",
    "Cite 3 jeux de société que tout le monde connaît.",
    "Cite 3 choses qui coûtent moins de 5 euros.",
    "Cite 3 choses qui coûtent moins de 5 euros en moins de 5 secondes.",
    "Cite 3 choses qui coûtent moins de 5 euros sans hésiter.",
    "Cite 3 choses qui coûtent moins de 5 euros que tout le monde connaît.",
    "Cite 3 objets rouges.",
    "Cite 3 objets rouges en moins de 5 secondes.",
    "Cite 3 objets rouges sans hésiter.",
    "Cite 3 objets rouges que tout le monde connaît.",
    "Cite 3 choses froides.",
    "Cite 3 choses froides en moins de 5 secondes.",
    "Cite 3 choses froides sans hésiter.",
    "Cite 3 choses froides que tout le monde connaît.",
    "Cite 3 choses chaudes.",
    "Cite 3 choses chaudes en moins de 5 secondes.",
    "Cite 3 choses chaudes sans hésiter.",
    "Cite 3 choses chaudes que tout le monde connaît.",
    "Cite 3 mots anglais connus.",
    "Cite 3 mots anglais connus en moins de 5 secondes.",
    "Cite 3 mots anglais connus sans hésiter.",
    "Cite 3 mots anglais connus que tout le monde connaît."
  ],

  Party: [
    "Cite 3 alcools.",
    "Cite 3 alcools en moins de 5 secondes.",
    "Cite 3 alcools sans hésiter.",
    "Cite 3 alcools que tout le monde connaît.",
    "Cite 3 cocktails.",
    "Cite 3 cocktails en moins de 5 secondes.",
    "Cite 3 cocktails sans hésiter.",
    "Cite 3 cocktails que tout le monde connaît.",
    "Cite 3 raisons de boire.",
    "Cite 3 raisons de boire en moins de 5 secondes.",
    "Cite 3 raisons de boire sans hésiter.",
    "Cite 3 raisons de boire que tout le monde connaît.",
    "Cite 3 chansons de soirée.",
    "Cite 3 chansons de soirée en moins de 5 secondes.",
    "Cite 3 chansons de soirée sans hésiter.",
    "Cite 3 chansons de soirée que tout le monde connaît.",
    "Cite 3 choses qu’on crie bourré.",
    "Cite 3 choses qu’on crie bourré en moins de 5 secondes.",
    "Cite 3 choses qu’on crie bourré sans hésiter.",
    "Cite 3 choses qu’on crie bourré que tout le monde connaît.",
    "Cite 3 jeux d’alcool.",
    "Cite 3 jeux d’alcool en moins de 5 secondes.",
    "Cite 3 jeux d’alcool sans hésiter.",
    "Cite 3 jeux d’alcool que tout le monde connaît.",
    "Cite 3 marques de bière.",
    "Cite 3 marques de bière en moins de 5 secondes.",
    "Cite 3 marques de bière sans hésiter.",
    "Cite 3 marques de bière que tout le monde connaît.",
    "Cite 3 endroits où sortir.",
    "Cite 3 endroits où sortir en moins de 5 secondes.",
    "Cite 3 endroits où sortir sans hésiter.",
    "Cite 3 endroits où sortir que tout le monde connaît.",
    "Cite 3 trucs qu’on regrette le lendemain.",
    "Cite 3 trucs qu’on regrette le lendemain en moins de 5 secondes.",
    "Cite 3 trucs qu’on regrette le lendemain sans hésiter.",
    "Cite 3 trucs qu’on regrette le lendemain que tout le monde connaît.",
    "Cite 3 excuses pour reprendre un verre.",
    "Cite 3 excuses pour reprendre un verre en moins de 5 secondes.",
    "Cite 3 excuses pour reprendre un verre sans hésiter.",
    "Cite 3 excuses pour reprendre un verre que tout le monde connaît.",
    "Cite 3 phrases de soirée.",
    "Cite 3 phrases de soirée en moins de 5 secondes.",
    "Cite 3 phrases de soirée sans hésiter.",
    "Cite 3 phrases de soirée que tout le monde connaît.",
    "Cite 3 danses ridicules.",
    "Cite 3 danses ridicules en moins de 5 secondes.",
    "Cite 3 danses ridicules sans hésiter.",
    "Cite 3 danses ridicules que tout le monde connaît.",
    "Cite 3 objets qu’on perd en soirée.",
    "Cite 3 objets qu’on perd en soirée en moins de 5 secondes.",
    "Cite 3 objets qu’on perd en soirée sans hésiter.",
    "Cite 3 objets qu’on perd en soirée que tout le monde connaît.",
    "Cite 3 boissons à mélanger.",
    "Cite 3 boissons à mélanger en moins de 5 secondes.",
    "Cite 3 boissons à mélanger sans hésiter.",
    "Cite 3 boissons à mélanger que tout le monde connaît.",
    "Cite 3 sons qui mettent l’ambiance.",
    "Cite 3 sons qui mettent l’ambiance en moins de 5 secondes.",
    "Cite 3 sons qui mettent l’ambiance sans hésiter.",
    "Cite 3 sons qui mettent l’ambiance que tout le monde connaît.",
    "Cite 3 raisons de faire un after.",
    "Cite 3 raisons de faire un after en moins de 5 secondes.",
    "Cite 3 raisons de faire un after sans hésiter.",
    "Cite 3 raisons de faire un after que tout le monde connaît.",
    "Cite 3 règles de jeu d’alcool.",
    "Cite 3 règles de jeu d’alcool en moins de 5 secondes.",
    "Cite 3 règles de jeu d’alcool sans hésiter.",
    "Cite 3 règles de jeu d’alcool que tout le monde connaît.",
    "Cite 3 mots interdits en soirée.",
    "Cite 3 mots interdits en soirée en moins de 5 secondes.",
    "Cite 3 mots interdits en soirée sans hésiter.",
    "Cite 3 mots interdits en soirée que tout le monde connaît.",
    "Cite 3 choses à dire avant un shot.",
    "Cite 3 choses à dire avant un shot en moins de 5 secondes.",
    "Cite 3 choses à dire avant un shot sans hésiter.",
    "Cite 3 choses à dire avant un shot que tout le monde connaît.",
    "Cite 3 signes que quelqu’un est bourré.",
    "Cite 3 signes que quelqu’un est bourré en moins de 5 secondes.",
    "Cite 3 signes que quelqu’un est bourré sans hésiter.",
    "Cite 3 signes que quelqu’un est bourré que tout le monde connaît.",
    "Cite 3 snacks d’après-soirée.",
    "Cite 3 snacks d’après-soirée en moins de 5 secondes.",
    "Cite 3 snacks d’après-soirée sans hésiter.",
    "Cite 3 snacks d’après-soirée que tout le monde connaît.",
    "Cite 3 verres différents.",
    "Cite 3 verres différents en moins de 5 secondes.",
    "Cite 3 verres différents sans hésiter.",
    "Cite 3 verres différents que tout le monde connaît.",
    "Cite 3 défis faciles.",
    "Cite 3 défis faciles en moins de 5 secondes.",
    "Cite 3 défis faciles sans hésiter.",
    "Cite 3 défis faciles que tout le monde connaît.",
    "Cite 3 prétextes pour trinquer.",
    "Cite 3 prétextes pour trinquer en moins de 5 secondes.",
    "Cite 3 prétextes pour trinquer sans hésiter.",
    "Cite 3 prétextes pour trinquer que tout le monde connaît.",
    "Cite 3 lieux improbables pour finir la soirée.",
    "Cite 3 lieux improbables pour finir la soirée en moins de 5 secondes.",
    "Cite 3 lieux improbables pour finir la soirée sans hésiter.",
    "Cite 3 lieux improbables pour finir la soirée que tout le monde connaît.",
    "Cite 3 choses à éviter en boîte.",
    "Cite 3 choses à éviter en boîte en moins de 5 secondes.",
    "Cite 3 choses à éviter en boîte sans hésiter.",
    "Cite 3 choses à éviter en boîte que tout le monde connaît.",
    "Cite 3 phrases de DJ nul.",
    "Cite 3 phrases de DJ nul en moins de 5 secondes.",
    "Cite 3 phrases de DJ nul sans hésiter.",
    "Cite 3 phrases de DJ nul que tout le monde connaît.",
    "Cite 3 objets utiles en soirée.",
    "Cite 3 objets utiles en soirée en moins de 5 secondes.",
    "Cite 3 objets utiles en soirée sans hésiter.",
    "Cite 3 objets utiles en soirée que tout le monde connaît.",
    "Cite 3 façons de porter un toast.",
    "Cite 3 façons de porter un toast en moins de 5 secondes.",
    "Cite 3 façons de porter un toast sans hésiter.",
    "Cite 3 façons de porter un toast que tout le monde connaît.",
    "Cite 3 raisons d’avoir soif.",
    "Cite 3 raisons d’avoir soif en moins de 5 secondes.",
    "Cite 3 raisons d’avoir soif sans hésiter.",
    "Cite 3 raisons d’avoir soif que tout le monde connaît."
  ],

  Chaos: [
    "Cite 3 personnes à qui il ne faut pas envoyer de message bourré.",
    "Cite 3 personnes à qui il ne faut pas envoyer de message bourré en moins de 5 secondes.",
    "Cite 3 personnes à qui il ne faut pas envoyer de message bourré sans hésiter.",
    "Cite 3 personnes à qui il ne faut pas envoyer de message bourré que tout le monde connaît.",
    "Cite 3 messages dangereux à envoyer à son ex.",
    "Cite 3 messages dangereux à envoyer à son ex en moins de 5 secondes.",
    "Cite 3 messages dangereux à envoyer à son ex sans hésiter.",
    "Cite 3 messages dangereux à envoyer à son ex que tout le monde connaît.",
    "Cite 3 raisons de supprimer une story.",
    "Cite 3 raisons de supprimer une story en moins de 5 secondes.",
    "Cite 3 raisons de supprimer une story sans hésiter.",
    "Cite 3 raisons de supprimer une story que tout le monde connaît.",
    "Cite 3 situations gênantes en soirée.",
    "Cite 3 situations gênantes en soirée en moins de 5 secondes.",
    "Cite 3 situations gênantes en soirée sans hésiter.",
    "Cite 3 situations gênantes en soirée que tout le monde connaît.",
    "Cite 3 mensonges pour cacher son état.",
    "Cite 3 mensonges pour cacher son état en moins de 5 secondes.",
    "Cite 3 mensonges pour cacher son état sans hésiter.",
    "Cite 3 mensonges pour cacher son état que tout le monde connaît.",
    "Cite 3 phrases dites par quelqu’un qui est trop bourré.",
    "Cite 3 phrases dites par quelqu’un qui est trop bourré en moins de 5 secondes.",
    "Cite 3 phrases dites par quelqu’un qui est trop bourré sans hésiter.",
    "Cite 3 phrases dites par quelqu’un qui est trop bourré que tout le monde connaît.",
    "Cite 3 décisions nulles après minuit.",
    "Cite 3 décisions nulles après minuit en moins de 5 secondes.",
    "Cite 3 décisions nulles après minuit sans hésiter.",
    "Cite 3 décisions nulles après minuit que tout le monde connaît.",
    "Cite 3 red flags en soirée.",
    "Cite 3 red flags en soirée en moins de 5 secondes.",
    "Cite 3 red flags en soirée sans hésiter.",
    "Cite 3 red flags en soirée que tout le monde connaît.",
    "Cite 3 choses qu’il ne faut jamais filmer.",
    "Cite 3 choses qu’il ne faut jamais filmer en moins de 5 secondes.",
    "Cite 3 choses qu’il ne faut jamais filmer sans hésiter.",
    "Cite 3 choses qu’il ne faut jamais filmer que tout le monde connaît.",
    "Cite 3 moyens de créer un drama.",
    "Cite 3 moyens de créer un drama en moins de 5 secondes.",
    "Cite 3 moyens de créer un drama sans hésiter.",
    "Cite 3 moyens de créer un drama que tout le monde connaît.",
    "Cite 3 excuses après une dinguerie.",
    "Cite 3 excuses après une dinguerie en moins de 5 secondes.",
    "Cite 3 excuses après une dinguerie sans hésiter.",
    "Cite 3 excuses après une dinguerie que tout le monde connaît.",
    "Cite 3 phrases impossibles à assumer.",
    "Cite 3 phrases impossibles à assumer en moins de 5 secondes.",
    "Cite 3 phrases impossibles à assumer sans hésiter.",
    "Cite 3 phrases impossibles à assumer que tout le monde connaît.",
    "Cite 3 trucs qu’on nie le lendemain.",
    "Cite 3 trucs qu’on nie le lendemain en moins de 5 secondes.",
    "Cite 3 trucs qu’on nie le lendemain sans hésiter.",
    "Cite 3 trucs qu’on nie le lendemain que tout le monde connaît.",
    "Cite 3 signes d’un mauvais plan.",
    "Cite 3 signes d’un mauvais plan en moins de 5 secondes.",
    "Cite 3 signes d’un mauvais plan sans hésiter.",
    "Cite 3 signes d’un mauvais plan que tout le monde connaît.",
    "Cite 3 façons de se faire griller.",
    "Cite 3 façons de se faire griller en moins de 5 secondes.",
    "Cite 3 façons de se faire griller sans hésiter.",
    "Cite 3 façons de se faire griller que tout le monde connaît.",
    "Cite 3 raisons de paniquer pour rien.",
    "Cite 3 raisons de paniquer pour rien en moins de 5 secondes.",
    "Cite 3 raisons de paniquer pour rien sans hésiter.",
    "Cite 3 raisons de paniquer pour rien que tout le monde connaît.",
    "Cite 3 mauvaises idées de groupe.",
    "Cite 3 mauvaises idées de groupe en moins de 5 secondes.",
    "Cite 3 mauvaises idées de groupe sans hésiter.",
    "Cite 3 mauvaises idées de groupe que tout le monde connaît.",
    "Cite 3 choses à ne pas poster.",
    "Cite 3 choses à ne pas poster en moins de 5 secondes.",
    "Cite 3 choses à ne pas poster sans hésiter.",
    "Cite 3 choses à ne pas poster que tout le monde connaît.",
    "Cite 3 situations où il faut appeler un pote.",
    "Cite 3 situations où il faut appeler un pote en moins de 5 secondes.",
    "Cite 3 situations où il faut appeler un pote sans hésiter.",
    "Cite 3 situations où il faut appeler un pote que tout le monde connaît.",
    "Cite 3 phrases à ne pas dire à son crush.",
    "Cite 3 phrases à ne pas dire à son crush en moins de 5 secondes.",
    "Cite 3 phrases à ne pas dire à son crush sans hésiter.",
    "Cite 3 phrases à ne pas dire à son crush que tout le monde connaît.",
    "Cite 3 objets qu’on peut casser en soirée.",
    "Cite 3 objets qu’on peut casser en soirée en moins de 5 secondes.",
    "Cite 3 objets qu’on peut casser en soirée sans hésiter.",
    "Cite 3 objets qu’on peut casser en soirée que tout le monde connaît.",
    "Cite 3 moyens de perdre sa dignité.",
    "Cite 3 moyens de perdre sa dignité en moins de 5 secondes.",
    "Cite 3 moyens de perdre sa dignité sans hésiter.",
    "Cite 3 moyens de perdre sa dignité que tout le monde connaît.",
    "Cite 3 confessions trop honnêtes.",
    "Cite 3 confessions trop honnêtes en moins de 5 secondes.",
    "Cite 3 confessions trop honnêtes sans hésiter.",
    "Cite 3 confessions trop honnêtes que tout le monde connaît.",
    "Cite 3 choses à ne pas envoyer en vocal.",
    "Cite 3 choses à ne pas envoyer en vocal en moins de 5 secondes.",
    "Cite 3 choses à ne pas envoyer en vocal sans hésiter.",
    "Cite 3 choses à ne pas envoyer en vocal que tout le monde connaît.",
    "Cite 3 raisons d’être dans le débrief.",
    "Cite 3 raisons d’être dans le débrief en moins de 5 secondes.",
    "Cite 3 raisons d’être dans le débrief sans hésiter.",
    "Cite 3 raisons d’être dans le débrief que tout le monde connaît.",
    "Cite 3 moments où il faut rentrer.",
    "Cite 3 moments où il faut rentrer en moins de 5 secondes.",
    "Cite 3 moments où il faut rentrer sans hésiter.",
    "Cite 3 moments où il faut rentrer que tout le monde connaît.",
    "Cite 3 prétextes pour disparaître.",
    "Cite 3 prétextes pour disparaître en moins de 5 secondes.",
    "Cite 3 prétextes pour disparaître sans hésiter.",
    "Cite 3 prétextes pour disparaître que tout le monde connaît.",
    "Cite 3 choses que le groupe ne pardonne pas.",
    "Cite 3 choses que le groupe ne pardonne pas en moins de 5 secondes.",
    "Cite 3 choses que le groupe ne pardonne pas sans hésiter.",
    "Cite 3 choses que le groupe ne pardonne pas que tout le monde connaît.",
    "Cite 3 mauvaises excuses de lendemain.",
    "Cite 3 mauvaises excuses de lendemain en moins de 5 secondes.",
    "Cite 3 mauvaises excuses de lendemain sans hésiter.",
    "Cite 3 mauvaises excuses de lendemain que tout le monde connaît.",
    "Cite 3 situations de honte.",
    "Cite 3 situations de honte en moins de 5 secondes.",
    "Cite 3 situations de honte sans hésiter.",
    "Cite 3 situations de honte que tout le monde connaît."
  ],

  Hardcore: [
    "Cite 3 raisons de finir en débrief le lendemain.",
    "Cite 3 raisons de finir en débrief le lendemain en moins de 5 secondes.",
    "Cite 3 raisons de finir en débrief le lendemain sans hésiter.",
    "Cite 3 raisons de finir en débrief le lendemain que tout le monde connaît.",
    "Cite 3 erreurs impossibles à assumer.",
    "Cite 3 erreurs impossibles à assumer en moins de 5 secondes.",
    "Cite 3 erreurs impossibles à assumer sans hésiter.",
    "Cite 3 erreurs impossibles à assumer que tout le monde connaît.",
    "Cite 3 phrases avant une catastrophe.",
    "Cite 3 phrases avant une catastrophe en moins de 5 secondes.",
    "Cite 3 phrases avant une catastrophe sans hésiter.",
    "Cite 3 phrases avant une catastrophe que tout le monde connaît.",
    "Cite 3 situations qui méritent un cul-sec.",
    "Cite 3 situations qui méritent un cul-sec en moins de 5 secondes.",
    "Cite 3 situations qui méritent un cul-sec sans hésiter.",
    "Cite 3 situations qui méritent un cul-sec que tout le monde connaît.",
    "Cite 3 gens qui devraient boire maintenant.",
    "Cite 3 gens qui devraient boire maintenant en moins de 5 secondes.",
    "Cite 3 gens qui devraient boire maintenant sans hésiter.",
    "Cite 3 gens qui devraient boire maintenant que tout le monde connaît.",
    "Cite 3 excuses nulles après une soirée.",
    "Cite 3 excuses nulles après une soirée en moins de 5 secondes.",
    "Cite 3 excuses nulles après une soirée sans hésiter.",
    "Cite 3 excuses nulles après une soirée que tout le monde connaît.",
    "Cite 3 décisions de fin de soirée horribles.",
    "Cite 3 décisions de fin de soirée horribles en moins de 5 secondes.",
    "Cite 3 décisions de fin de soirée horribles sans hésiter.",
    "Cite 3 décisions de fin de soirée horribles que tout le monde connaît.",
    "Cite 3 choses qu’on nie toujours le lendemain.",
    "Cite 3 choses qu’on nie toujours le lendemain en moins de 5 secondes.",
    "Cite 3 choses qu’on nie toujours le lendemain sans hésiter.",
    "Cite 3 choses qu’on nie toujours le lendemain que tout le monde connaît.",
    "Cite 3 manières de devenir la légende du groupe.",
    "Cite 3 manières de devenir la légende du groupe en moins de 5 secondes.",
    "Cite 3 manières de devenir la légende du groupe sans hésiter.",
    "Cite 3 manières de devenir la légende du groupe que tout le monde connaît.",
    "Cite 3 raisons de ne plus jamais choisir la musique.",
    "Cite 3 raisons de ne plus jamais choisir la musique en moins de 5 secondes.",
    "Cite 3 raisons de ne plus jamais choisir la musique sans hésiter.",
    "Cite 3 raisons de ne plus jamais choisir la musique que tout le monde connaît.",
    "Cite 3 signes que la soirée part trop loin.",
    "Cite 3 signes que la soirée part trop loin en moins de 5 secondes.",
    "Cite 3 signes que la soirée part trop loin sans hésiter.",
    "Cite 3 signes que la soirée part trop loin que tout le monde connaît.",
    "Cite 3 missions impossibles en soirée.",
    "Cite 3 missions impossibles en soirée en moins de 5 secondes.",
    "Cite 3 missions impossibles en soirée sans hésiter.",
    "Cite 3 missions impossibles en soirée que tout le monde connaît.",
    "Cite 3 façons de se faire roast.",
    "Cite 3 façons de se faire roast en moins de 5 secondes.",
    "Cite 3 façons de se faire roast sans hésiter.",
    "Cite 3 façons de se faire roast que tout le monde connaît.",
    "Cite 3 phrases de mauvaise foi.",
    "Cite 3 phrases de mauvaise foi en moins de 5 secondes.",
    "Cite 3 phrases de mauvaise foi sans hésiter.",
    "Cite 3 phrases de mauvaise foi que tout le monde connaît.",
    "Cite 3 raisons de perdre un duel.",
    "Cite 3 raisons de perdre un duel en moins de 5 secondes.",
    "Cite 3 raisons de perdre un duel sans hésiter.",
    "Cite 3 raisons de perdre un duel que tout le monde connaît.",
    "Cite 3 situations de chaos total.",
    "Cite 3 situations de chaos total en moins de 5 secondes.",
    "Cite 3 situations de chaos total sans hésiter.",
    "Cite 3 situations de chaos total que tout le monde connaît.",
    "Cite 3 choses que personne ne devrait raconter.",
    "Cite 3 choses que personne ne devrait raconter en moins de 5 secondes.",
    "Cite 3 choses que personne ne devrait raconter sans hésiter.",
    "Cite 3 choses que personne ne devrait raconter que tout le monde connaît.",
    "Cite 3 manières de perdre un pari.",
    "Cite 3 manières de perdre un pari en moins de 5 secondes.",
    "Cite 3 manières de perdre un pari sans hésiter.",
    "Cite 3 manières de perdre un pari que tout le monde connaît.",
    "Cite 3 défis qui tournent mal.",
    "Cite 3 défis qui tournent mal en moins de 5 secondes.",
    "Cite 3 défis qui tournent mal sans hésiter.",
    "Cite 3 défis qui tournent mal que tout le monde connaît.",
    "Cite 3 raisons de prendre un shot.",
    "Cite 3 raisons de prendre un shot en moins de 5 secondes.",
    "Cite 3 raisons de prendre un shot sans hésiter.",
    "Cite 3 raisons de prendre un shot que tout le monde connaît.",
    "Cite 3 comportements de fin de soirée.",
    "Cite 3 comportements de fin de soirée en moins de 5 secondes.",
    "Cite 3 comportements de fin de soirée sans hésiter.",
    "Cite 3 comportements de fin de soirée que tout le monde connaît.",
    "Cite 3 façons de ruiner son lendemain.",
    "Cite 3 façons de ruiner son lendemain en moins de 5 secondes.",
    "Cite 3 façons de ruiner son lendemain sans hésiter.",
    "Cite 3 façons de ruiner son lendemain que tout le monde connaît.",
    "Cite 3 phrases de quelqu’un qui ne gère rien.",
    "Cite 3 phrases de quelqu’un qui ne gère rien en moins de 5 secondes.",
    "Cite 3 phrases de quelqu’un qui ne gère rien sans hésiter.",
    "Cite 3 phrases de quelqu’un qui ne gère rien que tout le monde connaît.",
    "Cite 3 raisons d’avoir besoin d’un pote.",
    "Cite 3 raisons d’avoir besoin d’un pote en moins de 5 secondes.",
    "Cite 3 raisons d’avoir besoin d’un pote sans hésiter.",
    "Cite 3 raisons d’avoir besoin d’un pote que tout le monde connaît.",
    "Cite 3 moments où tout bascule.",
    "Cite 3 moments où tout bascule en moins de 5 secondes.",
    "Cite 3 moments où tout bascule sans hésiter.",
    "Cite 3 moments où tout bascule que tout le monde connaît.",
    "Cite 3 types de décisions catastrophiques.",
    "Cite 3 types de décisions catastrophiques en moins de 5 secondes.",
    "Cite 3 types de décisions catastrophiques sans hésiter.",
    "Cite 3 types de décisions catastrophiques que tout le monde connaît.",
    "Cite 3 preuves qu’il faut arrêter.",
    "Cite 3 preuves qu’il faut arrêter en moins de 5 secondes.",
    "Cite 3 preuves qu’il faut arrêter sans hésiter.",
    "Cite 3 preuves qu’il faut arrêter que tout le monde connaît.",
    "Cite 3 raisons de regretter le mode hardcore.",
    "Cite 3 raisons de regretter le mode hardcore en moins de 5 secondes.",
    "Cite 3 raisons de regretter le mode hardcore sans hésiter.",
    "Cite 3 raisons de regretter le mode hardcore que tout le monde connaît.",
    "Cite 3 façons d’être la cible.",
    "Cite 3 façons d’être la cible en moins de 5 secondes.",
    "Cite 3 façons d’être la cible sans hésiter.",
    "Cite 3 façons d’être la cible que tout le monde connaît.",
    "Cite 3 situations de punition collective.",
    "Cite 3 situations de punition collective en moins de 5 secondes.",
    "Cite 3 situations de punition collective sans hésiter.",
    "Cite 3 situations de punition collective que tout le monde connaît."
  ]
};

const punishments = {
  Chill: [
    "Bois 1 gorgée 🍺",
    "Bois 2 gorgées 🍺",
    "Distribue 2 gorgées",
    "Fais un mini-gage 😇",
    "Choisis quelqu’un qui boit avec toi",
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
  Party: [
    "Bois 3 gorgées 🍻",
    "Bois 4 gorgées 🍻",
    "Shot soft 🥃",
    "Mini cul-sec 🍺",
    "Waterfall 5 secondes 🌊",
    "Distribue 4 gorgées",
    "Bois avec la personne à ta gauche",
    "Tout le monde trinque, toi tu bois deux fois",
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
  Chaos: [
    "Shot 🥃",
    "Cul sec 🍺",
    "Bois 5 gorgées 💀",
    "Waterfall 8 secondes 🌊",
    "Distribue 6 gorgées",
    "Shot ou vérité gênante",
    "Le groupe choisit ta punition",
    "Bois avec quelqu’un désigné par le groupe",
    "Double peine au prochain round",
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
  ],
  Hardcore: [
    "SHOT COMPLET ☠️",
    "CUL SEC COMPLET 💀",
    "Double shot ou gros gage",
    "Waterfall 10 secondes 🌊",
    "Distribue 10 gorgées",
    "Shot mystère 🎲",
    "Le groupe décide de ton sort",
    "Punition collective : tout le monde boit",
    "Shot ou vérité hardcore",
    "Tu prends une double peine si tu rates encore",
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
};

async function initGame() {
  const roomSnap = await getDoc(roomRef);

  if (roomSnap.exists()) {
    const roomData = roomSnap.data();
    players = roomData.players || players;
  }

  roomBadge.textContent = `Room ${roomCode}`;
  modeText.textContent = selectedPartyMode;
  drinkLevelText.textContent = getDrinkLevelLabel();
  playersText.textContent = players.length;
  roundText.textContent = currentRound;

  if (players.length < 2) {
    questionText.textContent = "Ajoute au moins 2 joueurs pour jouer.";
    passBombBtn.disabled = true;
    nextBombBtn.classList.add("hidden");
    return;
  }

  passBombBtn.disabled = true;
  passBombBtn.textContent = "Attente du joueur concerné";

  listenToBombState();

  if (isHost) {
    createRoundState(1, 0);
  } else {
    setTimeout(async () => {
      if (!firstBombStateChecked) {
        const fresh = await getDoc(roomRef);
        if (fresh.exists() && !fresh.data().bombTimerState) {
          await createRoundState(1, 0, true);
        }
      }
    }, 900);
  }
}

function getDrinkLevelLabel() {
  if (drinkLevel === "soft") return "Soft";
  if (drinkLevel === "normal") return "Normal";
  if (drinkLevel === "hard") return "Hard";
  if (drinkLevel === "danger" || drinkLevel === "extreme") return "Extrême";
  return "Normal";
}

function getBaseTime() {
  if (drinkLevel === "soft") return 22;
  if (drinkLevel === "normal") return 16;
  if (drinkLevel === "hard") return 12;
  if (drinkLevel === "danger") return 8;
  return 15;
}

function getQuestionPool() {
  return questions[selectedPartyMode] || questions.Party;
}

function getRandomQuestion() {
  const pool = getQuestionPool();
  return pool[Math.floor(Math.random() * pool.length)];
}

function getRandomPunishment() {
  if (!alcoholMode) {
    const soft = [
      "Fais un gros gage 😇",
      "Raconte une vérité",
      "Le groupe choisit un mini-gage",
      "Fais une imitation",
      "Danse 10 secondes",
      "Complimente quelqu’un de manière dramatique"
    ];

    return soft[Math.floor(Math.random() * soft.length)];
  }

  const pool = punishments[selectedPartyMode] || punishments.Party;
  return pool[Math.floor(Math.random() * pool.length)];
}

function getCategoryLabel() {
  if (selectedPartyMode === "Chill") return "😇 Chill";
  if (selectedPartyMode === "Party") return "🍻 Party";
  if (selectedPartyMode === "Chaos") return "💀 Chaos";
  if (selectedPartyMode === "Hardcore") return "☠️ Hardcore";
  return "💣 Question";
}

async function createRoundState(round, playerIndex, forceInit = false) {
  if (!isHost && !forceInit) return;

  const duration = getBaseTime();

  await updateDoc(roomRef, {
    bombTimerState: {
      actionId: Date.now(),
      type: "round",
      round,
      playerIndex,
      question: getRandomQuestion(),
      category: getCategoryLabel(),
      duration,
      startedAt: Date.now(),
      active: true
    }
  });
}

async function passBomb() {
  if (!gameActive || !isCurrentPlayerTurn()) return;

  let nextIndex = currentPlayerIndex + 1;

  if (nextIndex >= players.length) {
    nextIndex = 0;
  }

  await updateDoc(roomRef, {
    bombTimerState: {
      actionId: Date.now(),
      type: "pass",
      round: currentRound,
      playerIndex: nextIndex,
      question: getRandomQuestion(),
      category: getCategoryLabel(),
      duration: timeLeft,
      startedAt: Date.now(),
      active: true
    }
  });
}

async function explodeFromHost() {
  if (!gameActive) return;

  const loser = getPlayerName(players[currentPlayerIndex]) || "Joueur";
  const punishment = getRandomPunishment();

  await updateDoc(roomRef, {
    bombTimerState: {
      actionId: Date.now(),
      type: "explode",
      round: currentRound,
      playerIndex: currentPlayerIndex,
      loser,
      punishment,
      active: false
    }
  });
}

async function startNextBomb() {
  if (!(isHost || isCurrentPlayerTurn())) return;

  let nextIndex = currentPlayerIndex + 1;

  if (nextIndex >= players.length) {
    nextIndex = 0;
  }

  await createRoundState(currentRound + 1, nextIndex, true);
}

function listenToBombState() {
  onSnapshot(roomRef, snapshot => {
    if (!snapshot.exists()) return;

    const data = snapshot.data();

    if (handleGlobalLobbyReturn(data)) return;

    const state = data.bombTimerState;

    if (!state) return;
    firstBombStateChecked = true;
    if (state.actionId === lastActionId) return;

    lastActionId = state.actionId;

    if (state.type === "round" || state.type === "pass") {
      applyRoundState(state);
      return;
    }

    if (state.type === "explode") {
      applyExplosionState(state);
    }
  });
}

function applyRoundState(state) {
  clearInterval(timerInterval);

  gameActive = true;
  currentRound = state.round;
  currentPlayerIndex = state.playerIndex;

  nextBombBtn.classList.add("hidden");


  resultBox.classList.add("hidden");
  explosionOverlay.classList.add("hidden");
  bombWrapper.classList.remove("bomb-danger");

  categoryText.textContent = state.category;
  questionText.textContent = state.question;
  instructionText.textContent = "Réponds puis passe la bombe avant l’explosion.";

  if (players[currentPlayerIndex]) {
    currentPlayerBox.textContent = getPlayerName(players[currentPlayerIndex]);
  }

  updateBombControls();

  roundText.textContent = currentRound;

  addHistory(
    state.type === "pass"
      ? `➡️ Bombe passée à ${getPlayerName(players[currentPlayerIndex]) || "joueur"}`
      : `💣 Manche ${currentRound} lancée`
  );

  startSyncedTimer(state.duration, state.startedAt);
}

function startSyncedTimer(duration, startedAt) {
  function updateTimer() {
    const elapsed = Math.floor((Date.now() - startedAt) / 1000);
    timeLeft = Math.max(0, duration - elapsed);

    timerText.textContent = timeLeft;

    if (timeLeft <= 5) {
      bombWrapper.classList.add("bomb-danger");
    }

    if (timeLeft <= 0) {
      clearInterval(timerInterval);

      if (gameActive && isCurrentPlayerTurn()) {
        explodeFromHost();
      }
    }
  }

  updateTimer();
  timerInterval = setInterval(updateTimer, 250);
}

function applyExplosionState(state) {
  clearInterval(timerInterval);

  gameActive = false;
  currentRound = state.round;
  currentPlayerIndex = state.playerIndex;

  passBombBtn.disabled = true;
  nextBombBtn.classList.remove("hidden");

  updateBombControls();

  timerText.textContent = "0";

  explosionOverlay.classList.remove("hidden");
  document.body.classList.add("screen-shake");

  resultTitle.textContent = `💥 ${state.loser} a explosé !`;
  resultText.textContent = state.punishment;
  resultBox.classList.remove("hidden");

  addHistory(`💥 ${state.loser} — ${state.punishment}`);
  launchConfetti();

  setTimeout(() => {
    document.body.classList.remove("screen-shake");
  }, 450);

  setTimeout(() => {
    explosionOverlay.classList.add("hidden");
  }, 2800);
}

function addHistory(message) {
  history.unshift(message);

  if (history.length > 7) {
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

function launchConfetti() {
  const colors = ["#ff007a", "#7b2cff", "#00b7ff", "#ffb000", "#ff3b3b"];

  for (let i = 0; i < 40; i++) {
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

passBombBtn.addEventListener("click", passBomb);
nextBombBtn.addEventListener("click", startNextBomb);

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