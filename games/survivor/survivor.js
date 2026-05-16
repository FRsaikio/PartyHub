import {
  db,
  doc,
  getDoc,
  updateDoc,
  onSnapshot
} from "../../firebase.js";

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
const isHost = savedData.isHost || savedData.enablePlayerControl !== false;

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
  renderPlayers();

  if (players.length < 2) {
    challengeText.textContent = "Ajoute au moins 2 joueurs pour jouer.";
    newChallengeBtn.disabled = true;
    chooseLoserBtn.disabled = true;
    return;
  }

  if (!isHost) {
    newChallengeBtn.disabled = true;
    chooseLoserBtn.disabled = true;
    resetGameBtn.disabled = true;
    restartBtn.disabled = true;

    newChallengeBtn.textContent = "À toi de jouer";
    chooseLoserBtn.textContent = "Action dispo choisit";
    resetGameBtn.textContent = "Action dispo reset";
  }

  listenToSurvivorState();

  if (isHost) {
    publishState({
      type: "init",
      round: 1,
      challenge: null,
      survivors: buildDefaultSurvivors(),
      history: []
    });
  }
}

function buildDefaultSurvivors() {
  return players.map(player => ({
    name: player.name,
    lives: 3,
    dead: false
  }));
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

  const pool = punishments[drinkLevel] || punishments.normal;
  return pool[Math.floor(Math.random() * pool.length)];
}

function getChallengeTypeLabel() {
  if (selectedPartyMode === "Chill") return "😇 Défi chill";
  if (selectedPartyMode === "Party") return "🍻 Défi party";
  if (selectedPartyMode === "Chaos") return "💀 Défi chaos";
  if (selectedPartyMode === "Hardcore") return "☠️ Défi hardcore";
  return "⚡ Défi réflexe";
}

async function publishState(state) {
  await updateDoc(roomRef, {
    survivorState: {
      actionId: Date.now(),
      ...state
    }
  });
}

async function newChallenge() {
  if (!isHost) return;

  const challenge = getRandomChallenge();

  const newHistory = [
    `⚡ Round ${round} : ${challenge}`,
    ...history
  ].slice(0, 8);

  await publishState({
    type: "challenge",
    round,
    challenge,
    survivors,
    history: newHistory
  });
}

async function chooseRandomLoser() {
  if (!isHost) return;

  const alivePlayers = survivors.filter(player => !player.dead);

  if (alivePlayers.length <= 1) return;

  const loser = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
  const loserIndex = survivors.findIndex(player => player.name === loser.name);

  await applyLoser(loserIndex);
}

async function applyLoser(index) {
  if (!isHost) return;

  const nextSurvivors = structuredClone(survivors);
  const player = nextSurvivors[index];

  if (!player || player.dead) return;

  player.lives--;

  const punishment = getRandomPunishment();

  let newHistory = [
    `💔 ${player.name} perd une vie — ${punishment}`,
    ...history
  ];

  if (player.lives <= 0) {
    player.dead = true;
    newHistory.unshift(`💀 ${player.name} est éliminé`);
  }

  newHistory = newHistory.slice(0, 8);

  const alivePlayers = nextSurvivors.filter(p => !p.dead);
  const winner = alivePlayers.length === 1 ? alivePlayers[0] : null;

  await publishState({
    type: winner ? "finish" : "loser",
    round: winner ? round : round + 1,
    challenge: currentChallenge,
    survivors: nextSurvivors,
    history: newHistory,
    loserName: player.name,
    punishment,
    winnerName: winner ? winner.name : null
  });
}

async function resetGame() {
  if (!isHost) return;

  await publishState({
    type: "reset",
    round: 1,
    challenge: null,
    survivors: buildDefaultSurvivors(),
    history: []
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
  currentChallenge = state.challenge || null;
  survivors = state.survivors || buildDefaultSurvivors();
  history = state.history || [];

  renderPlayers();
  renderHistory();

  roundBadge.textContent = `Round ${round}`;
  challengeType.textContent = getChallengeTypeLabel();

  if (state.type === "init" || state.type === "reset") {
    resultBox.classList.add("hidden");
    endScreen.classList.add("hidden");

    challengeText.textContent = "Prêt ?";
    instructionText.textContent = "Lance un défi. Le dernier perd une vie.";
  }

  if (state.type === "challenge") {
    resultBox.classList.add("hidden");
    endScreen.classList.add("hidden");

    challengeText.textContent = currentChallenge;
    instructionText.textContent = "Le dernier ou le perdant doit être choisi dans la liste.";

    challengeCard.classList.remove("pop");
    void challengeCard.offsetWidth;
    challengeCard.classList.add("pop");
  }

  if (state.type === "loser") {
    resultTitle.textContent = `💔 ${state.loserName} perd une vie`;
    punishmentText.textContent = `🍻 Punition : ${state.punishment}`;
    resultBox.classList.remove("hidden");

    document.body.classList.add("screen-shake");

    setTimeout(() => {
      document.body.classList.remove("screen-shake");
    }, 450);

    launchConfetti(25);
  }

  if (state.type === "finish") {
    resultTitle.textContent = `💔 ${state.loserName} perd une vie`;
    punishmentText.textContent = `🍻 Punition : ${state.punishment}`;
    resultBox.classList.remove("hidden");

    winnerText.textContent = `👑 ${state.winnerName} est le dernier survivant de la soirée.`;
    endScreen.classList.remove("hidden");

    launchConfetti(90);
  }
}

function renderPlayers() {
  playersList.innerHTML = "";

  survivors.forEach((player, index) => {
    const li = document.createElement("li");

    if (player.dead) {
      li.classList.add("dead");
    }

    const hearts = player.dead ? "💀" : "❤️".repeat(player.lives);

    li.innerHTML = `
      <span>${player.dead ? "💀" : "⚡"} ${player.name}</span>
      <button class="btn secondary small loser-btn" data-index="${index}" ${player.dead || !isHost ? "disabled" : ""}>
        Perd
      </button>
      <span class="life">${hearts}</span>
    `;

    playersList.appendChild(li);
  });

  document.querySelectorAll(".loser-btn").forEach(button => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.index);
      applyLoser(index);
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