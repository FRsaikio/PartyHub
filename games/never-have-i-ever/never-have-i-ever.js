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
const roundBadge = document.getElementById("roundBadge");
const levelBadge = document.getElementById("levelBadge");

const questionCard = document.getElementById("questionCard");
const categoryText = document.getElementById("categoryText");
const questionText = document.getElementById("questionText");
const instructionText = document.getElementById("instructionText");

const didItBtn = document.getElementById("didItBtn");
const safeBtn = document.getElementById("safeBtn");
const nextQuestionBtn = document.getElementById("nextQuestionBtn");

const modeText = document.getElementById("modeText");
const drinkLevelText = document.getElementById("drinkLevelText");
const playersText = document.getElementById("playersText");
const questionCountText = document.getElementById("questionCountText");

const drinkCounter = document.getElementById("drinkCounter");
const safeCounter = document.getElementById("safeCounter");
const historyList = document.getElementById("historyList");
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
const currentPlayer = savedData.currentPlayer || "";
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


let currentQuestion = 1;
let drinkCount = 0;
let safeCount = 0;
let rareCount = 0;
let streakDrink = 0;
let usedQuestions = [];
let history = [];
let answers = {};
let lastActionId = null;
let firstNeverStateChecked = false;

const questions = {
  Chill: [
    "Je n’ai jamais fini une série en une nuit.", 
    "Je n’ai jamais pleuré devant un film d’animation.", 
    "Je n’ai jamais stalké quelqu’un pendant des heures sur les réseaux.", 
    "Je n’ai jamais menti sur mon âge.", 
    "Je n’ai jamais oublié l’anniversaire de ma mère.", 
    "Je n’ai jamais eu de crush sur un personnage fictif.", 
    "Je n’ai jamais mangé une pizza froide le lendemain.", 
    "Je n’ai jamais fait semblant d’aimer un cadeau.", 
    "Je n’ai jamais gardé un objet trouvé sans chercher le proprio.", 
    "Je n’ai jamais fait de liste de résolutions du Nouvel An.", 
    "Je n’ai jamais dormi avec la lumière allumée après 15 ans.", 
    "Je n’ai jamais collectionné des figurines.", 
    "Je n’ai jamais fait du sport juste pour poster des photos.", 
    "Je n’ai jamais cuisiné un vrai repas pour moi seul.", 
    "Je n’ai jamais appris une langue pour impressionner quelqu’un.", 
    "Je n’ai jamais pleuré en écoutant une chanson.", 
    "Je n’ai jamais eu peur du noir après 18 ans.", 
    "Je n’ai jamais envoyé un message d’amour sans l’envoyer.", 
    "Je n’ai jamais fait semblant de connaître un artiste.", 
    "Je n’ai jamais gardé tous mes ex en ami.", 
    "Je n’ai jamais fait une tier list de mes ex.", 
    "Je n’ai jamais parlé tout seul dans la rue.", 
    "Je n’ai jamais collectionné des mugs mignons.", 
    "Je n’ai jamais fait du journaling pendant plus d’une semaine.", 
    "Je n’ai jamais eu peur des araignées.", 
    "Je n’ai jamais dit ‘je vais me coucher tôt’ et fait tout l’inverse.", 
    "Je n’ai jamais eu une playlist ‘sad girl/boy hours’.",
    "Je n’ai jamais fait des recherches Wikipédia à 4h du mat.", 
    "Je n’ai jamais parlé à mes plantes.", 
    "Je n’ai jamais eu 50 onglets ouverts en même temps.", 
    "Je n’ai jamais sauvé des animaux sur Internet sans rien faire.", 
    "Je n’ai jamais fait des siestes de 4 heures.", 
    "Je n’ai jamais ri tout seul avec un meme.", 
    "Je n’ai jamais gardé tous mes tickets de caisse.", 
    "Je n’ai jamais fait des blagues dad.", 
    "Je n’ai jamais eu peur des clowns.", 
    "Je n’ai jamais dit ‘je t’aime’ bourré à mes potes.", 
    "Je n’ai jamais collectionné les Polaroid.", 
    "Je n’ai jamais tenu mes résolutions plus de 3 jours.", 
    "Je n’ai jamais fait des voix bizarres au téléphone.", 
    "Je n’ai jamais collectionné les stickers.", 
    "Je n’ai jamais eu une peur irrationnelle des pigeons.", 
    "Je n’ai jamais parlé en dormant.", 
    "Je n’ai jamais été le plus gentil du groupe.", 
    "Je n’ai jamais fait des selfies avec des inconnus.", 
    "Je n’ai jamais gardé une lettre d’amour.", 
    "Je n’ai jamais googler mes symptômes.", 
    "Je n’ai jamais dit ‘juste un épisode’ et binge-watch.", 
    "Je n’ai jamais fait des voix en message vocal.", 
    "Je n’ai jamais été addict aux stories Instagram.", 
    "Je n’ai jamais fait des listes et rien fait.", 
    "Je n’ai jamais eu un carnet de pensées profondes.", 
    "Je n’ai jamais dansé seul dans ma chambre.", 
    "Je n’ai jamais été le thérapeute du groupe.", 
    "Je n’ai jamais dit ‘je change’ tous les mois.", 
    "Je n’ai jamais eu une playlist pour chaque mood.", 
    "Je n’ai jamais fait des câlins très longs.", 
    "Je n’ai jamais parlé de mes rêves lucides.", 
    "Je n’ai jamais grignoté healthy puis junk food.", 
    "Je n’ai jamais fait des tier lists de mes potes.", 
    "Je n’ai jamais gardé tous mes bracelets brésiliens.", 
    "Je n’ai jamais fait des blagues nulles pour détendre l’atmosphère.", 
    "Je n’ai jamais eu une peur des hauteurs.", 
    "Je n’ai jamais collectionné les hoodies oversize.", 
    "Je n’ai jamais fait des grimaces sur toutes les photos.", 
    "Je n’ai jamais posé des questions existentielles à 3h du mat.", 
    "Je n’ai jamais eu une routine skincare de 12 étapes.", 
    "Je n’ai jamais dit ‘je suis fatigué’ toute la soirée.", 
    "Je n’ai jamais été obsédé par le rangement ASMR.", 
    "Je n’ai jamais fait des DIY complètement ratés.", 
    "Je n’ai jamais chanté en voiture comme une star.", 
    "Je n’ai jamais eu une addiction au café.", 
    "Je n’ai jamais fait des mimes en racontant une histoire.", 
    "Je n’ai jamais eu une chambre qui ressemble à un champ de bataille.", 
    "Je n’ai jamais posé des questions philo bourré.", 
    "Je n’ai jamais collectionné les mugs.", 
    "Je n’ai jamais fait des sons bizarres en mangeant.", 
    "Je n’ai jamais gardé tous mes souvenirs d’enfance.", 
    "Je n’ai jamais dit oui à tout puis regretté.", 
    "Je n’ai jamais été le roi/la reine des memes.", 
    "Je n’ai jamais fait des danses TikTok ratées.", 
    "Je n’ai jamais eu des chaussettes dépareillées.", 
    "Je n’ai jamais blagué sur mon propre malheur.", 
    "Je n’ai jamais eu 10 projets commencés et aucun fini.", 
    "Je n’ai jamais fait des compliments random sincères.", 
    "Je n’ai jamais été toujours en retard avec une bonne excuse.", 
    "Je n’ai jamais fait des jeux de mots pourris.", 
    "Je n’ai jamais parlé en citations de séries.", 
    "Je n’ai jamais eu une opinion sur tout.", 
    "Je n’ai jamais cru aux signes de l’univers.", 
    "Je n’ai jamais raconté mes rêves bizarres à tout le monde.", 
    "Je n’ai jamais chanté sous la douche.", 
    "Je n’ai jamais fait des listes pour tout.", 
    "Je n’ai jamais fini mes phrases par des emojis.", 
    "Je n’ai jamais regardé des mukbangs pour m’endormir.", 
    "Je n’ai jamais dit ‘c’est pas ce que je voulais dire’.", 
    "Je n’ai jamais aimé les dramas des autres.", 
    "Je n’ai jamais fait du journaling.", 
    "Je n’ai jamais parlé à mes plantes.", 
    "Je n’ai jamais sauvé des animaux sur Internet.", 
    "Je n’ai jamais ri tout seul avec un meme.", 
    "Je n’ai jamais gardé tous mes tickets.", 
    "Je n’ai jamais fait des blagues dad.", 
    "Je n’ai jamais eu peur des araignées.", 
    "Je n’ai jamais collectionné les hoodies.", 
    "Je n’ai jamais eu une peluche secrète.", 
    "Je n’ai jamais chanté sous la pluie.", 
    "Je n’ai jamais oublié de manger de la journée.", 
    "Je n’ai jamais fait des câlins à tout le monde.", 
    "Je n’ai jamais eu une routine skincare longue.", 
    "Je n’ai jamais dit ‘je suis fatigué’ toute la soirée.", 
    "Je n’ai jamais fait des grimaces sur les photos.", 
    "Je n’ai jamais posé des questions existentielles.", 
    "Je n’ai jamais eu une playlist sad.", 
    "Je n’ai jamais collectionné les mugs.", 
    "Je n’ai jamais fait des voix aux animaux.", 
    "Je n’ai jamais été toujours en train de grignoter.", 
    "Je n’ai jamais pris des notes sur tout.", 
    "Je n’ai jamais aimé les films d’horreur mais eu peur après.", 
    "Je n’ai jamais parlé en citations.", 
    "Je n’ai jamais eu une opinion sur tout.", 
    "Je n’ai jamais fait des DIY ratés.", 
    "Je n’ai jamais chanté en voiture.", 
    "Je n’ai jamais fait des tier lists.", 
    "Je n’ai jamais gardé mes ex en ami."
  ],

  Party: [
    "Je n’ai jamais vomi dans un Uber.", 
    "Je n’ai jamais fait un striptease raté.", 
    "Je n’ai jamais perdu mon téléphone en soirée.", 
    "Je n’ai jamais embrassé quelqu’un dont je ne connaissais pas le prénom.", 
    "Je n’ai jamais volé une bouteille derrière le bar.", 
    "Je n’ai jamais fait un body shot.", 
    "Je n’ai jamais dansé sur le bar.", 
    "Je n’ai jamais fini à poil dans une piscine.", 
    "Je n’ai jamais ramené quelqu’un sans me souvenir de son visage.", 
    "Je n’ai jamais mixé des alcools interdits.", 
    "Je n’ai jamais fait un shot dans le nombril.", 
    "Je n’ai jamais perdu une chaussure en rentrant.", 
    "Je n’ai jamais crié des confessions sur la voie publique.", 
    "Je n’ai jamais fait un pari cul.", 
    "Je n’ai jamais fini chez un inconnu.", 
    "Je n’ai jamais fait un karaoké bourré.", 
    "Je n’ai jamais volé un panneau de signalisation.", 
    "Je n’ai jamais dormi dans une baignoire.", 
    "Je n’ai jamais fait un french kiss à plusieurs personnes la même nuit.", 
    "Je n’ai jamais pris de drogue pour la première fois en soirée.", 
    "Je n’ai jamais vomi puis continué à boire.", 
    "Je n’ai jamais fait un twerk sur un pote.", 
    "Je n’ai jamais perdu mon portefeuille en soirée.", 
    "Je n’ai jamais fait un shot reverse.", 
    "Je n’ai jamais dansé en slip.", 
    "Je n’ai jamais ramené tout le monde chez moi.", 
    "Je n’ai jamais fait un after jusqu’à 14h.", 
    "Je n’ai jamais fait un limbo avec une bouteille.", 
    "Je n’ai jamais chanté en duo bourré.", 
    "Je n’ai jamais fait un battle de danse.", 
    "Je n’ai jamais fini avec des bisous partout.", 
    "Je n’ai jamais volé des verres.", 
    "Je n’ai jamais fait un toast à n’importe quoi.", 
    "Je n’ai jamais fait un flip cup.", 
    "Je n’ai jamais dansé sur la table basse.", 
    "Je n’ai jamais fait un beer pong raté.", 
    "Je n’ai jamais crié des confessions d’ivrogne.", 
    "Je n’ai jamais perdu mes affaires partout.", 
    "Je n’ai jamais fait un mur de shot.", 
    "Je n’ai jamais dansé avec un inconnu toute la soirée.", 
    "Je n’ai jamais fait un never have I ever sauvage.", 
    "Je n’ai jamais fini la bouteille de vodka.", 
    "Je n’ai jamais chanté du hardstyle bourré.", 
    "Je n’ai jamais ramené quelqu’un dans les toilettes.", 
    "Je n’ai jamais fait un strip poker.", 
    "Je n’ai jamais crié ‘shots shots shots’.", 
    "Je n’ai jamais dansé sur du reggaeton.", 
    "Je n’ai jamais fini avec du maquillage sur le visage.", 
    "Je n’ai jamais fait un challenge TikTok bourré.", 
    "Je n’ai jamais perdu mon Uber.", 
    "Je n’ai jamais mixé Red Bull avec n’importe quoi.", 
    "Je n’ai jamais fait un body shot sur un random.", 
    "Je n’ai jamais chanté en play-back sur du rap.", 
    "Je n’ai jamais fait un conga dans la rue.", 
    "Je n’ai jamais dansé sous la pluie.", 
    "Je n’ai jamais volé un cendrier.", 
    "Je n’ai jamais fait un french kiss à plusieurs.", 
    "Je n’ai jamais crié mon ex sur la piste.", 
    "Je n’ai jamais fait un shot gun.", 
    "Je n’ai jamais dansé en chaussettes.", 
    "Je n’ai jamais ramené tout le groupe à l’after.", 
    "Je n’ai jamais fait un karaoké seul sur scène.", 
    "Je n’ai jamais fini torse nu sur une story.", 
    "Je n’ai jamais fait un défi cul.", 
    "Je n’ai jamais perdu mes lunettes en dansant.", 
    "Je n’ai jamais fait un dab sur une musique triste.", 
    "Je n’ai jamais ramené de la drogue à la soirée.", 
    "Je n’ai jamais fait un striptease sur une table.", 
    "Je n’ai jamais crié ‘je suis la star’.", 
    "Je n’ai jamais dansé avec une lampe.", 
    "Je n’ai jamais fait un battle de twerk.", 
    "Je n’ai jamais fini avec des traces de rouge à lèvres partout.", 
    "Je n’ai jamais fait un train humain.", 
    "Je n’ai jamais volé une bouteille dans un bar.", 
    "Je n’ai jamais fait un french kiss à un pote.", 
    "Je n’ai jamais dansé collé-serré avec tout le monde.", 
    "Je n’ai jamais fait un conga line.", 
    "Je n’ai jamais perdu une chaussure.", 
    "Je n’ai jamais crié des confessions publiques.", 
    "Je n’ai jamais fait un pari cul.", 
    "Je n’ai jamais fini à poil dans une piscine.", 
    "Je n’ai jamais vomi dans un Uber.", 
    "Je n’ai jamais fait un striptease raté.", 
    "Je n’ai jamais embrassé quelqu’un sans connaître son prénom.", 
    "Je n’ai jamais dansé sur le bar.", 
    "Je n’ai jamais volé une bouteille.", 
    "Je n’ai jamais fait un body shot.", 
    "Je n’ai jamais perdu mon téléphone en soirée.", 
    "Je n’ai jamais ramené un inconnu.", 
    "Je n’ai jamais mixé tous les alcools.", 
    "Je n’ai jamais fait un karaoké dramatique.", 
    "Je n’ai jamais fini en string.", 
    "Je n’ai jamais pris des photos de tout le monde bourré.", 
    "Je n’ai jamais perdu mon portefeuille.", 
    "Je n’ai jamais invité des randoms.", 
    "Je n’ai jamais crier des confessions.", 
    "Je n’ai jamais fait un shot dans le nombril.", 
    "Je n’ai jamais dansé sur du son de merde.", 
    "Je n’ai jamais fait un moonwalk raté.", 
    "Je n’ai jamais volé un panneau.", 
    "Je n’ai jamais fait un dab à chaque fois.", 
    "Je n’ai jamais ramener 5 inconnus.", 
    "Je n’ai jamais fait un body shot sur un pote.", 
    "Je n’ai jamais fait un limbo avec une bouteille.", 
    "Je n’ai jamais chanté en duo.", 
    "Je n’ai jamais fait un battle de danse.", 
    "Je n’ai jamais fini avec des bisous partout.", 
    "Je n’ai jamais volé des verres.", 
    "Je n’ai jamais fait un toast à n’importe quoi.", 
    "Je n’ai jamais fait un flip cup.", 
    "Je n’ai jamais dansé sur la table basse.", 
    "Je n’ai jamais fait un beer pong raté.", 
    "Je n’ai jamais crié des confessions d’ivrogne.", 
    "Je n’ai jamais perdu mes affaires partout.", 
    "Je n’ai jamais fait un mur de shot.", 
    "Je n’ai jamais dansé avec un inconnu toute la soirée.", 
    "Je n’ai jamais fini la bouteille de vodka."
  ],


   Chaos: [
    "Je n’ai jamais réveillé tout l’immeuble.", 
    "Je n’ai jamais cassé un truc cher et fui.", 
    "Je n’ai jamais fait un pari qui a fini aux urgences.", 
    "Je n’ai jamais appelé les flics par erreur.", 
    "Je n’ai jamais fui sans payer.", 
    "Je n’ai jamais posté une story ultra gênante bourré.", 
    "Je n’ai jamais fait un tatouage impulsif.", 
    "Je n’ai jamais dormi dans la rue.", 
    "Je n’ai jamais déclenché une bagarre.", 
    "Je n’ai jamais perdu mes chaussures.", 
    "Je n’ai jamais cassé mon téléphone en étant bourré.", 
    "Je n’ai jamais sauté d’un balcon dans une piscine.", 
    "Je n’ai jamais volé dans un magasin pendant une soirée.", 
    "Je n’ai jamais fait un burn out en une nuit.", 
    "Je n’ai jamais couru nu dans la rue.", 
    "Je n’ai jamais vomi sur quelqu’un.", 
    "Je n’ai jamais escaladé un bâtiment.", 
    "Je n’ai jamais fait un feu d’artifice illégal.", 
    "Je n’ai jamais détruit un meuble.", 
    "Je n’ai jamais fait un live complètement détruit.", 
    "Je n’ai jamais cassé une vitre.", 
    "Je n’ai jamais fait un prank dangereux.", 
    "Je n’ai jamais déclenché les pompiers.", 
    "Je n’ai jamais vomi sur le lit.", 
    "Je n’ai jamais posté une vidéo compromettante.", 
    "Je n’ai jamais perdu mes affaires dans la rue.", 
    "Je n’ai jamais crié sur tout le monde.", 
    "Je n’ai jamais fait un pari qui finit aux urgences.", 
    "Je n’ai jamais volé de l’alcool.", 
    "Je n’ai jamais fait un feu dans le salon.", 
    "Je n’ai jamais cassé la télé.", 
    "Je n’ai jamais fait un trou dans le mur.", 
    "Je n’ai jamais fui la police.", 
    "Je n’ai jamais cassé des verres exprès.", 
    "Je n’ai jamais fait un prank téléphonique.", 
    "Je n’ai jamais déclenché une bagarre de groupe.", 
    "Je n’ai jamais vomi dans le frigo.", 
    "Je n’ai jamais cassé une porte.", 
    "Je n’ai jamais fait un live TikTok chaotique.", 
    "Je n’ai jamais détruit la déco.", 
    "Je n’ai jamais hurlé des insultes.", 
    "Je n’ai jamais fait un flip sur un canapé.", 
    "Je n’ai jamais détruit la playlist.", 
    "Je n’ai jamais lancé des objets.", 
    "Je n’ai jamais fait un pari stupide.", 
    "Je n’ai jamais détruit la table basse.", 
    "Je n’ai jamais hurlé des secrets.", 
    "Je n’ai jamais fait un roulé-boulé bourré.", 
    "Je n’ai jamais déclenché un drama familial.", 
    "Je n’ai jamais fait un feu d’artifice intérieur.", 
    "Je n’ai jamais cassé la porte des toilettes.", 
    "Je n’ai jamais fait un saut dans le vide.", 
    "Je n’ai jamais hurlé des insultes racistes.", 
    "Je n’ai jamais fait un prank qui finit mal.", 
    "Je n’ai jamais détruit le canapé.", 
    "Je n’ai jamais fait un feu dans la poubelle.", 
    "Je n’ai jamais cassé une fenêtre.", 
    "Je n’ai jamais déclenché une alarme.", 
    "Je n’ai jamais fait un pari de bouffe extrême.", 
    "Je n’ai jamais fait un striptease sur le balcon.", 
    "Je n’ai jamais cassé des bouteilles.", 
    "Je n’ai jamais hurlé mon amour à 5h du mat.", 
    "Je n’ai jamais fait un mosh pit solo.", 
    "Je n’ai jamais déclenché une guerre de nourriture.", 
    "Je n’ai jamais cassé la table.", 
    "Je n’ai jamais fait un combat de polochons bourré.", 
    "Je n’ai jamais volé dans un magasin.", 
    "Je n’ai jamais dormi dans la rue.", 
    "Je n’ai jamais cassé mon téléphone.", 
    "Je n’ai jamais sauté d’un balcon.", 
    "Je n’ai jamais volé de l’alcool.", 
    "Je n’ai jamais fait un feu illégal.", 
    "Je n’ai jamais détruit un meuble.", 
    "Je n’ai jamais couru nu.", 
    "Je n’ai jamais escaladé un bâtiment.", 
    "Je n’ai jamais vomi sur quelqu’un.", 
    "Je n’ai jamais posté une story gênante.", 
    "Je n’ai jamais déclenché une bagarre.", 
    "Je n’ai jamais fui sans payer.", 
    "Je n’ai jamais cassé une vitre.", 
    "Je n’ai jamais fait un prank dangereux.", 
    "Je n’ai jamais hurlé des insultes.", 
    "Je n’ai jamais fait un feu dans le salon.", 
    "Je n’ai jamais cassé la télé.", 
    "Je n’ai jamais fait un trou dans le mur.", 
    "Je n’ai jamais fui la police.", 
    "Je n’ai jamais cassé des verres exprès.", 
    "Je n’ai jamais fait un prank téléphonique.", 
    "Je n’ai jamais vomi dans le frigo.", 
    "Je n’ai jamais cassé une porte.", 
    "Je n’ai jamais détruit la déco.", 
    "Je n’ai jamais hurlé des secrets.", 
    "Je n’ai jamais fait un roulé-boulé bourré.", 
    "Je n’ai jamais déclenché un drama familial.", 
    "Je n’ai jamais cassé la porte des toilettes.", 
    "Je n’ai jamais fait un saut dans le vide.", 
    "Je n’ai jamais hurlé des insultes racistes.", 
    "Je n’ai jamais détruit le canapé.", 
    "Je n’ai jamais fait un feu dans la poubelle.", 
    "Je n’ai jamais cassé une fenêtre.", 
    "Je n’ai jamais déclenché une alarme.", 
    "Je n’ai jamais fait un striptease sur le balcon.", 
    "Je n’ai jamais cassé des bouteilles.", 
    "Je n’ai jamais hurlé mon amour à 5h.", 
    "Je n’ai jamais fait un mosh pit solo.", 
    "Je n’ai jamais déclenché une guerre de nourriture.", 
    "Je n’ai jamais fait un combat de polochons.", 
    "Je n’ai jamais volé dans un magasin pendant une soirée.", 
    "Je n’ai jamais dormi dans la rue.", 
    "Je n’ai jamais cassé mon téléphone bourré.", 
    "Je n’ai jamais sauté d’un balcon dans une piscine.", 
    "Je n’ai jamais volé dans un magasin.", 
    "Je n’ai jamais fait un burn out en une nuit.", 
    "Je n’ai jamais couru nu dans la rue.", 
    "Je n’ai jamais vomi sur quelqu’un.", 
    "Je n’ai jamais escaladé un bâtiment.", 
    "Je n’ai jamais fait un feu d’artifice illégal.", 
    "Je n’ai jamais détruit un meuble.", 
    "Je n’ai jamais fait un live complètement détruit."
  ],

    Hardcore: [
    "Je n’ai jamais dit de trucs racistes après avoir bu.",
    "Je n’ai jamais été homophobe en public tout en étant attiré par le même sexe.",
    "Je n’ai jamais utilisé le mot en N ou des insultes racistes en soirée.",
    "Je n’ai jamais eu de pensées racistes que je n’oserais jamais dire.",
    "Je n’ai jamais refoulé mon homosexualité ou bisexualité.",
    "Je n’ai jamais dit ‘c’est pas gay si je suis bourré’.",
    "Je n’ai jamais eu un crush sur quelqu’un du même sexe.",
    "Je n’ai jamais fantasmé sur un pote.",
    "Je n’ai jamais fait semblant d’être straight devant ma famille.",
    "Je n’ai jamais eu peur que mes parents découvrent mes DMs.",
    "Je n’ai jamais menti sur mon orientation sexuelle.",
    "Je n’ai jamais regardé du porno gay tout en étant hétéro.",
    "Je n’ai jamais eu un crush sur un prof.",
    "Je n’ai jamais eu un crush sur le partenaire de mon pote.",
    "Je n’ai jamais eu un crush sur le frère ou la sœur d’un pote.",
    "Je n’ai jamais stalké mon ex pendant des heures.",
    "Je n’ai jamais stalké le crush de mon pote.",
    "Je n’ai jamais liké un post vieux de plusieurs années par accident.",
    "Je n’ai jamais eu peur que quelqu’un fouille mon téléphone.",
    "Je n’ai jamais envoyé un message à la mauvaise personne.",
    "Je n’ai jamais dit je t’aime bourré à la mauvaise personne.",
    "Je n’ai jamais regretté une soirée entière.",
    "Je n’ai jamais eu un fantasme que je ne pourrai jamais assumer.",
    "Je n’ai jamais envoyé un message que je regrette encore aujourd’hui.",
    "Je n’ai jamais eu une phase que je nierai jusqu’à ma mort.",
    "Je n’ai jamais eu une conversation impossible à défendre publiquement.",
    "Je n’ai jamais fait semblant d’être sobre devant mes parents.",
    "Je n’ai jamais pleuré bourré devant tout le monde.",
    "Je n’ai jamais dit des secrets que je n’aurais jamais dû dire.",
    "Je n’ai jamais ghosté quelqu’un.",
    "Je n’ai jamais été ghosté après avoir beaucoup parlé.",
    "Je n’ai jamais menti sur mon âge sur les réseaux ou les apps.",
    "Je n’ai jamais eu un compte fake ou finsta.",
    "Je n’ai jamais parlé mal de quelqu’un puis fait genre rien.",
    "Je n’ai jamais trahi un secret d’un pote.",
    "Je n’ai jamais fait semblant d’aimer quelque chose pour plaire.",
    "Je n’ai jamais eu un crush sur quelqu’un ici présent.",
    "Je n’ai jamais dragué quelqu’un alors que j’étais en couple.",
    "Je n’ai jamais eu de situationship toxique.",
    "Je n’ai jamais été bloqué par quelqu’un.",
    "Je n’ai jamais bloqué quelqu’un par jalousie.",
    "Je n’ai jamais menti sur mon nombre de relations.",
    "Je n’ai jamais fait semblant d’avoir de l’expérience.",
    "Je n’ai jamais dit des trucs chelous en étant bourré.",
    "Je n’ai jamais fini bourré en premier dans une soirée.",
    "Je n’ai jamais vomi en soirée.",
    "Je n’ai jamais perdu mon téléphone ou mes affaires bourré.",
    "Je n’ai jamais ramené quelqu’un dont je ne me souviens plus.",
    "Je n’ai jamais embrassé quelqu’un par défi.",
    "Je n’ai jamais fait un french kiss à un pote.",
    "Je n’ai jamais dansé collé-serré avec un inconnu.",
    "Je n’ai jamais fait un pari stupide bourré.",
    "Je n’ai jamais fini à poil par accident ou par défi.",
    "Je n’ai jamais dragué quelqu’un de beaucoup plus vieux.",
    "Je n’ai jamais eu de date catastrophique.",
    "Je n’ai jamais été pris en flag en train de mater quelqu’un.",
    "Je n’ai jamais eu un rendez-vous qui s’est fini hyper mal.",
    "Je n’ai jamais dit je t’aime trop tôt.",
    "Je n’ai jamais eu de relation à distance cheloue.",
    "Je n’ai jamais fait du sexting pendant un cours.",
    "Je n’ai jamais eu peur que mes parents voient mes messages.",
    "Je n’ai jamais liké un post de mon ex par accident.",
    "Je n’ai jamais eu un crush sur un influenceur.",
    "Je n’ai jamais fait semblant d’être vierge.",
    "Je n’ai jamais été le dernier vierge du groupe.",
    "Je n’ai jamais eu un crush sur le meilleur ami de mon ex.",
    "Je n’ai jamais dit un secret en étant bourré.",
    "Je n’ai jamais été humilié publiquement.",
    "Je n’ai jamais eu un kink que j’oserais jamais avouer.",
    "Je n’ai jamais regretté d’avoir ajouté quelqu’un sur Snap.",
    "Je n’ai jamais eu une conversation super gênante par message.",
    "Je n’ai jamais regretté mon premier baiser.",
    "Je n’ai jamais eu de feelings pour un pote hétéro.",
    "Je n’ai jamais fait semblant d’être intéressé juste pour l’attention.",
    "Je n’ai jamais eu un ex qui me harcèle encore.",
    "Je n’ai jamais eu peur d’attraper une IST.",
    "Je n’ai jamais fait de comparaison de corps.",
    "Je n’ai jamais eu un crush sur quelqu’un de ma promo.",
    "Je n’ai jamais été obsédé par quelqu’un.",
    "Je n’ai jamais eu peur que toute ma vie sorte au grand jour.",
    "Je n’ai jamais dit des trucs homophobes puis regretté.",
    "Je n’ai jamais eu de phase où je mentais sur tout.",
    "Je n’ai jamais fait semblant d’aimer un style de musique.",
    "Je n’ai jamais copié quelqu’un pour être accepté.",
    "Je n’ai jamais eu un compte privé pour espionner.",
    "Je n’ai jamais jugé quelqu’un puis fait pareil.",
    "Je n’ai jamais eu peur d’être jugé pour mes goûts.",
    "Je n’ai jamais fait du mal à quelqu’un par jalousie.",
    "Je n’ai jamais eu un énorme regret de message vocal.",
    "Je n’ai jamais fini la soirée à pleurer dans un coin.",
    "Je n’ai jamais inventé une vie parfaite sur les réseaux.",
    "Je n’ai jamais eu un crush sur un streamer.",
    "Je n’ai jamais fait semblant de connaître une personne célèbre.",
    "Je n’ai jamais eu honte de mes parents devant mes potes.",
    "Je n’ai jamais volé quelque chose de petit.",
    "Je n’ai jamais fait semblant d’avoir vu un film ou une série.",
    "Je n’ai jamais menti sur mes notes.",
    "Je n’ai jamais triché à un examen.",
    "Je n’ai jamais eu peur d’être le moins expérimenté du groupe.",
    "Je n’ai jamais fait un pari que j’ai regretté.",
    "Je n’ai jamais eu un secret de famille gênant.",
    "Je n’ai jamais eu peur que mes potes se moquent de moi.",
    "Je n’ai jamais dit du mal de tout le groupe puis fait genre rien.",
    "Je n’ai jamais eu un énorme crush non réciproque.",
    "Je n’ai jamais été rejeté de façon humiliante.",
    "Je n’ai jamais eu peur d’être le plus immature du groupe.",
    "Je n’ai jamais fait semblant d’être cool avec quelque chose qui me touche.",
    "Je n’ai jamais eu un moment ultra cringe sur les réseaux.",
    "Je n’ai jamais regretté mon style vestimentaire d’avant.",
    "Je n’ai jamais eu peur d’être le seul puceau du groupe.",
    "Je n’ai jamais fait semblant d’avoir déjà couché.",
    "Je n’ai jamais eu un crush sur quelqu’un d’inaccessible.",
    "Je n’ai jamais été super jaloux d’un pote.",
    "Je n’ai jamais eu peur que tout le monde me juge.",
    "Je n’ai jamais dit oui à un truc pour ne pas passer pour un trouillard."
  ]
};

const rareQuestions = {
  Chill: [
    "QUESTION RARE 😇 : Je n’ai jamais eu un crush secret ridicule.",
    "QUESTION RARE 😇 : Je n’ai jamais fait semblant de ne pas voir quelqu’un.",
    "QUESTION RARE 😇 : Je n’ai jamais menti pour éviter un appel."
  ],
  Party: [
    "QUESTION RARE 🍻 : Je n’ai jamais embrassé quelqu’un en soirée.",
    "QUESTION RARE 🍻 : Je n’ai jamais regretté un message envoyé bourré.",
    "QUESTION RARE 🍻 : Je n’ai jamais flirté juste parce que j’avais bu."
  ],
  Chaos: [
    "QUESTION INTERDITE 💀 : Je n’ai jamais menti à quelqu’un présent ici.",
    "QUESTION INTERDITE 💀 : Je n’ai jamais eu un secret sur quelqu’un du groupe.",
    "QUESTION INTERDITE 💀 : Je n’ai jamais envoyé un message que je cache encore."
  ],
  Hardcore: [
    "QUESTION LÉGENDAIRE ☠️ : Je n’ai jamais été la pire version de moi-même en soirée.",
    "QUESTION LÉGENDAIRE ☠️ : Je n’ai jamais fait quelque chose que je nierai toujours.",
    "QUESTION LÉGENDAIRE ☠️ : Je n’ai jamais été sauvé par un pote après une énorme erreur."
  ]
};

const alcoholPunishments = {
  soft: [
    "Ceux qui l’ont déjà fait boivent 1 gorgée 🍺.",
    "Ceux qui l’ont déjà fait boivent 2 gorgées 🍺.",
    "Ceux qui l’ont déjà fait distribuent 1 gorgée.",
    "Ceux qui l’ont déjà fait font un mini-gage 😇.",
    "Ceux qui l’ont déjà fait doivent boire 1 shot.",
    "Ceux qui l’ont déjà fait doivent boire 2 gorgées de ton verre actuel.",
    "Ceux qui l’ont déjà fait doivent boire 3 gorgées.",
    "Ceux qui l’ont déjà fait doivent choisir quelqu’un qui boit un shot avec toi.",
    "Ceux qui l’ont déjà fait doivent boire un shot de bière.",
    "Ceux qui l’ont déjà fait doivent boire un mélange que le groupe te prépare (petit).",
    "Ceux qui l’ont déjà fait doivent boire ton verre avec la main non dominante.",
    "Ceux qui l’ont déjà fait doivent boire en regardant quelqu’un dans les yeux.",
    "Ceux qui l’ont déjà fait doivent faire un shot inversé.",
    "Ceux qui l’ont déjà fait doivent boire une gorgée de chaque verre sur la table.",
  ],
  normal: [
    "Ceux qui l’ont déjà fait boivent 3 gorgées 🍻.",
    "Ceux qui l’ont déjà fait boivent 4 gorgées 🍻.",
    "Ceux qui l’ont déjà fait prennent un shot soft 🥃.",
    "Ceux qui l’ont déjà fait font un mini cul-sec 🍺.",
    "Ceux qui l’ont déjà fait lancent un waterfall 4 secondes 🌊.",
    "Ceux qui l’ont déjà fait doivent boire un cul sec de bière.",
    "Ceux qui l’ont déjà fait doivent boire 2 shots d’affilée.",
    "Ceux qui l’ont déjà fait doivent boire un grand verre d’alcool mélangé.",
    "Ceux qui l’ont déjà fait doivent boire un shot préparé par la personne à ta gauche.",
    "Ceux qui l’ont déjà fait doivent boire un shot préparé par la personne à ta droite.",
    "Ceux qui l’ont déjà fait doivent boire un Verre de la Honte : tout le monde verse un peu dedans.",
    "Ceux qui l’ont déjà fait doivent boire 4 gorgées d’affilée.",
    "Ceux qui l’ont déjà fait doivent boire sans utiliser tes mains avec une paille ou directement.",
    "Ceux qui l’ont déjà fait doivent faire un shot dans le nombril de quelqu’un ou se le faire faire.",
    "Ceux qui l’ont déjà fait doivent boire un shot à chaque fois que quelqu’un dit un mot interdit pendant 2 tours.",
    "Ceux qui l’ont déjà fait doivent le Serpent : tu bois une gorgée à chaque question/réponse jusqu’à ce que quelqu’un d’autre perde.",
    "Ceux qui l’ont déjà fait doivent cascade : tout le monde boit en même temps que toi jusqu’à ce que tu arrêtes.",
    "Ceux qui l’ont déjà fait doivent punition Double : tu bois 2 shots et tu choisis qui boit avec toi.",
    "Ceux qui l’ont déjà fait doivent le Dernier Verre : tu finis entièrement ton verre actuel.",
    "Ceux qui l’ont déjà fait doivent alcool Roulette : tu tournes une bouteille, la personne visée boit avec toi.",
    "Ceux qui l’ont déjà fait doivent verre sans fond : tu dois toujours avoir ton verre plein pendant 3 tours.",
    "Ceux qui l’ont déjà fait doivent shot ou Vérité : tu choisis entre boire 2 shots ou répondre à une question très gênante.",
  ],
  hard: [
    "Ceux qui l’ont déjà fait prennent un shot complet 🥃.",
    "Ceux qui l’ont déjà fait font un cul sec 🍺.",
    "Ceux qui l’ont déjà fait boivent 5 gorgées 💀.",
    "Ceux qui l’ont déjà fait font un waterfall 7 secondes 🌊.",
    "Ceux qui l’ont déjà fait choisissent entre shot ou vérité gênante.",
    "Ceux qui l’ont déjà fait doivent boire 3 shots d’affilée.",
    "Ceux qui l’ont déjà fait doivent boire un cul sec de spiritueux.",
    "Ceux qui l’ont déjà fait doivent boire un grand verre entier en moins de 45 secondes.",
    "Ceux qui l’ont déjà fait doivent boire 2 verres d’affilée.",
    "Ceux qui l’ont déjà fait doivent boire un mélange créé par tout le groupe.",
    "Ceux qui l’ont déjà fait doivent tour du Monde : boire une gorgée de 5 verres différents.",
    "Ceux qui l’ont déjà fait doivent boire sans respirer entre chaque gorgée jusqu’à 5 gorgées.",
    "Ceux qui l’ont déjà fait doivent boire un shot toutes les 2 minutes pendant 10 minutes.",
    "Ceux qui l’ont déjà fait doivent boire un Shot de la Mort très fort ou très bizarre.",
    "Ceux qui l’ont déjà fait doivent être Roi/Reine du Shot pendant 3 tours : tu dois servir un shot à chaque personne qui perd.",
    "Ceux qui l’ont déjà fait doivent le Serpent : tu bois une gorgée à chaque question/réponse jusqu’à ce que quelqu’un d’autre perde.",
    "Ceux qui l’ont déjà fait doivent cascade : tout le monde boit en même temps que toi jusqu’à ce que tu arrêtes.",
    "Ceux qui l’ont déjà fait doivent punition Double : tu bois 2 shots et tu choisis qui boit avec toi.",
    "Ceux qui l’ont déjà fait doivent le Dernier Verre : tu finis entièrement ton verre actuel.",
    "Ceux qui l’ont déjà fait doivent alcool Roulette : tu tournes une bouteille, la personne visée boit avec toi.",
    "Ceux qui l’ont déjà fait doivent verre sans fond : tu dois toujours avoir ton verre plein pendant 3 tours.",
    "Ceux qui l’ont déjà fait doivent shot ou Vérité : tu choisis entre boire 2 shots ou répondre à une question très gênante.",
  ],
  danger: [
    "Ceux qui l’ont déjà fait prennent un DOUBLE SHOT ☠️.",
    "Ceux qui l’ont déjà fait font un CUL SEC COMPLET 💀.",
    "Ceux qui l’ont déjà fait prennent un shot mystère 🎲.",
    "Ceux qui l’ont déjà fait font un waterfall 10 secondes 🌊.",
    "Ceux qui l’ont déjà fait subissent une sanction choisie par le groupe.",
    "Ceux qui l’ont déjà fait doivent boire 3 shots d’affilée.",
    "Ceux qui l’ont déjà fait doivent boire un cul sec de spiritueux.",
    "Ceux qui l’ont déjà fait doivent boire un grand verre entier en moins de 45 secondes.",
    "Ceux qui l’ont déjà fait doivent boire 2 verres d’affilée.",
    "Ceux qui l’ont déjà fait doivent boire un mélange créé par tout le groupe.",
    "Ceux qui l’ont déjà fait doivent tour du Monde : boire une gorgée de 5 verres différents.",
    "Ceux qui l’ont déjà fait doivent boire sans respirer entre chaque gorgée jusqu’à 5 gorgées.",
    "Ceux qui l’ont déjà fait doivent boire un shot toutes les 2 minutes pendant 10 minutes.",
    "Ceux qui l’ont déjà fait doivent boire un Shot de la Mort très fort ou très bizarre.",
    "Ceux qui l’ont déjà fait doivent être Roi/Reine du Shot pendant 3 tours : tu dois servir un shot à chaque personne qui perd.",
    "Ceux qui l’ont déjà fait doivent le Serpent : tu bois une gorgée à chaque question/réponse jusqu’à ce que quelqu’un d’autre perde.",
    "Ceux qui l’ont déjà fait doivent cascade : tout le monde boit en même temps que toi jusqu’à ce que tu arrêtes.",
    "Ceux qui l’ont déjà fait doivent punition Double : tu bois 2 shots et tu choisis qui boit avec toi.",
    "Ceux qui l’ont déjà fait doivent le Dernier Verre : tu finis entièrement ton verre actuel.",
    "Ceux qui l’ont déjà fait doivent alcool Roulette : tu tournes une bouteille, la personne visée boit avec toi.",
    "Ceux qui l’ont déjà fait doivent verre sans fond : tu dois toujours avoir ton verre plein pendant 3 tours.",
    "Ceux qui l’ont déjà fait doivent shot ou Vérité : tu choisis entre boire 2 shots ou répondre à une question très gênante.",
    "Ceux qui l’ont déjà fait doivent boire un cul sec de bière.",
    "Ceux qui l’ont déjà fait doivent boire 2 shots d’affilée.",
    "Ceux qui l’ont déjà fait doivent boire un grand verre d’alcool mélangé.",
    "Ceux qui l’ont déjà fait doivent boire un shot préparé par la personne à ta gauche.",
    "Ceux qui l’ont déjà fait doivent boire un shot préparé par la personne à ta droite.",
    "Ceux qui l’ont déjà fait doivent boire un Verre de la Honte : tout le monde verse un peu dedans.",
    "Ceux qui l’ont déjà fait doivent boire 4 gorgées d’affilée.",
    "Ceux qui l’ont déjà fait doivent boire sans utiliser tes mains avec une paille ou directement.",
    "Ceux qui l’ont déjà fait doivent faire un shot dans le nombril de quelqu’un ou se le faire faire.",
    "Ceux qui l’ont déjà fait doivent boire un shot à chaque fois que quelqu’un dit un mot interdit pendant 2 tours.",
  ],
};

const bonusReveals = {
  did: {
    soft: [
      "💀 Le groupe veut les détails.",
      "🍺 Bois 1 gorgée bonus si c’est récent.",
      "😈 Choisis quelqu’un qui fait un mini-gage avec toi.",
      "👀 Raconte l’histoire ou bois 1 gorgée."
    ],
    normal: [
      "💀 Le groupe veut les détails.",
      "🍻 Bois 2 gorgées bonus si c’est récent.",
      "😈 Choisis quelqu’un qui boit avec toi.",
      "👀 Raconte l’histoire ou bois encore.",
      "🎯 Si quelqu’un ici était impliqué, vous buvez tous les deux."
    ],
    hard: [
      "🔥 Raconte l’histoire ou prends un shot.",
      "⚡ Si c’était cette année, double peine.",
      "☠️ Si tu refuses de raconter, shot ou vérité hardcore.",
      "🎯 Choisis quelqu’un qui boit avec toi 3 gorgées.",
      "💀 Le groupe peut poser une question obligatoire."
    ],
    danger: [
      "☠️ Raconte l’histoire ou DOUBLE SHOT.",
      "💀 Si quelqu’un ici était impliqué, vous prenez tous les deux un shot.",
      "🔥 Si tu refuses de répondre, cul sec ou sanction du groupe.",
      "🎲 Shot mystère si l’histoire date de moins d’un an.",
      "🩸 Le groupe choisit une question hardcore."
    ]
  },
  safe: [
    "😇 Trop sage pour cette question.",
    "🛡️ Safe, tu peux choisir quelqu’un qui boit.",
    "👑 Immunité morale pour ce tour.",
    "✨ Tu esquives le chaos.",
    "🎲 Tu peux forcer quelqu’un à répondre honnêtement.",
    "🍀 Coup de chance.",
    "🧊 Sang-froid validé.",
    "😂 Le groupe ne te croit pas forcément."
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

  if (players.length < 2) {
    questionText.textContent = "Ajoute au moins 2 joueurs pour jouer.";
    didItBtn.disabled = true;
    safeBtn.disabled = true;
    nextQuestionBtn.disabled = true;
    return;
  }

  if (!isHost) {
    nextQuestionBtn.disabled = true;
    nextQuestionBtn.textContent = "Attente du host";
  }

  listenToNeverState();

  if (isHost) {
    publishQuestionState(1, [], {}, [], 0, 0, 0);
  } else {
    setTimeout(async () => {
      if (!firstNeverStateChecked) {
        const fresh = await getDoc(roomRef);
        if (fresh.exists() && !fresh.data().neverHaveIEverState) {
          await publishQuestionState(1, [], {}, [], 0, 0, 0);
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

function getQuestionPool() {
  return questions[selectedPartyMode] || questions.Party;
}

function buildQuestion(currentUsed) {
  const rareRoll = Math.random();

  if (rareRoll < 0.08) {
    const rarePool = rareQuestions[selectedPartyMode] || rareQuestions.Party;
    return {
      text: rarePool[Math.floor(Math.random() * rarePool.length)],
      rare: true,
      usedQuestions: currentUsed
    };
  }

  const pool = getQuestionPool();
  let nextUsed = [...currentUsed];

  if (nextUsed.length >= pool.length) {
    nextUsed = [];
  }

  let question;

  do {
    question = pool[Math.floor(Math.random() * pool.length)];
  } while (nextUsed.includes(question));

  nextUsed.push(question);

  return {
    text: question,
    rare: false,
    usedQuestions: nextUsed
  };
}

function getInstruction() {
  if (!alcoholMode) {
    const softGages = [
      "Ceux qui l’ont déjà fait font un mini-gage.",
      "Ceux qui l’ont déjà fait racontent une vérité.",
      "Ceux qui l’ont déjà fait font une imitation.",
      "Ceux qui l’ont déjà fait se font poser une question par le groupe."
    ];

    return softGages[Math.floor(Math.random() * softGages.length)];
  }

  const pool = alcoholPunishments[drinkLevel] || alcoholPunishments.normal;
  return pool[Math.floor(Math.random() * pool.length)];
}

function getCategoryLabel() {
  if (selectedPartyMode === "Chill") return "😇 Chill";
  if (selectedPartyMode === "Party") return "🍻 Party";
  if (selectedPartyMode === "Chaos") return "💀 Chaos";
  if (selectedPartyMode === "Hardcore") return "☠️ Hardcore";
  return "🥂 Question";
}

function getBonusReveal(type) {
  if (type === "safe") {
    const pool = bonusReveals.safe;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  const pool = bonusReveals.did[drinkLevel] || bonusReveals.did.normal;
  return pool[Math.floor(Math.random() * pool.length)];
}

async function publishState(state) {
  await updateDoc(roomRef, {
    neverHaveIEverState: {
      actionId: Date.now(),
      ...state
    }
  });
}

async function publishQuestionState(number, currentUsed, currentAnswers, currentHistory, drinks, safes, streak) {
  const question = buildQuestion(currentUsed);

  await publishState({
    type: "question",
    number,
    questionText: question.text,
    instruction: getInstruction(),
    category: getCategoryLabel(),
    rare: question.rare,
    usedQuestions: question.usedQuestions,
    answers: currentAnswers,
    history: currentHistory,
    drinkCount: drinks,
    safeCount: safes,
    streakDrink: streak,
    rareCount: question.rare ? rareCount + 1 : rareCount
  });
}

function listenToNeverState() {
  onSnapshot(roomRef, snapshot => {
    if (!snapshot.exists()) return;

    const data = snapshot.data();

    if (handleGlobalLobbyReturn(data)) return;

    const state = data.neverHaveIEverState;

    if (!state) return;
    firstNeverStateChecked = true;
    if (state.actionId === lastActionId) return;

    lastActionId = state.actionId;
    applyState(state);
  });
}

function applyState(state) {
  currentQuestion = state.number || 1;
  usedQuestions = state.usedQuestions || [];
  history = state.history || [];
  answers = state.answers || {};
  drinkCount = state.drinkCount || 0;
  safeCount = state.safeCount || 0;
  streakDrink = state.streakDrink || 0;
  rareCount = state.rareCount || 0;

  questionCard.classList.remove("drink", "safe", "transition-card", "rare-question");

  if (state.rare) {
    questionCard.classList.add("rare-question");
    document.body.classList.add("screen-shake");

    setTimeout(() => {
      document.body.classList.remove("screen-shake");
    }, 450);
  }

  roundBadge.textContent = `Question ${currentQuestion}`;
  questionCountText.textContent = currentQuestion;
  categoryText.textContent = state.category || getCategoryLabel();
  questionText.textContent = state.questionText || "";
  instructionText.textContent = state.instruction || "";

  drinkCounter.textContent = drinkCount;
  safeCounter.textContent = safeCount;

  renderHistory();
  updateAnswerButtons();

  questionCard.classList.add("transition-card");

  setTimeout(() => {
    questionCard.classList.remove("transition-card");
  }, 450);
}

function updateAnswerButtons() {
  const alreadyAnswered = !!answers[currentPlayer];

  didItBtn.disabled = alreadyAnswered;
  safeBtn.disabled = alreadyAnswered;

  if (alreadyAnswered) {
    if (answers[currentPlayer].type === "did") {
      questionCard.classList.add("drink");
    } else {
      questionCard.classList.add("safe");
    }
  }
}

async function answerQuestion(type) {
  if (answers[currentPlayer]) return;

  const bonus = getBonusReveal(type);

  const nextAnswers = {
    ...answers,
    [currentPlayer]: {
      type,
      bonus
    }
  };

  const nextDrinkCount = type === "did" ? drinkCount + 1 : drinkCount;
  const nextSafeCount = type === "safe" ? safeCount + 1 : safeCount;
  const nextStreak = type === "did" ? streakDrink + 1 : 0;

  const status = type === "did" ? "🍻 Déjà fait" : "😇 Jamais";

  let finalBonus = bonus;

  if (type === "did" && nextStreak >= 3) {
    finalBonus = `🔥 STREAK x${nextStreak} — ${bonus}`;
  }

  const nextHistory = [
    `#${currentQuestion} — ${currentPlayer} — ${status} — ${finalBonus}`,
    ...history
  ].slice(0, 7);

  await publishState({
    type: "answer",
    number: currentQuestion,
    questionText: questionText.textContent,
    instruction: finalBonus,
    category: categoryText.textContent,
    rare: questionCard.classList.contains("rare-question"),
    usedQuestions,
    answers: nextAnswers,
    history: nextHistory,
    drinkCount: nextDrinkCount,
    safeCount: nextSafeCount,
    streakDrink: nextStreak,
    rareCount
  });

  if (type === "did") {
    launchConfetti(nextStreak >= 3 ? 45 : 25);
  }
}

async function nextQuestion() {
  if (!isHost) return;

  await publishQuestionState(
    currentQuestion + 1,
    usedQuestions,
    {},
    history,
    drinkCount,
    safeCount,
    streakDrink
  );
}

function renderHistory() {
  historyList.innerHTML = "";

  history.forEach(item => {
    const li = document.createElement("li");
    li.textContent = item;
    historyList.appendChild(li);
  });
}

function launchConfetti(power = 25) {
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

didItBtn.addEventListener("click", () => answerQuestion("did"));
safeBtn.addEventListener("click", () => answerQuestion("safe"));
nextQuestionBtn.addEventListener("click", nextQuestion);


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