// Catalogue commun des punitions de PartyHub (tous les jeux piochent ici).
//
// Rangé selon le « Niveau alcool » du lobby : soft / normal / hard / extreme (« danger » =
// ancien nom d'extreme). Quand l'alcool est activé, ~3 punitions sur 4 font boire (seul, avec
// un complice ou en duel) et ~1 sur 4 est un gage ou une règle temporaire. Alcool désactivé :
// uniquement des gages, duels et règles sans alcool.
//
// Garde-fous : rien qui s'enchaîne dans le temps (« un shot toutes les 2 minutes »), pas plus
// de 2 shots ou d'un cul sec d'un coup, pas de verre de spiritueux. Les textes sont au « tu »
// (s'adressent à celui qui prend la punition) ; forGroup() les adapte à un groupe.

export const LEVELS = ["soft", "normal", "hard", "extreme"];
export const normalizeLevel = level => (level === "danger" ? "extreme" : LEVELS.includes(level) ? level : "normal");

// Gorgées « de base » d'un niveau, et la grosse punition du niveau.
const SIPS = { soft: 1, normal: 2, hard: 3, extreme: 4 };
const BIG = { soft: "3 gorgées", normal: "5 gorgées", hard: "un shot", extreme: "2 shots" };
const plural = n => `${n} gorgée${n > 1 ? "s" : ""}`;

// ---------- Boire seul ----------

const DRINK = {
  soft: [
    "Bois 1 gorgée 🍺",
    "Bois 2 gorgées 🍺",
    "Bois 2 gorgées sans les mains (paille autorisée) 🥤",
    "Distribue 2 gorgées comme tu veux 🫵",
    "Bois 1 gorgée et distribues-en 1 🍺",
    "Bois 1 gorgée en regardant quelqu'un dans les yeux 👀",
    "Bois 2 gorgées avec ta main faible 🍺",
    "Trinque avec tout le monde et bois 1 gorgée 🥂",
    "Distribue 3 gorgées, maximum 1 par personne 🫵",
    "Bois 2 gorgées… ou fais boire 1 gorgée à chacun de tes voisins 😈",
    "Bois 1 gorgée et choisis la musique suivante 🎵"
  ],
  normal: [
    "Bois 3 gorgées 🍻",
    "Bois 4 gorgées 🍻",
    "Bois 2 gorgées et distribues-en 2 🍻",
    "Distribue 4 gorgées comme tu veux 🫵",
    "Bois 3 gorgées sans les mains 🥤",
    "Waterfall de 4 secondes avec ton voisin de gauche 🌊",
    "Bois autant de gorgées que de personnes qui portent du noir (max 5) 🖤",
    "Bois 3 gorgées, ou 5 si tu as ri pendant ce tour 😂",
    "Pierre-feuille-ciseaux contre la personne de ton choix : le perdant boit 4 gorgées ✂️",
    "Bois 2 gorgées et invente une règle jusqu'à ton prochain tour 📜",
    "Mini cul sec : un quart de ton verre 🍺",
    "Bois 3 gorgées et choisis qui boit 1 gorgée avec toi 🤝",
    "Distribue 5 gorgées, mais tu ne peux pas en donner à la même personne deux fois 🫵",
    "Bois 4 gorgées… sauf si quelqu'un accepte d'en boire 2 à ta place 🙏"
  ],
  hard: [
    "Bois 5 gorgées 💀",
    "Bois 6 gorgées 💀",
    "Prends un shot 🥃",
    "Cul sec de la moitié de ton verre 🍺",
    "Bois 4 gorgées et distribues-en 4 🔥",
    "Waterfall de 7 secondes, tout le monde suit 🌊",
    "Shot… ou 6 gorgées, à toi de voir 🥃",
    "Distribue 8 gorgées comme tu veux 🫵",
    "Bois 5 gorgées sans les mains 🥤",
    "Shot ou vérité gênante choisie par le groupe 🥃",
    "Bois 4 gorgées, et ton voisin de droite aussi (solidarité) 🤝",
    "Le groupe vote : shot pour toi ou 2 gorgées pour tout le monde 🗳️",
    "Bois 5 gorgées en tenant ton verre avec deux doigts 🤏"
  ],
  extreme: [
    "Cul sec de ton verre 💀",
    "Prends 2 shots ☠️",
    "Prends un shot et distribue-en un 🥃",
    "Shot + 4 gorgées 🔥",
    "Waterfall de 10 secondes, tout le monde suit 🌊",
    "Bois 8 gorgées 💀",
    "Shot mystère : le groupe choisit ce qu'il y a dedans (sans mélange douteux) 🎲",
    "Distribue 2 shots à qui tu veux ☠️",
    "Cul sec de ton verre… ou 2 shots, à toi de voir 💀",
    "Le groupe choisit ta punition parmi : shot, cul sec, 8 gorgées 🗳️",
    "Shot les yeux bandés, servi par ton voisin de gauche 🙈",
    "Double peine : shot pour toi ET pour la personne de ton choix ☠️"
  ]
};

// ---------- Boire avec un complice ----------

const DUO = {
  soft: [
    "Choisis quelqu'un qui boit 1 gorgée avec toi 🤝",
    "Toi et ton voisin de droite buvez 1 gorgée en vous tenant le bras 🤝",
    "Choisis un complice : vous trinquez et buvez 2 gorgées chacun 🥂"
  ],
  normal: [
    "Choisis quelqu'un qui boit 3 gorgées avec toi 🤝",
    "Bras dessus bras dessous avec la personne de ton choix : 3 gorgées chacun 🤝",
    "Toi et tes deux voisins buvez 2 gorgées 🤝",
    "Choisis ton binôme : jusqu'à la fin du tour suivant, il boit chaque fois que tu bois 🔗"
  ],
  hard: [
    "Choisis quelqu'un : vous prenez un shot ensemble 🥃",
    "Toi et ton binôme buvez 5 gorgées bras dessus bras dessous 🤝",
    "Choisis un complice : vous videz chacun la moitié de votre verre 🍺",
    "Jusqu'à ton prochain tour, ton binôme boit chaque fois que tu bois 🔗"
  ],
  extreme: [
    "Choisis quelqu'un : cul sec ensemble 💀",
    "Toi et la personne de ton choix prenez 2 shots ☠️",
    "Toi et tes deux voisins prenez un shot ensemble 🥃",
    "Jusqu'à ton prochain tour, ton binôme boit chaque fois que tu bois, en double 🔗"
  ]
};

// ---------- Duels (le perdant boit / prend un gage) ----------

const DUELS = [
  "Duel de pouce avec la personne de ton choix 👍",
  "Pierre-feuille-ciseaux en 3 manches contre ton voisin de gauche ✂️",
  "Concours de regard avec la personne de ton choix : le premier qui rit ou cligne perd 👀",
  "Duel de rapidité : le premier qui touche son nez entre toi et ton voisin de droite gagne 👃",
  "Bras de fer contre la personne de ton choix 💪",
  "Le plus vite à dire 5 marques de voiture, entre toi et un adversaire de ton choix 🚗",
  "Duel de « Ni oui ni non » d'une minute avec la personne de ton choix 🤐",
  "Celui qui tient le plus longtemps sur un pied, toi contre ton voisin de gauche 🦩",
  "Chifoumi à mort contre la personne de ton choix (le premier à 3 victoires) ✂️",
  "Duel de mémoire : citez chacun votre tour un film de Disney, le premier qui sèche perd 🏰"
];

// ---------- Gages (sans alcool) ----------

const GAGES = [
  "Imite quelqu'un de la soirée jusqu'à ce qu'on devine qui 🎭",
  "Parle avec un accent marseillais jusqu'à ton prochain tour 🎤",
  "Fais 10 pompes (ou 20 squats) 💪",
  "Danse 15 secondes sans musique 💃",
  "Chante le refrain d'une chanson choisie par le groupe 🎵",
  "Fais une déclaration d'amour dramatique à un objet de la pièce 💘",
  "Fais deviner ton dernier rêve en mime 💭",
  "Fais une pub de 20 secondes pour l'objet le plus proche de toi 📺",
  "Raconte ta pire honte en 30 secondes 😳",
  "Fais un compliment sincère à chaque personne présente 💐",
  "Parle uniquement en chuchotant jusqu'à ton prochain tour 🤫",
  "Fais le bruit d'un animal choisi par le groupe à chaque fois qu'on dit ton prénom, jusqu'à ton prochain tour 🐔",
  "Mime un film, le groupe doit deviner en 30 secondes 🎬",
  "Fais ton meilleur discours de remise de prix de 20 secondes 🏆",
  "Échange un vêtement (accessoire, chaussette…) avec la personne de ton choix 🧦",
  "Garde les bras en l'air pendant 30 secondes 🙌",
  "Fais la planche pendant 30 secondes 🧱",
  "Imite un présentateur météo qui annonce la fin du monde 🌪️",
  "Dis l'alphabet à l'envers le plus loin possible 🔤",
  "Laisse le groupe te donner un surnom pour le reste de la partie 🏷️",
  "Raconte une blague : si personne ne rit, refais un gage 🤡",
  "Fais un défilé de mode jusqu'au bout de la pièce et retour 👠",
  "Parle de toi à la troisième personne jusqu'à ton prochain tour 🗣️",
  "Fais un selfie avec la tête la plus moche possible et montre-le à tout le monde 🤳",
  "Écris un poème de 4 vers sur la personne à ta gauche et lis-le ✍️",
  "Tiens une cuillère sur ton nez 10 secondes (ou essaie) 🥄",
  "Fais un rap de 4 phrases sur la soirée 🎤",
  "Chante « Joyeux anniversaire » à la personne de ton choix, version opéra 🎂",
  "Fais 3 tours sur toi-même puis marche droit jusqu'à la porte 🌀",
  "Garde une main sur la tête jusqu'à ton prochain tour 🙋"
];

// ---------- Règles temporaires (courtes et claires) ----------

const RULES = [
  "Jusqu'à ton prochain tour, interdiction de dire « oui » : chaque oubli = {pen} 🚫",
  "Jusqu'à ton prochain tour, interdiction de dire « non » : chaque oubli = {pen} 🚫",
  "Jusqu'à ton prochain tour, interdiction de prononcer un prénom : chaque oubli = {pen} 🤐",
  "Jusqu'à ton prochain tour, tu dois finir chaque phrase par « … en vrai » : chaque oubli = {pen} 🗣️",
  "Jusqu'à ton prochain tour, interdiction de montrer du doigt : chaque oubli = {pen} ☝️",
  "Jusqu'à ton prochain tour, tu ne peux tenir ton téléphone que de la main gauche : chaque oubli = {pen} ✋",
  "Jusqu'à ton prochain tour, tu deviens le « maître des questions » : quiconque répond à ta question prend {pen} ❓",
  "Jusqu'à ton prochain tour, quiconque te regarde dans les yeux prend {pen} 👀",
  "Jusqu'à ton prochain tour, tu ne peux plus jurer : chaque gros mot = {pen} 🙊",
  "Jusqu'à ton prochain tour, tu dois applaudir à chaque fois que quelqu'un rit, sinon {pen} 👏"
];

const pick = (list, rng = Math.random) => list[Math.floor(rng() * list.length)];

// Le « prix » d'une erreur dans une règle ou d'un duel perdu.
function penalty(level, alcohol) {
  if (!alcohol) return "un mini-gage";
  return plural(SIPS[level]);
}

/**
 * Tire une punition.
 * @param {object} o
 * @param {string} [o.level]   soft / normal / hard / extreme (ou danger)
 * @param {boolean} [o.alcohol] false = gages uniquement
 * @param {() => number} [o.rng]
 * @returns {string}
 */
export function punishment({ level = "normal", alcohol = true, rng = Math.random } = {}) {
  const lvl = normalizeLevel(level);
  const pen = penalty(lvl, alcohol);
  const fill = text => text.replaceAll("{pen}", pen);
  if (!alcohol) {
    const roll = rng();
    if (roll < 0.6) return pick(GAGES, rng);
    if (roll < 0.8) return `${pick(DUELS, rng)} → le perdant fait un gage choisi par le groupe`;
    return fill(pick(RULES, rng));
  }
  const roll = rng();
  if (roll < 0.55) return pick(DRINK[lvl], rng);
  if (roll < 0.65) return pick(DUO[lvl], rng);
  if (roll < 0.75) return `${pick(DUELS, rng)} → le perdant boit ${BIG[lvl] === "2 shots" ? "un shot" : BIG[lvl]}`;
  if (roll < 0.9) return `${pick(GAGES, rng)} — ou bois ${BIG[lvl]}`;
  return fill(pick(RULES, rng));
}

// Même punition pour un groupe : « Ceux qui l'ont fait, chacun : bois 3 gorgées ».
export function forGroup(label, text) {
  const t = String(text);
  return `${label}, chacun : ${t.charAt(0).toLowerCase()}${t.slice(1)}`;
}

// Petite récompense / punition « bonus » d'un niveau (gorgées à distribuer, etc.).
export const sipsOf = (level, times = 1) => plural(SIPS[normalizeLevel(level)] * times);
export const bigOf = level => BIG[normalizeLevel(level)];

export const CATALOG = { DRINK, DUO, DUELS, GAGES, RULES };
