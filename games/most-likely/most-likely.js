import {
  db,
  doc,
  getDoc,
  updateDoc,
  onSnapshot
} from "../../firebase.js";
import { resolveIsHost, lobbyWrite } from "../../game-common.js";
import { escapeHtml } from "../../html-safe.js";

const backToLobbyBtn = document.getElementById("backToLobbyBtn");
const finalBackBtn = document.getElementById("finalBackBtn");
const restartGameBtn = document.getElementById("restartGameBtn");

const roomBadge = document.getElementById("roomBadge");
const gameModeBadge = document.getElementById("gameModeBadge");
const roundBadge = document.getElementById("roundBadge");
const progressBadge = document.getElementById("progressBadge");
const questionCategory = document.getElementById("questionCategory");

const questionText = document.getElementById("questionText");
const voteGrid = document.getElementById("voteGrid");

const resultBox = document.getElementById("resultBox");
const resultText = document.getElementById("resultText");
const drinkPenalty = document.getElementById("drinkPenalty");
const resultHint = document.getElementById("resultHint");

const nextQuestionBtn = document.getElementById("nextQuestionBtn");
const skipQuestionBtn = document.getElementById("skipQuestionBtn");
const finishGameBtn = document.getElementById("finishGameBtn");

const scoreList = document.getElementById("scoreList");
const endScreen = document.getElementById("endScreen");
const winnerText = document.getElementById("winnerText");
const finalScores = document.getElementById("finalScores");

const savedData = JSON.parse(localStorage.getItem("partyhubGameData"));

if (!savedData) {
  alert("Aucune partie trouvée. Retour au lobby.");
  window.location.href = "../../index.html";
}

let players = savedData.players || [];
const selectedPartyMode = savedData.selectedPartyMode || "Party";
const alcoholMode = savedData.alcoholMode;
const drinkLevel = savedData.drinkLevel || "normal";
const gameDuration = savedData.gameDuration || "medium";
const roomCode = savedData.roomCode || "----";
const currentPlayer = savedData.currentPlayer || "";
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


let currentRound = 1;
let maxRounds = getMaxRounds();
let usedQuestions = [];
let scores = {};
let votes = {};
let currentQuestion = "";
let resultPlayer = null;
let lastActionId = null;

const questions = {
  Chill: [
    "Qui est le plus susceptible de finir la soirée à parler philo dans un coin ?",
    "Qui est le plus susceptible d’oublier son téléphone partout ?",
    "Qui est le plus susceptible de ramener un animal errant ?",
    "Qui est le plus susceptible de commander à manger pour tout le monde à 3h ?",
    "Qui est le plus susceptible de tomber amoureux en une soirée ?",
    "Qui est le plus susceptible de danser comme si personne ne regardait ?",
    "Qui est le plus susceptible de citer des memes obsolètes ?",
    "Qui est le plus susceptible de s’endormir avant minuit ?",
    "Qui est le plus susceptible de prendre 300 photos floues ?",
    "Qui est le plus susceptible de toujours avoir des snacks sur lui ?",
    "Qui est le plus susceptible de proposer un jeu de société random ?",
    "Qui est le plus susceptible de faire des playlists interminables ?",
    "Qui est le plus susceptible de connaître toutes les paroles de chansons nulles ?",
    "Qui est le plus susceptible de garder un secret pendant 10 ans ?",
    "Qui est le plus susceptible de collectionner des trucs inutiles ?",
    "Qui est le plus susceptible de pleurer devant des vidéos de chiots ?",
    "Qui est le plus susceptible de rester sobre toute la soirée ?",
    "Qui est le plus susceptible de faire des compliments chelous ?",
    "Qui est le plus susceptible de ranger l’appart à 6h du matin ?",
    "Qui est le plus susceptible d’adopter des plantes et de les tuer ?",
    "Qui est le plus susceptible de parler tout seul ?",
    "Qui est le plus susceptible de croire aux signes de l’univers ?",
    "Qui est le plus susceptible de raconter ses rêves bizarres ?",
    "Qui est le plus susceptible d’être toujours en retard ?",
    "Qui est le plus susceptible de chanter sous la douche ?",
    "Qui est le plus susceptible de faire des listes pour tout ?",
    "Qui est le plus susceptible d’avoir peur des araignées ?",
    "Qui est le plus susceptible de finir ses phrases par des emojis ?",
    "Qui est le plus susceptible de collectionner les hoodies ?",
    "Qui est le plus susceptible de regarder des mukbangs pour s’endormir ?",
    "Qui est le plus susceptible de dire ‘c’est pas ce que je voulais dire’ ?",
    "Qui est le plus susceptible d’aimer les dramas des autres ?",
    "Qui est le plus susceptible de faire du journaling ?",
    "Qui est le plus susceptible de parler à ses plantes ?",
    "Qui est le plus susceptible d’avoir 50 onglets ouverts en permanence ?",
    "Qui est le plus susceptible de sauver des animaux sur Internet ?",
    "Qui est le plus susceptible de faire des siestes de 4h ?",
    "Qui est le plus susceptible d’être addict aux réseaux sociaux ?",
    "Qui est le plus susceptible de rire tout seul devant un meme ?",
    "Qui est le plus susceptible de garder tous ses tickets ?",
    "Qui est le plus susceptible de devenir pote avec le serveur ?",
    "Qui est le plus susceptible de faire des blagues nulles ?",
    "Qui est le plus susceptible d’avoir une peluche secrète ?",
    "Qui est le plus susceptible de chanter sous la pluie ?",
    "Qui est le plus susceptible d’oublier de manger ?",
    "Qui est le plus susceptible de faire des câlins à tout le monde ?",
    "Qui est le plus susceptible d’avoir une routine skincare interminable ?",
    "Qui est le plus susceptible de dire ‘je suis fatigué’ toute la soirée ?",
    "Qui est le plus susceptible de faire des grimaces sur les photos ?",
    "Qui est le plus susceptible d’être obsédé par le rangement ?",
    "Qui est le plus susceptible de poser des questions existentielles ?",
    "Qui est le plus susceptible d’avoir une playlist sad ?",
    "Qui est le plus susceptible de collectionner les mugs ?",
    "Qui est le plus susceptible de faire des voix aux animaux ?",
    "Qui est le plus susceptible d’être toujours en train de grignoter ?",
    "Qui est le plus susceptible de prendre des notes sur tout ?",
    "Qui est le plus susceptible de faire des blagues dad ?",
    "Qui est le plus susceptible d’aimer les films d’horreur tout en ayant peur ?",
    "Qui est le plus susceptible de parler en citations ?",
    "Qui est le plus susceptible d’avoir une opinion sur tout ?",
    "Qui est le plus susceptible de faire des DIY ratés ?",
    "Qui est le plus susceptible de devenir pote avec les grands-parents ?",
    "Qui est le plus susceptible de chanter en voiture ?",
    "Qui est le plus susceptible d’avoir une addiction au café ?",
    "Qui est le plus susceptible de faire des tier lists ?",
    "Qui est le plus susceptible de garder ses ex en ami ?",
    "Qui est le plus susceptible de dire ‘je vais me coucher tôt’ et finir à 5h ?",
    "Qui est le plus susceptible d’être toujours en jogging ?",
    "Qui est le plus susceptible de faire des mimes en racontant une histoire ?",
    "Qui est le plus susceptible d’avoir une chambre bordélique ?",
    "Qui est le plus susceptible de poser des questions philo quand il est bourré ?",
    "Qui est le plus susceptible d’aimer les câlins ?",
    "Qui est le plus susceptible de faire des recherches Wikipédia à 4h du mat ?",
    "Qui est le plus susceptible de collectionner les stickers ?",
    "Qui est le plus susceptible de dire ‘je suis trop vieux’ puis de le faire quand même ?",
    "Qui est le plus susceptible d’avoir un crush sur une voix ?",
    "Qui est le plus susceptible de faire des appels vidéo interminables ?",
    "Qui est le plus susceptible de rater ses recettes healthy ?",
    "Qui est le plus susceptible de parler à ses posters ?",
    "Qui est le plus susceptible d’avoir peur du vide ?",
    "Qui est le plus susceptible de faire des sons en mangeant ?",
    "Qui est le plus susceptible de garder ses souvenirs d’enfance ?",
    "Qui est le plus susceptible de dire oui à tout puis regretter ?",
    "Qui est le plus susceptible d’être le roi des memes ?",
    "Qui est le plus susceptible de faire des danses TikTok ratées ?",
    "Qui est le plus susceptible d’avoir des chaussettes dépareillées ?",
    "Qui est le plus susceptible de blaguer sur son malheur ?",
    "Qui est le plus susceptible de devenir émotif avec la musique ?",
    "Qui est le plus susceptible d’avoir 10 projets inachevés ?",
    "Qui est le plus susceptible de faire des compliments random ?",
    "Qui est le plus susceptible d’être toujours en retard avec une excuse bidon ?",
    "Qui est le plus susceptible de faire des jeux de mots pourris ?",
    "Qui est le plus susceptible d’avoir une peur irrationnelle ?",
    "Qui est le plus susceptible de parler en dormant ?",
    "Qui est le plus susceptible d’être le plus gentil du groupe ?",
    "Qui est le plus susceptible de faire des selfies avec des inconnus ?",
    "Qui est le plus susceptible d’aimer les soirées calmes ?",
    "Qui est le plus susceptible de garder une lettre d’amour ?",
    "Qui est le plus susceptible de googler ses symptômes ?",
    "Qui est le plus susceptible de dire ‘juste un épisode’ et binge-watcher toute la saison ?",
    "Qui est le plus susceptible d’être toujours positif ?",
    "Qui est le plus susceptible de faire des voix en vocal ?",
    "Qui est le plus susceptible d’être addict aux stories ?",
    "Qui est le plus susceptible de faire des listes sans jamais rien faire ?",
    "Qui est le plus susceptible de devenir pote avec tout le monde ?",
    "Qui est le plus susceptible d’avoir un carnet de pensées ?",
    "Qui est le plus susceptible de blaguer sur son ex ?",
    "Qui est le plus susceptible de danser seul dans sa chambre ?",
    "Qui est le plus susceptible d’être le thérapeute du groupe ?",
    "Qui est le plus susceptible de collectionner les mugs mignons ?",
    "Qui est le plus susceptible de dire ‘je change’ tous les mois ?",
    "Qui est le plus susceptible d’avoir une playlist pour chaque mood ?",
    "Qui est le plus susceptible de faire des câlins longs ?",
    "Qui est le plus susceptible de parler de rêves lucides ?",
    "Qui est le plus susceptible de grignoter healthy puis junk food juste après ?",
    "Qui est le plus susceptible de faire des tier lists de ses potes ?",
    "Qui est le plus susceptible de garder ses bracelets brésiliens ?",
    "Qui est le plus susceptible de faire des blagues nulles pour détendre l’ambiance ?",
    "Qui est le plus susceptible d’avoir peur des clowns ?",
    "Qui est le plus susceptible de dire ‘je t’aime’ bourré à ses potes ?",
    "Qui est le plus susceptible de collectionner les Polaroid ?",
    "Qui est le plus susceptible de tenir ses résolutions seulement 3 jours ?",
    "Qui est le plus susceptible de faire des voix bizarres au téléphone ?",
    "Qui est le plus susceptible de collectionner les figurines ?",
    "Qui est le plus susceptible d’être toujours en train de dessiner ?",
    "Qui est le plus susceptible de faire des blagues sur son signe astro ?",
    "Qui est le plus susceptible d’avoir peur des hauteurs ?"
  ],

  Party: [
    "Qui est le plus susceptible de finir sur la table à danser ?",
    "Qui est le plus susceptible de faire 10 shots d’affilée ?",
    "Qui est le plus susceptible d’inviter tout le monde à l’after ?",
    "Qui est le plus susceptible de perdre ses clés en 20 minutes ?",
    "Qui est le plus susceptible de se mettre torse nu ?",
    "Qui est le plus susceptible de chanter dans la rue ?",
    "Qui est le plus susceptible de draguer le barman / la barmaid ?",
    "Qui est le plus susceptible de faire un twerk raté ?",
    "Qui est le plus susceptible d’organiser un jeu à boire ?",
    "Qui est le plus susceptible de finir avec le maquillage détruit ?",
    "Qui est le plus susceptible de voler une bouteille ?",
    "Qui est le plus susceptible de faire un body shot ?",
    "Qui est le plus susceptible de danser sur le bar ?",
    "Qui est le plus susceptible de ramener un inconnu ?",
    "Qui est le plus susceptible de mixer tous les alcools ?",
    "Qui est le plus susceptible de faire un striptease raté ?",
    "Qui est le plus susceptible de perdre une chaussure ?",
    "Qui est le plus susceptible de crier ‘j’aime tout le monde’ ?",
    "Qui est le plus susceptible de faire un karaoké dramatique ?",
    "Qui est le plus susceptible de finir en string ?",
    "Qui est le plus susceptible de vomir puis continuer à boire ?",
    "Qui est le plus susceptible de prendre des photos complètement bourré ?",
    "Qui est le plus susceptible de french kiss un pote ?",
    "Qui est le plus susceptible de danser collé ?",
    "Qui est le plus susceptible de perdre son portefeuille ?",
    "Qui est le plus susceptible de faire un shot dans le nombril ?",
    "Qui est le plus susceptible d’inviter des randoms ?",
    "Qui est le plus susceptible de finir à poil dans une piscine ?",
    "Qui est le plus susceptible de crier des confessions ?",
    "Qui est le plus susceptible de faire un pari cul ?",
    "Qui est le plus susceptible de faire un conga line ?",
    "Qui est le plus susceptible de se faire tatouer temporaire ?",
    "Qui est le plus susceptible de draguer en groupe ?",
    "Qui est le plus susceptible de finir sur les épaules de quelqu’un ?",
    "Qui est le plus susceptible de faire un moonwalk raté ?",
    "Qui est le plus susceptible de voler un panneau de signalisation ?",
    "Qui est le plus susceptible de chanter du rap en playback ?",
    "Qui est le plus susceptible de faire un dab à chaque fois ?",
    "Qui est le plus susceptible de ramener 5 inconnus ?",
    "Qui est le plus susceptible de faire un battle de danse ?",
    "Qui est le plus susceptible de finir avec des bisous partout ?",
    "Qui est le plus susceptible de voler des verres ?",
    "Qui est le plus susceptible de faire un toast à n’importe quoi ?",
    "Qui est le plus susceptible de faire un flip cup ?",
    "Qui est le plus susceptible de danser sur la table basse ?",
    "Qui est le plus susceptible de faire un beer pong catastrophique ?",
    "Qui est le plus susceptible de perdre ses affaires partout ?",
    "Qui est le plus susceptible de faire un selfie de groupe toutes les 10 minutes ?",
    "Qui est le plus susceptible de faire un mur de shots ?",
    "Qui est le plus susceptible de danser avec un inconnu toute la soirée ?",
    "Qui est le plus susceptible de faire un Never Have I Ever sauvage ?",
    "Qui est le plus susceptible de finir la bouteille de vodka ?",
    "Qui est le plus susceptible de crier ‘shots shots shots’ ?",
    "Qui est le plus susceptible de danser sur du reggaeton ?",
    "Qui est le plus susceptible de finir avec du maquillage sur le visage ?",
    "Qui est le plus susceptible de faire un challenge TikTok bourré ?",
    "Qui est le plus susceptible de perdre son Uber ?",
    "Qui est le plus susceptible de mixer Red Bull avec tout ce qui passe ?",
    "Qui est le plus susceptible de finir la soirée à danser sous la pluie ?",
    "Qui est le plus susceptible de faire un shot gun ?",
    "Qui est le plus susceptible de danser en chaussettes ?",
    "Qui est le plus susceptible de ramener tout le groupe à l’after ?",
    "Qui est le plus susceptible de faire un karaoké seul sur scène ?",
    "Qui est le plus susceptible de finir torse nu sur une story ?"
  ],

  Chaos: [
    "Qui est le plus susceptible de déclencher une dispute pour rien ?",
    "Qui est le plus susceptible de voler dans l’appart ?",
    "Qui est le plus susceptible d’appeler son ex à 4h du mat ?",
    "Qui est le plus susceptible de casser un truc cher ?",
    "Qui est le plus susceptible de se perdre en rentrant ?",
    "Qui est le plus susceptible de lancer un pari dangereux ?",
    "Qui est le plus susceptible de filmer sans consentement ?",
    "Qui est le plus susceptible de saouler tout le monde ?",
    "Qui est le plus susceptible de commencer une bagarre ?",
    "Qui est le plus susceptible de vomir partout ?",
    "Qui est le plus susceptible de réveiller tout l’immeuble ?",
    "Qui est le plus susceptible de faire un tatouage impulsif ?",
    "Qui est le plus susceptible de dormir dans la rue ?",
    "Qui est le plus susceptible de poster des stories gênantes ?",
    "Qui est le plus susceptible de casser son téléphone ?",
    "Qui est le plus susceptible de se battre avec un pote ?",
    "Qui est le plus susceptible de fuir sans payer ?",
    "Qui est le plus susceptible de déclencher un drama ?",
    "Qui est le plus susceptible de faire un mosh pit ?",
    "Qui est le plus susceptible de sauter d’un balcon ?",
    "Qui est le plus susceptible de faire un feu illégal ?",
    "Qui est le plus susceptible de détruire un meuble ?",
    "Qui est le plus susceptible de courir nu ?",
    "Qui est le plus susceptible d’escalader un bâtiment ?",
    "Qui est le plus susceptible de voler dans un magasin ?",
    "Qui est le plus susceptible de faire un prank dangereux ?",
    "Qui est le plus susceptible de déclencher les pompiers ?",
    "Qui est le plus susceptible de se battre avec un inconnu ?",
    "Qui est le plus susceptible de poster une vidéo compromettante ?",
    "Qui est le plus susceptible de faire un burn out en une nuit ?",
    "Qui est le plus susceptible de crier sur tout le monde ?",
    "Qui est le plus susceptible de faire un pari qui finit aux urgences ?",
    "Qui est le plus susceptible de détruire la playlist ?",
    "Qui est le plus susceptible de faire un trou dans le mur ?",
    "Qui est le plus susceptible de fuir la police ?",
    "Qui est le plus susceptible de faire un live TikTok chaotique ?",
    "Qui est le plus susceptible de se disputer avec le DJ ?",
    "Qui est le plus susceptible de se faire jeter dehors ?",
    "Qui est le plus susceptible de hurler des secrets ?",
    "Qui est le plus susceptible de déclencher un drama familial ?",
    "Qui est le plus susceptible de faire une guerre de nourriture ?",
    "Qui est le plus susceptible de casser la porte des toilettes ?",
    "Qui est le plus susceptible de hurler son amour à 5h du matin ?",
    "Qui est le plus susceptible de déclencher une alarme ?",
    "Qui est le plus susceptible de faire un prank qui finit mal ?"
  ],

  Hardcore: [
    // Attention : catégorie très dark, je l’ai juste corrigée orthographiquement et fluidifiée
    "Qui est le plus susceptible d’être raciste après 3 verres ?",
    "Qui est le plus susceptible d’être homophobe en public tout en étant très actif sur Grindr ?",
    "Qui est le plus susceptible d’avoir déjà dit le mot en N bourré ?",
    "Qui est le plus susceptible de devenir ultra raciste quand il boit ?",
    "Qui est le plus susceptible d’avoir des DMs racistes ou homophobes ?",
    "Qui est le plus susceptible d’être refoulé gay et de le nier toute sa vie ?",
    "Qui est le plus susceptible d’avoir une double vie sexuelle ?",
    "Qui est le plus susceptible de ghoster après avoir fait des trucs dégueulasses ?",
    "Qui est le plus susceptible d’avoir un kink raciste ou humiliant ?",
    "Qui est le plus susceptible d’avoir déjà payé pour du sexe ?",
    "Qui est le plus susceptible d’avoir un compte OnlyFans secret ?",
    "Qui est le plus susceptible de mentir sur son body count depuis des années ?",
    "Qui est le plus susceptible d’avoir déjà couché avec un membre de sa famille ?",
    "Qui est le plus susceptible de devenir violent après minuit ?",
    "Qui est le plus susceptible d’avoir trahi tous ses potes pour du sexe ?",
    "Qui est le plus susceptible d’avoir un dossier judiciaire bien rempli ?",
    "Qui est le plus susceptible d’avoir fait du scat ou piss play ?",
    "Qui est le plus susceptible d’avoir couché avec son ex en étant en couple ?",
    "Qui est le plus susceptible d’avoir filmé une sextape sans consentement ?",
    "Qui est le plus susceptible de mater du porno illégal ou extrême ?",
    "Qui est le plus susceptible d’avoir déjà été cancel pour de vraies raisons ?",
    "Qui est le plus susceptible d’avoir une MST et de la refiler sans prévenir ?",
    "Qui est le plus susceptible de fantasmer sur des trucs vraiment tabous ?",
    "Qui est le plus susceptible d’avoir fait du revenge porn ?",
    "Qui est le plus susceptible d’avoir un crush sur quelqu’un ici tout en le détestant ?",
    "Qui est le plus susceptible d’avoir couché avec le partenaire de son meilleur ami ?",
    "Qui est le plus susceptible d’avoir déjà participé à une orgie ?",
    "Qui est le plus susceptible d’avoir un historique de recherche porno terrifiant ?",
    "Qui est le plus susceptible d’avoir des fantasmes incestueux ?",
    "Qui est le plus susceptible d’avoir un daddy kink avec grosse différence d’âge ?",
    "Qui est le plus susceptible de mater du porno gore ou violent ?",
    "Qui est le plus susceptible d’avoir des pratiques sexuelles hyper dangereuses ?",
    "Qui est le plus susceptible d’avoir un deuxième téléphone pour ses plans ?",
    "Qui est le plus susceptible d’avoir déjà pissé sur quelqu’un ou l’inverse ?",
    "Qui est le plus susceptible d’avoir déjà fait du candaulisme sans le dire ?",
    "Qui est le plus susceptible d’avoir déjà couché avec quelqu’un de sa famille éloignée ?",
    "Qui est le plus susceptible d’avoir déjà fait du public sex très risqué ?",
    "Qui est le plus susceptible d’avoir un trouble de la personnalité bien caché ?",
    "Qui est le plus susceptible d’avoir couché plusieurs personnes la même nuit sans protection ?",
    "Qui est le plus susceptible d’avoir fantasmé sur du viol ?",
    "Qui est le plus susceptible d’avoir volé des sous-vêtements ?",
    "Qui est le plus susceptible de harceler ses ex sur les réseaux ?",
    "Qui est le plus susceptible d’avoir des kinks fluides corporels extrêmes ?",
    "Qui est le plus susceptible d’avoir fait du sexting avec des mineurs ?",
    "Qui est le plus susceptible d’avoir un kink pour la violence sexuelle ?",
    "Qui est le plus susceptible d’avoir couché sous drogues dures ?",
    "Qui est le plus susceptible d’avoir fait du voyeurisme ?",
    "Qui est le plus susceptible d’avoir une addiction sexe destructrice ?",
    "Qui est le plus susceptible d’avoir fait du breeding sans protection ?",
    "Qui est le plus susceptible d’avoir fait du glory hole ?",
    "Qui est le plus susceptible d’avoir fait du age play extrême ?",
    "Qui est le plus susceptible d’avoir fait du public humiliation ?",
    "Qui est le plus susceptible d’avoir fait du CNC ?",
    "Qui est le plus susceptible d’avoir un fétichisme excréments ?",
    "Qui est le plus susceptible de finir bourré en premier ?",
    "Qui est le plus susceptible de vomir le plus tôt dans la soirée ?",
    "Qui est le plus susceptible de se mettre torse nu après 4 verres ?",
    "Qui est le plus susceptible de draguer tout le monde quand il est saoul ?",
    "Qui est le plus susceptible de pleurer bourré ?",
    "Qui est le plus susceptible de dire des secrets qu’il regrettera ?",
    "Qui est le plus susceptible de finir à poil ?",
    "Qui est le plus susceptible de devenir hyper affectueux après l’alcool ?",
    "Qui est le plus susceptible de faire des déclarations d’amour cheloues ?",
    "Qui est le plus susceptible de se battre pour rien après minuit ?",
    "Qui est le plus susceptible de faire un striptease raté ?",
    "Qui est le plus susceptible de dire ‘je vous aime tous’ ?",
    "Qui est le plus susceptible de faire des paris stupides ?",
    "Qui est le plus susceptible de regretter toute sa vie le lendemain ?",
    "Qui est le plus susceptible de se disputer avec ses meilleurs potes ?",
    "Qui est le plus susceptible de finir à l’hôpital ?",
    "Qui est le plus susceptible de draguer son ex bourré ?",
    "Qui est le plus susceptible de se réveiller sans aucun souvenir ?"
  ]
};

const drinkPenalties = {
  soft: [
    "Boit 1 gorgée 🍺",
    "Boit 2 gorgées 🍺",
    "Distribue 1 gorgée",
    "Mini-gage au choix du groupe 😇",
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
    "Boit 3 gorgées 🍻",
    "Boit 4 gorgées 🍻",
    "Mini cul-sec 🍺",
    "Shot soft 🥃",
    "Distribue 3 gorgées",
    "Waterfall 4 secondes 🌊",
    "Choisis quelqu’un qui boit avec toi",
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
    "Shot complet 🥃",
    "Cul sec 🍺",
    "Boit 5 gorgées 💀",
    "Waterfall 7 secondes 🌊",
    "Distribue 6 gorgées",
    "Shot ou vérité gênante",
    "Double punition si tu es encore voté au prochain tour",
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
    "DOUBLE SHOT ☠️",
    "CUL SEC COMPLET 💀",
    "Shot mystère 🎲",
    "Waterfall 10 secondes 🌊",
    "Distribue 10 gorgées",
    "Le groupe choisit ta sanction",
    "Shot + vérité hardcore",
    "Punition collective : tout le monde boit avec toi",
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
  gameModeBadge.textContent = `Mode ${selectedPartyMode}`;

  scores = buildDefaultScores();
  renderScores();

  if (players.length < 2) {
    questionText.textContent = "Ajoute au moins 2 joueurs pour jouer.";
    nextQuestionBtn.disabled = true;
    skipQuestionBtn.disabled = true;
    return;
  }

  if (!isHost) {
    nextQuestionBtn.disabled = true;
    skipQuestionBtn.disabled = true;
    finishGameBtn.disabled = true;
    restartGameBtn.disabled = true;

    nextQuestionBtn.textContent = "À toi de jouer";
    skipQuestionBtn.textContent = "Action dispo skip";
    finishGameBtn.textContent = "Action dispo termine";
  }

  listenToMostLikelyState();

  if (isHost) {
    publishState({
      type: "question",
      round: 1,
      maxRounds,
      usedQuestions: [],
      scores: buildDefaultScores(),
      votes: {},
      question: getRandomQuestionFromUsed([]),
      resultPlayer: null,
      penalty: null,
      hint: null,
      voteComplete: false,
      tie: false,
      finished: false
    });
  }
}

function buildDefaultScores() {
  const base = {};

  players.forEach(player => {
    base[player.name] = 0;
  });

  return base;
}

function getMaxRounds() {
  if (gameDuration === "short") return 5;
  if (gameDuration === "medium") return 10;
  if (gameDuration === "long") return 15;
  if (gameDuration === "infinite") return 999;
  return 10;
}

function updateRoundUI() {
  const progress = Math.min(Math.round(((currentRound - 1) / maxRounds) * 100), 100);

  roundBadge.textContent = `Manche ${currentRound}/${maxRounds}`;
  progressBadge.textContent = `Progression ${progress}%`;
  questionCategory.textContent = getCategoryLabel();
}

function getCategoryLabel() {
  if (selectedPartyMode === "Chill") return "😇 Question chill";
  if (selectedPartyMode === "Party") return "🍺 Question soirée";
  if (selectedPartyMode === "Chaos") return "💀 Question chaos";
  if (selectedPartyMode === "Hardcore") return "☠️ Question hardcore";
  return "🍻 Question";
}

function getQuestionPool() {
  return questions[selectedPartyMode] || questions.Party;
}

function getRandomQuestionFromUsed(currentUsed) {
  const pool = getQuestionPool();
  let localUsed = [...currentUsed];

  if (localUsed.length >= pool.length) {
    localUsed = [];
  }

  let question;

  do {
    question = pool[Math.floor(Math.random() * pool.length)];
  } while (localUsed.includes(question));

  return question;
}

function getDrinkPenalty() {
  if (!alcoholMode) {
    const softGages = [
      "Mode soft : mini-gage choisi par le groupe 😇",
      "Mode soft : vérité obligatoire",
      "Mode soft : imitation ridicule",
      "Mode soft : danse de 10 secondes"
    ];

    return softGages[Math.floor(Math.random() * softGages.length)];
  }

  const effectiveDrinkLevel = drinkLevel === "extreme" ? "danger" : drinkLevel;
  const pool = drinkPenalties[effectiveDrinkLevel] || drinkPenalties.normal;
  return pool[Math.floor(Math.random() * pool.length)];
}

function getResultHint(playerName) {
  const hints = [
    `${playerName}, le groupe a parlé. Aucun recours possible.`,
    `${playerName}, accepte ton destin.`,
    `${playerName}, c’est ton moment de gloire.`,
    `${playerName}, la démocratie a décidé.`,
    `${playerName}, ça sent le débrief demain.`,
    `${playerName}, visiblement tout le monde avait quelque chose à dire.`,
    `${playerName}, c’est pas personnel… enfin normalement.`
  ];

  return hints[Math.floor(Math.random() * hints.length)];
}

async function publishState(state) {
  await updateDoc(roomRef, {
    mostLikelyState: {
      actionId: Date.now(),
      ...state
    }
  });
}

function listenToMostLikelyState() {
  onSnapshot(roomRef, snapshot => {
    if (!snapshot.exists()) return;

    const data = snapshot.data();

    if (handleGlobalLobbyReturn(data)) return;

    const state = data.mostLikelyState;

    if (!state) return;
    if (state.actionId === lastActionId) return;

    lastActionId = state.actionId;
    applyState(state);
  });
}

function applyState(state) {
  currentRound = state.round || 1;
  maxRounds = state.maxRounds || getMaxRounds();
  usedQuestions = state.usedQuestions || [];
  scores = state.scores || buildDefaultScores();
  votes = state.votes || {};
  currentQuestion = state.question || "";
  resultPlayer = state.resultPlayer || null;

  updateRoundUI();
  renderScores();

  questionText.textContent = currentQuestion;

  if (state.finished) {
    showFinalScreen();
    return;
  }

  endScreen.classList.add("hidden");
  renderVoteButtons();

  if (state.voteComplete && state.tie) {
    resultBox.classList.remove("hidden");
    resultText.textContent = "🤝 Égalité !";
    drinkPenalty.textContent = "Aucune punition pour cette manche.";
    resultHint.textContent = "Personne n’a été sélectionné plus que les autres.";
    return;
  }

  if (state.voteComplete && resultPlayer) {
    resultBox.classList.remove("hidden");
    let target=`🍺 ${resultPlayer} est désigné par la majorité !`;
    resultText.textContent="";
    let i=0;
    const anim=setInterval(()=>{ i++; resultText.textContent=target.slice(0,i); if(i>=target.length) clearInterval(anim); },40);
    drinkPenalty.textContent = state.penalty || "";
    resultHint.textContent = state.hint || "";
  } else {
    resultBox.classList.add("hidden");
  }
}

function renderVoteButtons() {
  voteGrid.innerHTML = "";

  const hasCurrentPlayerVoted = !!votes[currentPlayer];

  players.forEach(player => {
    const btn = document.createElement("button");
    btn.className = "vote-btn";
    btn.textContent = player.name;
    btn.dataset.initial = String(player.name || "?").trim().charAt(0).toUpperCase();

    if (hasCurrentPlayerVoted) {
      btn.disabled = true;
    }

    if (votes[currentPlayer] === player.name) {
      btn.classList.add("voted");
    }

    btn.addEventListener("click", () => {
      voteForPlayer(player.name);
    });

    voteGrid.appendChild(btn);
  });
}

async function voteForPlayer(playerName) {
  if (votes[currentPlayer]) return;

  const nextVotes = {
    ...votes,
    [currentPlayer]: playerName
  };

  const allPlayersVoted = Object.keys(nextVotes).length >= players.length;
  const nextScores = { ...scores };

  let majorityPlayer = null;
  let penalty = null;
  let hint = null;
  let tie = false;

  if (allPlayersVoted) {
    const voteCounts = {};

    Object.values(nextVotes).forEach(votedName => {
      voteCounts[votedName] = (voteCounts[votedName] || 0) + 1;
    });

    let maxVotes = 0;

    Object.values(voteCounts).forEach(count => {
      if (count > maxVotes) {
        maxVotes = count;
      }
    });

    const winners = Object.keys(voteCounts).filter(name => voteCounts[name] === maxVotes);

    if (winners.length === 1) {
      majorityPlayer = winners[0];
      nextScores[majorityPlayer] = (nextScores[majorityPlayer] || 0) + 1;
      penalty = getDrinkPenalty();
      hint = getResultHint(majorityPlayer);
    } else {
      tie = true;
    }
  }

  await publishState({
    type: "vote",
    round: currentRound,
    maxRounds,
    usedQuestions,
    scores: nextScores,
    votes: nextVotes,
    question: currentQuestion,
    resultPlayer: majorityPlayer,
    penalty,
    hint,
    voteComplete: allPlayersVoted,
    tie,
    finished: false
  });
}

async function goToNextRound() {
  if (!isHost) return;

  const nextRound = currentRound + 1;

  if (nextRound > maxRounds) {
    await finishGame();
    return;
  }

  const nextUsed = [...usedQuestions, currentQuestion];
  const nextQuestion = getRandomQuestionFromUsed(nextUsed);

  await publishState({
    type: "question",
    round: nextRound,
    maxRounds,
    usedQuestions: nextUsed,
    scores,
    votes: {},
    question: nextQuestion,
    resultPlayer: null,
    penalty: null,
    hint: null,
    voteComplete: false,
    tie: false,
    finished: false
  });
}

async function skipQuestion() {
  if (!isHost) return;

  const nextUsed = [...usedQuestions, currentQuestion];
  const nextQuestion = getRandomQuestionFromUsed(nextUsed);

  await publishState({
    type: "question",
    round: currentRound,
    maxRounds,
    usedQuestions: nextUsed,
    scores,
    votes: {},
    question: nextQuestion,
    resultPlayer: null,
    penalty: null,
    hint: null,
    voteComplete: false,
    tie: false,
    finished: false
  });
}

async function finishGame() {
  if (!isHost) return;

  await publishState({
    type: "finish",
    round: currentRound,
    maxRounds,
    usedQuestions,
    scores,
    votes,
    question: currentQuestion,
    resultPlayer,
    penalty: null,
    hint: null,
    finished: true
  });
}

async function restartGame() {
  if (!isHost) return;

  await publishState({
    type: "question",
    round: 1,
    maxRounds,
    usedQuestions: [],
    scores: buildDefaultScores(),
    votes: {},
    question: getRandomQuestionFromUsed([]),
    resultPlayer: null,
    penalty: null,
    hint: null,
    voteComplete: false,
    tie: false,
    finished: false
  });
}

// Classement avec gestion des égalités : même score = même rang (1, 1, 3...).
// "leader" = à égalité en tête avec au moins 1 vote.
function rankPlayers() {
  const sorted = [...players].sort((a, b) => (scores[b.name] || 0) - (scores[a.name] || 0));
  const topScore = scores[sorted[0]?.name] || 0;

  return sorted.map((player, index) => {
    const score = scores[player.name] || 0;
    const firstWithScore = sorted.findIndex(p => (scores[p.name] || 0) === score);
    return {
      player,
      score,
      rank: (index === firstWithScore ? index : firstWithScore) + 1,
      leader: topScore > 0 && score === topScore
    };
  });
}

function joinNames(names) {
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}` : names[0] || "";
}

function renderScores() {
  scoreList.innerHTML = "";

  rankPlayers().forEach(({ player, score, rank, leader }) => {
    const li = document.createElement("li");
    li.classList.toggle("leader", leader);

    li.innerHTML = `<span>${leader ? "👑" : `${rank}.`} ${escapeHtml(player.name)}</span><strong>${escapeHtml(score)}</strong>`;

    scoreList.appendChild(li);
  });
}

function showFinalScreen() {
  const ranking = rankPlayers();
  const leaders = ranking.filter(entry => entry.leader);
  const votesLabel = count => `${count} vote${count > 1 ? "s" : ""}`;

  if (!leaders.length) {
    winnerText.textContent = "🤝 Personne n’a reçu de vote pendant cette partie.";
  } else if (leaders.length === 1) {
    winnerText.textContent = `💀 ${leaders[0].player.name} est la cible officielle de la soirée avec ${votesLabel(leaders[0].score)}.`;
  } else {
    winnerText.textContent = `🤝 Égalité ! ${joinNames(leaders.map(entry => entry.player.name))} se partagent la place de cible officielle avec ${votesLabel(leaders[0].score)} chacun.`;
  }

  finalScores.innerHTML = "";

  ranking.forEach(({ player, score, rank, leader }) => {
    const row = document.createElement("div");
    row.className = "final-score-row";
    row.classList.toggle("leader", leader);
    row.innerHTML = `<span>${rank}. ${escapeHtml(player.name)}</span><strong>${escapeHtml(votesLabel(score))}</strong>`;
    finalScores.appendChild(row);
  });

  endScreen.classList.remove("hidden");
}

nextQuestionBtn.addEventListener("click", goToNextRound);
skipQuestionBtn.addEventListener("click", skipQuestion);
finishGameBtn.addEventListener("click", finishGame);
restartGameBtn.addEventListener("click", restartGame);

async function returnToLobby() {

  if (isHost) {
    try {
      await lobbyWrite(updateDoc(roomRef, {
        gameStarted: false,
        roomStatus: "lobby",
        screen: "lobby",
        activeGame: null,
        gameState: {},
        forceNavigation: { target: "lobby", at: Date.now() }
      }));
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

}

backToLobbyBtn.addEventListener("click", returnToLobby);
finalBackBtn.addEventListener("click", returnToLobby);





initGame();
