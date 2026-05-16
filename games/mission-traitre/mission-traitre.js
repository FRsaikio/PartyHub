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
const phaseBadge = document.getElementById("phaseBadge");

const roleCard = document.getElementById("roleCard");
const roleLabel = document.getElementById("roleLabel");
const roleTitle = document.getElementById("roleTitle");
const roleDescription = document.getElementById("roleDescription");

const revealRoleBtn = document.getElementById("revealRoleBtn");
const nextPlayerBtn = document.getElementById("nextPlayerBtn");
const startDebateBtn = document.getElementById("startDebateBtn");
const endGameBtn = document.getElementById("endGameBtn");

const modeText = document.getElementById("modeText");
const drinkLevelText = document.getElementById("drinkLevelText");
const playersText = document.getElementById("playersText");
const currentPlayerText = document.getElementById("currentPlayerText");

const missionBox = document.getElementById("missionBox");
const missionText = document.getElementById("missionText");

const resultBox = document.getElementById("resultBox");
const resultTitle = document.getElementById("resultTitle");
const resultText = document.getElementById("resultText");

const historyList = document.getElementById("historyList");
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


let currentPlayerIndex = 0;
let revealed = false;
let history = [];
let votes = {};
let traitorIndex = 0;
let traitorMission = null;
let lastActionId = null;
let myPlayerIndex = Math.max(0, players.findIndex(p => p.name === savedData.currentPlayer));
let roleAlreadyRevealedOnThisDevice = false;

const missions = [
  {
    title: "Faire boire un joueur",
    objective: "Fais boire un joueur sans qu’il comprenne que c’est ta mission.",
    rules: [
      "Le joueur doit accepter de boire de lui-même.",
      "Tu ne peux pas dire que c’est ta mission.",
      "Tu dois rester naturel pendant la discussion."
    ],
    example: "Exemple : lance un mini défi, propose un toast ou invente une règle drôle."
  },
  {
    title: "Faire dire un mot secret",
    objective: "Fais dire le mot secret à n’importe quel joueur pendant la discussion.",
    secretWord: "pizza",
    rules: [
      "Tu ne dois pas dire le mot toi-même.",
      "Le joueur doit dire le mot clairement à voix haute.",
      "Le mot doit sortir naturellement dans une phrase."
    ],
    example: "Exemple : « Vous mangeriez quoi là maintenant ? »"
  },
  {
    title: "Changer la musique",
    objective: "Réussis à faire changer la musique sans que les autres comprennent que c’est ta mission.",
    rules: [
      "Tu peux suggérer un style de musique.",
      "Tu peux critiquer la musique actuelle.",
      "Quelqu’un d’autre doit accepter de changer le son."
    ],
    example: "Exemple : « Elle est bizarre cette musique, quelqu’un met un son plus drôle ? »"
  },
  {
    title: "Faire rire la table",
    objective: "Fais rire au moins deux joueurs pendant la même discussion.",
    rules: [
      "Le rire doit être naturel.",
      "Tu ne peux pas annoncer que c’est un défi.",
      "Au moins deux joueurs doivent rire."
    ],
    example: "Exemple : raconte une anecdote gênante ou fais une remarque absurde."
  },
  {
    title: "Lancer un débat inutile",
    objective: "Fais débattre au moins deux joueurs sur un sujet complètement inutile.",
    rules: [
      "Le débat doit durer au moins 30 secondes.",
      "Au moins deux joueurs doivent donner leur avis.",
      "Tu peux lancer le sujet, mais tu ne dois pas trop forcer."
    ],
    example: "Exemple : « Est-ce qu’un hot-dog est un sandwich ? »"
  },
  {
    title: "Faire trinquer deux joueurs",
    objective: "Fais en sorte que deux joueurs trinquent ensemble.",
    rules: [
      "Les deux joueurs doivent trinquer volontairement.",
      "Tu ne peux pas dire directement que c’est ta mission.",
      "Le geste doit être visible par le groupe."
    ],
    example: "Exemple : « Vous deux, vous avez gagné le débat, trinquez pour fêter ça. »"
  },
  {
    title: "Faire répéter une phrase",
    objective: "Fais répéter cette phrase à un joueur : « Je suis innocent à 100% ».",
    rules: [
      "Le joueur doit répéter la phrase entière.",
      "Tu peux lui demander de prouver son innocence.",
      "Tu ne dois pas révéler que c’est une mission."
    ],
    example: "Exemple : « Répète exactement ça pour qu’on te croie : je suis innocent à 100%. »"
  },
  {
    title: "Faire dire “quoi ?”",
    objective: "Fais dire le mot “quoi ?” à un joueur.",
    rules: [
      "Le joueur doit le dire naturellement.",
      "Tu ne peux pas lui demander de dire “quoi ?”.",
      "Tu peux parler doucement ou dire une phrase confuse."
    ],
    example: "Exemple : dis une phrase bizarre comme si elle était totalement normale."
  },
  {
    title: "Obtenir une anecdote",
    objective: "Fais raconter une anecdote drôle, gênante ou bizarre à un joueur.",
    rules: [
      "L’anecdote doit durer au moins 15 secondes.",
      "Le joueur doit raconter l’histoire de lui-même.",
      "Tu peux poser une question pour lancer le sujet."
    ],
    example: "Exemple : « C’est quoi le truc le plus honteux qui t’est arrivé en soirée ? »"
  },
  {
    title: "Faire accuser un innocent",
    objective: "Fais en sorte qu’un joueur accuse quelqu’un qui n’est pas le traître.",
    rules: [
      "L’accusation doit être claire.",
      "Le joueur doit nommer une personne précise.",
      "Tu ne dois pas lui dire directement qui accuser."
    ],
    example: "Exemple : « Tu ne trouves pas que Lucas agit vraiment bizarrement ? »"
  }
];

const loserPunishments = {
  soft: [
    "Les perdants boivent 1 gorgée 🍺",
    "Les perdants font un mini-gage 😇",
    "Les perdants distribuent 1 gorgée",
    "Les perdants boire 1 shot",
    "Les perdants boire 2 gorgées de ton verre actuel",
    "Les perdants boire 3 gorgées",
    "Les perdants choisir quelqu’un qui boit un shot avec toi",
    "Les perdants boire un shot de bière",
    "Les perdants boire un mélange que le groupe te prépare (petit)",
    "Les perdants boire ton verre avec la main non dominante",
    "Les perdants boire en regardant quelqu’un dans les yeux",
    "Les perdants faire un shot inversé",
    "Les perdants boire une gorgée de chaque verre sur la table",
  ],
  normal: [
    "Les perdants boivent 3 gorgées 🍻",
    "Les perdants font un mini cul-sec 🍺",
    "Les perdants prennent un shot soft 🥃",
    "Les perdants distribuent 4 gorgées",
    "Les perdants boire un cul sec de bière",
    "Les perdants boire 2 shots d’affilée",
    "Les perdants boire un grand verre d’alcool mélangé",
    "Les perdants boire un shot préparé par la personne à ta gauche",
    "Les perdants boire un shot préparé par la personne à ta droite",
    "Les perdants boire un Verre de la Honte : tout le monde verse un peu dedans",
    "Les perdants boire 4 gorgées d’affilée",
    "Les perdants boire sans utiliser tes mains avec une paille ou directement",
    "Les perdants faire un shot dans le nombril de quelqu’un ou se le faire faire",
    "Les perdants boire un shot à chaque fois que quelqu’un dit un mot interdit pendant 2 tours",
    "Les perdants le Serpent : tu bois une gorgée à chaque question/réponse jusqu’à ce que quelqu’un d’autre perde",
    "Les perdants cascade : tout le monde boit en même temps que toi jusqu’à ce que tu arrêtes",
    "Les perdants punition Double : tu bois 2 shots et tu choisis qui boit avec toi",
    "Les perdants le Dernier Verre : tu finis entièrement ton verre actuel",
    "Les perdants alcool Roulette : tu tournes une bouteille, la personne visée boit avec toi",
    "Les perdants verre sans fond : tu dois toujours avoir ton verre plein pendant 3 tours",
    "Les perdants shot ou Vérité : tu choisis entre boire 2 shots ou répondre à une question très gênante",
  ],
  hard: [
    "Les perdants prennent un shot complet 🥃",
    "Les perdants font un cul sec 🍺",
    "Les perdants boivent 6 gorgées 💀",
    "Les perdants font un waterfall 8 secondes 🌊",
    "Les perdants boire 3 shots d’affilée",
    "Les perdants boire un cul sec de spiritueux",
    "Les perdants boire un grand verre entier en moins de 45 secondes",
    "Les perdants boire 2 verres d’affilée",
    "Les perdants boire un mélange créé par tout le groupe",
    "Les perdants tour du Monde : boire une gorgée de 5 verres différents",
    "Les perdants boire sans respirer entre chaque gorgée jusqu’à 5 gorgées",
    "Les perdants boire un shot toutes les 2 minutes pendant 10 minutes",
    "Les perdants boire un Shot de la Mort très fort ou très bizarre",
    "Les perdants être Roi/Reine du Shot pendant 3 tours : tu dois servir un shot à chaque personne qui perd",
    "Les perdants le Serpent : tu bois une gorgée à chaque question/réponse jusqu’à ce que quelqu’un d’autre perde",
    "Les perdants cascade : tout le monde boit en même temps que toi jusqu’à ce que tu arrêtes",
    "Les perdants punition Double : tu bois 2 shots et tu choisis qui boit avec toi",
    "Les perdants le Dernier Verre : tu finis entièrement ton verre actuel",
    "Les perdants alcool Roulette : tu tournes une bouteille, la personne visée boit avec toi",
    "Les perdants verre sans fond : tu dois toujours avoir ton verre plein pendant 3 tours",
    "Les perdants shot ou Vérité : tu choisis entre boire 2 shots ou répondre à une question très gênante",
  ],
  danger: [
    "Les perdants prennent un DOUBLE SHOT ☠️",
    "Les perdants font un CUL SEC COMPLET 💀",
    "Les perdants prennent un shot mystère 🎲",
    "Les perdants subissent une sanction choisie par le groupe",
    "Punition collective : les perdants boivent, les gagnants distribuent",
    "Les perdants boire 3 shots d’affilée",
    "Les perdants boire un cul sec de spiritueux",
    "Les perdants boire un grand verre entier en moins de 45 secondes",
    "Les perdants boire 2 verres d’affilée",
    "Les perdants boire un mélange créé par tout le groupe",
    "Les perdants tour du Monde : boire une gorgée de 5 verres différents",
    "Les perdants boire sans respirer entre chaque gorgée jusqu’à 5 gorgées",
    "Les perdants boire un shot toutes les 2 minutes pendant 10 minutes",
    "Les perdants boire un Shot de la Mort très fort ou très bizarre",
    "Les perdants être Roi/Reine du Shot pendant 3 tours : tu dois servir un shot à chaque personne qui perd",
    "Les perdants le Serpent : tu bois une gorgée à chaque question/réponse jusqu’à ce que quelqu’un d’autre perde",
    "Les perdants cascade : tout le monde boit en même temps que toi jusqu’à ce que tu arrêtes",
    "Les perdants punition Double : tu bois 2 shots et tu choisis qui boit avec toi",
    "Les perdants le Dernier Verre : tu finis entièrement ton verre actuel",
    "Les perdants alcool Roulette : tu tournes une bouteille, la personne visée boit avec toi",
    "Les perdants verre sans fond : tu dois toujours avoir ton verre plein pendant 3 tours",
    "Les perdants shot ou Vérité : tu choisis entre boire 2 shots ou répondre à une question très gênante",
    "Les perdants boire un cul sec de bière",
    "Les perdants boire 2 shots d’affilée",
    "Les perdants boire un grand verre d’alcool mélangé",
    "Les perdants boire un shot préparé par la personne à ta gauche",
    "Les perdants boire un shot préparé par la personne à ta droite",
    "Les perdants boire un Verre de la Honte : tout le monde verse un peu dedans",
    "Les perdants boire 4 gorgées d’affilée",
    "Les perdants boire sans utiliser tes mains avec une paille ou directement",
    "Les perdants faire un shot dans le nombril de quelqu’un ou se le faire faire",
    "Les perdants boire un shot à chaque fois que quelqu’un dit un mot interdit pendant 2 tours",
  ],
};

const winnerRewards = [
  "Les gagnants peuvent distribuer 5 gorgées 👑",
  "Les gagnants choisissent quelqu’un qui boit 🍻",
  "Les gagnants inventent une mini-règle pour le prochain jeu",
  "Les gagnants sont safe pour la prochaine punition"
];

async function initGame() {
  const roomSnap = await getDoc(roomRef);

  if (roomSnap.exists()) {
    const roomData = roomSnap.data();
    players = roomData.players || players;

    if (roomData.traitorState) {
      traitorIndex = roomData.traitorState.traitorIndex;
      traitorMission = roomData.traitorState.traitorMission;
    } else {
      traitorIndex = Math.floor(Math.random() * players.length);
      traitorMission = missions[Math.floor(Math.random() * missions.length)];

      await updateDoc(roomRef, {
        traitorState: {
          actionId: Date.now(),
          phase: "roles",
          traitorIndex,
          traitorMission,
          currentPlayerIndex: 0,
          history: ["🕵️ Distribution des rôles lancée"]
        }
      });
    }
  }

  roomBadge.textContent = `Room ${roomCode}`;
  modeBadge.textContent = `Mode ${selectedPartyMode}`;
  levelBadge.textContent = getDrinkLevelLabel();

  modeText.textContent = selectedPartyMode;
  drinkLevelText.textContent = getDrinkLevelLabel();
  playersText.textContent = players.length;

  if (players.length < 2) {
    roleTitle.textContent = "Pas assez de joueurs";
    roleDescription.textContent = "Ajoute au moins 2 joueurs pour lancer Mission Traître.";
    revealRoleBtn.disabled = true;
    return;
  }

  listenToTraitorState();
  updateCurrentPlayer();
}

function getDrinkLevelLabel() {
  if (drinkLevel === "soft") return "Soft";
  if (drinkLevel === "normal") return "Normal";
  if (drinkLevel === "hard") return "Hard";
  if (drinkLevel === "danger" || drinkLevel === "extreme") return "Extrême";
  return "Normal";
}

function getRandomLoserPunishment() {
  if (!alcoholMode) {
    const softPunishments = [
      "Les perdants font un gros gage 😇",
      "Les perdants racontent une vérité",
      "Les perdants font une imitation ridicule",
      "Le groupe choisit un gage pour les perdants"
    ];

    return softPunishments[Math.floor(Math.random() * softPunishments.length)];
  }

  const pool = loserPunishments[drinkLevel] || loserPunishments.normal;
  return pool[Math.floor(Math.random() * pool.length)];
}

function getRandomWinnerReward() {
  return winnerRewards[Math.floor(Math.random() * winnerRewards.length)];
}

function updateCurrentPlayer() {
  myPlayerIndex = Math.max(0, players.findIndex(p => p.name === savedData.currentPlayer));
  currentPlayerIndex = myPlayerIndex;
  if (!players[currentPlayerIndex]) return;
  currentPlayerText.textContent = players[currentPlayerIndex].name;
  roleTitle.textContent = `${players[currentPlayerIndex].name}, ton rôle est prêt`;
  roleDescription.textContent = "Appuie pour voir ton rôle. Les autres joueurs ne verront pas ton écran.";
  nextPlayerBtn.classList.add("hidden");
}

function renderMission(mission) {
  missionText.innerHTML = `
    <div class="mission-title">🎯 ${mission.title}</div>

    <div class="mission-section">
      <strong>Objectif :</strong><br>
      ${mission.objective}
    </div>

    ${
      mission.secretWord
        ? `
      <div class="mission-section">
        <strong>Mot secret :</strong><br>
        <span class="secret-word">${mission.secretWord}</span>
      </div>`
        : ""
    }

    <div class="mission-section">
      <strong>Règles :</strong>
      <ul class="mission-rules">
        ${mission.rules.map(rule => `<li>${rule}</li>`).join("")}
      </ul>
    </div>

    <div class="mission-example">
      💡 ${mission.example}
    </div>
  `;
}

function revealRole() {
  if (revealed) return;

  revealed = true;

  const currentPlayerObj = players[currentPlayerIndex];

  roleCard.classList.remove("traitor", "innocent", "vote-mode");

  if (currentPlayerIndex === traitorIndex) {
    roleCard.classList.add("traitor");

    roleLabel.textContent = "☠️ TRAÎTRE";
    roleTitle.textContent = `Tu es le traître, ${currentPlayerObj.name}`;
    roleDescription.textContent = "Réussis ta mission sans te faire griller.";

    missionBox.classList.remove("hidden");
    renderMission(traitorMission);

    addHistory(`😈 ${currentPlayerObj.name} a reçu un rôle`);
  } else {
    roleCard.classList.add("innocent");

    roleLabel.textContent = "😇 INNOCENT";
    roleTitle.textContent = `${currentPlayerObj.name}, tu es innocent`;
    roleDescription.textContent =
      "Observe les comportements suspects et trouve le traître.";

    missionBox.classList.add("hidden");

    addHistory(`😇 ${currentPlayerObj.name} a reçu un rôle`);
  }

  revealRoleBtn.classList.add("hidden");

  roleAlreadyRevealedOnThisDevice = true;
  nextPlayerBtn.classList.add("hidden");
  startDebateBtn.classList.remove("hidden");
}

function nextPlayer() {
  // V27 multi-device: chaque téléphone affiche uniquement le rôle de son joueur.
  return;
  currentPlayerIndex++;
  revealed = false;

  updateCurrentPlayer();

  roleCard.classList.remove("traitor", "innocent", "vote-mode");

  roleLabel.textContent = "🎭 Rôle secret";
  roleTitle.textContent = "Passe le téléphone au joueur suivant";
  roleDescription.textContent =
    "Le prochain joueur peut maintenant découvrir son rôle.";

  missionBox.classList.add("hidden");

  nextPlayerBtn.classList.add("hidden");
  revealRoleBtn.classList.remove("hidden");
}

function startDebate() {
  phaseBadge.textContent = "Débat en cours 🔥";

  roleCard.classList.remove("traitor", "innocent", "vote-mode");

  roleLabel.textContent = "🗣️ DÉBAT";
  roleTitle.textContent = "Le débat commence";
  roleDescription.textContent =
    "Discutez ensemble et essayez de découvrir le traître.";

  missionBox.classList.add("hidden");

  startDebateBtn.classList.add("hidden");

  endGameBtn.textContent = "Passer au vote 🗳️";
  endGameBtn.classList.remove("hidden");

  addHistory("🔥 Débat lancé");
}

function startVote() {
  phaseBadge.textContent = "Vote final 🗳️";

  roleCard.classList.remove("traitor", "innocent");
  roleCard.classList.add("vote-mode");

  roleLabel.textContent = "🗳️ VOTE";
  roleTitle.textContent = "Qui est le traître ?";
  roleDescription.textContent =
    "Votez pour la personne que vous pensez être le traître.";

  missionBox.classList.remove("hidden");

  missionText.innerHTML = `
    <div class="vote-box">
      <p class="vote-intro">Chaque joueur vote une seule fois.</p>

      <div class="vote-list">
        ${players
          .map(
            (player, index) => `
          <button class="vote-btn" onclick="voteForPlayer(${index})">
            ${player.name}
          </button>
        `
          )
          .join("")}
      </div>
    </div>
  `;

  endGameBtn.classList.add("hidden");

  addHistory("🗳️ Vote lancé");
}

function voteForPlayer(index) {
  votes[index] = (votes[index] || 0) + 1;

  const votedPlayer = players[index].name;
  addHistory(`🗳️ Vote contre ${votedPlayer}`);

  revealTraitor(index);
}

function revealTraitor(votedIndex) {
  const traitor = players[traitorIndex];
  const votedPlayer = players[votedIndex];

  const innocentsWin = votedIndex === traitorIndex;

  const punishment = getRandomLoserPunishment();
  const reward = getRandomWinnerReward();

  phaseBadge.textContent = "Fin de partie";

  roleCard.classList.remove("vote-mode", "innocent");
  roleCard.classList.add("traitor");

  roleLabel.textContent = innocentsWin ? "✅ TROUVÉ" : "❌ RATÉ";
  roleTitle.textContent = `${traitor.name} était le traître`;
  roleDescription.textContent = `Mission : ${traitorMission.title}`;

  missionBox.classList.remove("hidden");
  renderMission(traitorMission);

  resultBox.classList.remove("hidden");

  resultTitle.textContent = innocentsWin
    ? "🎉 Victoire des innocents"
    : "😈 Victoire du traître";

  resultText.innerHTML = innocentsWin
    ? `
      Le groupe a voté contre ${votedPlayer.name}. Bien joué, le traître a été trouvé !<br><br>
      🍻 <strong>Punition du traître :</strong> ${punishment}<br>
      👑 <strong>Bonus innocents :</strong> ${reward}
    `
    : `
      Le groupe a voté contre ${votedPlayer.name}, mais le vrai traître était ${traitor.name}.<br><br>
      🍻 <strong>Punition des innocents :</strong> ${punishment}<br>
      👑 <strong>Bonus du traître :</strong> ${reward}
    `;

  launchConfetti();

  addHistory(`☠️ ${traitor.name} révélé comme traître`);
  addHistory(`🍻 Punition finale : ${punishment}`);
}

function listenToTraitorState() {
  onSnapshot(roomRef, snapshot => {
    if (!snapshot.exists()) return;

    const data = snapshot.data();

    if (handleGlobalLobbyReturn(data)) return;

    const state = data.traitorState;

    if (!state) return;
    if (state.actionId === lastActionId) return;

    lastActionId = state.actionId;

    traitorIndex = state.traitorIndex;
    traitorMission = state.traitorMission;
    history = state.history || history;

    renderHistory();
  });
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
  const colors = ["#ff007a", "#7b2cff", "#00b7ff", "#ffb000", "#00d084"];

  for (let i = 0; i < 40; i++) {
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

revealRoleBtn.addEventListener("click", revealRole);
nextPlayerBtn.addEventListener("click", nextPlayer);
startDebateBtn.addEventListener("click", startDebate);
endGameBtn.addEventListener("click", startVote);

window.voteForPlayer = voteForPlayer;

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