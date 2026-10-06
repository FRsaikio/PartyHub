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
const isHost = resolveIsHost(savedData);

function getSavedPlayerIdentity() {
  return (
    savedData.playerId ||
    savedData.profileId ||
    savedData.currentPlayerId ||
    savedData.localPlayerId ||
    savedData.uid ||
    savedData.playerName ||
    savedData.name ||
    savedData.pseudo ||
    localStorage.getItem("partyhubProfileId") ||
    localStorage.getItem("partyhubPlayerId") ||
    localStorage.getItem("partyhubPlayerName") ||
    ""
  );
}

const localPlayerIdentity = String(getSavedPlayerIdentity() || "").trim();

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
let currentPlayerIndex = 0;
let turnDirection = 1;
let selectedTargetIndex = null;
let selectedTargetName = null;
let lastTargetSelectionId = null;
let currentDrawState = null;
let playerStats = {};
let finalSummaryShown = false;

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
    scenarios: [
          {
                "text": "Waterfall classique : tout le monde commence à boire en même temps. Le joueur qui a pioché s'arrête quand il veut, puis chacun ne peut s'arrêter qu'après la personne avant lui.",
                "consequence": "Le dernier à arrêter boit 2 gorgées bonus."
          },
          {
                "text": "Waterfall inversée : le joueur à ta droite commence, puis tout le monde suit dans l'autre sens. Tu décides quand la cascade peut se terminer.",
                "consequence": "Le premier qui se trompe de sens boit 3 gorgées."
          },
          {
                "text": "Waterfall silencieuse : tout le monde boit, mais personne n'a le droit de parler jusqu'à la fin de la cascade.",
                "consequence": "Celui qui parle ou rigole trop fort boit 4 gorgées."
          },
          {
                "text": "Cascade piège : tout le monde boit. Tu peux t'arrêter une seule fois, mais si quelqu'un s'arrête avant son tour, il devient la cible du groupe.",
                "consequence": "La cible fait un verre cul sec ou distribue 6 gorgées si le groupe accepte d'être gentil."
          },
          {
                "text": "Mini-cascade : seuls les joueurs assis à gauche et à droite de toi participent à une cascade rapide.",
                "consequence": "Le dernier des deux à arrêter boit 4 gorgées. Si les deux arrêtent en même temps, tu bois 3 gorgées."
          },
          {
                "text": "Cascade royale : tu choisis le sens de départ et tu peux changer le sens une seule fois pendant la cascade.",
                "consequence": "Le joueur qui rate le changement de sens boit 5 gorgées."
          },
          {
                "text": "Cascade miroir : chaque joueur doit boire exactement comme la personne avant lui, même rythme et même pause.",
                "consequence": "Le premier qui casse le rythme boit 4 gorgées et devient la cible du prochain joueur."
          },
          {
                "text": "Cascade duo : choisis deux joueurs qui lancent une mini-cascade entre eux pendant que le groupe compte à voix haute.",
                "consequence": "Celui qui abandonne en premier boit 5 gorgées. S'ils tiennent jusqu'au compte de 10, tu distribues 5 gorgées."
          },
          {
                "text": "Cascade traître : pendant la cascade, tu peux désigner discrètement un joueur qui devra continuer 3 secondes de plus.",
                "consequence": "S'il refuse, il fait un verre cul sec. S'il accepte, il distribue 4 gorgées ensuite."
          },
          {
                "text": "Cascade vote : tout le monde boit une gorgée, puis le groupe vote pour la personne qui a le moins joué le jeu.",
                "consequence": "La personne élue boit 5 gorgées. En cas d'égalité, les égalités boivent 3 gorgées."
          },
          {
                "text": "Cascade mémoire : avant de boire, chaque joueur doit répéter le prénom de la personne avant lui dans la cascade.",
                "consequence": "Erreur ou oubli = 4 gorgées. Si tout le monde réussit, tu bois 3 gorgées."
          },
          {
                "text": "Cascade stop : tu choisis un mot secret. Quand tu le dis, tout le monde doit arrêter immédiatement.",
                "consequence": "Le dernier à arrêter boit 5 gorgées. Si quelqu'un arrête avant le mot, il boit 4 gorgées."
          },
          {
                "text": "Cascade fausse alerte : tu peux faire semblant de t'arrêter une fois. Les autres ne doivent pas tomber dans le piège.",
                "consequence": "Ceux qui s'arrêtent sur la feinte boivent 3 gorgées. Si personne ne tombe dedans, tu bois 4 gorgées."
          },
          {
                "text": "Cascade sans mains : tout le monde doit poser une main sur la table pendant la cascade.",
                "consequence": "Celui qui enlève sa main boit 4 gorgées. Le dernier à s'arrêter boit 2 gorgées bonus."
          },
          {
                "text": "Cascade catégorie : avant de boire, chaque joueur doit donner un mot dans une catégorie choisie par toi.",
                "consequence": "Blocage = 5 gorgées. Si tout le groupe réussit, tu distribues 6 gorgées."
          },
          {
                "text": "Cascade revanche : choisis un joueur qui t'a déjà mis une sanction. Il démarre la cascade avec toi.",
                "consequence": "Le premier de vous deux qui lâche boit 5 gorgées. Le gagnant distribue 4 gorgées."
          },
          {
                "text": "Cascade équipe : sépare la table en deux équipes. Chaque équipe lance sa propre cascade.",
                "consequence": "L'équipe qui finit en premier boit 2 gorgées chacun. L'autre équipe distribue 6 gorgées."
          },
          {
                "text": "Cascade jugement : après une mini-cascade, le groupe vote pour celui qui a le plus triché avec son verre.",
                "consequence": "Le joueur élu fait un verre cul sec. S'il conteste et perd le vote, il ajoute 3 gorgées."
          },
          {
                "text": "Cascade du boss : tu choisis un joueur qui contrôle l'arrêt de toute la table à ta place.",
                "consequence": "S'il abuse trop, le groupe peut voter contre lui. S'il est renversé, il boit 5 gorgées."
          },
          {
                "text": "Cascade finale : tout le monde participe, puis le dernier à arrêter choisit un autre joueur pour partager sa peine.",
                "consequence": "Les deux joueurs boivent chacun 4 gorgées. S'il refuse de choisir, il fait un verre cul sec."
          }
    ]
  },
  "2": {
    name: "You",
    scenarios: [
          {
                "text": "Choisis un joueur. Il doit inventer une excuse crédible pour éviter de boire.",
                "consequence": "Si le groupe refuse son excuse, il boit 4 gorgées. Si le groupe accepte, il distribue 3 gorgées."
          },
          {
                "text": "Choisis un joueur pour un duel pierre-feuille-ciseaux contre toi.",
                "consequence": "Le perdant boit 4 gorgées. En cas d'égalité, vous buvez tous les deux 2 gorgées."
          },
          {
                "text": "Choisis un joueur. Il devient ta cible officielle jusqu'à ton prochain tour.",
                "consequence": "Chaque fois qu'il boit avant ton prochain tour, tu distribues 2 gorgées à quelqu'un d'autre."
          },
          {
                "text": "Choisis un joueur. Il doit raconter une anecdote gênante en moins de 20 secondes.",
                "consequence": "Si le groupe juge l'anecdote trop faible, il fait un verre cul sec. Sinon il distribue 5 gorgées."
          },
          {
                "text": "Choisis un joueur. Il doit choisir entre boire maintenant ou accepter un défi rapide décidé par toi.",
                "consequence": "S'il boit, il prend 5 gorgées. S'il prend le défi et échoue, il fait un verre cul sec."
          },
          {
                "text": "Choisis un joueur. Le groupe vote pour savoir s'il est le plus susceptible de finir dans un plan foireux ce soir.",
                "consequence": "S'il gagne le vote, il boit 5 gorgées. Sinon tu bois 3 gorgées pour accusation faible."
          },
          {
                "text": "Choisis un joueur. Il doit désigner son meilleur allié autour de la table.",
                "consequence": "La cible et son allié boivent chacun 3 gorgées. Si personne ne veut être son allié, la cible fait un verre cul sec."
          },
          {
                "text": "Choisis un joueur. Il doit faire un compliment crédible à trois personnes différentes.",
                "consequence": "Chaque compliment refusé par le groupe vaut 2 gorgées. S'il réussit les trois, il distribue 5 gorgées."
          },
          {
                "text": "Choisis un joueur. Il devient ton rival jusqu'à ton prochain tour.",
                "consequence": "Si ton rival boit avant ton prochain tour, tu distribues 2 gorgées. S'il ne boit pas, tu bois 4 gorgées."
          },
          {
                "text": "Choisis un joueur. Il doit répondre en 5 secondes à une question du groupe.",
                "consequence": "Réponse validée = il distribue 4 gorgées. Hésitation, esquive ou réponse nulle = 5 gorgées."
          },
          {
                "text": "Choisis un joueur. Il doit choisir une personne qui boira avec lui pendant cette carte.",
                "consequence": "Ils boivent chacun 3 gorgées. S'il refuse de choisir, il fait un verre cul sec seul."
          },
          {
                "text": "Choisis un joueur. Il devient juge d'une mini-épreuve entre deux autres joueurs.",
                "consequence": "Le perdant de l'épreuve boit 4 gorgées, mais si le juge est trop injuste, le groupe peut lui donner 5 gorgées."
          },
          {
                "text": "Choisis un joueur. Il doit imiter quelqu'un de la table sans dire son nom.",
                "consequence": "Si le groupe devine, la personne imitée boit 3 gorgées. Sinon l'imitateur boit 5 gorgées."
          },
          {
                "text": "Choisis un joueur. Il doit donner une vérité gênante ou accepter une sanction directe.",
                "consequence": "Vérité validée = il distribue 5 gorgées. Refus ou vérité jugée faible = verre cul sec."
          },
          {
                "text": "Choisis un joueur. Il doit former une alliance avec une personne qu'il n'aurait pas choisie naturellement.",
                "consequence": "Les deux alliés boivent 2 gorgées maintenant. S'ils se trahissent avant le prochain 2, ils boivent chacun 5 gorgées."
          },
          {
                "text": "Choisis un joueur. Il devient intouchable pour une petite sanction, mais seulement si le groupe accepte.",
                "consequence": "Si le groupe accepte, tu bois 4 gorgées pour lui offrir le bouclier. Si le groupe refuse, il boit 5 gorgées."
          },
          {
                "text": "Choisis un joueur. Il doit deviner qui autour de la table l'aurait le plus ciblé à ta place.",
                "consequence": "S'il trouve, il distribue 5 gorgées. S'il se trompe, lui et la vraie personne boivent 3 gorgées chacun."
          },
          {
                "text": "Choisis un joueur. Il doit lancer un duel de regard avec toi pendant 10 secondes.",
                "consequence": "Le premier qui rigole ou détourne les yeux boit 5 gorgées. Si vous tenez tous les deux, le groupe boit 1 gorgée."
          },
          {
                "text": "Choisis un joueur. Il doit sacrifier quelqu'un pour réduire sa sanction.",
                "consequence": "S'il sacrifie quelqu'un, ils boivent chacun 3 gorgées. S'il refuse de sacrifier, il fait un verre cul sec."
          },
          {
                "text": "Choisis un joueur. Il devient la star du tour et doit trinquer avec la personne de ton choix.",
                "consequence": "Les deux boivent 3 gorgées. Si la star refuse la personne choisie, elle boit 6 gorgées."
          }
    ]
  },
  "3": {
    name: "Me",
    scenarios: [
          {
                "text": "Tu es la cible. Tu dois boire immédiatement, mais tu peux entraîner quelqu'un avec toi.",
                "consequence": "Tu bois 3 gorgées et tu choisis un joueur qui boit 2 gorgées avec toi."
          },
          {
                "text": "Tu choisis un partenaire de galère pour un duel rapide contre toi.",
                "consequence": "Le perdant boit 4 gorgées. Le gagnant peut distribuer 2 gorgées."
          },
          {
                "text": "Tu prends la pression du groupe : chaque joueur te pose une question rapide. Tu peux passer une seule fois.",
                "consequence": "À la deuxième esquive ou hésitation, tu fais un verre cul sec."
          },
          {
                "text": "Tu deviens le martyr du tour : tu peux accepter ta sanction ou la transférer à quelqu'un qui accepte un duel contre toi.",
                "consequence": "Si personne n'accepte le duel, tu bois 5 gorgées. Si quelqu'un accepte, le perdant boit 5 gorgées."
          },
          {
                "text": "Tu dois choisir entre boire maintenant ou laisser le groupe choisir un mini-défi pour toi.",
                "consequence": "Boire = 5 gorgées. Défi raté ou refusé = verre cul sec."
          },
          {
                "text": "Tu désignes une personne qui t'accompagne dans ta galère.",
                "consequence": "Vous buvez chacun 3 gorgées. Si la personne refuse, elle boit 5 gorgées et tu distribues 3 gorgées."
          },
          {
                "text": "Tu dois raconter un mini-dossier sur toi-même en moins de 20 secondes.",
                "consequence": "Si le groupe valide, tu distribues 5 gorgées. Si le groupe trouve ça trop faible, tu fais un verre cul sec."
          },
          {
                "text": "Tu deviens la cible officielle jusqu'à ton prochain tour.",
                "consequence": "La prochaine fois que quelqu'un doit choisir une cible, il peut te choisir pour te donner 3 gorgées bonus."
          },
          {
                "text": "Tu peux acheter une immunité contre une petite sanction future.",
                "consequence": "Pour l'acheter, tu bois 4 gorgées maintenant. Si tu refuses, tu distribues 3 gorgées mais tu restes vulnérable."
          },
          {
                "text": "Tu dois faire un duel pierre-feuille-ciseaux contre la personne à ta gauche.",
                "consequence": "Le perdant boit 5 gorgées. Le gagnant peut annuler une petite sanction avant son prochain tour."
          },
          {
                "text": "Tu deviens le banquier du tour : tu reçois 8 gorgées à distribuer, mais le groupe peut te taxer.",
                "consequence": "Distribue 8 gorgées. Si le groupe juge ta distribution injuste, tu bois 4 gorgées."
          },
          {
                "text": "Tu choisis une personne qui t'a déjà ciblé ou qui te fait peur dans la partie.",
                "consequence": "Vous buvez chacun 3 gorgées, puis vous êtes rivaux jusqu'à ton prochain tour."
          },
          {
                "text": "Tu dois prendre une décision : protéger quelqu'un ou punir quelqu'un.",
                "consequence": "Protection = tu bois 4 gorgées. Punition = la cible boit 4 gorgées mais peut te défier."
          },
          {
                "text": "Tu dois faire une mini-imitation d'un joueur de la table.",
                "consequence": "Si le groupe devine, tu distribues 4 gorgées. Sinon tu bois 5 gorgées."
          },
          {
                "text": "Tu deviens l'otage du groupe pendant 1 tour : le groupe choisit une règle légère qui ne concerne que toi.",
                "consequence": "Si tu l'oublies, tu bois 4 gorgées. Si tu tiens jusqu'au bout, tu distribues 6 gorgées."
          },
          {
                "text": "Tu dois choisir ton camp : alcool direct ou chaos social.",
                "consequence": "Alcool direct = 5 gorgées. Chaos social = tu lances un vote, le perdant fait un verre cul sec."
          },
          {
                "text": "Tu peux transférer ta prochaine petite sanction, mais tu dois payer maintenant.",
                "consequence": "Tu bois 4 gorgées. Si tu n'utilises pas le transfert avant ton prochain tour, tu bois 2 gorgées bonus."
          },
          {
                "text": "Tu es accusé par le groupe d'être trop dangereux dans la partie. Défends-toi en 15 secondes.",
                "consequence": "Défense validée = tu distribues 5 gorgées. Défense refusée = verre cul sec."
          },
          {
                "text": "Tu dois trinquer avec la personne que le groupe estime la plus opposée à toi.",
                "consequence": "Vous buvez chacun 3 gorgées. Si vous refusez, vous buvez chacun 5 gorgées."
          },
          {
                "text": "Tu deviens le héros inutile du tour : tu dois sauver quelqu'un d'une sanction imaginaire.",
                "consequence": "La personne sauvée distribue 4 gorgées. Toi, tu bois 3 gorgées pour le geste héroïque."
          }
    ]
  },
  "4": {
    name: "Floor",
    scenarios: [
          {
                "text": "Tout le monde touche le sol le plus vite possible.",
                "consequence": "Le dernier à toucher le sol boit 4 gorgées."
          },
          {
                "text": "Faux départ : tu cries 'sol' quand tu veux dans les 10 prochaines secondes. Tout le monde doit réagir.",
                "consequence": "Le dernier boit 3 gorgées. Si quelqu'un touche le sol avant ton signal, il boit 5 gorgées."
          },
          {
                "text": "Tout le monde doit toucher le sol avec deux mains, sans se lever de sa place.",
                "consequence": "Le dernier boit 4 gorgées et devient la cible du prochain joueur."
          },
          {
                "text": "Réflexe inversé : tout le monde doit lever les mains au lieu de toucher le sol.",
                "consequence": "Ceux qui touchent le sol par réflexe boivent 3 gorgées. Le dernier à lever les mains boit 5 gorgées."
          },
          {
                "text": "Floor silencieux : tout le monde touche le sol sans parler ni rire.",
                "consequence": "Le dernier boit 4 gorgées. Le premier qui parle boit 3 gorgées bonus."
          },
          {
                "text": "Floor mémoire : tu annonces une façon précise de toucher le sol, par exemple coude, main gauche ou deux doigts.",
                "consequence": "Les erreurs boivent 3 gorgées. Le dernier correct boit 5 gorgées."
          },
          {
                "text": "Floor en chaîne : le joueur à ta gauche touche le sol, puis chacun suit dans l'ordre.",
                "consequence": "Celui qui casse l'ordre boit 4 gorgées. Si la chaîne réussit, tu bois 2 gorgées."
          },
          {
                "text": "Floor piège : tu peux faire un faux mouvement avant de vraiment lancer le signal.",
                "consequence": "Ceux qui tombent dans le piège boivent 3 gorgées. Si personne ne tombe dedans, tu distribues 4 gorgées."
          },
          {
                "text": "Floor duel : choisis un joueur. Au signal du groupe, vous devez toucher le sol le plus vite possible.",
                "consequence": "Le plus lent boit 5 gorgées. En cas d'égalité, vous buvez chacun 2 gorgées."
          },
          {
                "text": "Floor statue : tout le monde touche le sol puis reste immobile pendant 8 secondes.",
                "consequence": "Le premier qui bouge ou rigole boit 5 gorgées. Si personne ne craque, tout le monde boit 1 gorgée."
          },
          {
                "text": "Floor royal : tu choisis une catégorie de joueurs qui doit toucher le sol avec un handicap drôle, sans danger.",
                "consequence": "Les joueurs concernés qui ratent boivent 4 gorgées. S'ils réussissent tous, tu bois 4 gorgées."
          },
          {
                "text": "Floor miroir : tout le monde doit copier la posture au sol du joueur à ta droite.",
                "consequence": "La posture la plus ratée boit 5 gorgées. La meilleure distribue 3 gorgées."
          },
          {
                "text": "Floor traître : après le signal, chacun pointe la personne qu'il pense avoir été la plus lente.",
                "consequence": "La personne la plus accusée boit 5 gorgées. Si le groupe accuse mal, le vrai dernier distribue 4 gorgées."
          },
          {
                "text": "Floor express : tout le monde a 2 secondes pour toucher le sol après ton signal.",
                "consequence": "Tous ceux qui ratent le timing boivent 4 gorgées. Si tout le monde réussit, tu distribues 5 gorgées."
          },
          {
                "text": "Floor interdit : jusqu'à ton prochain tour, personne ne doit toucher volontairement le sol avec les mains.",
                "consequence": "Chaque erreur vaut 3 gorgées. Si personne ne se trompe, tu bois 3 gorgées."
          },
          {
                "text": "Floor sélection : le dernier à toucher le sol doit choisir quelqu'un pour partager sa sanction.",
                "consequence": "Les deux boivent 3 gorgées. S'il refuse de choisir, il fait un verre cul sec."
          },
          {
                "text": "Floor objet : au lieu du sol, tu choisis un objet visible que tout le monde doit toucher.",
                "consequence": "Le dernier boit 4 gorgées. Celui qui touche le mauvais objet boit 5 gorgées."
          },
          {
                "text": "Floor sabotage : tu désignes une personne qui devra toucher le sol avec une contrainte simple, comme une main derrière le dos.",
                "consequence": "Si elle réussit, tu bois 3 gorgées. Si elle échoue, elle boit 5 gorgées."
          },
          {
                "text": "Floor jugement : le groupe juge qui a eu la réaction la plus ridicule.",
                "consequence": "Le joueur désigné boit 4 gorgées et doit lancer le prochain compte à rebours."
          },
          {
                "text": "Floor final : tout le monde touche le sol, puis le dernier devient chef d'une mini-punition collective ciblée.",
                "consequence": "Il choisit deux joueurs qui boivent 3 gorgées avec lui. S'il refuse, il fait un verre cul sec."
          }
    ]
  },
  "5": {
    name: "Guys",
    scenarios: [
          {
                "text": "Tous les gars boivent ensemble.",
                "consequence": "Les gars boivent 3 gorgées. S'il n'y a aucun gars, le joueur qui a pioché distribue 5 gorgées."
          },
          {
                "text": "Les gars votent entre eux pour désigner le plus dangereux du groupe.",
                "consequence": "Le joueur désigné boit 5 gorgées. En cas d'égalité, tous les gars boivent 2 gorgées."
          },
          {
                "text": "Duel des gars : choisis deux gars qui s'affrontent à pierre-feuille-ciseaux.",
                "consequence": "Le perdant fait un verre cul sec. S'il y a moins de deux gars, tu choisis deux joueurs au hasard."
          },
          {
                "text": "Alliance des gars : jusqu'au prochain 5, les gars doivent se défendre entre eux.",
                "consequence": "Si un gars est ciblé avant le prochain 5, tous les gars boivent 2 gorgées avec lui."
          },
          {
                "text": "Tribunal des gars : les gars choisissent un joueur qui doit se défendre en 20 secondes.",
                "consequence": "Si sa défense est refusée, il boit 5 gorgées. Si elle est acceptée, les gars distribuent 6 gorgées."
          },
          {
                "text": "Conseil des gars : les gars désignent deux joueurs pour un duel rapide.",
                "consequence": "Le perdant boit 4 gorgées. Le gagnant choisit un gars qui distribue 3 gorgées."
          },
          {
                "text": "Pouvoir des gars : les gars imposent un mot interdit jusqu'au prochain 5. Le mot doit être clair.",
                "consequence": "Chaque erreur vaut 3 gorgées. Si personne ne se trompe, les gars boivent 2 gorgées chacun."
          },
          {
                "text": "Les gars choisissent un joueur qui doit faire un compliment crédible à trois personnes.",
                "consequence": "S'il bloque ou sort un compliment nul, il boit 5 gorgées. S'il réussit, il distribue 4 gorgées."
          },
          {
                "text": "Duo imposé : chaque gars choisit un partenaire de boisson pour ce tour.",
                "consequence": "Chaque duo boit 2 gorgées ensemble. Les joueurs sans duo boivent 3 gorgées."
          },
          {
                "text": "Les gars lancent un vote éclair : qui est le plus susceptible de trahir une alliance ?",
                "consequence": "Le joueur élu boit 5 gorgées et devient la cible prioritaire du prochain effet chaos."
          },
          {
                "text": "Les gars créent une règle de respect pendant 2 tours. Exemple : appeler tout le monde patron ou chef.",
                "consequence": "Chaque oubli vaut 2 gorgées. Au troisième oubli total, tous les gars boivent 2 gorgées."
          },
          {
                "text": "Défi collectif des gars : ils choisissent une mini-épreuve réalisable pour toute la table.",
                "consequence": "Ceux qui refusent boivent 4 gorgées. Si tout le monde participe, les gars distribuent 6 gorgées."
          },
          {
                "text": "Les gars désignent un chef temporaire jusqu'au prochain tour.",
                "consequence": "Le chef distribue 5 gorgées, mais boit 2 gorgées à chaque ordre qu'il donne."
          },
          {
                "text": "Protection piégée : les gars protègent un joueur, mais seulement si ce joueur accepte leur condition.",
                "consequence": "S'il accepte, il annule une petite sanction. S'il refuse, il boit 5 gorgées."
          },
          {
                "text": "Les gars choisissent deux joueurs qui doivent échanger leur place ou leur rôle social pendant 2 tours.",
                "consequence": "S'ils refusent, ils boivent chacun 4 gorgées. S'ils acceptent, les gars boivent 1 gorgée chacun."
          },
          {
                "text": "Ultimatum des gars : ils donnent deux options à un joueur, une vérité gênante ou une sanction alcool.",
                "consequence": "S'il choisit la vérité, le groupe valide. S'il refuse ou ment, il fait un verre cul sec."
          },
          {
                "text": "Les gars lancent une règle anti-téléphone jusqu'au prochain 5.",
                "consequence": "Le premier qui touche son téléphone boit 5 gorgées. Si personne ne touche son téléphone, les gars distribuent 5 gorgées."
          },
          {
                "text": "Les gars choisissent un joueur qui doit imiter quelqu'un de la table pendant 15 secondes.",
                "consequence": "Si le groupe devine, la personne imitée boit 3 gorgées. Sinon l'imitateur boit 5 gorgées."
          },
          {
                "text": "Les gars décident d'une mini-punition ciblée sur une personne.",
                "consequence": "La cible peut accepter et boire 4 gorgées, ou défier un gars au choix. Le perdant boit 5 gorgées."
          },
          {
                "text": "Conseil final des gars : ils choisissent une personne qui doit trinquer avec chacun d'eux.",
                "consequence": "La cible boit 1 gorgée avec chaque gars. S'il n'y a aucun gars, tout le monde boit 2 gorgées."
          }
    ]
  },
  "6": {
    name: "Girls",
    scenarios: [
      {
        text: "Toutes les filles boivent ensemble pour ouvrir le tour.",
        consequence: "Les filles boivent 3 gorgées. S'il n'y a aucune fille, le joueur qui a pioché distribue 5 gorgées."
      },
      {
        text: "Les filles votent pour la personne la plus suspecte de la table.",
        consequence: "La personne désignée boit 4 gorgées. Si le vote est égalité, toutes les filles distribuent 2 gorgées."
      },
      {
        text: "Duel des filles : choisis deux filles qui s'affrontent à pierre-feuille-ciseaux.",
        consequence: "La perdante boit 5 gorgées. S'il y a moins de deux filles, choisis deux joueurs au hasard."
      },
      {
        text: "Alliance des filles : jusqu'au prochain 6, les filles peuvent protéger une personne du groupe.",
        consequence: "La personne protégée peut annuler une petite sanction. En échange, toutes les filles boivent 2 gorgées."
      },
      {
        text: "Tribunal des filles : les filles choisissent un joueur qui doit se défendre en 20 secondes.",
        consequence: "Si sa défense est refusée, il fait un verre cul sec. Si elle est acceptée, les filles distribuent 6 gorgées."
      },
      {
        text: "Conseil secret : les filles se concertent et désignent deux joueurs qui doivent faire un duel rapide.",
        consequence: "Le perdant boit 4 gorgées. Le gagnant choisit une fille qui distribue 3 gorgées."
      },
      {
        text: "Pouvoir des filles : les filles imposent un mot interdit jusqu'au prochain 6. Le mot doit être annoncé clairement.",
        consequence: "Chaque erreur vaut 3 gorgées. Si personne ne se trompe avant le prochain 6, les filles boivent 2 gorgées."
      },
      {
        text: "Les filles choisissent un joueur qui doit complimenter sincèrement trois personnes différentes.",
        consequence: "S'il bloque ou fait un compliment éclaté, il boit 5 gorgées. S'il réussit, il distribue 4 gorgées."
      },
      {
        text: "Duo imposé : chaque fille choisit un partenaire de boisson pour ce tour.",
        consequence: "Chaque duo boit 2 gorgées ensemble. Les joueurs sans duo boivent 3 gorgées."
      },
      {
        text: "Les filles lancent un vote éclair : qui est le plus susceptible de trahir le groupe ce soir ?",
        consequence: "Le joueur élu boit 5 gorgées et devient la cible prioritaire du prochain effet chaos."
      },
      {
        text: "Les filles créent une règle de politesse pendant 2 tours. Exemple : dire merci avant de boire ou appeler tout le monde chef.",
        consequence: "Chaque oubli vaut 2 gorgées. Au troisième oubli total, tout le monde boit 2 gorgées."
      },
      {
        text: "Défi collectif des filles : elles choisissent une mini-épreuve réalisable pour toute la table.",
        consequence: "Ceux qui refusent boivent 4 gorgées. Si tout le monde participe, les filles distribuent 6 gorgées."
      },
      {
        text: "Les filles désignent un roi ou une reine temporaire jusqu'au prochain tour.",
        consequence: "La personne choisie distribue 5 gorgées, mais doit boire 2 gorgées à chaque fois qu'elle donne un ordre."
      },
      {
        text: "Protection piégée : les filles protègent un joueur, mais seulement s'il accepte une condition imposée par elles.",
        consequence: "S'il accepte, il est protégé d'une sanction simple. S'il refuse, il boit 5 gorgées."
      },
      {
        text: "Les filles choisissent deux joueurs qui doivent échanger leur place ou leur rôle social pendant 2 tours.",
        consequence: "S'ils refusent, ils boivent chacun 4 gorgées. S'ils acceptent, les filles boivent 1 gorgée chacune."
      },
      {
        text: "Ultimatum des filles : elles donnent deux options à un joueur, une vérité gênante ou une sanction alcool.",
        consequence: "S'il choisit la vérité, le groupe valide. S'il refuse ou ment, il fait un verre cul sec."
      },
      {
        text: "Les filles lancent une règle anti-téléphone jusqu'au prochain 6.",
        consequence: "Le premier qui touche son téléphone boit 5 gorgées. Si personne ne touche son téléphone, les filles distribuent 5 gorgées."
      },
      {
        text: "Les filles choisissent un joueur qui doit imiter quelqu'un de la table pendant 15 secondes.",
        consequence: "Si le groupe devine, la personne imitée boit 3 gorgées. Sinon l'imitateur boit 5 gorgées."
      },
      {
        text: "Les filles décident d'une mini-punition de groupe ciblée sur une personne.",
        consequence: "La cible peut accepter et boire 4 gorgées, ou défier une fille au choix. Le perdant boit 5 gorgées."
      },
      {
        text: "Conseil final des filles : elles choisissent une personne qui doit trinquer avec chacune d'elles.",
        consequence: "La cible boit 1 gorgée avec chaque fille. S'il n'y a aucune fille, tout le monde boit 2 gorgées."
      }
    ]
  },
  "7": {
    name: "Heaven",
    scenarios: [
      {
        text: "Tout le monde lève les mains vers le ciel le plus vite possible.",
        consequence: "Le dernier boit 4 gorgées."
      },
      {
        text: "Heaven piégé : tout le monde doit lever une seule main. Celui qui lève les deux est piégé.",
        consequence: "Les joueurs piégés boivent 3 gorgées. Le dernier boit 5 gorgées."
      },
      {
        text: "Le joueur qui a pioché choisit un geste à faire vers le ciel. Tout le monde doit le copier.",
        consequence: "Le plus lent boit 4 gorgées et doit garder ce geste pendant 10 secondes."
      },
      {
        text: "Heaven silencieux : tout le monde lève les mains sans parler. Le premier qui parle perd.",
        consequence: "Le perdant boit 5 gorgées. Si personne ne parle, le dernier à lever les mains boit 3 gorgées."
      },
      {
        text: "Heaven inversé : au lieu de lever les mains, tout le monde doit pointer vers le sol.",
        consequence: "Ceux qui lèvent les mains par réflexe boivent 3 gorgées. Le dernier à pointer le sol boit 4 gorgées."
      },
      {
        text: "Heaven mémoire : tu montres une pose avec les mains. Tout le monde doit la reproduire exactement.",
        consequence: "Chaque erreur vaut 2 gorgées. Le pire imitateur boit 5 gorgées."
      },
      {
        text: "Heaven en chaîne : le joueur à ta gauche lève la main, puis chacun suit dans l'ordre.",
        consequence: "Celui qui casse l'ordre boit 4 gorgées. Si la chaîne réussit, tu bois 2 gorgées."
      },
      {
        text: "Faux Heaven : tu peux feinter une fois sans lever les mains. Si quelqu'un tombe dans le piège, il perd.",
        consequence: "Tous ceux qui réagissent à la feinte boivent 3 gorgées. Si personne ne tombe dedans, tu bois 4 gorgées."
      },
      {
        text: "Heaven duel : choisis un joueur. Au signal du groupe, vous devez lever les mains en même temps.",
        consequence: "Le plus lent boit 5 gorgées. En cas d'égalité, vous buvez chacun 2 gorgées."
      },
      {
        text: "Heaven statue : tout le monde lève les mains puis reste immobile pendant 10 secondes.",
        consequence: "Le premier qui bouge, parle ou rigole boit 5 gorgées. Si personne ne craque, tout le monde boit 1 gorgée."
      },
      {
        text: "Heaven royal : le joueur qui a pioché choisit qui a le droit de baisser les mains en premier.",
        consequence: "Le dernier autorisé à baisser les mains boit 4 gorgées, sauf s'il négocie une alliance avec toi."
      },
      {
        text: "Heaven miroir : tout le monde doit copier exactement le joueur à ta droite pendant 10 secondes.",
        consequence: "La première erreur vaut 3 gorgées. La deuxième personne qui se trompe boit 5 gorgées."
      },
      {
        text: "Heaven traître : après avoir levé les mains, chaque joueur pointe la personne qu'il pense avoir été la plus lente.",
        consequence: "La personne la plus accusée boit 5 gorgées. En cas d'égalité, les accusés boivent 3 gorgées."
      },
      {
        text: "Heaven express : tout le monde a 2 secondes pour lever les mains après ton signal.",
        consequence: "Tous ceux qui ratent le timing boivent 4 gorgées. Si tout le monde réussit, tu distribues 4 gorgées."
      },
      {
        text: "Heaven interdit : jusqu'à ton prochain tour, personne ne doit lever les mains au-dessus des épaules.",
        consequence: "Chaque erreur vaut 3 gorgées. Si personne ne se trompe, tu bois 3 gorgées."
      },
      {
        text: "Heaven sélection : le dernier à lever les mains doit choisir un autre joueur pour partager sa peine.",
        consequence: "Les deux joueurs boivent chacun 3 gorgées. S'il refuse de choisir, il fait un verre cul sec."
      },
      {
        text: "Heaven musical : tout le monde lève les mains et fredonne un son pendant 5 secondes.",
        consequence: "Celui qui s'arrête le premier boit 4 gorgées. Le groupe peut élire le pire son, qui vaut 2 gorgées bonus."
      },
      {
        text: "Heaven sabotage : tu peux désigner une personne qui doit lever les mains avec un handicap drôle, sans danger.",
        consequence: "Si elle réussit, tu bois 3 gorgées. Si elle échoue, elle boit 5 gorgées."
      },
      {
        text: "Heaven jugement : le groupe juge qui a réagi le moins naturellement.",
        consequence: "Le joueur désigné boit 4 gorgées et doit lancer le prochain compte à rebours."
      },
      {
        text: "Heaven final : tout le monde lève les mains, puis le joueur qui a pioché choisit une catégorie de joueurs à punir.",
        consequence: "La catégorie choisie boit 3 gorgées. Exemple : lunettes, baskets blanches, cheveux attachés, etc."
      }
    ]
  },
  "8": {
    name: "Mate",
    scenarios: [
      {
        text: "Choisis un mate. Pendant 3 tours, quand tu bois, il boit aussi.",
        consequence: "Pour sceller l'alliance, vous buvez chacun 2 gorgées maintenant."
      },
      {
        text: "Choisis un mate de galère. Jusqu'à ton prochain tour, vous partagez les sanctions.",
        consequence: "Si l'un de vous est ciblé, l'autre boit 2 gorgées avec lui."
      },
      {
        text: "Choisis un mate protecteur. Il peut te sauver une fois d'une petite sanction.",
        consequence: "S'il te sauve, il boit 4 gorgées à ta place."
      },
      {
        text: "Choisis un mate rival. Vous êtes liés, mais le groupe peut vous opposer à tout moment jusqu'au prochain 8.",
        consequence: "Au premier duel entre vous deux, le perdant fait un verre cul sec."
      },
      {
        text: "Choisis un mate miroir. Jusqu'à ton prochain tour, il doit copier ta façon de boire et tes réactions.",
        consequence: "S'il oublie, il boit 3 gorgées. Si tu le pièges volontairement, tu bois aussi 2 gorgées."
      },
      {
        text: "Choisis un mate secret sans le dire au groupe. Fais-lui comprendre discrètement qu'il est lié à toi.",
        consequence: "Si le groupe devine le mate avant ton prochain tour, vous buvez chacun 4 gorgées. Sinon vous distribuez 6 gorgées."
      },
      {
        text: "Choisis un mate sacrifice. Il peut prendre une sanction à ta place une seule fois.",
        consequence: "S'il accepte de se sacrifier, il boit 5 gorgées et tu distribues 3 gorgées. S'il refuse, vous buvez chacun 3 gorgées."
      },
      {
        text: "Choisis un mate de duel. Vous êtes une équipe contre deux joueurs choisis par le groupe.",
        consequence: "L'équipe perdante boit 4 gorgées chacun. L'équipe gagnante distribue 4 gorgées."
      },
      {
        text: "Choisis un mate toxique. Jusqu'au prochain 8, chaque fois qu'il parle avant toi, il boit.",
        consequence: "Chaque erreur vaut 2 gorgées. S'il tient jusqu'au bout, tu bois 5 gorgées."
      },
      {
        text: "Choisis un mate de confiance. Il doit répondre à ta place à la prochaine question gênante qui te vise.",
        consequence: "S'il répond mal ou refuse, vous buvez chacun 4 gorgées. S'il gère, vous distribuez 5 gorgées."
      },
      {
        text: "Choisis un mate verre cul sec. Vous devez trinquer ensemble maintenant.",
        consequence: "Vous buvez chacun 3 gorgées. Si l'un refuse, il fait un verre cul sec seul."
      },
      {
        text: "Choisis un mate espion. Il doit surveiller une personne jusqu'à ton prochain tour.",
        consequence: "Si la cible touche son téléphone, dit un prénom ou oublie une règle active, elle boit 4 gorgées et ton mate distribue 3 gorgées."
      },
      {
        text: "Choisis un mate maudit. Pendant 2 tours, vos destins sont liés.",
        consequence: "Si l'un boit, l'autre boit 2 gorgées. Si l'un gagne un duel, l'autre distribue 3 gorgées."
      },
      {
        text: "Choisis un mate de vengeance. Il doit désigner quelqu'un qui lui a déjà mis une sanction dans la partie.",
        consequence: "La cible boit 4 gorgées. S'il n'a personne à désigner, ton mate boit 3 gorgées et tu distribues 2 gorgées."
      },
      {
        text: "Choisis un mate silencieux. Jusqu'à ton prochain tour, vous ne pouvez communiquer qu'avec des gestes.",
        consequence: "Le premier de vous deux qui parle boit 5 gorgées. Si vous réussissez, vous distribuez 6 gorgées."
      },
      {
        text: "Choisis un mate bouclier. Il protège une personne choisie par toi, mais pas toi.",
        consequence: "Si la personne protégée est ciblée, ton mate boit 4 gorgées pour la sauver. Sinon ton mate distribue 3 gorgées à la fin."
      },
      {
        text: "Choisis un mate imposteur. Le groupe doit voter pour deviner s'il est vraiment ton allié ou ton ennemi.",
        consequence: "Si le groupe se trompe, vous distribuez 8 gorgées. S'il trouve, vous buvez chacun 4 gorgées."
      },
      {
        text: "Choisis un mate de rythme. À chaque fois que quelqu'un dit ton prénom, vous devez trinquer ensemble.",
        consequence: "Chaque oubli vaut 2 gorgées chacun. La troisième erreur déclenche un verre cul sec partagé au choix."
      },
      {
        text: "Choisis un mate remplaçant. Il joue ton prochain défi à ta place, sauf si le groupe refuse.",
        consequence: "S'il réussit, vous distribuez 5 gorgées. S'il échoue, vous buvez chacun 5 gorgées."
      },
      {
        text: "Choisis ton mate final. Jusqu'au prochain 8, vous êtes officiellement un duo.",
        consequence: "Toutes vos sanctions simples sont partagées. Pour commencer, vous buvez chacun 2 gorgées."
      }
    ]
  },
  "9": {
    name: "Rhyme",
    scenarios: [
      {
        text: "Choisis un mot. Chaque joueur doit donner une rime rapidement, sans répéter une réponse.",
        consequence: "Le premier qui bloque, répète ou donne une rime refusée boit 4 gorgées."
      },
      {
        text: "Battle de rimes : choisis un joueur. Vous alternez les rimes jusqu'à ce que quelqu'un bloque.",
        consequence: "Le perdant boit 5 gorgées. Le gagnant distribue 2 gorgées."
      },
      {
        text: "Rime sale : le groupe peut refuser les rimes trop faciles.",
        consequence: "Chaque rime refusée vaut 2 gorgées. Le premier à abandonner fait un verre cul sec."
      },
      {
        text: "Rime chrono : 3 secondes maximum par joueur.",
        consequence: "Hésitation, répétition ou silence = 4 gorgées immédiates."
      },
      {
        text: "Rime thème soirée : choisis un mot lié à la soirée. Les rimes doivent rester dans l'ambiance.",
        consequence: "Une rime hors thème vaut 3 gorgées. Le premier blocage vaut 5 gorgées."
      },
      {
        text: "Rime duel sale : choisis un adversaire. Chaque rime doit être une mini-pique drôle contre l'autre.",
        consequence: "Le groupe choisit le moins drôle. Il boit 5 gorgées. En cas de malaise, les deux boivent 2 gorgées."
      },
      {
        text: "Rime interdite : choisis un son interdit, par exemple -é ou -on. Personne ne peut rimer avec ce son.",
        consequence: "Celui qui utilise le son interdit boit 4 gorgées. Celui qui bloque boit 5 gorgées."
      },
      {
        text: "Rime en chaîne : chaque joueur doit reprendre le dernier mot de la rime précédente et en créer une nouvelle.",
        consequence: "Celui qui casse la chaîne boit 5 gorgées. Si la chaîne fait un tour complet, tu bois 3 gorgées."
      },
      {
        text: "Rime célébrité : chaque rime doit contenir un prénom ou un nom connu.",
        consequence: "Nom éclaté ou répétition = 3 gorgées. Blocage = verre cul sec."
      },
      {
        text: "Rime vérité : chaque joueur doit donner une rime qui révèle un mini-dossier sur lui-même.",
        consequence: "Si le groupe juge la rime trop safe, le joueur boit 4 gorgées. La meilleure rime distribue 4 gorgées."
      },
      {
        text: "Rime duo : choisis deux joueurs. Ils doivent créer une rime ensemble en alternant un mot chacun.",
        consequence: "S'ils échouent, ils boivent chacun 4 gorgées. S'ils réussissent, ils distribuent 5 gorgées."
      },
      {
        text: "Rime menteur : un joueur peut inventer un mot une seule fois dans le tour.",
        consequence: "Si le groupe repère le faux mot, le menteur boit 5 gorgées. Sinon il distribue 5 gorgées."
      },
      {
        text: "Rime accélérée : le premier tour se fait en 5 secondes, le deuxième en 3 secondes.",
        consequence: "Erreur au premier tour = 3 gorgées. Erreur au deuxième = verre cul sec."
      },
      {
        text: "Rime sabotage : tu peux imposer un mot difficile à un joueur précis.",
        consequence: "S'il réussit, tu bois 4 gorgées. S'il échoue, il boit 5 gorgées."
      },
      {
        text: "Rime collective : le groupe doit créer une phrase rimée complète, joueur après joueur.",
        consequence: "Celui qui détruit la phrase boit 4 gorgées. Si la phrase est validée, tout le monde trinque 1 gorgée."
      },
      {
        text: "Rime sans réfléchir : chaque joueur doit répondre immédiatement, sans bruit d'hésitation.",
        consequence: "Un euh, un blanc ou une répétition vaut 3 gorgées. Deux erreurs dans le tour = verre cul sec."
      },
      {
        text: "Rime ciblée : choisis une personne. Toutes les rimes doivent parler d'elle, gentiment ou salement selon l'ambiance.",
        consequence: "La cible choisit la pire rime. Son auteur boit 5 gorgées. La meilleure rime distribue 3 gorgées."
      },
      {
        text: "Rime inversée : au lieu de trouver une rime, chaque joueur doit donner un mot qui ne rime surtout pas avec le mot de départ.",
        consequence: "Si ça rime quand même, le joueur boit 4 gorgées. Si le groupe hésite, vote rapide."
      },
      {
        text: "Rime tribunal : après un tour de rimes, le groupe vote pour la rime la plus faible.",
        consequence: "Le joueur élu boit 5 gorgées. La meilleure rime donne une immunité contre la prochaine petite sanction."
      },
      {
        text: "Rime finale : choisis un mot. Le tour continue jusqu'à ce qu'il ne reste que deux joueurs.",
        consequence: "Le perdant du duel final fait un verre cul sec. Le gagnant distribue 6 gorgées."
      }
    ]
  },
  "10": {
    name: "Categories",
    scenarios: [
      {
        text: "Choisis une catégorie simple. Chaque joueur donne une réponse à son tour sans répéter.",
        consequence: "Le premier qui bloque, répète ou répond mal boit 4 gorgées."
      },
      {
        text: "Catégorie piège : tu choisis un thème, mais le groupe peut refuser les réponses trop faciles.",
        consequence: "Une réponse refusée vaut 3 gorgées. Deux refus dans le même tour = verre cul sec."
      },
      {
        text: "Choisis une catégorie gênante mais jouable : excuses bidon, red flags, phrases de soirée ou célébrités éclatées.",
        consequence: "Le premier qui bloque boit 5 gorgées et propose la prochaine catégorie."
      },
      {
        text: "Catégorie chrono : chaque joueur a 3 secondes pour répondre.",
        consequence: "Erreur, silence ou répétition = 4 gorgées. Si tout le monde réussit un tour complet, tu bois 3 gorgées."
      },
      {
        text: "Catégorie alcool : choisis un type de boisson, de cocktail ou de marque. Les réponses doivent rester dans le thème.",
        consequence: "Le premier qui bloque boit 5 gorgées. Une réponse inventée repérée par le groupe = verre cul sec."
      },
      {
        text: "Catégorie vérité : choisis une catégorie liée au groupe, par exemple défauts, habitudes, dossiers ou phrases typiques.",
        consequence: "Le joueur dont la réponse est jugée la plus faible boit 4 gorgées. La meilleure réponse distribue 3 gorgées."
      },
      {
        text: "Catégorie duel : choisis deux joueurs. Ils alternent les réponses dans la catégorie de ton choix.",
        consequence: "Le perdant boit 5 gorgées. Le gagnant distribue 3 gorgées."
      },
      {
        text: "Catégorie interdite : choisis une catégorie, puis annonce une réponse interdite avant de commencer.",
        consequence: "Celui qui donne la réponse interdite boit 5 gorgées. Celui qui bloque boit 4 gorgées."
      },
      {
        text: "Catégorie en chaîne : chaque réponse doit commencer par la dernière lettre de la réponse précédente.",
        consequence: "Celui qui casse la chaîne boit 5 gorgées. Si le groupe fait un tour complet, tu distribues 5 gorgées."
      },
      {
        text: "Catégorie souvenirs : chacun doit citer un souvenir de soirée, de voyage ou de groupe en un mot ou une courte phrase.",
        consequence: "Celui qui donne un souvenir trop vague boit 3 gorgées. Si le groupe refuse, il fait un verre cul sec."
      },
      {
        text: "Catégorie sabotage : tu choisis la catégorie et désignes une personne qui devra répondre deux fois à chaque tour.",
        consequence: "Si elle réussit, tu bois 4 gorgées. Si elle échoue, elle boit 5 gorgées."
      },
      {
        text: "Catégorie vote : chaque joueur donne une réponse, puis le groupe vote pour la pire.",
        consequence: "L'auteur de la pire réponse boit 5 gorgées. La meilleure réponse donne une immunité contre une petite sanction."
      },
      {
        text: "Catégorie sans réfléchir : les joueurs doivent répondre immédiatement, sans dire euh, attends ou je sais pas.",
        consequence: "Chaque hésitation vaut 2 gorgées. Deux hésitations dans le tour = verre cul sec."
      },
      {
        text: "Catégorie ciblée : choisis une personne. Toutes les réponses doivent avoir un lien avec elle.",
        consequence: "La cible choisit la réponse la plus drôle : son auteur distribue 4 gorgées. La plus nulle boit 5 gorgées."
      },
      {
        text: "Catégorie impossible mais drôle : choisis un thème volontairement bizarre mais jouable, comme objets inutiles en boîte de nuit.",
        consequence: "Si le groupe rigole, tu distribues 4 gorgées. Si la catégorie est jugée nulle, tu bois 5 gorgées."
      },
      {
        text: "Catégorie équipe : divise la table en deux équipes. Chaque équipe donne une réponse à tour de rôle.",
        consequence: "L'équipe qui bloque boit 3 gorgées chacun. L'autre équipe distribue 6 gorgées."
      },
      {
        text: "Catégorie mémoire : chacun doit répéter les réponses précédentes puis ajouter la sienne.",
        consequence: "Le premier oubli boit 5 gorgées. Le deuxième oubli dans le même tour fait un verre cul sec."
      },
      {
        text: "Catégorie reine du chaos : choisis un thème et autorise le groupe à contester chaque réponse.",
        consequence: "Chaque contestation validée vaut 3 gorgées pour le joueur. Une contestation abusive vaut 2 gorgées pour l'accusateur."
      },
      {
        text: "Catégorie dernière chance : si quelqu'un bloque, il peut demander 5 secondes de réflexion.",
        consequence: "S'il trouve, il distribue 3 gorgées. S'il échoue, il fait un verre cul sec."
      },
      {
        text: "Catégorie finale : le tour continue jusqu'à ce qu'il reste deux joueurs en duel.",
        consequence: "Le perdant du duel final fait un verre cul sec. Le gagnant distribue 8 gorgées."
      }
    ]
  },
  J: {
    name: "Rule Master",
    scenarios: [
      {
        text: "Crée une règle simple qui dure 3 tours. Exemple : interdiction de dire un prénom, parler avec un accent, finir chaque phrase par chef.",
        consequence: "Chaque oubli vaut 2 gorgées."
      },
      {
        text: "Crée un mot interdit jusqu'à ton prochain tour. Le mot doit être annoncé clairement au groupe.",
        consequence: "Chaque personne qui dit le mot boit 3 gorgées."
      },
      {
        text: "Crée une règle de posture ou de geste. Exemple : lever son verre avant de parler.",
        consequence: "Chaque oubli vaut 2 gorgées. Au troisième oubli collectif, tout le monde boit 2 gorgées."
      },
      {
        text: "Crée une règle chaos qui cible une seule personne pendant 2 tours.",
        consequence: "Si la cible oublie la règle, elle boit 4 gorgées. Si elle tient jusqu'au bout, elle distribue 5 gorgées."
      },
      {
        text: "Crée une règle de politesse obligatoire. Exemple : dire s'il te plaît avant de demander quelque chose.",
        consequence: "Chaque oubli vaut 2 gorgées. Si le groupe oublie 5 fois, tu bois aussi 3 gorgées pour mauvaise règle."
      },
      {
        text: "Crée une règle anti-téléphone jusqu'à ton prochain tour.",
        consequence: "Le premier qui touche son téléphone boit 5 gorgées. Si personne ne craque, tu distribues 5 gorgées."
      },
      {
        text: "Crée une règle de prénom : personne ne peut appeler quelqu'un par son vrai prénom pendant 3 tours.",
        consequence: "Chaque prénom prononcé vaut 3 gorgées. Le groupe peut inventer des surnoms ridicules."
      },
      {
        text: "Crée une règle de boisson : avant de boire, chaque joueur doit faire un geste imposé par toi.",
        consequence: "Chaque oubli vaut 2 gorgées bonus. Trois oublis par la même personne = verre cul sec."
      },
      {
        text: "Crée une règle duo : choisis deux joueurs qui doivent se soutenir jusqu'à ton prochain tour.",
        consequence: "Si l'un boit, l'autre boit 2 gorgées. S'ils oublient leur duo, ils boivent chacun 4 gorgées."
      },
      {
        text: "Crée une règle piège que tu annonces clairement, puis tu as le droit de tester le groupe une fois.",
        consequence: "Ceux qui tombent dans le piège boivent 3 gorgées. Si personne ne tombe dedans, tu bois 4 gorgées."
      },
      {
        text: "Crée une règle d'accent : une personne ou tout le groupe doit parler avec un accent pendant 2 tours.",
        consequence: "Chaque oubli vaut 2 gorgées. Le pire accent élu par le groupe boit 3 gorgées bonus."
      },
      {
        text: "Crée une règle de silence ciblée : choisis un joueur qui ne peut parler que si quelqu'un lui pose une question.",
        consequence: "Chaque parole hors règle vaut 3 gorgées. S'il tient jusqu'au bout, il distribue 5 gorgées."
      },
      {
        text: "Crée une règle de regard : avant de boire, il faut regarder quelqu'un dans les yeux et trinquer.",
        consequence: "Chaque oubli vaut 2 gorgées. Si deux joueurs oublient en même temps, ils boivent chacun 4 gorgées."
      },
      {
        text: "Crée une règle de vote : à chaque sanction, le groupe peut voter pour ajouter une gorgée bonus.",
        consequence: "Si le vote passe, la cible boit +1 gorgée. Si le vote échoue, les votants boivent 1 gorgée."
      },
      {
        text: "Crée une règle de phrase obligatoire, par exemple je respecte le roi avant toute réponse.",
        consequence: "Chaque oubli vaut 2 gorgées. La troisième erreur déclenche un verre cul sec pour le fautif."
      },
      {
        text: "Crée une règle de main : pendant 3 tours, tout le monde doit boire avec la main non dominante.",
        consequence: "Chaque erreur vaut 3 gorgées. Si tout le groupe respecte la règle, tu bois 3 gorgées."
      },
      {
        text: "Crée une règle de protection : choisis un joueur protégé d'une seule petite sanction.",
        consequence: "Quand la protection est utilisée, tu bois 4 gorgées pour payer le bouclier."
      },
      {
        text: "Crée une règle de trahison : choisis un joueur qui peut dénoncer les oublis de règle jusqu'à ton prochain tour.",
        consequence: "Chaque dénonciation validée donne 2 gorgées au fautif. Une fausse dénonciation vaut 4 gorgées au traître."
      },
      {
        text: "Crée une règle royale qui ne concerne que toi et un autre joueur.",
        consequence: "Si vous la respectez jusqu'à ton prochain tour, vous distribuez 6 gorgées. Sinon vous buvez chacun 4 gorgées."
      },
      {
        text: "Crée une règle finale : elle dure jusqu'au prochain Valet ou Roi.",
        consequence: "Chaque oubli vaut 3 gorgées. Si la règle est trop floue, le groupe peut l'annuler et tu fais un verre cul sec."
      }
    ]
  },
  Q: {
    name: "Question Master",
    scenarios: [
      {
        text: "Tu deviens Question Master jusqu'à ton prochain tour. Si quelqu'un répond naturellement à une de tes questions, il tombe dans le piège.",
        consequence: "Chaque réponse piégée vaut 3 gorgées."
      },
      {
        text: "Question Master agressif : tu peux poser 3 questions pièges à 3 joueurs différents.",
        consequence: "Chaque joueur qui répond boit 4 gorgées. S'ils esquivent tous, tu bois 3 gorgées."
      },
      {
        text: "Tu choisis un thème de questions. Exemple : couple, soirée, secrets, études, travail.",
        consequence: "Le premier qui répond sans dire je refuse boit 4 gorgées. Un refus vaut 2 gorgées."
      },
      {
        text: "Question Master royal : jusqu'au prochain Q, personne ne doit répondre à tes questions par oui ou non.",
        consequence: "Oui ou non = 3 gorgées. Trois erreurs cumulées = verre cul sec pour la troisième personne."
      },
      {
        text: "Tu deviens Question Master miroir : chaque réponse à une question doit être une autre question.",
        consequence: "Celui qui répond normalement boit 3 gorgées. Deux erreurs = verre cul sec."
      },
      {
        text: "Tu poses une question gênante à un joueur. Il peut répondre, refuser ou renvoyer la question à quelqu'un d'autre.",
        consequence: "Réponse validée = il distribue 3 gorgées. Refus = 4 gorgées. Renvoi refusé = verre cul sec."
      },
      {
        text: "Question piège rapide : pose une question simple à la personne de gauche, puis elle en pose une à la suivante.",
        consequence: "Le premier qui répond directement au lieu de poser une question boit 4 gorgées."
      },
      {
        text: "Question Master secret : choisis un joueur cible sans le dire. Essaie de le faire répondre dans les 2 prochains tours.",
        consequence: "Si la cible tombe dans le piège, elle boit 5 gorgées. Sinon tu bois 4 gorgées."
      },
      {
        text: "Question interdite : choisis un mot-réponse interdit, par exemple oui, non, peut-être ou je sais pas.",
        consequence: "Chaque utilisation du mot interdit vaut 3 gorgées. Le mot doit être annoncé clairement."
      },
      {
        text: "Question tribunal : pose une question à un joueur, puis le groupe vote s'il a répondu honnêtement.",
        consequence: "Si le groupe ne le croit pas, il fait un verre cul sec. Si le groupe le croit, il distribue 5 gorgées."
      },
      {
        text: "Question duo : choisis deux joueurs. Ils doivent répondre en même temps à la même question.",
        consequence: "Si leurs réponses sont différentes, ils boivent chacun 4 gorgées. Si elles matchent, ils distribuent 4 gorgées."
      },
      {
        text: "Question mémoire : pose une question à un joueur, puis repose-la plus tard avant ton prochain tour.",
        consequence: "S'il change de réponse, il boit 5 gorgées. S'il garde la même, il distribue 3 gorgées."
      },
      {
        text: "Question sabotage : un joueur choisi par toi doit répondre à ta place à la prochaine question qui te vise.",
        consequence: "S'il répond mal ou refuse, il boit 4 gorgées. S'il gère, vous distribuez 5 gorgées à deux."
      },
      {
        text: "Question sans rire : pose une question absurde à un joueur. Il doit répondre sérieusement.",
        consequence: "S'il rigole avant de répondre, il boit 4 gorgées. Si le groupe rigole plus que lui, tu bois 2 gorgées."
      },
      {
        text: "Question chaîne : chaque joueur doit poser une question au suivant, sans jamais répondre.",
        consequence: "Le premier qui répond, hésite trop ou répète une question boit 5 gorgées."
      },
      {
        text: "Question vérité express : choisis un joueur. Il doit répondre honnêtement en moins de 5 secondes.",
        consequence: "S'il hésite, il boit 4 gorgées. Si le groupe juge la réponse forte, il distribue 4 gorgées."
      },
      {
        text: "Question piège prénom : tu poses une question dont la réponse naturelle contient un prénom de la table.",
        consequence: "S'il dit un prénom, il boit 3 gorgées. S'il esquive proprement, tu bois 3 gorgées."
      },
      {
        text: "Question Master toxique : jusqu'à ton prochain tour, tu peux interrompre une discussion avec une question piège.",
        consequence: "La personne qui répond boit 3 gorgées. Si tu abuses et que le groupe te bloque, tu bois 5 gorgées."
      },
      {
        text: "Question confession : chaque joueur te pose une question, mais tu peux en retourner une contre son auteur.",
        consequence: "Celui qui refuse sa propre question boit 5 gorgées. Une réponse validée permet de distribuer 2 gorgées."
      },
      {
        text: "Question finale : choisis un joueur pour un interrogatoire de 3 questions.",
        consequence: "Chaque esquive vaut 3 gorgées. Trois réponses validées lui donnent une immunité contre la prochaine petite sanction."
      }
    ]
  },
  K: {
    name: "King",
    scenarios: [
      {
        text: "Tu deviens Roi. Crée une loi royale qui dure jusqu'au prochain Roi.",
        consequence: "Chaque violation vaut 3 gorgées. Au quatrième Roi, la Chaos Cup finale se déclenche."
      },
      {
        text: "Tu deviens Roi distributeur. Tu peux distribuer 10 gorgées comme tu veux.",
        consequence: "Tu dois au moins cibler 2 joueurs différents. Au quatrième Roi, finale Chaos Cup."
      },
      {
        text: "Tu deviens Roi du duel. Choisis deux joueurs qui s'affrontent à pierre-feuille-ciseaux.",
        consequence: "Le perdant fait un verre cul sec. Le gagnant devient protégé jusqu'au prochain tour."
      },
      {
        text: "Tu deviens Roi sombre. Choisis un ennemi royal jusqu'au prochain Roi.",
        consequence: "Chaque fois que ton ennemi boit, tu distribues 2 gorgées. Au quatrième Roi, finale Chaos Cup."
      },
      {
        text: "Tu deviens Roi des impôts. Chaque joueur doit te payer une gorgée symbolique.",
        consequence: "Tout le monde boit 1 gorgée. Tu distribues ensuite autant de gorgées qu'il y a de joueurs."
      },
      {
        text: "Tu deviens Roi protecteur. Choisis un joueur sous ta protection jusqu'au prochain Roi.",
        consequence: "La première petite sanction de ce joueur est annulée. En échange, tu bois 4 gorgées quand tu le protèges."
      },
      {
        text: "Tu deviens Roi traître. Choisis secrètement un joueur. Au prochain vote ou duel, tu peux retourner le résultat contre lui.",
        consequence: "Si tu utilises ta trahison, la cible boit 5 gorgées. Si le groupe devine ta cible avant, tu fais un verre cul sec."
      },
      {
        text: "Tu deviens Roi du silence. Pendant 2 tours, personne ne peut parler sans lever son verre.",
        consequence: "Chaque oubli vaut 2 gorgées. Trois oublis déclenchent 5 gorgées pour le troisième fautif."
      },
      {
        text: "Tu deviens Roi de la rébellion. Le groupe peut voter pour te renverser maintenant.",
        consequence: "Si la rébellion passe, tu bois 5 gorgées. Si elle échoue, tous les rebelles boivent 3 gorgées."
      },
      {
        text: "Tu deviens Roi du tribunal. Choisis un joueur accusé d'être le plus dangereux de la soirée.",
        consequence: "Il a 20 secondes pour se défendre. Si le groupe le condamne, verre cul sec. Sinon il distribue 6 gorgées."
      },
      {
        text: "Tu deviens Roi du bouffon. Choisis un joueur qui doit te divertir pendant 15 secondes.",
        consequence: "Si le groupe rit, le bouffon distribue 5 gorgées. Sinon il boit 5 gorgées."
      },
      {
        text: "Tu deviens Roi des alliances. Forme deux équipes pour les 2 prochains tours.",
        consequence: "Quand un joueur boit, son équipe boit 1 gorgée avec lui. L'équipe la plus visée à la fin distribue 6 gorgées."
      },
      {
        text: "Tu deviens Roi de l'exécution. Choisis deux joueurs pour un duel public.",
        consequence: "Le perdant boit 5 gorgées. Le gagnant choisit un spectateur qui boit 3 gorgées."
      },
      {
        text: "Tu deviens Roi du pardon. Tu peux annuler une sanction simple avant le prochain Roi.",
        consequence: "Quand tu l'annules, tu choisis quelqu'un qui boit 4 gorgées à la place, ou tu les bois toi-même."
      },
      {
        text: "Tu deviens Roi de la vérité. Pose une vérité gênante à un joueur.",
        consequence: "Réponse validée = il distribue 5 gorgées. Refus ou mensonge repéré = verre cul sec."
      },
      {
        text: "Tu deviens Roi du chaos. Ajoute une règle active choisie par le groupe, mais tu gardes le dernier mot.",
        consequence: "Chaque oubli vaut 3 gorgées. Si la règle est trop dure, le groupe peut te faire boire 5 gorgées pour abus de pouvoir."
      },
      {
        text: "Tu deviens Roi du sacrifice. Choisis un joueur qui peut te sauver une fois avant le prochain Roi.",
        consequence: "S'il te sauve, il boit 5 gorgées et tu distribues 5 gorgées. S'il refuse au moment venu, il fait un verre cul sec."
      },
      {
        text: "Tu deviens Roi de la bouteille. Fais tourner une bouteille ou désigne au hasard deux joueurs.",
        consequence: "Les deux joueurs trinquent et boivent 4 gorgées. Puis ils doivent se protéger jusqu'au prochain tour."
      },
      {
        text: "Tu deviens Roi finaliste. Choisis un joueur qui sera ton rival royal jusqu'au prochain Roi.",
        consequence: "À chaque sanction qui touche l'un de vous deux, l'autre distribue 2 gorgées. Le plus puni des deux à la fin fait un verre cul sec."
      },
      {
        text: "Tu deviens Roi de la Chaos Cup. Ajoute une règle finale dans la coupe imaginaire.",
        consequence: "Au quatrième Roi, le groupe applique la finale Chaos Cup. En attendant, tu distribues 8 gorgées."
      }
    ]
  }
};


const SPECIAL_CARD_CHANCE = 0.35;

const specialCardWeights = [
  "JOKER", "JOKER", "JOKER", "JOKER", "JOKER",
  "CHAOS_CARD", "CHAOS_CARD", "CHAOS_CARD", "CHAOS_CARD", "CHAOS_CARD",
  "SUPREME_KING", "SUPREME_KING", "SUPREME_KING", "SUPREME_KING",
  "CURSE", "CURSE", "CURSE", "CURSE", "CURSE",
  "FATE", "FATE", "FATE", "FATE", "FATE", "FATE",
  "WORLD_CARD", "WORLD_CARD", "WORLD_CARD", "WORLD_CARD", "WORLD_CARD"
];

const specialRules = {
  JOKER: {
    name: "Joker",
    displayValue: "JOKER",
    displaySuit: "🃏",
    icon: "🃏",
    scenarios: [
      { text: "Joker copieur : copie la dernière carte jouée, sans copier une finale Chaos Cup.", consequence: "Applique son scénario sur la cible de ton choix. Si personne ne se souvient de la dernière carte, distribue 6 gorgées." },
      { text: "Joker voleur : vole le bénéfice d'une carte positive qu'un joueur vient de gagner.", consequence: "Le joueur volé boit 3 gorgées. Si aucun bonus n'est actif, tu distribues 5 gorgées." },
      { text: "Joker échangeur : échange ta sanction actuelle ou prochaine avec celle d'un autre joueur.", consequence: "La personne choisie peut refuser seulement en buvant 5 gorgées." },
      { text: "Joker miroir : le prochain joueur qui te cible subit aussi son propre effet.", consequence: "Si personne ne te cible avant ton prochain tour, tu bois 3 gorgées pour bluff raté." },
      { text: "Joker menteur : annonce une fausse règle crédible pendant 1 tour.", consequence: "Si quelqu'un tombe dans le piège, il boit 4 gorgées. Si le groupe te grille direct, tu bois 5 gorgées." },
      { text: "Joker caméléon : transforme cette carte en A, 2, 3, 4, 7, 8, 9 ou 10 au choix.", consequence: "Applique une variante de la carte choisie. Tu ne peux pas choisir Roi." },
      { text: "Joker opportuniste : choisis un joueur qui vient de s'en sortir trop facilement.", consequence: "Il boit 4 gorgées ou accepte que tu prennes sa prochaine récompense." },
      { text: "Joker sabotage : annule une protection, une alliance ou un avantage social annoncé dans les 2 derniers tours.", consequence: "Le joueur saboté boit 3 gorgées. Si aucun avantage n'existe, tout le monde boit 1." },
      { text: "Joker clown noir : choisis deux joueurs. Ils doivent décider ensemble qui prend la sanction.", consequence: "S'ils ne décident pas en 10 secondes, ils boivent chacun 5 gorgées." },
      { text: "Joker double face : choisis pile ou face avant de révéler l'effet.", consequence: "Pile : tu distribues 8 gorgées. Face : tu bois 5 gorgées et le groupe distribue 5." },
      { text: "Joker parasite : accroche-toi à un joueur jusqu'à ton prochain tour.", consequence: "À chaque fois qu'il boit, tu distribues 2 gorgées. S'il ne boit jamais, tu bois 4 gorgées." },
      { text: "Joker suprême : rejoue immédiatement une carte normale au hasard après avoir appliqué ce Joker.", consequence: "La deuxième carte est obligatoire. Si c'est un Roi, il compte normalement dans la Chaos Cup." }
    ]
  },
  CHAOS_CARD: {
    name: "Chaos Card",
    displayValue: "CHAOS",
    displaySuit: "⚡",
    icon: "⚡",
    scenarios: [
      { text: "Double impact : la prochaine sanction simple touche deux joueurs au lieu d'un.", consequence: "Le joueur qui pioche choisit la deuxième cible." },
      { text: "Bug temporel : rejoue mentalement la dernière carte tirée comme si elle tombait maintenant.", consequence: "Elle touche un nouveau joueur choisi par le groupe." },
      { text: "Anomalie : toutes les protections ou immunités annoncées sont suspendues pendant 1 tour.", consequence: "Les joueurs protégés boivent chacun 2 gorgées pour le bug." },
      { text: "Roulette infernale : le joueur ciblé choisit entre boire 6 gorgées ou désigner 3 joueurs qui boivent 2.", consequence: "S'il hésite plus de 10 secondes, il prend les deux options." },
      { text: "Faille du royaume : la prochaine carte normale déclenche aussi un effet actif aléatoire.", consequence: "Ajoutez une règle courte décidée par le groupe pendant 2 tours." },
      { text: "Court-circuit : les alliances, mates et duos sont mélangés ou brisés pendant 1 tour.", consequence: "Chaque duo concerné boit 2 gorgées ensemble." },
      { text: "Triple tension : les 3 prochaines sanctions gagnent +1 gorgée.", consequence: "Si une sanction est un verre cul sec, elle ne change pas." },
      { text: "Chaos silencieux : pendant 1 tour, personne ne doit commenter les cartes tirées.", consequence: "Chaque commentaire vaut 3 gorgées immédiates." },
      { text: "Effet domino : choisis une cible. Après sa sanction, elle choisit quelqu'un qui prend 2 gorgées.", consequence: "La chaîne continue 3 fois maximum. Impossible de choisir deux fois la même personne." },
      { text: "Réinitialisation brutale : toutes les règles actives trop floues sont supprimées.", consequence: "Pour chaque règle supprimée, son créateur boit 2 gorgées." },
      { text: "Chaos ascendant : augmente la pression de la partie.", consequence: "Tout le monde boit 1 gorgée, puis la prochaine carte spéciale applique +2 gorgées à sa conséquence." },
      { text: "Cataclysme léger : piochez une carte normale supplémentaire immédiatement.", consequence: "Elle s'applique normalement, mais personne ne peut refuser sa conséquence." }
    ]
  },
  SUPREME_KING: {
    name: "Roi Suprême",
    displayValue: "SUPRÊME",
    displaySuit: "👑",
    icon: "👑",
    scenarios: [
      { text: "Empereur : tu prends le contrôle du prochain choix de cible.", consequence: "Quand une carte demande de choisir un joueur, tu peux imposer la cible une fois." },
      { text: "Tyran : tous les autres joueurs doivent te payer une taxe.", consequence: "Chaque joueur boit 1 gorgée. Tu distribues ensuite 6 gorgées." },
      { text: "Roi immortel : tu ignores la prochaine petite sanction qui te vise.", consequence: "Quand tu l'ignores, tu bois quand même 2 gorgées de taxe royale." },
      { text: "Roi manipulateur : jusqu'à ton prochain tour, tu peux rediriger une sanction simple.", consequence: "La nouvelle cible boit 4 gorgées maximum, même si la sanction était plus forte." },
      { text: "Roi voleur : vole le droit de distribuer les gorgées d'un autre joueur.", consequence: "Le joueur volé boit 3 gorgées pour insolence royale." },
      { text: "Roi de guerre : choisis deux rivaux publics pour 2 tours.", consequence: "À chaque fois que l'un boit, l'autre boit 1 gorgée. Le plus puni des deux distribue 6 à la fin." },
      { text: "Roi maudit : tu gagnes un pouvoir, mais il est instable.", consequence: "Distribue 10 gorgées maintenant. Au prochain tour, bois 4 gorgées si personne ne t'a ciblé." },
      { text: "Roi absolu : tu peux doubler une seule conséquence avant ton prochain tour.", consequence: "Si tu doubles une sanction trop forte, le groupe peut t'obliger à boire 5 gorgées." },
      { text: "Roi des ombres : choisis secrètement un joueur qui devient ta cible royale.", consequence: "La prochaine fois qu'il boit, il ajoute 3 gorgées et tu distribues 3." },
      { text: "Roi du destin : choisis un joueur. Son prochain effet positif devient négatif.", consequence: "S'il n'a aucun effet positif avant ton prochain tour, il boit 3 gorgées." },
      { text: "Roi protecteur : choisis un joueur à protéger une fois.", consequence: "Quand la protection s'active, toi et lui buvez chacun 2 gorgées." },
      { text: "Roi final : impose une mini-loi royale jusqu'à ton prochain tour.", consequence: "Chaque oubli vaut 3 gorgées. Si la loi est jugée nulle, tu bois 5 gorgées." }
    ]
  },
  CURSE: {
    name: "Malédiction",
    displayValue: "CURSE",
    displaySuit: "☠️",
    icon: "☠️",
    scenarios: [
      { text: "Soif éternelle : un joueur ciblé prend +1 gorgée sur chaque sanction jusqu'à son prochain tour.", consequence: "La cible boit 2 gorgées maintenant pour lancer la malédiction." },
      { text: "Mauvais karma : le prochain bonus de la cible est annulé.", consequence: "Si aucun bonus n'arrive avant son prochain tour, elle boit 3 gorgées." },
      { text: "Verre maudit : la prochaine fois que la cible boit, elle choisit quelqu'un qui boit avec elle.", consequence: "Si elle oublie de choisir, elle boit 4 gorgées bonus." },
      { text: "Marque du chaos : la cible devient prioritaire pour la prochaine carte qui demande un joueur.", consequence: "Si elle est effectivement ciblée, elle ajoute 2 gorgées." },
      { text: "Dette royale : la cible doit 6 gorgées au groupe.", consequence: "Elle peut les payer maintenant ou les étaler sur les 3 prochains tours." },
      { text: "Bouclier brisé : la prochaine protection de la cible est détruite.", consequence: "Si elle n'a aucune protection, elle boit 4 gorgées directement." },
      { text: "Ombre du roi : jusqu'à son prochain tour, la cible ne peut pas distribuer de gorgées.", consequence: "Toute distribution gagnée est remplacée par 3 gorgées pour elle." },
      { text: "Malchance : la cible doit choisir pile ou face à sa prochaine sanction.", consequence: "Si elle perd, la sanction est doublée. Si elle gagne, elle est réduite de moitié." },
      { text: "Couronne fissurée : si la cible pioche un Roi avant la fin de la partie, elle boit 5 gorgées bonus.", consequence: "Si elle ne pioche jamais de Roi, elle distribue 4 gorgées à la fin." },
      { text: "Silence maudit : la cible ne doit pas se plaindre jusqu'à son prochain tour.", consequence: "Chaque plainte ou négociation vaut 3 gorgées." },
      { text: "Retour de flammes : la prochaine sanction donnée par la cible lui revient à moitié.", consequence: "Exemple : elle donne 6, elle boit 3. Minimum 2 gorgées." },
      { text: "Malédiction finale : la cible choisit entre boire 5 gorgées ou recevoir une règle personnelle pendant 2 tours.", consequence: "La règle doit être simple, claire et validée par le groupe." }
    ]
  },
  FATE: {
    name: "Destin",
    displayValue: "DESTIN",
    displaySuit: "🎲",
    icon: "🎲",
    scenarios: [
      { text: "Pile ou face du destin : annonce pile ou face avant de lancer.", consequence: "Gagné : distribue 6 gorgées. Perdu : bois 5 gorgées." },
      { text: "Loterie noire : choisis un nombre entre 1 et le nombre de joueurs.", consequence: "Le groupe compte autour de la table. La personne désignée boit 5 gorgées." },
      { text: "Miracle : tu peux annuler une petite sanction maintenant ou plus tard.", consequence: "Si tu gardes le miracle et oublies de l'utiliser, tu bois 3 gorgées." },
      { text: "Catastrophe : un joueur au hasard subit une mini-punition immédiate.", consequence: "La table choisit entre 4 gorgées ou une règle personnelle pendant 1 tour." },
      { text: "Jackpot : tout le monde lève un doigt, puis le joueur qui a pioché compte jusqu'à 3.", consequence: "Ceux qui ont choisi le même chiffre que toi boivent 4 gorgées. Les autres boivent 1." },
      { text: "Coup du sort : inverse ta situation actuelle.", consequence: "Si tu étais avantagé, tu bois 4. Si tu étais désavantagé, tu distribues 5." },
      { text: "Destin caché : choisis secrètement un joueur avant de lire la conséquence.", consequence: "Ce joueur boit 4 gorgées, sauf s'il devine que tu l'as choisi. Dans ce cas, tu bois 5." },
      { text: "Roulette simple : gauche, droite ou toi. Annonce ton choix avant de révéler.", consequence: "La personne correspondant au choix boit 5 gorgées. Si le choix est impossible, tout le monde boit 1." },
      { text: "Fortune : prends immédiatement un petit avantage social.", consequence: "Tu peux refuser une cible une fois. Pour activer l'avantage, bois 2 gorgées." },
      { text: "Mauvais tirage : la prochaine carte normale est plus violente.", consequence: "Ajoute +2 gorgées à sa conséquence principale." },
      { text: "Surprise : pioche mentalement une carte A, 2, 3 ou K au choix du groupe.", consequence: "Applique une version légère de cette carte. Si K est choisi, il ne compte pas dans les 4 Rois." },
      { text: "Dernière chance : choisis une sanction que tu risques de recevoir plus tard.", consequence: "Quand elle arrive, tu peux la réduire de moitié. Si elle n'arrive jamais, bois 3 gorgées." }
    ]
  },
  WORLD_CARD: {
    name: "Carte Mondiale",
    displayValue: "MONDE",
    displaySuit: "🌍",
    icon: "🌍",
    scenarios: [
      { text: "Tournée générale : toute la table est concernée immédiatement.", consequence: "Tout le monde boit 2 gorgées. Le joueur qui a pioché distribue 2 gorgées bonus." },
      { text: "Apocalypse : la prochaine punition tirée est appliquée à tous les joueurs.", consequence: "Si la prochaine punition est trop forte, le groupe peut la limiter à 4 gorgées chacun." },
      { text: "Taxe royale : personne n'échappe au royaume.", consequence: "Tous les joueurs sauf celui qui a pioché boivent 2 gorgées." },
      { text: "Destin commun : une seule personne choisit une mini-sanction pour tout le monde.", consequence: "La sanction doit être courte. Refus = 4 gorgées." },
      { text: "Chaos global : tout le monde pioche symboliquement une carte invisible.", consequence: "Chacun boit 1 gorgée, puis le joueur qui a pioché choisit 2 personnes qui boivent 3 bonus." },
      { text: "Happy hour infernale : tout le monde trinque, personne ne négocie.", consequence: "Tout le monde boit 3 gorgées. Le premier qui se plaint boit 2 bonus." },
      { text: "Jugement dernier : la table désigne spontanément le joueur le plus dangereux.", consequence: "Ce joueur boit 5 gorgées, puis tout le monde boit 1 pour avoir participé au jugement." },
      { text: "Fin du royaume : toutes les règles actives sont remises en question.", consequence: "Gardez une seule règle active. Chaque créateur de règle supprimée boit 2 gorgées." },
      { text: "Invasion royale : tous les joueurs doivent choisir un camp autour de la table.", consequence: "Le camp le moins nombreux boit 3 gorgées chacun. Égalité : tout le monde boit 2." },
      { text: "Tempête du chaos : pendant 1 tour, chaque sanction simple gagne +1 gorgée.", consequence: "Tout le monde boit 1 maintenant pour annoncer la tempête." },
      { text: "Tous dans le même bateau : la prochaine personne qui boit entraîne toute la table.", consequence: "Quand elle boit, tout le monde boit 1 gorgée avec elle." },
      { text: "Châtiment divin : la table entière subit un effet direct.", consequence: "Tout le monde boit 2 gorgées. Les joueurs avec un bonus actif boivent 1 gorgée de plus." }
    ]
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


function ensureTurnAndTargetUI() {
  if (document.getElementById("chaosKingsTurnPanel")) return;

  const style = document.createElement("style");
  style.textContent = `
    .ck-turn-panel {
      margin: 16px 0;
      padding: 14px;
      border-radius: 18px;
      border: 1px solid rgba(255,255,255,.18);
      background: rgba(10, 10, 18, .52);
      box-shadow: 0 16px 45px rgba(0,0,0,.22);
      backdrop-filter: blur(12px);
    }

    .ck-turn-title {
      font-size: 0.78rem;
      opacity: .72;
      text-transform: uppercase;
      letter-spacing: .08em;
      margin-bottom: 8px;
    }

    .ck-active-player {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 9px 13px;
      border-radius: 999px;
      font-weight: 800;
      background: linear-gradient(135deg, rgba(255,0,122,.28), rgba(123,44,255,.28));
      border: 1px solid rgba(255,255,255,.22);
      margin-bottom: 12px;
    }

    .ck-target-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(105px, 1fr));
      gap: 8px;
    }

    .ck-player-chip {
      border: 1px solid rgba(255,255,255,.16);
      border-radius: 14px;
      padding: 10px 8px;
      background: rgba(255,255,255,.07);
      color: inherit;
      font-weight: 700;
      cursor: pointer;
      transition: transform .16s ease, background .16s ease, border-color .16s ease;
      min-height: 42px;
    }

    .ck-player-chip:hover {
      transform: translateY(-1px);
      background: rgba(255,255,255,.13);
      border-color: rgba(255,255,255,.35);
    }

    .ck-player-chip.active-turn {
      border-color: rgba(255,176,0,.85);
      box-shadow: 0 0 0 2px rgba(255,176,0,.15);
    }

    .ck-player-chip.selected-target {
      background: linear-gradient(135deg, rgba(255,0,122,.45), rgba(0,183,255,.28));
      border-color: rgba(255,255,255,.55);
      transform: translateY(-1px) scale(1.02);
    }

    .ck-selection-help {
      margin-top: 10px;
      font-size: .86rem;
      opacity: .72;
    }

    .ck-final-summary {
      margin-top: 18px;
      padding: 18px;
      border-radius: 22px;
      border: 1px solid rgba(255,255,255,.22);
      background: radial-gradient(circle at top, rgba(255,0,122,.22), rgba(10,10,18,.78));
      box-shadow: 0 22px 70px rgba(0,0,0,.35);
    }

    .ck-final-summary h2 {
      margin: 0 0 12px;
      font-size: clamp(1.4rem, 3vw, 2.1rem);
    }

    .ck-title-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      gap: 10px;
      margin: 14px 0;
    }

    .ck-title-card {
      padding: 12px;
      border-radius: 16px;
      background: rgba(255,255,255,.08);
      border: 1px solid rgba(255,255,255,.14);
    }

    .ck-title-card strong {
      display: block;
      font-size: 1.02rem;
      margin-bottom: 4px;
    }

    .ck-ranking {
      margin: 14px 0 0;
      padding-left: 20px;
    }

    .ck-ranking li {
      margin: 6px 0;
    }

    .ck-stats-mini {
      opacity: .78;
      font-size: .88rem;
    }
  `;
  document.head.appendChild(style);

  const panel = document.createElement("div");
  panel.id = "chaosKingsTurnPanel";
  panel.className = "ck-turn-panel";
  panel.innerHTML = `
    <div class="ck-turn-title">Tour actuel</div>
    <div id="activePlayerPill" class="ck-active-player">🎮 Joueur actif : -</div>
    <div class="ck-turn-title">Sélection de cible</div>
    <div id="playerTargetGrid" class="ck-target-grid"></div>
    <div id="selectionHelp" class="ck-selection-help">
      Après une carte qui demande de choisir quelqu'un, clique sur le pseudo ciblé.
    </div>
  `;

  const anchor = resetGameBtn?.parentElement || drawCardBtn?.parentElement || kingCard?.parentElement || document.body;
  anchor.insertAdjacentElement("afterend", panel);
}

function renderTurnAndTargetUI(state = currentDrawState) {
  ensureTurnAndTargetUI();

  const activePill = document.getElementById("activePlayerPill");
  const grid = document.getElementById("playerTargetGrid");
  const help = document.getElementById("selectionHelp");

  const activeIndex = normalizePlayerIndex(state?.playerIndex ?? currentPlayerIndex);
  const activeName = state?.playerName || getPlayerName(players[activeIndex], activeIndex);

  activePill.textContent = `🎮 Joueur actif : ${activeName}`;
  grid.innerHTML = "";

  players.forEach((player, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ck-player-chip";
    btn.textContent = getPlayerName(player, index);
    btn.dataset.playerIndex = String(index);

    if (index === activeIndex) btn.classList.add("active-turn");
    if (selectedTargetIndex === index) btn.classList.add("selected-target");

    btn.addEventListener("click", () => selectTargetPlayer(index));

    grid.appendChild(btn);
  });

  if (state?.turnEffect === "replay") {
    help.textContent = "🔁 Effet tour : le même joueur rejoue immédiatement.";
  } else if (state?.turnEffect === "skip_next") {
    help.textContent = "⏭️ Effet tour : le prochain joueur est sauté.";
  } else if (state?.turnEffect === "reverse") {
    help.textContent = "🔄 Effet tour : le sens du jeu est inversé.";
  } else if (state?.turnEffect === "target_next") {
    help.textContent = selectedTargetName
      ? `🎯 ${selectedTargetName} récupère le prochain tour.`
      : "🎯 Tour volé : clique sur le joueur qui récupère le prochain tour.";
  } else if (state?.needsTargetSelection) {
    help.textContent = selectedTargetName
      ? `Cible sélectionnée : ${selectedTargetName}`
      : "Cette carte peut demander une cible : clique sur le joueur concerné.";
  } else {
    help.textContent = "Tu peux quand même sélectionner un joueur si la carte ou le groupe en a besoin.";
  }
}

function getTargetLine(state = currentDrawState) {
  const activeName = state?.playerName || getPlayerName(getCurrentPlayer(), getCurrentPlayerIndex());

  if (selectedTargetName) {
    return `🎮 Joueur actif : ${activeName} · 🎯 Cible : ${selectedTargetName}`;
  }

  if (state?.needsTargetSelection) {
    return `🎮 Joueur actif : ${activeName} · 🎯 Cible à sélectionner`;
  }

  return `🎮 Joueur actif : ${activeName}`;
}

function updateDisplayedTargetLine() {
  targetText.textContent = getTargetLine(currentDrawState);
  renderTurnAndTargetUI(currentDrawState);
}

async function selectTargetPlayer(index) {
  if (!currentDrawState || currentDrawState.type !== "draw") return;

  selectedTargetIndex = index;
  selectedTargetName = getPlayerName(players[index], index);

  const chooserName = currentDrawState.playerName;
  if (chooserName) addStat(chooserName, "targetsChosen", 1);
  if (selectedTargetName) addStat(selectedTargetName, "timesTargeted", 1);

  if (currentDrawState.turnEffect === "target_next") {
    currentPlayerIndex = normalizePlayerIndex(index);
  }

  updateDisplayedTargetLine();
  refreshDrawButtonState();

  try {
    const patch = {
      chaosKingsTarget: {
        drawActionId: currentDrawState.actionId,
        targetIndex: index,
        targetName: selectedTargetName,
        targetBecomesNextPlayer: currentDrawState.turnEffect === "target_next",
        updatedAt: Date.now()
      },
      chaosKingsStats: playerStats
    };

    if (currentDrawState.turnEffect === "target_next") {
      patch.chaosKingsState = {
        ...currentDrawState,
        nextPlayerIndex: normalizePlayerIndex(index)
      };
    }

    await updateDoc(roomRef, patch);
  } catch (error) {
    console.error("Erreur sélection cible Chaos Kings :", error);
  }
}

function applyTargetSelection(selection) {
  if (!selection) return;
  if (!currentDrawState) return;
  if (selection.drawActionId !== currentDrawState.actionId) return;
  if (selection.updatedAt === lastTargetSelectionId) return;

  lastTargetSelectionId = selection.updatedAt;
  selectedTargetIndex = Number.isInteger(selection.targetIndex) ? selection.targetIndex : null;
  selectedTargetName = selection.targetName || null;

  if (selection.targetBecomesNextPlayer && selectedTargetIndex !== null) {
    currentPlayerIndex = normalizePlayerIndex(selectedTargetIndex);
  }

  updateDisplayedTargetLine();
  refreshDrawButtonState();
}


function createEmptyPlayerStats(name) {
  return {
    name,
    cardsDrawn: 0,
    specialCards: 0,
    kingsDrawn: 0,
    timesTargeted: 0,
    targetsChosen: 0,
    chaosPoints: 0,
    worldCards: 0,
    jokerCards: 0,
    curseCards: 0,
    fateCards: 0,
    supremeKingCards: 0,
    chaosCards: 0,
    replays: 0,
    skippedTurns: 0,
    reversedTurns: 0,
    stolenTurns: 0
  };
}

function ensureStatsForPlayerName(name) {
  const safeName = name || "Joueur";
  if (!playerStats[safeName]) {
    playerStats[safeName] = createEmptyPlayerStats(safeName);
  }
  return playerStats[safeName];
}

function ensureStatsForAllPlayers() {
  players.forEach((player, index) => {
    ensureStatsForPlayerName(getPlayerName(player, index));
  });
}

function addStat(name, key, amount = 1) {
  const stats = ensureStatsForPlayerName(name);
  stats[key] = (stats[key] || 0) + amount;
}

function getSpecialStatKey(ruleName = "") {
  const name = ruleName.toLowerCase();

  if (name.includes("joker")) return "jokerCards";
  if (name.includes("chaos card")) return "chaosCards";
  if (name.includes("roi suprême")) return "supremeKingCards";
  if (name.includes("malédiction")) return "curseCards";
  if (name.includes("destin")) return "fateCards";
  if (name.includes("mondiale")) return "worldCards";

  return null;
}

function updateStatsFromDrawState(state) {
  if (!state || state.type !== "draw" || !state.playerName) return playerStats;

  const drawer = ensureStatsForPlayerName(state.playerName);
  drawer.cardsDrawn += 1;
  drawer.chaosPoints += state.isSpecial ? 5 : 2;

  if (state.isSpecial) {
    drawer.specialCards += 1;
    const specialKey = getSpecialStatKey(state.ruleName);
    if (specialKey) drawer[specialKey] += 1;
  }

  if (state.cardValue === "K") {
    drawer.kingsDrawn += 1;
    drawer.chaosPoints += 4;
  }

  if (state.turnEffect === "replay") {
    drawer.replays += 1;
    drawer.chaosPoints += 3;
  }

  if (state.turnEffect === "reverse") {
    drawer.reversedTurns += 1;
    drawer.chaosPoints += 2;
  }

  if (state.turnEffect === "skip_next") {
    drawer.skippedTurns += 1;
    drawer.chaosPoints += 2;
  }

  if (state.turnEffect === "target_next") {
    drawer.stolenTurns += 1;
    drawer.chaosPoints += 2;
  }

  return playerStats;
}

function computePlayerRankings() {
  ensureStatsForAllPlayers();

  return Object.values(playerStats)
    .map(stats => ({
      ...stats,
      score:
        (stats.chaosPoints || 0) +
        (stats.cardsDrawn || 0) +
        (stats.specialCards || 0) * 3 +
        (stats.kingsDrawn || 0) * 4 +
        (stats.targetsChosen || 0) * 2 -
        Math.floor((stats.timesTargeted || 0) / 2)
    }))
    .sort((a, b) => b.score - a.score);
}

function getTopByStat(key, fallback = null) {
  const ranking = Object.values(playerStats).sort((a, b) => (b[key] || 0) - (a[key] || 0));
  const top = ranking[0];

  if (!top || !top[key]) return fallback || computePlayerRankings()[0] || null;
  return top;
}

function buildFinalTitles() {
  const ranking = computePlayerRankings();
  const top = ranking[0] || null;

  return [
    {
      label: "👑 Roi du Chaos",
      player: top?.name || "-",
      detail: "Meilleur score chaos global."
    },
    {
      label: "☠️ Victime du Royaume",
      player: getTopByStat("timesTargeted", top)?.name || "-",
      detail: "Le joueur le plus ciblé de la partie."
    },
    {
      label: "😈 Bourreau Royal",
      player: getTopByStat("targetsChosen", top)?.name || "-",
      detail: "Celui qui a le plus choisi de cibles."
    },
    {
      label: "🃏 Aimant à Cartes Spéciales",
      player: getTopByStat("specialCards", top)?.name || "-",
      detail: "Le plus touché par les cartes spéciales."
    },
    {
      label: "👑 Sang Royal",
      player: getTopByStat("kingsDrawn", top)?.name || "-",
      detail: "Le joueur qui a tiré le plus de Rois."
    },
    {
      label: "🛡️ Survivant Légendaire",
      player: [...Object.values(playerStats)].sort((a, b) => (a.timesTargeted || 0) - (b.timesTargeted || 0))[0]?.name || "-",
      detail: "Le joueur le moins ciblé."
    }
  ];
}

function renderFinalSummary() {
  ensureStatsForAllPlayers();

  const ranking = computePlayerRankings();
  const titles = buildFinalTitles();

  const titleCards = titles
    .map(item => `
      <div class="ck-title-card">
        <strong>${item.label}</strong>
        <div>${escapeHtml(item.player)}</div>
        <div class="ck-stats-mini">${item.detail}</div>
      </div>
    `)
    .join("");

  const rankingHtml = ranking
    .map((stats, index) => `
      <li>
        <strong>${index + 1}. ${escapeHtml(stats.name)}</strong>
        — ${stats.score} pts
        <div class="ck-stats-mini">
          ${stats.cardsDrawn} carte(s), ${stats.specialCards} spéciale(s), ${stats.kingsDrawn} Roi(s), ${stats.timesTargeted} ciblage(s)
        </div>
      </li>
    `)
    .join("");

  effectDescription.innerHTML = `
    <div class="ck-final-summary">
      <h2>🏆 Résumé final Chaos Kings</h2>
      <div class="ck-title-grid">${titleCards}</div>
      <h3>Classement Chaos</h3>
      <ol class="ck-ranking">${rankingHtml}</ol>
    </div>
  `;

  eventBanner.textContent = "🏆 RÉSULTATS FINAUX — Chaos Kings";
  eventBanner.classList.remove("hidden");
  launchConfetti(120);
  finalSummaryShown = true;
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
  ensureStatsForAllPlayers();

  ensureTurnAndTargetUI();
  renderTurnAndTargetUI();

  updateUI();
  renderActiveEffects();

  if (players.length < 2) {
    effectTitle.textContent = "Pas assez de joueurs";
    effectDescription.textContent = "Ajoute au moins 2 joueurs pour lancer Chaos Kings.";
    drawCardBtn.disabled = true;
    resetGameBtn.disabled = true;
    return;
  }

  refreshDrawButtonState();

  // Reset accessible à tous pour éviter de bloquer la partie si le host ne joue pas.
  resetGameBtn.disabled = false;
  resetGameBtn.textContent = "Réinitialiser la partie";

  listenToChaosKingsState();
}

function getDrinkLevelLabel() {
  if (drinkLevel === "soft") return "Soft";
  if (drinkLevel === "normal") return "Normal";
  if (drinkLevel === "hard") return "Hard";
  if (drinkLevel === "danger" || drinkLevel === "extreme") return "Extrême";
  return "Normal";
}

function getPlayerName(player, index = 0) {
  return player?.name || player?.pseudo || player?.displayName || `Joueur ${index + 1}`;
}

function getPlayerIdentity(player, index = 0) {
  return String(
    player?.id ||
    player?.profileId ||
    player?.playerId ||
    player?.uid ||
    player?.name ||
    player?.pseudo ||
    player?.displayName ||
    `Joueur ${index + 1}`
  ).trim();
}

function isLocalPlayerActive(index = currentPlayerIndex) {
  if (!players.length) return false;

  const activeIndex = normalizePlayerIndex(index);
  const activePlayer = players[activeIndex];
  const activeIdentity = getPlayerIdentity(activePlayer, activeIndex);
  const activeName = getPlayerName(activePlayer, activeIndex);

  if (!localPlayerIdentity) {
    // Mode TV / host sans identité joueur : on laisse piocher pour ne pas bloquer la partie.
    return true;
  }

  return (
    localPlayerIdentity === activeIdentity ||
    localPlayerIdentity === activeName
  );
}

function canCurrentClientDraw() {
  return !isDrawing && players.length >= 2 && isLocalPlayerActive(currentPlayerIndex);
}

function refreshDrawButtonState() {
  if (!drawCardBtn) return;

  if (players.length < 2) {
    drawCardBtn.disabled = true;
    drawCardBtn.textContent = "Pas assez de joueurs";
    return;
  }

  const activeIndex = normalizePlayerIndex(currentPlayerIndex);
  const activeName = getPlayerName(players[activeIndex], activeIndex);

  if (canCurrentClientDraw()) {
    drawCardBtn.disabled = false;
    drawCardBtn.textContent = `Piocher (${activeName}) 🃏`;
  } else {
    drawCardBtn.disabled = true;
    drawCardBtn.textContent = `Tour de ${activeName}`;
  }
}

function normalizePlayerIndex(index) {
  if (!players.length) return 0;
  return ((index % players.length) + players.length) % players.length;
}

function getCurrentPlayerIndex() {
  return normalizePlayerIndex(currentPlayerIndex);
}

function getCurrentPlayer() {
  return players[getCurrentPlayerIndex()] || players[0];
}

function getNextTurnIndex(fromIndex = currentPlayerIndex, direction = turnDirection) {
  if (!players.length) return 0;
  return normalizePlayerIndex(fromIndex + direction);
}

function getScenarioTurnEffect(card, scenario) {
  const raw = `${card?.rule?.name || ""} ${card?.value || ""} ${scenario?.text || ""} ${scenario?.consequence || ""}`.toLowerCase();

  // Le joueur garde la main et pioche encore.
  if (
    raw.includes("rejoue immédiatement") ||
    raw.includes("rejouer immédiatement") ||
    raw.includes("rejoue une carte") ||
    raw.includes("pioche une carte supplémentaire") ||
    raw.includes("piochez une carte normale supplémentaire") ||
    raw.includes("double draw") ||
    raw.includes("joker suprême") ||
    raw.includes("cataclysme léger")
  ) {
    return "replay";
  }

  // On saute le joueur suivant.
  if (
    raw.includes("passe ton tour") ||
    raw.includes("passer son tour") ||
    raw.includes("saute le prochain") ||
    raw.includes("saute son prochain") ||
    raw.includes("le prochain joueur saute") ||
    raw.includes("fait passer le prochain")
  ) {
    return "skip_next";
  }

  // Le sens de jeu change.
  if (
    raw.includes("inverse le sens") ||
    raw.includes("sens inversé") ||
    raw.includes("change le sens") ||
    raw.includes("inversion du sens") ||
    raw.includes("reverse")
  ) {
    return "reverse";
  }

  // Le tour revient au joueur ciblé : utile pour les cartes “vole le tour”.
  if (
    raw.includes("vole le tour") ||
    raw.includes("tour volé") ||
    raw.includes("prends le prochain tour") ||
    raw.includes("prend le prochain tour")
  ) {
    return "target_next";
  }

  return "normal";
}

function getNextTurnData(card, scenario, playerIndex) {
  const effect = getScenarioTurnEffect(card, scenario);
  let nextDirection = turnDirection;
  let nextIndex = getNextTurnIndex(playerIndex, nextDirection);

  if (effect === "replay") {
    nextIndex = playerIndex;
  }

  if (effect === "skip_next") {
    nextIndex = normalizePlayerIndex(playerIndex + nextDirection * 2);
  }

  if (effect === "reverse") {
    nextDirection = nextDirection * -1;
    nextIndex = normalizePlayerIndex(playerIndex + nextDirection);
  }

  if (effect === "target_next") {
    // Le vrai joueur ciblé sera choisi après la pioche.
    // Par défaut on avance normalement pour ne pas bloquer si aucune cible n'est sélectionnée.
    nextIndex = getNextTurnIndex(playerIndex, nextDirection);
  }

  return {
    effect,
    nextIndex,
    nextDirection
  };
}

function scenarioKeepsSamePlayer(card, scenario) {
  return getScenarioTurnEffect(card, scenario) === "replay";
}

function scenarioNeedsTargetSelection(scenario) {
  const raw = `${scenario?.text || ""} ${scenario?.consequence || ""}`.toLowerCase();

  return (
    raw.includes("choisis un joueur") ||
    raw.includes("choisis une personne") ||
    raw.includes("choisis deux joueurs") ||
    raw.includes("désigne un joueur") ||
    raw.includes("désigne une personne") ||
    raw.includes("choisis quelqu") ||
    raw.includes("cible") ||
    raw.includes("joueur ciblé") ||
    raw.includes("personne choisie") ||
    raw.includes("la cible")
  );
}

function getRandomCard() {
  if (Math.random() < SPECIAL_CARD_CHANCE) {
    const specialKey = specialCardWeights[Math.floor(Math.random() * specialCardWeights.length)];
    const specialRule = specialRules[specialKey];

    return {
      value: specialRule.displayValue,
      suit: specialRule.displaySuit,
      icon: specialRule.icon,
      rule: specialRule,
      isSpecial: true
    };
  }

  const values = Object.keys(baseRules);
  const value = values[Math.floor(Math.random() * values.length)];
  const suit = suits[Math.floor(Math.random() * suits.length)];

  return {
    value,
    suit,
    icon: cardIcons[value],
    rule: baseRules[value],
    isSpecial: false
  };
}

function getRandomScenario(rule) {
  const scenarios = rule.scenarios || [];
  if (scenarios.length === 0) {
    return {
      text: "Pioche une carte et applique son effet.",
      consequence: "Le groupe choisit une conséquence adaptée à la soirée."
    };
  }

  return scenarios[Math.floor(Math.random() * scenarios.length)];
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
  if (drinkLevel === "danger" || drinkLevel === "extreme") return 5;
  return 3;
}

function addChaosValue(baseAmount, currentChaos) {
  let amount = baseAmount;

  if (drinkLevel === "normal") amount += 2;
  if (drinkLevel === "hard") amount += 6;
  if (drinkLevel === "danger" || drinkLevel === "extreme") amount += 11;

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
  const playerIndex = getCurrentPlayerIndex();
  const player = getCurrentPlayer();
  const scenario = getRandomScenario(card.rule);
  const turnData = getNextTurnData(card, scenario, playerIndex);
  const nextPlayerIndex = turnData.nextIndex;
  const nextTurnDirection = turnData.nextDirection;
  const turnEffect = turnData.effect;
  const needsTargetSelection = scenarioNeedsTargetSelection(scenario);
  const ruleText =
    scenario.text ||
    "Pioche une carte et applique son effet.";
  const consequenceText =
    scenario.consequence ||
    "Le groupe choisit une conséquence adaptée à la soirée.";

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
    nextChaosLevel = addChaosValue(card.isSpecial ? getChaosGain() + 6 : getChaosGain(), nextChaosLevel);
  }

  if (card.isSpecial) {
    historyItems.push(`✨ Carte spéciale : ${card.rule.name}`);
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

  if (turnEffect === "replay") {
    historyItems.push(`🔁 ${getPlayerName(player, playerIndex)} rejoue immédiatement.`);
  }

  if (turnEffect === "skip_next") {
    const skippedIndex = getNextTurnIndex(playerIndex, turnDirection);
    historyItems.push(`⏭️ ${getPlayerName(players[skippedIndex], skippedIndex)} passe son tour.`);
  }

  if (turnEffect === "reverse") {
    historyItems.push("🔄 Le sens du tour est inversé.");
  }

  if (turnEffect === "target_next") {
    historyItems.push("🎯 Tour volé : sélectionne une cible pour confirmer le prochain joueur.");
  }

  historyItems.unshift(`${getPlayerName(player, playerIndex)} a pioché ${card.value}${card.suit} — ${card.rule.name}`);

  const nextPlayerStats = JSON.parse(JSON.stringify(playerStats || {}));
  const drawerStats = nextPlayerStats[getPlayerName(player, playerIndex)] || createEmptyPlayerStats(getPlayerName(player, playerIndex));
  drawerStats.cardsDrawn += 1;
  drawerStats.chaosPoints += card.isSpecial ? 5 : 2;

  if (card.isSpecial) {
    drawerStats.specialCards += 1;
    const specialKey = getSpecialStatKey(card.rule.name);
    if (specialKey) drawerStats[specialKey] += 1;
  }

  if (card.value === "K") {
    drawerStats.kingsDrawn += 1;
    drawerStats.chaosPoints += 4;
  }

  if (turnEffect === "replay") {
    drawerStats.replays += 1;
    drawerStats.chaosPoints += 3;
  }

  if (turnEffect === "reverse") {
    drawerStats.reversedTurns += 1;
    drawerStats.chaosPoints += 2;
  }

  if (turnEffect === "skip_next") {
    drawerStats.skippedTurns += 1;
    drawerStats.chaosPoints += 2;
  }

  if (turnEffect === "target_next") {
    drawerStats.stolenTurns += 1;
    drawerStats.chaosPoints += 2;
  }

  nextPlayerStats[getPlayerName(player, playerIndex)] = drawerStats;

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
    isSpecial: card.isSpecial || false,
    ruleText,
    playerIndex,
    nextPlayerIndex,
    turnDirection: nextTurnDirection,
    turnEffect,
    needsTargetSelection,
    playerName: getPlayerName(player, playerIndex),
    selectedTargetIndex: null,
    selectedTargetName: null,
    consequenceText,
    rareEvent,
    historyItems,
    playerStats: nextPlayerStats,
    finalKing: nextKingCount >= 4
  };
}

async function drawCard() {
  if (!canCurrentClientDraw()) return;

  const state = buildDrawState();

  await updateDoc(roomRef, {
    chaosKingsState: state,
    chaosKingsTarget: null,
    chaosKingsStats: state.playerStats || {}
  });
}

async function resetGame() {
  await updateDoc(roomRef, {
    chaosKingsState: {
      actionId: Date.now(),
      type: "reset"
    },
    chaosKingsTarget: null,
    chaosKingsStats: {}
  });
}

function listenToChaosKingsState() {
  onSnapshot(roomRef, snapshot => {
    if (!snapshot.exists()) return;

    const data = snapshot.data();

    if (handleGlobalLobbyReturn(data)) return;

    const state = data.chaosKingsState;
    if (data.chaosKingsStats) {
      playerStats = data.chaosKingsStats;
    }
    applyTargetSelection(data.chaosKingsTarget);

    if (!state) return;
    if (state.actionId === lastActionId) return;

    lastActionId = state.actionId;
    selectedTargetIndex = state.selectedTargetIndex ?? null;
    selectedTargetName = state.selectedTargetName ?? null;

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

  drawCardBtn.disabled = true;
  resetGameBtn.disabled = true;

  eventBanner.classList.add("hidden");
  kingCard.classList.remove("draw", "rare");

  cardValue.textContent = state.cardValue;
  cardIcon.textContent = state.cardIcon;
  cardSuit.textContent = state.cardSuit;

  void kingCard.offsetWidth;
  kingCard.classList.add("draw");

  currentDrawState = state;
  if (state.playerStats) {
    playerStats = state.playerStats;
  }
  targetText.textContent = getTargetLine(state);
  renderTurnAndTargetUI(state);
  effectTitle.textContent = `${state.cardValue}${state.cardSuit} — ${state.ruleName}`;
  effectDescription.innerHTML = `
    <span class="effect-label">Scénario</span>
    <strong>${escapeHtml(state.ruleText)}</strong>

    <span class="effect-label">Conséquence</span>
    <strong>${escapeHtml(state.consequenceText)}</strong>
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

  if (state.isSpecial) {
    eventBanner.textContent = `✨ CARTE SPÉCIALE — ${state.ruleName}`;
    eventBanner.classList.remove("hidden");
    kingCard.classList.add("rare");
    launchConfetti(35);
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
  currentPlayerIndex = normalizePlayerIndex(state.nextPlayerIndex ?? currentPlayerIndex + 1);
  turnDirection = state.turnDirection || turnDirection;
  renderTurnAndTargetUI();

  if (state.finalKing) {
    triggerFinalKingSynced();
    return;
  }

  isDrawing = false;

  refreshDrawButtonState();
  resetGameBtn.disabled = false;
}

function triggerFinalKingSynced() {
  drawCardBtn.disabled = true;

  if (isHost) {
    resetGameBtn.disabled = false;
  }

  eventBanner.textContent = "👑💀 CHAOS CUP FINAL — Les 4 rois sont tombés";
  eventBanner.classList.remove("hidden");

  effectTitle.textContent = "Fin royale";
  renderFinalSummary();

  addHistory("👑 Les 4 rois ont été tirés : résumé final Chaos Kings");
}

function applyResetState() {
  turn = 1;
  chaosLevel = 0;
  kingCount = 0;
  history = [];
  activeEffects = [];
  isDrawing = false;
  currentPlayerIndex = 0;
  turnDirection = 1;
  selectedTargetIndex = null;
  selectedTargetName = null;
  currentDrawState = null;
  lastTargetSelectionId = null;
  playerStats = {};
  finalSummaryShown = false;
  ensureStatsForAllPlayers();

  eventBanner.classList.add("hidden");

  cardValue.textContent = "?";
  cardIcon.textContent = "👑";
  cardSuit.textContent = "CHAOS";

  targetText.textContent = "Pioche une carte pour commencer";
  renderTurnAndTargetUI();
  effectTitle.textContent = "Chaos Kings";
  effectDescription.textContent =
    "Chaque carte applique une règle. Plus la partie avance, plus le chaos monte.";

  refreshDrawButtonState();
  resetGameBtn.disabled = false;

  updateUI();
  renderHistory();
}

function updateUI() {
  turnBadge.textContent = `Tour ${turn}`;
  chaosBadge.textContent = `Chaos ${chaosLevel}%`;
  kingCountText.textContent = `${kingCount}/4`;

  renderTurnAndTargetUI();
  renderActiveEffects();
  refreshDrawButtonState();
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