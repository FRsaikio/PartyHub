import {
  db,
  doc,
  getDoc,
  updateDoc,
  onSnapshot
} from "../../firebase.js";
import { resolveIsHost } from "../../game-common.js";
import { escapeHtml } from "../../html-safe.js";

const backToLobbyBtn = document.getElementById("backToLobbyBtn");
const finalBackBtn = document.getElementById("finalBackBtn");
const restartBtn = document.getElementById("restartBtn");

const roomBadge = document.getElementById("roomBadge");
const modeBadge = document.getElementById("modeBadge");
const levelBadge = document.getElementById("levelBadge");
const roundBadge = document.getElementById("roundBadge");

const challengeCard = document.getElementById("challengeCard");
const challengeType = document.getElementById("challengeType");
const challengeText = document.getElementById("challengeText");
const instructionText = document.getElementById("instructionText");

const newChallengeBtn = document.getElementById("newChallengeBtn");
const chooseLoserBtn = document.getElementById("chooseLoserBtn");
const resetGameBtn = document.getElementById("resetGameBtn");

const resultBox = document.getElementById("resultBox");
const resultTitle = document.getElementById("resultTitle");
const punishmentText = document.getElementById("punishmentText");

const modeText = document.getElementById("modeText");
const drinkLevelText = document.getElementById("drinkLevelText");
const playersText = document.getElementById("playersText");
const playersList = document.getElementById("playersList");
const historyList = document.getElementById("historyList");

const endScreen = document.getElementById("endScreen");
const winnerText = document.getElementById("winnerText");
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
const isHost = resolveIsHost(savedData);

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


let round = 1;
let currentChallenge = null;
let survivors = [];
let history = [];
let lastActionId = null;


const VOTE_PHASE = "vote";
const CHALLENGE_PHASE = "challenge";
const RESULT_PHASE = "result";
const FINISH_PHASE = "finish";

const hiddenAdvantages = [
  { key: "immunity", icon: "🛡️", name: "Immunité cachée", description: "Annule automatiquement la prochaine perte de vie." },
  { key: "doubleVote", icon: "🗳️", name: "Double vote", description: "Ton prochain vote compte double." },
  { key: "extraLife", icon: "❤️", name: "Vie bonus", description: "Récupère automatiquement 1 vie si tu tombes trop bas." },
  { key: "sabotage", icon: "🔥", name: "Sabotage", description: "Au prochain conseil, tu ajoutes 1 vote contre une cible." },
  { key: "revive", icon: "☠️", name: "Retour à la vie", description: "Si tu es éliminé, tu reviens une fois avec 1 vie." },
  { key: "stealVote", icon: "🕵️", name: "Vol de vote", description: "Au prochain conseil, ton vote compte +1." },
  { key: "curse", icon: "💀", name: "Malédiction", description: "Une cible reçoit +1 vote automatique au prochain conseil." },
  { key: "shieldAlly", icon: "🤝", name: "Bouclier d'alliance", description: "Protège ton allié une fois si vous êtes liés." },
  { key: "lifeSwap", icon: "🔁", name: "Échange de vie", description: "Échange ton nombre de vies avec un autre survivant choisi par le groupe." }
];

const survivorEvents = [
  { key: "storm", label: "🌪️ Tempête", description: "Tout le monde boit 1 gorgée. Le prochain conseil est plus tendu." },
  { key: "doubleVotes", label: "🗳️ Vote x2", description: "Tous les votes du prochain conseil comptent double." },
  { key: "hiddenAdvantage", label: "🎁 Avantage caché", description: "Un survivant reçoit un avantage secret." },
  { key: "rebellion", label: "🔥 Rébellion", description: "Un joueur éliminé peut revenir avec 1 vie." },
  { key: "alliance", label: "🤝 Alliance forcée", description: "Deux survivants sont liés pendant 2 rounds." },
  { key: "bloodCouncil", label: "☠️ Conseil sanglant", description: "Le joueur le plus voté perd 2 vies au lieu d'une." },
  { key: "safeRound", label: "🛡️ Immunité générale", description: "Personne ne peut être éliminé ce round, mais le perdant boit." },
  { key: "treasure", label: "🏴‍☠️ Coffre caché", description: "Deux avantages secrets sont distribués." },
  { key: "tribalKing", label: "👑 Roi du Conseil", description: "Un joueur reçoit un double vote." },
  { key: "curseVote", label: "💀 Vote maudit", description: "Un survivant commence le conseil avec 1 vote contre lui." },
  { key: "noAlliance", label: "💔 Rupture", description: "Une alliance active peut être brisée." },
  { key: "survivalRoulette", label: "🎲 Roulette de survie", description: "Un survivant au hasard boit ou gagne un avantage." },
  { key: "reverseCouncil", label: "🔄 Conseil inversé", description: "En cas d'égalité, le moins voté choisit la cible." },
  { key: "publicEnemy", label: "🎯 Ennemi public", description: "Un joueur ciblé reçoit +1 vote automatique." },
  { key: "partyTax", label: "🍻 Taxe de tribu", description: "Tous les survivants boivent 1 gorgée avant le vote." },
  { key: "lastChanceBoost", label: "⚔️ Duel boosté", description: "Le prochain duel de survie a plus de chances de réussir." },
  { key: "deadWhisper", label: "👻 Murmure des morts", description: "Un éliminé ajoute 1 vote contre un survivant." },
  { key: "immunityHunt", label: "🔎 Chasse à l'immunité", description: "Un joueur reçoit une immunité cachée." },
  { key: "doublePunishment", label: "🥃 Double punition", description: "Le perdant du conseil prend aussi une punition bonus." },
  { key: "finalPanic", label: "🚨 Panique finale", description: "Si 3 joueurs ou moins restent, le prochain perdant perd 2 vies." }
];

let currentPhase = CHALLENGE_PHASE;
let votes = {};
let voteVoters = {};
let currentEvent = null;
let roundModifiers = {};
let survivorStats = {};
let firstEliminated = null;
let lastResultSummary = null;

const challenges = {
  Chill: [
    "Dernier à lever les mains",
    "Premier à lever les mains",
    "Dernier à réussir à lever les mains",
    "Premier à réussir à lever les mains",
    "Dernier à toucher le sol",
    "Premier à toucher le sol",
    "Dernier à réussir à toucher le sol",
    "Premier à réussir à toucher le sol",
    "Dernier à dire PartyHub",
    "Premier à dire PartyHub",
    "Dernier à réussir à dire PartyHub",
    "Premier à réussir à dire PartyHub",
    "Dernier à toucher un mur",
    "Premier à toucher un mur",
    "Dernier à réussir à toucher un mur",
    "Premier à réussir à toucher un mur",
    "Dernier à se lever",
    "Premier à se lever",
    "Dernier à réussir à se lever",
    "Premier à réussir à se lever",
    "Dernier à montrer un objet rouge",
    "Premier à montrer un objet rouge",
    "Dernier à réussir à montrer un objet rouge",
    "Premier à réussir à montrer un objet rouge",
    "Dernier à applaudir",
    "Premier à applaudir",
    "Dernier à réussir à applaudir",
    "Premier à réussir à applaudir",
    "Dernier à faire un cœur avec les mains",
    "Premier à faire un cœur avec les mains",
    "Dernier à réussir à faire un cœur avec les mains",
    "Premier à réussir à faire un cœur avec les mains",
    "Dernier à dire un prénom du groupe",
    "Premier à dire un prénom du groupe",
    "Dernier à réussir à dire un prénom du groupe",
    "Premier à réussir à dire un prénom du groupe",
    "Dernier à montrer un objet blanc",
    "Premier à montrer un objet blanc",
    "Dernier à réussir à montrer un objet blanc",
    "Premier à réussir à montrer un objet blanc",
    "Dernier à imiter un animal",
    "Premier à imiter un animal",
    "Dernier à réussir à imiter un animal",
    "Premier à réussir à imiter un animal",
    "Dernier à pointer la porte",
    "Premier à pointer la porte",
    "Dernier à réussir à pointer la porte",
    "Premier à réussir à pointer la porte",
    "Dernier à toucher sa chaise",
    "Premier à toucher sa chaise",
    "Dernier à réussir à toucher sa chaise",
    "Premier à réussir à toucher sa chaise",
    "Dernier à dire une couleur",
    "Premier à dire une couleur",
    "Dernier à réussir à dire une couleur",
    "Premier à réussir à dire une couleur",
    "Dernier à faire un signe de paix",
    "Premier à faire un signe de paix",
    "Dernier à réussir à faire un signe de paix",
    "Premier à réussir à faire un signe de paix",
    "Dernier à trouver un objet rond",
    "Premier à trouver un objet rond",
    "Dernier à réussir à trouver un objet rond",
    "Premier à réussir à trouver un objet rond",
    "Dernier à faire semblant de dormir",
    "Premier à faire semblant de dormir",
    "Dernier à réussir à faire semblant de dormir",
    "Premier à réussir à faire semblant de dormir",
    "Dernier à dire merci",
    "Premier à dire merci",
    "Dernier à réussir à dire merci",
    "Premier à réussir à dire merci",
    "Dernier à poser son verre",
    "Premier à poser son verre",
    "Dernier à réussir à poser son verre",
    "Premier à réussir à poser son verre",
    "Dernier à faire une grimace",
    "Premier à faire une grimace",
    "Dernier à réussir à faire une grimace",
    "Premier à réussir à faire une grimace",
    "Dernier à toucher son épaule",
    "Premier à toucher son épaule",
    "Dernier à réussir à toucher son épaule",
    "Premier à réussir à toucher son épaule",
    "Dernier à dire un mot anglais",
    "Premier à dire un mot anglais",
    "Dernier à réussir à dire un mot anglais",
    "Premier à réussir à dire un mot anglais",
    "Dernier à montrer un snack",
    "Premier à montrer un snack",
    "Dernier à réussir à montrer un snack",
    "Premier à réussir à montrer un snack",
    "Dernier à taper dans ses mains",
    "Premier à taper dans ses mains",
    "Dernier à réussir à taper dans ses mains",
    "Premier à réussir à taper dans ses mains",
    "Dernier à faire un mini salut",
    "Premier à faire un mini salut",
    "Dernier à réussir à faire un mini salut",
    "Premier à réussir à faire un mini salut",
    "Dernier à dire son âge",
    "Premier à dire son âge",
    "Dernier à réussir à dire son âge",
    "Premier à réussir à dire son âge",
    "Dernier à lever un pied",
    "Premier à lever un pied",
    "Dernier à réussir à lever un pied",
    "Premier à réussir à lever un pied",
    "Dernier à dire le nom d’un film",
    "Premier à dire le nom d’un film",
    "Dernier à réussir à dire le nom d’un film",
    "Premier à réussir à dire le nom d’un film",
    "Dernier à pointer le plafond",
    "Premier à pointer le plafond",
    "Dernier à réussir à pointer le plafond",
    "Premier à réussir à pointer le plafond",
    "Dernier à faire un clin d’œil",
    "Premier à faire un clin d’œil",
    "Dernier à réussir à faire un clin d’œil",
    "Premier à réussir à faire un clin d’œil"
  ],

  Party: [
    "Dernier à lever les mains",
    "Premier à lever les mains",
    "Dernier à réussir à lever les mains",
    "Premier à réussir à lever les mains",
    "Dernier à toucher le sol",
    "Premier à toucher le sol",
    "Dernier à réussir à toucher le sol",
    "Premier à réussir à toucher le sol",
    "Dernier à crier PartyHub",
    "Premier à crier PartyHub",
    "Dernier à réussir à crier PartyHub",
    "Premier à réussir à crier PartyHub",
    "Dernier à taper dans ses mains 3 fois",
    "Premier à taper dans ses mains 3 fois",
    "Dernier à réussir à taper dans ses mains 3 fois",
    "Premier à réussir à taper dans ses mains 3 fois",
    "Dernier à pointer le plafond",
    "Premier à pointer le plafond",
    "Dernier à réussir à pointer le plafond",
    "Premier à réussir à pointer le plafond",
    "Dernier à toucher son verre",
    "Premier à toucher son verre",
    "Dernier à réussir à toucher son verre",
    "Premier à réussir à toucher son verre",
    "Dernier à dire le prénom du host",
    "Premier à dire le prénom du host",
    "Dernier à réussir à dire le prénom du host",
    "Premier à réussir à dire le prénom du host",
    "Dernier à se lever et se rasseoir",
    "Premier à se lever et se rasseoir",
    "Dernier à réussir à se lever et se rasseoir",
    "Premier à réussir à se lever et se rasseoir",
    "Dernier à faire un toast",
    "Premier à faire un toast",
    "Dernier à réussir à faire un toast",
    "Premier à réussir à faire un toast",
    "Dernier à dire santé",
    "Premier à dire santé",
    "Dernier à réussir à dire santé",
    "Premier à réussir à dire santé",
    "Dernier à faire semblant de trinquer",
    "Premier à faire semblant de trinquer",
    "Dernier à réussir à faire semblant de trinquer",
    "Premier à réussir à faire semblant de trinquer",
    "Dernier à pointer le DJ",
    "Premier à pointer le DJ",
    "Dernier à réussir à pointer le DJ",
    "Premier à réussir à pointer le DJ",
    "Dernier à chanter un mot",
    "Premier à chanter un mot",
    "Dernier à réussir à chanter un mot",
    "Premier à réussir à chanter un mot",
    "Dernier à montrer son verre",
    "Premier à montrer son verre",
    "Dernier à réussir à montrer son verre",
    "Premier à réussir à montrer son verre",
    "Dernier à dire une marque de boisson",
    "Premier à dire une marque de boisson",
    "Dernier à réussir à dire une marque de boisson",
    "Premier à réussir à dire une marque de boisson",
    "Dernier à faire une danse de 3 secondes",
    "Premier à faire une danse de 3 secondes",
    "Dernier à réussir à faire une danse de 3 secondes",
    "Premier à réussir à faire une danse de 3 secondes",
    "Dernier à dire dernier verre",
    "Premier à dire dernier verre",
    "Dernier à réussir à dire dernier verre",
    "Premier à réussir à dire dernier verre",
    "Dernier à toucher une bouteille",
    "Premier à toucher une bouteille",
    "Dernier à réussir à toucher une bouteille",
    "Premier à réussir à toucher une bouteille",
    "Dernier à dire un cocktail",
    "Premier à dire un cocktail",
    "Dernier à réussir à dire un cocktail",
    "Premier à réussir à dire un cocktail",
    "Dernier à faire semblant de rapper",
    "Premier à faire semblant de rapper",
    "Dernier à réussir à faire semblant de rapper",
    "Premier à réussir à faire semblant de rapper",
    "Dernier à lever les deux pouces",
    "Premier à lever les deux pouces",
    "Dernier à réussir à lever les deux pouces",
    "Premier à réussir à lever les deux pouces",
    "Dernier à dire le nom d’une chanson",
    "Premier à dire le nom d’une chanson",
    "Dernier à réussir à dire le nom d’une chanson",
    "Premier à réussir à dire le nom d’une chanson",
    "Dernier à taper sur la table",
    "Premier à taper sur la table",
    "Dernier à réussir à taper sur la table",
    "Premier à réussir à taper sur la table",
    "Dernier à montrer un objet brillant",
    "Premier à montrer un objet brillant",
    "Dernier à réussir à montrer un objet brillant",
    "Premier à réussir à montrer un objet brillant",
    "Dernier à faire un pas de danse",
    "Premier à faire un pas de danse",
    "Dernier à réussir à faire un pas de danse",
    "Premier à réussir à faire un pas de danse",
    "Dernier à dire qui a lancé le jeu",
    "Premier à dire qui a lancé le jeu",
    "Dernier à réussir à dire qui a lancé le jeu",
    "Premier à réussir à dire qui a lancé le jeu",
    "Dernier à faire un dab",
    "Premier à faire un dab",
    "Dernier à réussir à faire un dab",
    "Premier à réussir à faire un dab",
    "Dernier à dire tequila",
    "Premier à dire tequila",
    "Dernier à réussir à dire tequila",
    "Premier à réussir à dire tequila",
    "Dernier à pointer quelqu’un qui rigole",
    "Premier à pointer quelqu’un qui rigole",
    "Dernier à réussir à pointer quelqu’un qui rigole",
    "Premier à réussir à pointer quelqu’un qui rigole",
    "Dernier à faire un mini cri",
    "Premier à faire un mini cri",
    "Dernier à réussir à faire un mini cri",
    "Premier à réussir à faire un mini cri"
  ],

  Chaos: [
    "Dernier à toucher le sol",
    "Premier à toucher le sol",
    "Dernier à réussir à toucher le sol",
    "Premier à réussir à toucher le sol",
    "Dernier à toucher un mur",
    "Premier à toucher un mur",
    "Dernier à réussir à toucher un mur",
    "Premier à réussir à toucher un mur",
    "Dernier à crier JE SUIS SAFE",
    "Premier à crier JE SUIS SAFE",
    "Dernier à réussir à crier JE SUIS SAFE",
    "Premier à réussir à crier JE SUIS SAFE",
    "Dernier à pointer quelqu’un",
    "Premier à pointer quelqu’un",
    "Dernier à réussir à pointer quelqu’un",
    "Premier à réussir à pointer quelqu’un",
    "Dernier à lever les deux mains",
    "Premier à lever les deux mains",
    "Dernier à réussir à lever les deux mains",
    "Premier à réussir à lever les deux mains",
    "Dernier à faire semblant de dormir",
    "Premier à faire semblant de dormir",
    "Dernier à réussir à faire semblant de dormir",
    "Premier à réussir à faire semblant de dormir",
    "Dernier à dire un prénom du groupe",
    "Premier à dire un prénom du groupe",
    "Dernier à réussir à dire un prénom du groupe",
    "Premier à réussir à dire un prénom du groupe",
    "Dernier à trouver un objet noir",
    "Premier à trouver un objet noir",
    "Dernier à réussir à trouver un objet noir",
    "Premier à réussir à trouver un objet noir",
    "Dernier à dire une vérité rapide",
    "Premier à dire une vérité rapide",
    "Dernier à réussir à dire une vérité rapide",
    "Premier à réussir à dire une vérité rapide",
    "Dernier à changer de place",
    "Premier à changer de place",
    "Dernier à réussir à changer de place",
    "Premier à réussir à changer de place",
    "Dernier à toucher son téléphone",
    "Premier à toucher son téléphone",
    "Dernier à réussir à toucher son téléphone",
    "Premier à réussir à toucher son téléphone",
    "Dernier à faire un regard dramatique",
    "Premier à faire un regard dramatique",
    "Dernier à réussir à faire un regard dramatique",
    "Premier à réussir à faire un regard dramatique",
    "Dernier à dire chaos",
    "Premier à dire chaos",
    "Dernier à réussir à dire chaos",
    "Premier à réussir à dire chaos",
    "Dernier à accuser quelqu’un",
    "Premier à accuser quelqu’un",
    "Dernier à réussir à accuser quelqu’un",
    "Premier à réussir à accuser quelqu’un",
    "Dernier à faire une confession fake",
    "Premier à faire une confession fake",
    "Dernier à réussir à faire une confession fake",
    "Premier à réussir à faire une confession fake",
    "Dernier à montrer une preuve imaginaire",
    "Premier à montrer une preuve imaginaire",
    "Dernier à réussir à montrer une preuve imaginaire",
    "Premier à réussir à montrer une preuve imaginaire",
    "Dernier à dire une phrase gênante",
    "Premier à dire une phrase gênante",
    "Dernier à réussir à dire une phrase gênante",
    "Premier à réussir à dire une phrase gênante",
    "Dernier à toucher deux objets",
    "Premier à toucher deux objets",
    "Dernier à réussir à toucher deux objets",
    "Premier à réussir à toucher deux objets",
    "Dernier à faire semblant de pleurer",
    "Premier à faire semblant de pleurer",
    "Dernier à réussir à faire semblant de pleurer",
    "Premier à réussir à faire semblant de pleurer",
    "Dernier à dire je gère",
    "Premier à dire je gère",
    "Dernier à réussir à dire je gère",
    "Premier à réussir à dire je gère",
    "Dernier à imiter le host",
    "Premier à imiter le host",
    "Dernier à réussir à imiter le host",
    "Premier à réussir à imiter le host",
    "Dernier à pointer la personne la plus suspecte",
    "Premier à pointer la personne la plus suspecte",
    "Dernier à réussir à pointer la personne la plus suspecte",
    "Premier à réussir à pointer la personne la plus suspecte",
    "Dernier à taper deux fois sur la table",
    "Premier à taper deux fois sur la table",
    "Dernier à réussir à taper deux fois sur la table",
    "Premier à réussir à taper deux fois sur la table",
    "Dernier à faire un signe secret",
    "Premier à faire un signe secret",
    "Dernier à réussir à faire un signe secret",
    "Premier à réussir à faire un signe secret",
    "Dernier à dire un mot interdit choisi par le groupe",
    "Premier à dire un mot interdit choisi par le groupe",
    "Dernier à réussir à dire un mot interdit choisi par le groupe",
    "Premier à réussir à dire un mot interdit choisi par le groupe",
    "Dernier à faire le silence complet",
    "Premier à faire le silence complet",
    "Dernier à réussir à faire le silence complet",
    "Premier à réussir à faire le silence complet",
    "Dernier à se cacher le visage",
    "Premier à se cacher le visage",
    "Dernier à réussir à se cacher le visage",
    "Premier à réussir à se cacher le visage",
    "Dernier à dire qui est le plus chaos",
    "Premier à dire qui est le plus chaos",
    "Dernier à réussir à dire qui est le plus chaos",
    "Premier à réussir à dire qui est le plus chaos",
    "Dernier à montrer un objet dangereux pour la dignité",
    "Premier à montrer un objet dangereux pour la dignité",
    "Dernier à réussir à montrer un objet dangereux pour la dignité",
    "Premier à réussir à montrer un objet dangereux pour la dignité",
    "Dernier à faire une mini scène",
    "Premier à faire une mini scène",
    "Dernier à réussir à faire une mini scène",
    "Premier à réussir à faire une mini scène"
  ],

  Hardcore: [
    "Dernier à toucher le sol",
    "Premier à toucher le sol",
    "Dernier à réussir à toucher le sol",
    "Premier à réussir à toucher le sol",
    "Dernier à toucher deux murs différents",
    "Premier à toucher deux murs différents",
    "Dernier à réussir à toucher deux murs différents",
    "Premier à réussir à toucher deux murs différents",
    "Dernier à lever les mains",
    "Premier à lever les mains",
    "Dernier à réussir à lever les mains",
    "Premier à réussir à lever les mains",
    "Dernier à crier SURVIVOR",
    "Premier à crier SURVIVOR",
    "Dernier à réussir à crier SURVIVOR",
    "Premier à réussir à crier SURVIVOR",
    "Dernier à se lever",
    "Premier à se lever",
    "Dernier à réussir à se lever",
    "Premier à réussir à se lever",
    "Dernier à faire 3 tours sur lui-même",
    "Premier à faire 3 tours sur lui-même",
    "Dernier à réussir à faire 3 tours sur lui-même",
    "Premier à réussir à faire 3 tours sur lui-même",
    "Dernier à montrer son verre",
    "Premier à montrer son verre",
    "Dernier à réussir à montrer son verre",
    "Premier à réussir à montrer son verre",
    "Dernier à toucher une chaussure",
    "Premier à toucher une chaussure",
    "Dernier à réussir à toucher une chaussure",
    "Premier à réussir à toucher une chaussure",
    "Dernier à faire un squat",
    "Premier à faire un squat",
    "Dernier à réussir à faire un squat",
    "Premier à réussir à faire un squat",
    "Dernier à dire je suis faible",
    "Premier à dire je suis faible",
    "Dernier à réussir à dire je suis faible",
    "Premier à réussir à dire je suis faible",
    "Dernier à faire une pose ridicule",
    "Premier à faire une pose ridicule",
    "Dernier à réussir à faire une pose ridicule",
    "Premier à réussir à faire une pose ridicule",
    "Dernier à courir sur place 3 secondes",
    "Premier à courir sur place 3 secondes",
    "Dernier à réussir à courir sur place 3 secondes",
    "Premier à réussir à courir sur place 3 secondes",
    "Dernier à faire semblant de tomber",
    "Premier à faire semblant de tomber",
    "Dernier à réussir à faire semblant de tomber",
    "Premier à réussir à faire semblant de tomber",
    "Dernier à chanter une phrase",
    "Premier à chanter une phrase",
    "Dernier à réussir à chanter une phrase",
    "Premier à réussir à chanter une phrase",
    "Dernier à dire une honte rapide",
    "Premier à dire une honte rapide",
    "Dernier à réussir à dire une honte rapide",
    "Premier à réussir à dire une honte rapide",
    "Dernier à pointer le futur perdant",
    "Premier à pointer le futur perdant",
    "Dernier à réussir à pointer le futur perdant",
    "Premier à réussir à pointer le futur perdant",
    "Dernier à faire un cri de guerre",
    "Premier à faire un cri de guerre",
    "Dernier à réussir à faire un cri de guerre",
    "Premier à réussir à faire un cri de guerre",
    "Dernier à toucher la table puis le mur",
    "Premier à toucher la table puis le mur",
    "Dernier à réussir à toucher la table puis le mur",
    "Premier à réussir à toucher la table puis le mur",
    "Dernier à faire une révérence",
    "Premier à faire une révérence",
    "Dernier à réussir à faire une révérence",
    "Premier à réussir à faire une révérence",
    "Dernier à tenir une pose 3 secondes",
    "Premier à tenir une pose 3 secondes",
    "Dernier à réussir à tenir une pose 3 secondes",
    "Premier à réussir à tenir une pose 3 secondes",
    "Dernier à dire je prends le risque",
    "Premier à dire je prends le risque",
    "Dernier à réussir à dire je prends le risque",
    "Premier à réussir à dire je prends le risque",
    "Dernier à faire un mini duel regard",
    "Premier à faire un mini duel regard",
    "Dernier à réussir à faire un mini duel regard",
    "Premier à réussir à faire un mini duel regard",
    "Dernier à dire le mot sanction",
    "Premier à dire le mot sanction",
    "Dernier à réussir à dire le mot sanction",
    "Premier à réussir à dire le mot sanction",
    "Dernier à se mettre debout en dernier",
    "Premier à se mettre debout en dernier",
    "Dernier à réussir à se mettre debout en dernier",
    "Premier à réussir à se mettre debout en dernier",
    "Dernier à montrer deux objets",
    "Premier à montrer deux objets",
    "Dernier à réussir à montrer deux objets",
    "Premier à réussir à montrer deux objets",
    "Dernier à faire semblant d’être coach",
    "Premier à faire semblant d’être coach",
    "Dernier à réussir à faire semblant d’être coach",
    "Premier à réussir à faire semblant d’être coach",
    "Dernier à dire qui doit boire",
    "Premier à dire qui doit boire",
    "Dernier à réussir à dire qui doit boire",
    "Premier à réussir à dire qui doit boire",
    "Dernier à faire une annonce dramatique",
    "Premier à faire une annonce dramatique",
    "Dernier à réussir à faire une annonce dramatique",
    "Premier à réussir à faire une annonce dramatique",
    "Dernier à toucher son genou",
    "Premier à toucher son genou",
    "Dernier à réussir à toucher son genou",
    "Premier à réussir à toucher son genou",
    "Dernier à faire un mini challenge",
    "Premier à faire un mini challenge",
    "Dernier à réussir à faire un mini challenge",
    "Premier à réussir à faire un mini challenge"
  ]
};

const punishments = {
  soft: [
    "1 gorgée 🍺",
    "2 gorgées 🍺",
    "Mini-gage 😇",
    "Distribue 2 gorgées",
    "Fais une imitation ridicule",
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
    "3 gorgées 🍻",
    "4 gorgées 🍻",
    "Shot soft 🥃",
    "Mini cul-sec 🍺",
    "Waterfall 5 secondes 🌊",
    "Distribue 4 gorgées",
    "Choisis quelqu’un qui boit avec toi",
    "Vérité gênante ou 3 gorgées",
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
    "Shot 🥃",
    "Cul sec 🍺",
    "5 gorgées 💀",
    "Waterfall 8 secondes 🌊",
    "Distribue 6 gorgées",
    "Double punition au prochain round",
    "Shot ou vérité hardcore",
    "Le groupe choisit ton gage alcoolisé",
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
    "Shot mystère ☠️",
    "Cul sec complet 💀",
    "Double shot ou gros gage",
    "Waterfall 10 secondes 🌊",
    "Punition collective : tout le monde boit",
    "Le groupe choisit ta sanction",
    "Shot + perte d’une vie bonus ☠️",
    "Duel shot avec le joueur de ton choix",
    "Tu perds 2 vies si tu refuses la punition",
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

async function publishState(state) {
  await updateDoc(roomRef, {
    survivorState: {
      actionId: Date.now(),
      ...state
    }
  });
}

function getPlayerName(player, index = 0) {
  return player?.name || player?.pseudo || player?.displayName || `Joueur ${index + 1}`;
}

function createStats(name) {
  return {
    name,
    votesGiven: 0,
    votesReceived: 0,
    livesLost: 0,
    punishments: 0,
    advantagesFound: 0,
    advantagesUsed: 0,
    immunitiesUsed: 0,
    survivalDuels: 0,
    survivalDuelsWon: 0,
    eliminations: 0,
    betrayals: 0,
    alliancesCreated: 0,
    alliancesBroken: 0,
    allianceSaves: 0,
    cursedVotes: 0,
    bonusVotes: 0,
    itemsCollected: 0,
    chaosPoints: 0
  };
}

function ensureStats(name) {
  if (!survivorStats[name]) {
    survivorStats[name] = createStats(name);
  }
  return survivorStats[name];
}

function ensureAllStats(list = survivors) {
  list.forEach(player => ensureStats(player.name));
}

function getAliveSurvivors(list = survivors) {
  return list.filter(player => !player.dead);
}

function getDeadSurvivors(list = survivors) {
  return list.filter(player => player.dead);
}

function clone(value) {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function buildDefaultSurvivors() {
  return players.map((player, index) => ({
    name: getPlayerName(player, index),
    lives: 3,
    dead: false,
    advantages: [],
    allianceWith: null,
    allianceRounds: 0
  }));
}

function normalizeSurvivors(list) {
  return (list || buildDefaultSurvivors()).map((player, index) => ({
    name: player.name || `Joueur ${index + 1}`,
    lives: Number.isFinite(player.lives) ? player.lives : 3,
    dead: Boolean(player.dead),
    advantages: Array.isArray(player.advantages) ? player.advantages : [],
    allianceWith: player.allianceWith || null,
    allianceRounds: Number.isFinite(player.allianceRounds) ? player.allianceRounds : 0
  }));
}

function getRandomAliveIndex(list = survivors) {
  const alive = list
    .map((player, index) => ({ player, index }))
    .filter(item => !item.player.dead);

  if (!alive.length) return -1;

  return alive[Math.floor(Math.random() * alive.length)].index;
}

function getRandomDeadIndex(list = survivors) {
  const dead = list
    .map((player, index) => ({ player, index }))
    .filter(item => item.player.dead);

  if (!dead.length) return -1;

  return dead[Math.floor(Math.random() * dead.length)].index;
}

function giveAdvantage(list, index, forcedKey = null) {
  const player = list[index];

  if (!player || player.dead) return null;

  const advantage = forcedKey
    ? hiddenAdvantages.find(item => item.key === forcedKey)
    : hiddenAdvantages[Math.floor(Math.random() * hiddenAdvantages.length)];

  if (!advantage) return null;

  player.advantages = player.advantages || [];
  player.advantages.push(advantage.key);

  const stats = ensureStats(player.name);
  stats.advantagesFound += 1;
  stats.chaosPoints += 3;

  return advantage;
}


function giveRandomAdvantageToRandomSurvivor(list, historyItems, forcedKey = null) {
  const index = getRandomAliveIndex(list);
  if (index < 0) return null;

  const advantage = giveAdvantage(list, index, forcedKey);
  if (advantage) {
    ensureStats(list[index].name).itemsCollected += 1;
    historyItems.unshift(`🎁 ${list[index].name} obtient ${advantage.icon} ${advantage.name}`);
  }

  return advantage;
}

function createAlliance(list, historyItems) {
  const aliveIndexes = list
    .map((player, index) => ({ player, index }))
    .filter(item => !item.player.dead)
    .map(item => item.index);

  if (aliveIndexes.length < 2) return false;

  const firstIndex = aliveIndexes[Math.floor(Math.random() * aliveIndexes.length)];
  let secondIndex = aliveIndexes[Math.floor(Math.random() * aliveIndexes.length)];
  let guard = 0;

  while (secondIndex === firstIndex && guard < 20) {
    secondIndex = aliveIndexes[Math.floor(Math.random() * aliveIndexes.length)];
    guard++;
  }

  if (firstIndex === secondIndex) return false;

  list[firstIndex].allianceWith = list[secondIndex].name;
  list[secondIndex].allianceWith = list[firstIndex].name;
  list[firstIndex].allianceRounds = 3;
  list[secondIndex].allianceRounds = 3;

  ensureStats(list[firstIndex].name).alliancesCreated += 1;
  ensureStats(list[secondIndex].name).alliancesCreated += 1;

  historyItems.unshift(`🤝 Alliance réelle : ${list[firstIndex].name} + ${list[secondIndex].name} pendant 3 rounds`);
  return true;
}

function breakRandomAlliance(list, historyItems) {
  const allied = list.filter(player => !player.dead && player.allianceWith);

  if (!allied.length) return false;

  const player = allied[Math.floor(Math.random() * allied.length)];
  const ally = list.find(item => item.name === player.allianceWith);

  const playerName = player.name;
  const allyName = player.allianceWith;

  player.allianceWith = null;
  player.allianceRounds = 0;

  if (ally) {
    ally.allianceWith = null;
    ally.allianceRounds = 0;
  }

  ensureStats(playerName).alliancesBroken += 1;
  if (allyName) ensureStats(allyName).alliancesBroken += 1;

  historyItems.unshift(`💔 Rupture d'alliance : ${playerName} et ${allyName}`);
  return true;
}

function getVotePowerForCurrentVote() {
  return roundModifiers?.voteMultiplier || 1;
}

function formatAdvantage(key) {
  const advantage = hiddenAdvantages.find(item => item.key === key);
  return advantage ? `${advantage.icon} ${advantage.name}` : key;
}

function maybeCreateEvent(nextSurvivors) {
  if (Math.random() > 0.45) {
    return {
      event: null,
      modifiers: {},
      historyItems: []
    };
  }

  const event = survivorEvents[Math.floor(Math.random() * survivorEvents.length)];
  const modifiers = {};
  const historyItems = [`${event.label} : ${event.description}`];

  if (event.key === "doubleVotes") {
    modifiers.voteMultiplier = 2;
  }

  if (event.key === "bloodCouncil") {
    modifiers.lifeLoss = 2;
  }

  if (event.key === "safeRound") {
    modifiers.safeRound = true;
  }

  if (event.key === "hiddenAdvantage") {
    giveRandomAdvantageToRandomSurvivor(nextSurvivors, historyItems);
  }

  if (event.key === "treasure") {
    giveRandomAdvantageToRandomSurvivor(nextSurvivors, historyItems);
    giveRandomAdvantageToRandomSurvivor(nextSurvivors, historyItems);
  }

  if (event.key === "tribalKing") {
    giveRandomAdvantageToRandomSurvivor(nextSurvivors, historyItems, "doubleVote");
  }

  if (event.key === "immunityHunt") {
    giveRandomAdvantageToRandomSurvivor(nextSurvivors, historyItems, "immunity");
  }

  if (event.key === "curseVote" || event.key === "publicEnemy") {
    const index = getRandomAliveIndex(nextSurvivors);
    if (index >= 0) {
      modifiers.autoVoteTarget = nextSurvivors[index].name;
      ensureStats(nextSurvivors[index].name).cursedVotes += 1;
      historyItems.unshift(`🎯 ${nextSurvivors[index].name} commence avec 1 vote contre lui`);
    }
  }

  if (event.key === "rebellion") {
    const deadIndex = getRandomDeadIndex(nextSurvivors);
    if (deadIndex >= 0) {
      nextSurvivors[deadIndex].dead = false;
      nextSurvivors[deadIndex].lives = 1;
      historyItems.unshift(`🔥 ${nextSurvivors[deadIndex].name} revient dans la partie avec 1 vie`);
      ensureStats(nextSurvivors[deadIndex].name).chaosPoints += 4;
    }
  }

  if (event.key === "alliance") {
    createAlliance(nextSurvivors, historyItems);
  }

  if (event.key === "noAlliance") {
    breakRandomAlliance(nextSurvivors, historyItems);
  }

  if (event.key === "survivalRoulette") {
    const index = getRandomAliveIndex(nextSurvivors);
    if (index >= 0) {
      if (Math.random() < 0.5) {
        const advantage = giveAdvantage(nextSurvivors, index);
        if (advantage) historyItems.unshift(`🎲 ${nextSurvivors[index].name} gagne ${advantage.icon} ${advantage.name}`);
      } else {
        historyItems.unshift(`🎲 ${nextSurvivors[index].name} boit 3 gorgées à cause de la roulette`);
      }
    }
  }

  if (event.key === "deadWhisper") {
    const deadIndex = getRandomDeadIndex(nextSurvivors);
    const aliveIndex = getRandomAliveIndex(nextSurvivors);
    if (deadIndex >= 0 && aliveIndex >= 0) {
      modifiers.autoVoteTarget = nextSurvivors[aliveIndex].name;
      historyItems.unshift(`👻 ${nextSurvivors[deadIndex].name} glisse 1 vote contre ${nextSurvivors[aliveIndex].name}`);
    }
  }

  if (event.key === "lastChanceBoost") {
    modifiers.duelBoost = true;
  }

  if (event.key === "doublePunishment") {
    modifiers.doublePunishment = true;
  }

  if (event.key === "reverseCouncil") {
    modifiers.reverseTie = true;
  }

  if (event.key === "finalPanic" && getAliveSurvivors(nextSurvivors).length <= 3) {
    modifiers.lifeLoss = 2;
  }

  return {
    event,
    modifiers,
    historyItems
  };
}

function decayAlliances(list) {
  return list.map(player => {
    if (!player.allianceRounds) return player;

    const next = { ...player, allianceRounds: player.allianceRounds - 1 };

    if (next.allianceRounds <= 0) {
      next.allianceWith = null;
      next.allianceRounds = 0;
    }

    return next;
  });
}

function getDrinkLevelLabel() {
  if (drinkLevel === "soft") return "Soft";
  if (drinkLevel === "normal") return "Normal";
  if (drinkLevel === "hard") return "Hard";
  if (drinkLevel === "danger" || drinkLevel === "extreme") return "Extrême";
  return "Normal";
}

function getChallengePool() {
  return challenges[selectedPartyMode] || challenges.Party;
}

function getRandomChallenge() {
  const pool = getChallengePool();
  return pool[Math.floor(Math.random() * pool.length)];
}

function getRandomPunishment() {
  if (!alcoholMode) {
    const softGages = [
      "Gros gage choisi par le groupe 😇",
      "Vérité obligatoire",
      "Imitation ridicule",
      "Danse de 10 secondes",
      "Compliment forcé à quelqu’un"
    ];

    return softGages[Math.floor(Math.random() * softGages.length)];
  }

  const effectiveDrinkLevel = drinkLevel === "extreme" ? "danger" : drinkLevel;
  const pool = punishments[effectiveDrinkLevel] || punishments.normal;
  return pool[Math.floor(Math.random() * pool.length)];
}

function getChallengeTypeLabel() {
  if (selectedPartyMode === "Chill") return "😇 Défi chill";
  if (selectedPartyMode === "Party") return "⚡ Défi party";
  if (selectedPartyMode === "Chaos") return "🔥 Défi chaos";
  if (selectedPartyMode === "Hardcore") return "☠️ Défi hardcore";
  return "⚡ Défi party";
}

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

  survivors = buildDefaultSurvivors();
  ensureAllStats(survivors);
  renderPlayers();

  if (players.length < 2) {
    challengeText.textContent = "Ajoute au moins 2 joueurs pour jouer.";
    newChallengeBtn.disabled = true;
    chooseLoserBtn.disabled = true;
    return;
  }

  newChallengeBtn.textContent = "Nouveau défi ⚡";
  chooseLoserBtn.textContent = "Ouvrir le conseil 🗳️";
  resetGameBtn.textContent = "Reset la partie";

  listenToSurvivorState();

  if (isHost) {
    publishState({
      type: "init",
      phase: CHALLENGE_PHASE,
      round: 1,
      challenge: null,
      survivors: buildDefaultSurvivors(),
      votes: {},
      voteVoters: {},
      stats: survivorStats,
      currentEvent: null,
      roundModifiers: {},
      firstEliminated: null,
      history: ["🏝️ Survivor Prime lancé : défis, votes, alliances et trahisons activés."]
    });
  }
}

async function newChallenge() {
  if (getAliveSurvivors().length <= 1) return;

  const nextSurvivors = decayAlliances(clone(survivors));
  const challenge = getRandomChallenge();
  const eventData = maybeCreateEvent(nextSurvivors);

  const newHistory = [
    ...eventData.historyItems,
    `⚡ Round ${round} : ${challenge}`,
    ...history
  ].slice(0, 14);

  await publishState({
    type: "challenge",
    phase: CHALLENGE_PHASE,
    round,
    challenge,
    survivors: nextSurvivors,
    votes: {},
    stats: survivorStats,
    currentEvent: eventData.event,
    roundModifiers: eventData.modifiers,
    firstEliminated,
    history: newHistory
  });
}

async function chooseRandomLoser() {
  if (currentPhase === VOTE_PHASE) {
    await resolveVote();
    return;
  }

  if (!currentChallenge) {
    await newChallenge();
    return;
  }

  await openTribalCouncil();
}

async function openTribalCouncil() {
  const alive = getAliveSurvivors();

  if (alive.length <= 1) return;

  const startingVotes = {};
  if (roundModifiers?.autoVoteTarget) {
    startingVotes[roundModifiers.autoVoteTarget] = 1;
  }

  await publishState({
    type: "vote",
    phase: VOTE_PHASE,
    round,
    challenge: currentChallenge,
    survivors,
    votes: startingVotes,
    voteVoters: {},
    stats: survivorStats,
    currentEvent,
    roundModifiers,
    firstEliminated,
    history: [
      "🗳️ Conseil Tribal ouvert : cliquez sur les joueurs pour voter.",
      ...(roundModifiers?.autoVoteTarget ? [`🎯 ${roundModifiers.autoVoteTarget} démarre avec 1 vote contre lui.`] : []),
      ...history
    ].slice(0, 14)
  });
}

async function addVote(index) {
  if (currentPhase !== VOTE_PHASE) return;

  const target = survivors[index];

  if (!target || target.dead) return;

  const aliveVoters = getAliveSurvivors();
  const nextVotes = { ...(votes || {}) };
  const nextVoteVoters = { ...(voteVoters || {}) };

  const voterNumber = Object.keys(nextVoteVoters).length + 1;
  const voter = aliveVoters[voterNumber - 1];
  const voterKey = voter ? voter.name : `vote_${voterNumber}`;

  if (Object.keys(nextVoteVoters).length >= aliveVoters.length) return;

  if (voter && voter.allianceWith === target.name) {
    await publishState({
      type: "vote",
      phase: VOTE_PHASE,
      round,
      challenge: currentChallenge,
      survivors,
      votes: nextVotes,
      voteVoters: nextVoteVoters,
      stats: survivorStats,
      currentEvent,
      roundModifiers,
      firstEliminated,
      history: [
        `🤝 ${voter.name} ne peut pas voter contre son allié ${target.name}.`,
        ...history
      ].slice(0, 14)
    });
    return;
  }

  let weight = getVotePowerForCurrentVote();

  if (voter?.advantages?.includes("doubleVote")) {
    weight += 1;
    voter.advantages.splice(voter.advantages.indexOf("doubleVote"), 1);
    ensureStats(voter.name).advantagesUsed += 1;
    ensureStats(voter.name).bonusVotes += 1;
  }

  if (voter?.advantages?.includes("stealVote")) {
    weight += 1;
    voter.advantages.splice(voter.advantages.indexOf("stealVote"), 1);
    ensureStats(voter.name).advantagesUsed += 1;
    ensureStats(voter.name).bonusVotes += 1;
  }

  nextVotes[target.name] = (nextVotes[target.name] || 0) + weight;
  nextVoteVoters[voterKey] = target.name;

  if (voter) {
    ensureStats(voter.name).votesGiven += weight;
  }

  const stats = ensureStats(target.name);
  stats.votesReceived += weight;

  const allVotesDone = Object.keys(nextVoteVoters).length >= aliveVoters.length;

  await publishState({
    type: allVotesDone ? "vote-complete" : "vote",
    phase: VOTE_PHASE,
    round,
    challenge: currentChallenge,
    survivors,
    votes: nextVotes,
    voteVoters: nextVoteVoters,
    stats: survivorStats,
    currentEvent,
    roundModifiers,
    firstEliminated,
    history: [
      `🗳️ ${voter ? voter.name : "Un survivant"} vote contre ${target.name}${weight > 1 ? ` x${weight}` : ""}`,
      ...(allVotesDone ? ["✅ Tous les survivants ont voté : résolution automatique."] : []),
      ...history
    ].slice(0, 14)
  });

  if (allVotesDone) {
    setTimeout(() => {
      resolveVote();
    }, 450);
  }
}

async function useAdvantage(index, key) {
  const nextSurvivors = clone(survivors);
  const player = nextSurvivors[index];

  if (!player || player.dead) return;

  player.advantages = player.advantages || [];
  const advantageIndex = player.advantages.indexOf(key);

  if (advantageIndex < 0) return;

  player.advantages.splice(advantageIndex, 1);
  const stats = ensureStats(player.name);
  stats.advantagesUsed += 1;
  stats.chaosPoints += 3;

  let newHistory = [`${formatAdvantage(key)} utilisé par ${player.name}`, ...history];

  if (key === "extraLife") {
    player.lives += 1;
    newHistory.unshift(`❤️ ${player.name} récupère 1 vie`);
  }

  if (key === "sabotage" && currentPhase === VOTE_PHASE) {
    const aliveTargets = nextSurvivors.filter(item => !item.dead && item.name !== player.name);
    const target = aliveTargets[Math.floor(Math.random() * aliveTargets.length)];

    if (target) {
      votes[target.name] = (votes[target.name] || 0) + 1;
      ensureStats(target.name).votesReceived += 1;
      newHistory.unshift(`🔥 Sabotage : +1 vote contre ${target.name}`);
    }
  }

  await publishState({
    type: currentPhase === VOTE_PHASE ? "vote" : "advantage",
    phase: currentPhase,
    round,
    challenge: currentChallenge,
    survivors: nextSurvivors,
    votes,
    voteVoters,
    stats: survivorStats,
    currentEvent,
    roundModifiers,
    firstEliminated,
    history: newHistory.slice(0, 14)
  });
}

function getVoteLoser() {
  const alive = getAliveSurvivors();

  if (!alive.length) return null;

  const entries = Object.entries(votes || {});

  if (!entries.length) {
    return alive[Math.floor(Math.random() * alive.length)];
  }

  const scores = entries.map(([, count]) => count);
  const selectedScore = roundModifiers?.reverseTie
    ? Math.min(...scores)
    : Math.max(...scores);

  const selectedNames = entries
    .filter(([, count]) => count === selectedScore)
    .map(([name]) => name);

  const chosenName = selectedNames[Math.floor(Math.random() * selectedNames.length)];

  return survivors.find(player => player.name === chosenName && !player.dead) || null;
}

async function resolveVote() {
  const loser = getVoteLoser();

  if (!loser) return;

  const loserIndex = survivors.findIndex(player => player.name === loser.name);

  await applyLoser(loserIndex, "vote");
}

async function applyLoser(index, source = "direct") {
  const nextSurvivors = clone(survivors);
  const player = nextSurvivors[index];

  if (!player || player.dead) return;

  const punishment = getRandomPunishment();
  let lifeLoss = roundModifiers?.lifeLoss || 1;
  let blocked = false;
  let survivedDuel = false;
  let newHistory = [];

  const stats = ensureStats(player.name);
  stats.punishments += 1;
  stats.chaosPoints += 1;

  player.advantages = player.advantages || [];

  if (roundModifiers?.safeRound) {
    blocked = true;
    newHistory.push(`🛡️ Immunité générale : ${player.name} ne perd pas de vie.`);
  }

  if (!blocked && player.advantages.includes("immunity")) {
    blocked = true;
    player.advantages.splice(player.advantages.indexOf("immunity"), 1);
    stats.immunitiesUsed += 1;
    stats.advantagesUsed += 1;
    stats.chaosPoints += 4;
    newHistory.push(`🛡️ ${player.name} révèle une immunité cachée et bloque la perte de vie.`);
  }

  if (!blocked) {
    player.lives -= lifeLoss;
    stats.livesLost += lifeLoss;
    newHistory.push(`💔 ${player.name} perd ${lifeLoss} vie${lifeLoss > 1 ? "s" : ""} — ${punishment}`);
  } else {
    newHistory.push(`🍻 ${player.name} prend quand même la punition : ${punishment}`);
  }

  if (player.lives <= 0 && player.advantages.includes("extraLife")) {
    player.advantages.splice(player.advantages.indexOf("extraLife"), 1);
    player.lives = 1;
    stats.advantagesUsed += 1;
    newHistory.unshift(`❤️ ${player.name} utilise une vie bonus et reste en jeu.`);
  }

  if (player.lives <= 0 && player.advantages.includes("revive")) {
    player.advantages.splice(player.advantages.indexOf("revive"), 1);
    player.lives = 1;
    stats.advantagesUsed += 1;
    newHistory.unshift(`☠️ ${player.name} active Retour à la vie et revient avec 1 vie.`);
  }

  if (player.lives <= 0) {
    stats.survivalDuels += 1;
    const duelWin = Math.random() < (roundModifiers?.duelBoost ? 0.65 : 0.45);

    if (duelWin) {
      player.lives = 1;
      survivedDuel = true;
      stats.survivalDuelsWon += 1;
      stats.chaosPoints += 5;
      newHistory.unshift(`⚔️ Dernière chance réussie : ${player.name} survit avec 1 vie.`);
    }
  }

  if (player.lives <= 0 && !survivedDuel) {
    player.dead = true;
    stats.eliminations += 1;

    if (!firstEliminated) {
      firstEliminated = player.name;
    }

    newHistory.unshift(`💀 ${player.name} est éliminé du Survivor.`);
  }

  if (player.allianceWith) {
    const ally = nextSurvivors.find(item => item.name === player.allianceWith && !item.dead);

    if (ally && !blocked) {
      if (ally.advantages?.includes("shieldAlly")) {
        ally.advantages.splice(ally.advantages.indexOf("shieldAlly"), 1);
        ensureStats(ally.name).advantagesUsed += 1;
        ensureStats(ally.name).allianceSaves += 1;
        newHistory.push(`🤝🛡️ ${ally.name} protège son allié ${player.name} avec un bouclier d'alliance.`);
      } else {
        ally.lives = Math.max(1, ally.lives - 1);
        ensureStats(ally.name).livesLost += 1;
        newHistory.push(`🤝 Alliance : ${ally.name} perd 1 vie avec ${player.name}.`);
      }
    }
  }

  if (roundModifiers?.doublePunishment) {
    newHistory.push(`🥃 Double punition : ${player.name} prend aussi ${getRandomPunishment()}`);
    ensureStats(player.name).punishments += 1;
  }

  const alivePlayers = getAliveSurvivors(nextSurvivors);
  const winner = alivePlayers.length === 1 ? alivePlayers[0] : null;

  const nextHistory = [
    ...newHistory,
    ...history
  ].slice(0, 14);

  await publishState({
    type: winner ? "finish" : "loser",
    phase: winner ? FINISH_PHASE : RESULT_PHASE,
    round: winner ? round : round + 1,
    challenge: currentChallenge,
    survivors: nextSurvivors,
    votes: {},
    stats: survivorStats,
    currentEvent: null,
    roundModifiers: {},
    firstEliminated,
    history: nextHistory,
    loserName: player.name,
    punishment,
    winnerName: winner ? winner.name : null,
    resultSummary: newHistory
  });
}

async function resetGame() {
  survivorStats = {};
  firstEliminated = null;

  const freshSurvivors = buildDefaultSurvivors();
  ensureAllStats(freshSurvivors);

  await publishState({
    type: "reset",
    phase: CHALLENGE_PHASE,
    round: 1,
    challenge: null,
    survivors: freshSurvivors,
    votes: {},
    stats: survivorStats,
    currentEvent: null,
    roundModifiers: {},
    firstEliminated: null,
    history: ["🔄 Survivor Prime réinitialisé."]
  });
}

function listenToSurvivorState() {
  onSnapshot(roomRef, snapshot => {
    if (!snapshot.exists()) return;

    const data = snapshot.data();

    if (handleGlobalLobbyReturn(data)) return;

    const state = data.survivorState;

    if (!state) return;
    if (state.actionId === lastActionId) return;

    lastActionId = state.actionId;
    applyState(state);
  });
}

function applyState(state) {
  round = state.round || 1;
  currentPhase = state.phase || CHALLENGE_PHASE;
  currentChallenge = state.challenge || null;
  survivors = normalizeSurvivors(state.survivors || buildDefaultSurvivors());
  history = state.history || [];
  votes = state.votes || {};
  voteVoters = state.voteVoters || {};
  survivorStats = state.stats || survivorStats || {};
  currentEvent = state.currentEvent || null;
  roundModifiers = state.roundModifiers || {};
  firstEliminated = state.firstEliminated || firstEliminated;
  lastResultSummary = state.resultSummary || null;

  ensureAllStats(survivors);
  renderPlayers();
  renderHistory();

  roundBadge.textContent = `Round ${round}`;
  challengeType.textContent = getChallengeTypeLabel();

  newChallengeBtn.disabled = currentPhase === VOTE_PHASE || currentPhase === FINISH_PHASE;
  chooseLoserBtn.disabled = currentPhase === FINISH_PHASE;

  if (currentPhase === VOTE_PHASE) {
    chooseLoserBtn.textContent = "Résoudre le conseil 🗳️";
  } else if (currentPhase === CHALLENGE_PHASE && currentChallenge) {
    chooseLoserBtn.textContent = "Ouvrir le conseil 🗳️";
  } else if (currentPhase === RESULT_PHASE) {
    chooseLoserBtn.textContent = "Ouvrir le conseil 🗳️";
  } else {
    chooseLoserBtn.textContent = "Ouvrir le conseil 🗳️";
  }

  if (state.type === "init" || state.type === "reset") {
    resultBox.classList.add("hidden");
    endScreen.classList.add("hidden");
    challengeText.textContent = "Prêt ?";
    instructionText.textContent = "Lance un défi, puis ouvre le Conseil Tribal pour voter.";
  }

  if (state.type === "challenge" || state.type === "advantage") {
    resultBox.classList.add("hidden");
    endScreen.classList.add("hidden");

    challengeText.textContent = currentChallenge || "Défi prêt";
    instructionText.textContent = currentEvent
      ? `${currentEvent.label} — ${currentEvent.description}`
      : "Le perdant du défi passera au Conseil Tribal.";

    challengeCard.classList.remove("pop");
    void challengeCard.offsetWidth;
    challengeCard.classList.add("pop");
  }

  if (state.type === "vote" || state.type === "vote-complete") {
    resultBox.classList.remove("hidden");
    resultTitle.textContent = "🗳️ Conseil Tribal";
    punishmentText.textContent = `Clique sur les boutons Vote dans la liste. Votes : ${Object.keys(voteVoters || {}).length}/${getAliveSurvivors().length}. Le vote se clôture automatiquement quand tout le monde a voté.`;
    challengeText.textContent = currentChallenge || "Conseil Tribal";
    instructionText.textContent = "Les alliances, immunités et avantages peuvent retourner le vote.";
  }

  if (state.type === "loser") {
    resultTitle.textContent = `💔 ${state.loserName} passe au conseil`;
    punishmentText.innerHTML = (state.resultSummary || [`🍻 Punition : ${state.punishment}`])
      .map(item => `<div>${escapeHtml(item)}</div>`)
      .join("");
    resultBox.classList.remove("hidden");

    document.body.classList.add("screen-shake");

    setTimeout(() => {
      document.body.classList.remove("screen-shake");
    }, 450);

    launchConfetti(30);
  }

  if (state.type === "finish") {
    resultTitle.textContent = `👑 ${state.winnerName} remporte Survivor`;
    punishmentText.innerHTML = (state.resultSummary || [`🍻 Punition : ${state.punishment}`])
      .map(item => `<div>${escapeHtml(item)}</div>`)
      .join("");
    resultBox.classList.remove("hidden");

    winnerText.innerHTML = buildFinalSummary(state.winnerName);
    endScreen.classList.remove("hidden");

    launchConfetti(110);
  }
}

function getTopStat(key) {
  const entries = Object.values(survivorStats || {});
  if (!entries.length) return null;

  return [...entries].sort((a, b) => (b[key] || 0) - (a[key] || 0))[0];
}

function buildFinalSummary(winnerName) {
  const martyr = getTopStat("livesLost");
  const target = getTopStat("votesReceived");
  const strategist = getTopStat("votesGiven");
  const idol = getTopStat("advantagesUsed");
  const traitor = getTopStat("alliancesBroken");
  const collector = getTopStat("itemsCollected");
  const gladiator = getTopStat("survivalDuelsWon");
  const immune = getTopStat("immunitiesUsed");
  const survivor = Object.values(survivorStats || {}).sort((a, b) => (a.livesLost || 0) - (b.livesLost || 0))[0];

  const ranking = Object.values(survivorStats || {})
    .map(stats => ({
      ...stats,
      score:
        (stats.chaosPoints || 0) +
        (stats.survivalDuelsWon || 0) * 5 +
        (stats.advantagesUsed || 0) * 3 +
        (stats.votesGiven || 0) +
        (stats.allianceSaves || 0) * 4 +
        (stats.votesReceived || 0) -
        (stats.eliminations || 0) * 2
    }))
    .sort((a, b) => b.score - a.score);

  const rankingHtml = ranking.map((stats, index) => `
    <li>
      <strong>${index + 1}. ${escapeHtml(stats.name)}</strong> — ${stats.score} pts
      <small>
        ${stats.votesGiven} votes donnés ·
        ${stats.votesReceived} votes reçus ·
        ${stats.livesLost} vies perdues ·
        ${stats.advantagesUsed} avantages utilisés ·
        ${stats.survivalDuelsWon} duel(s) gagné(s)
      </small>
    </li>
  `).join("");

  return `
    <div class="survivor-final-summary">
      <h3>👑 Survivant Suprême</h3>
      <p><strong>${escapeHtml(winnerName)}</strong></p>

      <div class="title-grid">
        <div><b>💀 Première Victime</b><span>${escapeHtml(firstEliminated || "Aucune")}</span></div>
        <div><b>🍻 Plus Gros Martyr</b><span>${escapeHtml(martyr?.name || "-")}</span></div>
        <div><b>🗳️ Aimant à Votes</b><span>${escapeHtml(target?.name || "-")}</span></div>
        <div><b>😈 Stratège du Conseil</b><span>${escapeHtml(strategist?.name || "-")}</span></div>
        <div><b>🛡️ Intouchable</b><span>${escapeHtml(immune?.name || "-")}</span></div>
        <div><b>🤝 Faux Ami</b><span>${escapeHtml(traitor?.name || "-")}</span></div>
        <div><b>🎁 Collectionneur</b><span>${escapeHtml(collector?.name || "-")}</span></div>
        <div><b>⚔️ Gladiateur</b><span>${escapeHtml(gladiator?.name || "-")}</span></div>
        <div><b>🏃 Survivant Discret</b><span>${escapeHtml(survivor?.name || "-")}</span></div>
        <div><b>🔥 Roi des Avantages</b><span>${escapeHtml(idol?.name || "-")}</span></div>
      </div>

      <h4>Classement Survivor Prime</h4>
      <ol>${rankingHtml}</ol>
    </div>
  `;
}

function renderPlayers() {
  playersList.innerHTML = "";

  survivors.forEach((player, index) => {
    const li = document.createElement("li");

    if (player.dead) {
      li.classList.add("dead");
    }

    const hearts = player.dead ? "💀" : "❤️".repeat(Math.max(0, player.lives));
    const voteCount = votes?.[player.name] || 0;
    const advantages = (player.advantages || []).map(formatAdvantage).join(" · ");
    const alliance = player.allianceWith
      ? `<small class="survivor-meta">🤝 avec ${escapeHtml(player.allianceWith)} (${escapeHtml(player.allianceRounds)})</small>`
      : "";
    const advantageText = advantages
      ? `<small class="survivor-meta inventory-visible">🎁 Inventaire : ${advantages}</small>`
      : `<small class="survivor-meta inventory-empty">🎁 Inventaire : vide</small>`;

    li.innerHTML = `
      <div class="survivor-player-info">
        <span>${player.dead ? "💀" : "⚡"} ${escapeHtml(player.name)}</span>
        ${alliance}
        ${advantageText}
        ${voteCount ? `<small class="survivor-meta">🗳️ Votes : ${voteCount}</small>` : ""}
      </div>

      <div class="survivor-player-actions">
        <button class="btn secondary small vote-btn" data-index="${index}" ${player.dead || currentPhase !== VOTE_PHASE || Object.keys(voteVoters || {}).length >= getAliveSurvivors().length ? "disabled" : ""}>
          Vote ${currentPhase === VOTE_PHASE ? `${Object.keys(voteVoters || {}).length + 1}/${getAliveSurvivors().length}` : ""}
        </button>
        <button class="btn danger small loser-btn" data-index="${index}" ${player.dead ? "disabled" : ""}>
          Perd
        </button>
        <span class="life">${hearts}</span>
      </div>
    `;

    playersList.appendChild(li);
  });

  document.querySelectorAll(".vote-btn").forEach(button => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.index);
      addVote(index);
    });
  });

  document.querySelectorAll(".loser-btn").forEach(button => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.index);
      applyLoser(index, "direct");
    });
  });
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

newChallengeBtn.addEventListener("click", newChallenge);
chooseLoserBtn.addEventListener("click", chooseRandomLoser);
resetGameBtn.addEventListener("click", resetGame);
restartBtn.addEventListener("click", resetGame);



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

finalBackBtn.addEventListener("click", async () => {
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

  localStorage.setItem("partyhubReturnLobby", "true");
  window.location.href = "../../index.html";
});

initGame();