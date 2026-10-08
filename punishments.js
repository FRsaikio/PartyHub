// Catalogue commun des punitions de PartyHub (tous les jeux piochent ici).
//
// Rangé selon le « Niveau alcool » du lobby : soft / normal / hard / extreme (« danger » =
// ancien nom d'extreme). Quand l'alcool est activé, ~3 punitions sur 4 font boire (seul, avec
// un complice ou en duel) et ~1 sur 4 est un gage ou une règle temporaire. Alcool désactivé :
// uniquement des gages, duels et règles sans alcool.
//
// Garde-fous : rien qui s'enchaîne dans le temps (« un shot toutes les 2 minutes »), pas plus
// de 2 shots ou d'un cul sec d'un coup, pas de verre de spiritueux. Soft : jamais de shot ni de
// cul sec. Les textes sont au « tu » (s'adressent à celui qui prend la punition) ; forGroup()
// les adapte à un groupe. GAGES, DUELS et RULES servent aussi sans alcool : aucun mot
// d'alcool dedans ({pen} est remplacé par « 2 gorgées » ou « un mini-gage »).

export const LEVELS = ["soft", "normal", "hard", "extreme"];
export const normalizeLevel = level => (level === "danger" ? "extreme" : LEVELS.includes(level) ? level : "normal");

// Gorgées « de base » d'un niveau, et la grosse punition du niveau.
const SIPS = { soft: 1, normal: 2, hard: 4, extreme: 5 };
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
    "Bois 1 gorgée et choisis la musique suivante 🎵",
    "Bois 1 gorgée en levant ton verre au-dessus de ta tête 🙌",
    "Bois 2 gorgées debout 🧍",
    "Bois 1 gorgée et porte un toast à la personne de ton choix 🥂",
    "Bois 2 gorgées en tenant ton verre avec deux doigts 🤏",
    "Bois 1 gorgée par personne qui porte des lunettes (max 3) 👓",
    "Bois 2 gorgées les yeux fermés 🙈",
    "Bois 1 gorgée et fais un clin d'œil à la personne de ton choix 😉",
    "Distribue 2 gorgées à ceux qui ont ri pendant ce tour 😂",
    "Bois 2 gorgées en silence total : si quelqu'un te fait rire, il boit 1 gorgée 🤫",
    "Bois 1 gorgée et dis un truc que tu aimes chez ton voisin de droite 💐",
    "Bois 2 gorgées au ralenti, façon film d'action 🐢",
    "Mini waterfall de 3 secondes avec tes deux voisins 🌊",
    "Bois 1 gorgée et échange de place avec la personne de ton choix 🔀",
    "Bois 2 gorgées, ou 1 seule si tu cites 3 capitales en 5 secondes 🌍",
    "Bois 1 gorgée en disant « santé » dans une autre langue 🌐",
    "Distribue 1 gorgée à la personne la plus proche de toi et 1 à la plus éloignée 📏",
    "Bois 2 gorgées, ou aucune si tu fais rire quelqu'un en 10 secondes 🤡",
    "Bois 1 gorgée et raconte ton meilleur moment de la soirée 💭",
    "Bois 1 gorgée le petit doigt levé, très chic 🫖",
    "Bois 2 gorgées en tenant sur un pied 🦩",
    "Distribue 2 gorgées à celui qui a le moins bu jusqu'ici 🏆",
    "Bois 2 gorgées en faisant ta meilleure grimace 😝",
    "Bois 1 gorgée pendant que tout le monde t'applaudit 👏",
    "Bois 2 gorgées, verre tenu de la main gauche ✋",
    "Distribue 2 gorgées à la même personne, ou 1 à deux personnes différentes 🎯",
    "Bois 1 gorgée et nomme un « roi de la soirée » qui boit 1 gorgée aussi 👑",
    "Bois 1 gorgée pour chaque « euh » en décrivant ton plat préféré pendant 10 secondes 🍝",
    "Bois 2 gorgées, puis fais une révérence 🎩",
    "Bois 1 gorgée et désigne le prochain DJ de la soirée 🎧"
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
    "Distribue 5 gorgées, mais pas deux fois à la même personne 🫵",
    "Bois 4 gorgées… sauf si quelqu'un accepte d'en boire 2 à ta place 🙏",
    "Bois 3 gorgées en faisant un toast en anglais 🇬🇧",
    "Bois 3 gorgées en tenant ton verre avec deux doigts 🤏",
    "Bois 4 gorgées les yeux fermés 🙈",
    "Bois 2 gorgées, puis distribue-en autant que de personnes qui ont un tatouage 🖋️",
    "Bois 3 gorgées en chantant « ♪ Santé ! ♪ » à la fin 🎶",
    "Bois 4 gorgées, ou 2 si tu fais 10 squats d'abord 🦵",
    "Bois 3 gorgées avec ta main faible 🍺",
    "Distribue 6 gorgées, maximum 2 par personne 🫵",
    "Bois 3 gorgées en tenant sur un pied 🦩",
    "Waterfall de 5 secondes, tout le monde suit 🌊",
    "Bois 4 gorgées, et le dernier à te dire « santé » en boit 2 🥂",
    "Bois 3 gorgées et choisis le prochain joueur à prendre la parole 🎤",
    "Bois 2 gorgées par « non » que tu as dit depuis ton dernier tour (max 5) 🚫",
    "Bois 3 gorgées, ou 1 seule si tu cites 5 pays d'Afrique en 10 secondes 🌍",
    "Le groupe choisit : 4 gorgées pour toi, ou 2 pour toi et 2 pour ton voisin de droite 🗳️",
    "Bois 3 gorgées sans poser ton verre entre les gorgées 🍻",
    "Bois 3 gorgées en regardant la personne de ton choix dans les yeux : si elle rit, elle boit 2 👀",
    "Distribue 3 gorgées et bois-en 3 🔁",
    "Bois 4 gorgées, puis mets ton verre de l'autre côté de la table 🙃",
    "Bois 3 gorgées au ralenti pendant que le groupe fait le bruitage 🐢",
    "Bois 3 gorgées, puis tout le monde boit 1 gorgée en ton honneur 🎉",
    "Bois 4 gorgées, ou distribue-en 6 si tu racontes une anecdote gênante 😳",
    "Bois 3 gorgées et deviens le « garde du corps » de quelqu'un : tu bois ses 2 prochaines gorgées 🛡️",
    "Distribue 4 gorgées à ceux qui ont leur téléphone en main 📱",
    "Bois 3 gorgées, verre tenu des deux mains comme un enfant 🍼",
    "Bois 4 gorgées et lance un toast que tout le monde doit écouter 🥂"
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
    "Bois 5 gorgées en tenant ton verre avec deux doigts 🤏",
    "Prends un shot sans les mains 🥃",
    "Bois 6 gorgées les yeux fermés 🙈",
    "Shot, puis choisis la prochaine musique 🎵",
    "Bois 5 gorgées debout, le groupe compte à voix haute 📣",
    "Cul sec d'un tiers de ton verre, puis distribue 3 gorgées 🍺",
    "Distribue 10 gorgées, maximum 3 par personne 🫵",
    "Bois 5 gorgées, ou un shot si tu as ri pendant ce tour 😂",
    "Shot pour toi, et 2 gorgées pour chacun de tes voisins 🥃",
    "Bois 4 gorgées par personne qui t'a fait boire ce tour-ci (max 6 gorgées) 🔥",
    "Le groupe choisit : shot, ou moitié de verre cul sec 🗳️",
    "Bois 6 gorgées, ou 3 si tu fais 15 pompes d'abord 💪",
    "Bois 5 gorgées en tenant sur un pied 🦩",
    "Shot en regardant la personne de ton choix dans les yeux : si elle rit, elle boit 3 gorgées 👀",
    "Waterfall de 6 secondes avec tes deux voisins 🌊",
    "Bois 5 gorgées et distribues-en autant que de personnes qui portent du blanc (max 5) 🤍",
    "Shot ou anecdote gênante racontée au groupe 😳",
    "Bois 6 gorgées sans poser ton verre 🍻",
    "Prends un shot, puis fais une révérence au groupe 🎩",
    "Cul sec de la moitié de ton verre, le groupe chante pendant ce temps 🎶",
    "Bois 4 gorgées et deviens le « garde du corps » de quelqu'un : tu bois ses 3 prochaines gorgées 🛡️",
    "Shot, ou 3 gorgées pour toi ET pour la personne de ton choix 🤝",
    "Bois 5 gorgées avec ta main faible 🍺",
    "Distribue 6 gorgées et bois-en 3 🔁",
    "Le dernier à toucher le sol boit un shot : tu lances le décompte ⬇️",
    "Bois 5 gorgées, puis tout le monde boit 1 gorgée en ton honneur 🎉",
    "Prends un shot servi par ton voisin de gauche 🥃",
    "Bois 6 gorgées en criant « JE SUIS UNE LÉGENDE » à la fin 🏆",
    "Prends un shot, puis distribue 4 gorgées 🥃",
    "Shot sans grimacer : si tu grimaces, 3 gorgées de plus 😐",
    "Cul sec de la moitié de ton verre, puis 2 gorgées 🍺",
    "Bois 8 gorgées 💀",
    "Bois 7 gorgées sans poser ton verre 🍻",
    "Shot + 3 gorgées 🔥",
    "Le groupe vote : shot pour toi, ou shot pour ton voisin de gauche 🗳️",
    "Prends un shot, et le groupe choisit qui t'accompagne 🥃",
    "Cul sec des trois quarts de ton verre 🍺",
    "Shot, ou 8 gorgées : le groupe choisit 🗳️",
    "Waterfall de 8 secondes : tu commences et tu décides quand ça s'arrête 🌊",
    "Bois 6 gorgées et distribues-en 6 🔁",
    "Prends un shot les yeux fermés, servi par la personne de ton choix 🙈",
    "Shot, ou 20 pompes 💪",
    "Bois 7 gorgées en tenant sur un pied 🦩",
    "Prends un shot, puis fais un discours de 10 secondes 🎤",
    "Cul sec de la moitié de ton verre sans les mains 🥤",
    "Shot pour toi, 3 gorgées pour tout le monde 🎉",
    "Prends un shot en trinquant avec tout le monde 🥂",
    "Bois 8 gorgées, pas plus de 2 entre chaque respiration 💨",
    "Le dernier à lever son verre prend un shot : tu lances le signal ⬆️",
    "Shot, puis choisis qui boit 4 gorgées 🫵",
    "Raconte ton pire râteau, ou prends un shot 💔",
    "Prends un shot servi par le joueur qui a le plus bu 🏆",
    "Bois 7 gorgées en regardant le groupe : le premier qui rit en boit 3 👀",
    "Shot les mains dans le dos, servi par ton voisin de droite 🤲",
    "Cul sec de la moitié de ton verre, puis porte un toast 🥂",
    "Prends un shot et distribue-en un 🥃",
    "Bois 10 gorgées, ou un shot : à toi de voir 💀",
    "Shot, et ton voisin de gauche boit 3 gorgées par solidarité 🤝",
    "Prends un shot en criant ton cri de guerre 📣",
    "Bois 6 gorgées sans les mains, paille interdite 🥤",
    "Le groupe choisit le contenu de ton shot (rien de dégoûtant) 🎲",
    "Shot, ou 30 secondes de planche 🧱",
    "Bois 8 gorgées pendant que le groupe compte 📣",
    "Cul sec de la moitié de ton verre, puis distribue 4 gorgées 🔥",
    "Shot, puis tu inventes la règle du prochain tour 📜",
    "Prends un shot en tenant sur un pied 🦩",
    "Bois 7 gorgées et distribues-en 3 🔁",
    "Shot ou vérité : le groupe pose la question, tu choisis après l'avoir entendue 😈"
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
    "Double peine : shot pour toi ET pour la personne de ton choix ☠️",
    "Prends 2 shots sans les mains ☠️",
    "Cul sec de ton verre, le groupe compte à voix haute 📣",
    "Bois 10 gorgées, ou un shot si tu as ri pendant ce tour 😂",
    "Shot, puis distribue 6 gorgées 🔥",
    "Cul sec de la moitié de ton verre + un shot 💀",
    "Distribue un shot et 6 gorgées comme tu veux ☠️",
    "Prends un shot en faisant un toast en anglais 🇬🇧",
    "Bois 8 gorgées sans poser ton verre 🍻",
    "Le groupe vote : 2 shots pour toi, ou 1 shot pour tes deux voisins 🗳️",
    "Shot ou vérité très gênante choisie par le groupe 🥃",
    "Waterfall de 8 secondes avec tes deux voisins, puis un shot pour toi 🌊",
    "Cul sec de ton verre, puis choisis la prochaine musique 🎵",
    "Prends un shot et deviens le « garde du corps » de quelqu'un : tu bois ses 4 prochaines gorgées 🛡️",
    "Bois 8 gorgées les yeux fermés 🙈",
    "Prends un shot, ou fais 25 pompes 💪",
    "Shot pour toi, et un shot pour le dernier qui te dit « santé » 🥂",
    "Cul sec de ton verre, ou anecdote très gênante racontée au groupe 😳",
    "Prends 2 shots, et tout le monde boit 2 gorgées en ton honneur 🎉",
    "Bois 6 gorgées et distribues-en 6 🔁",
    "Shot les mains dans le dos, ton voisin de droite te le sert 🤲",
    "Le dernier à toucher le sol prend un shot : tu lances le décompte ⬇️",
    "Cul sec de ton verre en tenant sur un pied 🦩",
    "Prends un shot et crie « JE SUIS UNE LÉGENDE » 🏆",
    "Bois 10 gorgées, maximum 2 à la suite sans respirer 💨",
    "Shot, puis 3 gorgées pour chacun de tes voisins 🤝",
    "Double shot… ou cul sec de ton verre : le groupe choisit 🗳️",
    "Prends un shot en regardant la personne de ton choix dans les yeux : si elle rit, elle en prend un aussi 👀",
    "Cul sec de ton verre, puis porte un toast à la soirée 🥂",
    "Cul sec de ton verre, puis 3 gorgées 💀",
    "Prends 2 shots, puis distribue 4 gorgées ☠️",
    "Cul sec de ton verre sans les mains 🥤",
    "Shot + moitié de ton verre cul sec 💀",
    "Le groupe vote : 2 shots pour toi, ou cul sec de ton verre 🗳️",
    "Bois 12 gorgées, pas plus de 3 entre chaque respiration 💨",
    "Cul sec de ton verre, et le dernier à te dire « santé » prend un shot 🥂",
    "2 shots les yeux fermés, servis par la personne de ton choix 🙈",
    "Prends un shot, et chacun de tes voisins en prend un aussi 🤝",
    "Distribue un shot à trois personnes différentes ☠️",
    "Cul sec de ton verre en regardant le groupe : le premier qui rit prend un shot 👀",
    "2 shots, ou 30 pompes 💪",
    "Cul sec de ton verre, puis distribue 5 gorgées 🔥",
    "Shot + 6 gorgées 💀",
    "Waterfall de 12 secondes, tout le monde suit 🌊",
    "2 shots en trinquant avec tout le monde 🥂",
    "Le dernier à lever son verre fait cul sec : tu lances le signal ⬆️",
    "Cul sec de ton verre pendant que le groupe chante 🎶",
    "Prends 2 shots, puis choisis qui boit 6 gorgées 🫵",
    "Le groupe choisit le contenu de tes 2 shots (rien de dégoûtant) 🎲",
    "Shot les mains dans le dos + 4 gorgées 🤲",
    "Cul sec de ton verre, ou ton pire secret + un shot 😳",
    "2 shots servis par le joueur qui a le plus bu 🏆",
    "Bois 10 gorgées sans poser ton verre 🍻",
    "Shot, puis tout le monde boit 3 gorgées en ton honneur 🎉",
    "Cul sec de ton verre, puis invente une règle jusqu'à ton prochain tour 📜",
    "2 shots en criant ton cri de guerre 📣",
    "Shot + 4 gorgées pour toi et pour la victime de ton choix ☠️",
    "Le groupe vote : cul sec pour toi, ou un shot pour tout le monde 🗳️",
    "Cul sec de ton verre sans reprendre ta respiration 💨",
    "2 shots, ou cul sec de ton verre + 3 gorgées 💀",
    "Prends un shot, puis 30 secondes de planche 🧱",
    "Fais faire cul sec à la personne de ton choix… et prends un shot 😈",
    "Cul sec de ton verre, tenu avec deux doigts 🤏",
    "Prends 2 shots, puis donne un surnom à chaque joueur 🏷️",
    "Shot, puis lance un waterfall de 6 secondes 🌊",
    "Cul sec de ton verre sur un roulement de tambour du groupe 🥁",
    "Bois 12 gorgées et distribues-en 6 🔁",
    "Prends 2 shots, puis choisis la prochaine musique 🎵",
    "Le dernier à toucher son nez fait cul sec : tu lances le signal 👃"
  ]
};

// ---------- Boire avec un complice ----------

const DUO = {
  soft: [
    "Choisis quelqu'un qui boit 1 gorgée avec toi 🤝",
    "Toi et ton voisin de droite buvez 1 gorgée en vous tenant le bras 🤝",
    "Choisis un complice : vous trinquez et buvez 2 gorgées chacun 🥂",
    "Toi et ton voisin de gauche buvez 1 gorgée en même temps, sans vous quitter des yeux 👀",
    "Choisis quelqu'un : il boit 1 gorgée, puis toi 1 gorgée, puis lui encore 1 🔁",
    "Toi et la personne en face de toi buvez 1 gorgée en vous faisant un clin d'œil 😉",
    "Choisis un binôme : vous buvez 1 gorgée chacun en vous tapant dans la main d'abord ✋",
    "Toi et la personne la plus âgée de la pièce buvez 1 gorgée 🎂",
    "Toi et la personne la plus jeune de la pièce buvez 1 gorgée 🍼",
    "Toi et tes deux voisins buvez 1 gorgée 🤝",
    "Choisis quelqu'un qui boit 2 gorgées à ta place… s'il accepte, sinon c'est toi 🙏",
    "Toi et la personne de ton choix buvez 1 gorgée bras dessus bras dessous 🤝"
  ],
  normal: [
    "Choisis quelqu'un qui boit 3 gorgées avec toi 🤝",
    "Bras dessus bras dessous avec la personne de ton choix : 3 gorgées chacun 🤝",
    "Toi et tes deux voisins buvez 2 gorgées 🤝",
    "Choisis ton binôme : jusqu'à la fin du tour suivant, il boit chaque fois que tu bois 🔗",
    "Toi et la personne en face de toi buvez 3 gorgées en vous regardant dans les yeux 👀",
    "Choisis un complice : vous buvez 2 gorgées, puis vous en distribuez 2 chacun 🔁",
    "Toi et le dernier à avoir parlé buvez 3 gorgées 🗣️",
    "Toi et la personne la plus proche de la porte buvez 3 gorgées 🚪",
    "Choisis quelqu'un : celui de vous deux qui a le plus petit pied boit 4 gorgées, l'autre 2 🦶",
    "Toi et ton voisin de gauche faites un waterfall de 4 secondes 🌊",
    "Choisis un binôme : vous buvez 3 gorgées en vous tenant par le petit doigt 🤙",
    "Toi et la personne de ton choix buvez 3 gorgées, le premier qui rit en boit 2 de plus 😂"
  ],
  hard: [
    "Choisis quelqu'un : vous prenez un shot ensemble 🥃",
    "Toi et ton binôme buvez 5 gorgées bras dessus bras dessous 🤝",
    "Choisis un complice : vous videz chacun la moitié de votre verre 🍺",
    "Jusqu'à ton prochain tour, ton binôme boit chaque fois que tu bois 🔗",
    "Toi et tes deux voisins buvez 4 gorgées 🤝",
    "Toi et la personne en face de toi prenez un shot en vous regardant dans les yeux 👀",
    "Choisis quelqu'un : pierre-feuille-ciseaux, le perdant prend un shot, le gagnant 3 gorgées ✂️",
    "Toi et le dernier à avoir ri prenez un shot 😂",
    "Choisis un complice : waterfall de 6 secondes à deux 🌊",
    "Toi et la personne de ton choix buvez 5 gorgées, puis vous en distribuez 3 chacun 🔁",
    "Toi et la personne la plus âgée de la pièce prenez un shot 🎂",
    "Choisis un binôme : un shot chacun, servi par l'autre 🥃",
    "Toi et la personne de ton choix prenez un shot, puis 2 gorgées chacun 🥃",
    "Choisis un complice : cul sec de la moitié de vos verres, ensemble 🍺",
    "Toi et tes deux voisins prenez un shot ensemble 🥃",
    "Toi et la personne en face de toi : waterfall de 8 secondes 🌊",
    "Choisis quelqu'un : bras de fer, le perdant prend un shot, le gagnant 4 gorgées 💪",
    "Toi et le joueur qui a le plus bu prenez un shot 🏆",
    "Choisis un binôme : 6 gorgées chacun, bras dessus bras dessous 🤝",
    "Toi et la personne la plus jeune de la pièce prenez un shot 🍼",
    "Choisis quelqu'un : un shot chacun, le dernier à finir boit 3 gorgées de plus 🏁",
    "Toi et la dernière personne à avoir parlé buvez 6 gorgées 🗣️",
    "Choisis un complice : jusqu'à ton prochain tour, vous buvez toujours ensemble, en double 🔗",
    "Toi et ton voisin de droite : shot croisé, chacun sert l'autre 🔀"
  ],
  extreme: [
    "Choisis quelqu'un : cul sec ensemble 💀",
    "Toi et la personne de ton choix prenez 2 shots ☠️",
    "Toi et tes deux voisins prenez un shot ensemble 🥃",
    "Jusqu'à ton prochain tour, ton binôme boit chaque fois que tu bois, en double 🔗",
    "Toi et la personne en face de toi : cul sec ensemble, sans vous quitter des yeux 👀",
    "Choisis un complice : un shot chacun, puis vous distribuez 4 gorgées chacun 🔁",
    "Toi et le dernier à avoir parlé prenez un shot 🗣️",
    "Choisis quelqu'un : pierre-feuille-ciseaux, le perdant fait cul sec, le gagnant prend un shot ✂️",
    "Toi et ton voisin de gauche faites un waterfall de 10 secondes 🌊",
    "Choisis un binôme : shot servi par l'autre, bras dessus bras dessous 🥃",
    "Toi et la personne la plus jeune de la pièce prenez un shot 🍼",
    "Choisis quelqu'un : vous buvez 8 gorgées chacun, le premier qui finit distribue un shot 🏁",
    "Toi et la personne de ton choix : cul sec ensemble, puis 3 gorgées chacun 💀",
    "Choisis un complice : 2 shots chacun ☠️",
    "Toi et tes deux voisins : cul sec ensemble 💀",
    "Toi et la personne en face de toi : waterfall de 12 secondes 🌊",
    "Choisis quelqu'un : bras de fer, le perdant fait cul sec, le gagnant prend un shot 💪",
    "Toi et le joueur qui a le plus bu prenez 2 shots 🏆",
    "Choisis un binôme : shot croisé, puis la moitié de vos verres cul sec 🔀",
    "Toi et la personne la plus âgée de la pièce prenez 2 shots 🎂",
    "Choisis quelqu'un : un shot chacun, le dernier à finir en reprend un 🏁",
    "Toi et la dernière personne à avoir ri : cul sec 😂",
    "Choisis 2 complices : un shot pour vous trois 🥃",
    "Toi et ton voisin de gauche : cul sec bras dessus bras dessous 🤝"
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
  "Duel de mémoire : citez chacun votre tour un film Disney, le premier qui sèche perd 🏰",
  "Duel de pompes contre la personne de ton choix : le moins de pompes en 20 secondes perd 💪",
  "Duel de grimaces : le groupe vote pour la pire, toi contre ton voisin de droite 😝",
  "Duel de chant : chacun chante un refrain, le groupe vote, toi contre la personne de ton choix 🎤",
  "Duel du « Je ne ris pas » : ton adversaire a 20 secondes pour te faire rire 😐",
  "Duel de rapidité : le premier à citer 5 pays qui commencent par B gagne 🌍",
  "Duel de mime : faites chacun deviner un animal, le plus rapide gagne 🐒",
  "Duel de planche : le premier qui craque perd 🧱",
  "Duel de mémoire : répétez à tour de rôle une liste de courses qui s'allonge, le premier qui se trompe perd 🛒",
  "Duel de rapidité : le premier à trouver un objet rouge dans la pièce gagne 🔴",
  "Duel de pierre-feuille-ciseaux… avec les pieds 🦶",
  "Duel de squats : le plus de squats en 20 secondes gagne 🦵",
  "Duel du « Tu préfères » : le premier qui hésite plus de 3 secondes perd 🤔",
  "Duel de rimes : trouvez chacun votre tour un mot qui rime avec « soirée », le premier qui sèche perd 🎶",
  "Duel d'équilibre : une pièce sur le dos de la main, le premier qui la fait tomber perd 🪙",
  "Duel d'alphabet : dites l'alphabet à l'envers à tour de rôle, le premier qui se trompe perd 🔤",
  "Duel de compliments : enchaînez les compliments, le premier qui sèche ou rit perd 💐",
  "Duel de rapidité : le premier à applaudir 10 fois gagne 👏",
  "Duel de chiffres : comptez à tour de rôle en sautant les multiples de 3, le premier qui se trompe perd 🔢",
  "Duel de regard + grimaces : le premier qui détourne les yeux perd 👀",
  "Duel de capitales : citez chacun une capitale, pas de répétition, le premier qui sèche perd 🏙️"
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
  "Échange un accessoire (bracelet, casquette, chaussette…) avec la personne de ton choix 🧦",
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
  "Garde une main sur la tête jusqu'à ton prochain tour 🙋",
  "Fais le robot pendant 15 secondes 🤖",
  "Présente le journal télévisé de la soirée en 20 secondes 📰",
  "Imite ton prof le plus marquant 👨‍🏫",
  "Fais 20 jumping jacks 🤸",
  "Raconte la soirée d'aujourd'hui comme un commentateur de foot ⚽",
  "Fais une déclaration d'amour à ton téléphone 📱",
  "Danse le moonwalk jusqu'à l'autre bout de la pièce 🕺",
  "Fais deviner une chanson en la fredonnant, sans paroles 🎶",
  "Fais un tuto beauté imaginaire de 20 secondes 💄",
  "Imite un influenceur qui présente un produit nul 📸",
  "Fais semblant d'être un GPS et guide quelqu'un jusqu'à la cuisine 🧭",
  "Parle comme un robot jusqu'à ton prochain tour 🤖",
  "Fais un câlin à la personne de ton choix (si elle est d'accord) 🫂",
  "Imite un animal, le groupe doit deviner lequel 🐘",
  "Raconte ton pire rendez-vous en 30 secondes 💔",
  "Fais 10 secondes de danse de la victoire 🏆",
  "Dis 3 qualités de la personne à ta droite 💬",
  "Fais semblant d'être en interview pour un talk-show pendant 20 secondes 🎙️",
  "Joue de la guitare imaginaire sur la chanson en cours 🎸",
  "Fais un discours de mariage pour deux personnes de la soirée 💍",
  "Imite la sonnerie de ton téléphone 📳",
  "Fais un tour de magie (même raté) 🎩",
  "Fais 15 secondes de gainage sur les coudes 🧱",
  "Danse avec la personne de ton choix pendant 15 secondes 💃",
  "Raconte un souvenir d'enfance gênant 🧸",
  "Fais une imitation de célébrité, le groupe doit deviner 🌟",
  "Décris la personne à ta gauche comme un vendeur de voitures 🚗",
  "Fais une chorégraphie de 10 secondes que tout le monde doit copier 🕺",
  "Parle uniquement en rimes jusqu'à ton prochain tour 🎶",
  "Fais la statue pendant 30 secondes, le groupe essaie de te faire bouger 🗿",
  "Marche comme un pingouin jusqu'au bout de la pièce 🐧",
  "Fais semblant de pleurer de joie pendant 10 secondes 😭",
  "Vends ta chaussure au groupe en 20 secondes 👟",
  "Imite un bébé qui découvre le monde pendant 10 secondes 👶",
  "Raconte une histoire en inventant une phrase, la personne suivante continue (3 tours) 📖",
  "Fais semblant d'être un serveur et prends la commande de chacun 📝",
  "Récite les jours de la semaine à l'envers en 5 secondes 📅",
  "Fais un salut militaire à chaque fois qu'on te parle, jusqu'à ton prochain tour 🫡",
  "Chante une phrase de ton choix comme un chanteur d'opéra 🎭",
  "Imite un commentateur de course hippique qui décrit la soirée 🏇",
  "Danse la macarena jusqu'au bout 💃",
  "Raconte ton plus gros fou rire 🤣",
  "Fais 10 pompes en disant « je suis le meilleur » à chaque fois 💪",
  "Fais le portrait-robot de la personne à ta droite à voix haute 🕵️",
  "Fais semblant d'être une statue de musée pendant que le groupe te décrit 🖼️",
  "Imite un zombie jusqu'à ton prochain tour 🧟",
  "Fais un beatbox de 10 secondes 🥁",
  "Fais une demande en mariage théâtrale à un objet de la pièce 💍",
  "Dis 10 mots qui commencent par « P » en 10 secondes 🅿️",
  "Fais semblant d'avoir gagné au loto pendant 15 secondes 💰",
  "Raconte ta journée comme si c'était un film d'horreur 👻",
  "Imite la personne en face de toi pendant 15 secondes 🪞",
  "Laisse la personne de ton choix te coiffer comme elle veut 💇",
  "Fais un cri de guerre que tout le monde doit reprendre 📣",
  "Garde un sourire figé jusqu'à ton prochain tour 😁",
  "Fais deviner un métier en mime 👷",
  "Raconte la dernière chose qui t'a fait rire 😂",
  "Fais un tour de la pièce en sautant à cloche-pied 🦘",
  "Présente-toi comme si tu passais un entretien d'embauche pour être licorne 🦄",
  "Fais 10 secondes de yoga de la pose la plus improbable 🧘"
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
  "Jusqu'à ton prochain tour, tu dois applaudir à chaque fois que quelqu'un rit, sinon {pen} 👏",
  "Jusqu'à ton prochain tour, interdiction de dire « je » : chaque oubli = {pen} 🙅",
  "Jusqu'à ton prochain tour, tu dois vouvoyer tout le monde : chaque oubli = {pen} 🎩",
  "Jusqu'à ton prochain tour, tu dois parler avec un accent : chaque oubli = {pen} 🎤",
  "Jusqu'à ton prochain tour, interdiction de rire : chaque rire = {pen} 😐",
  "Jusqu'à ton prochain tour, tu dois lever la main avant de parler : chaque oubli = {pen} 🙋",
  "Jusqu'à ton prochain tour, interdiction de toucher ton téléphone : chaque oubli = {pen} 📵",
  "Jusqu'à ton prochain tour, tu dois dire « chef » à la fin de chaque phrase : chaque oubli = {pen} 🫡",
  "Jusqu'à ton prochain tour, interdiction de croiser les jambes : chaque oubli = {pen} 🦵",
  "Jusqu'à ton prochain tour, tu deviens « le miroir » : quiconque oublie de t'imiter quand tu te touches le nez prend {pen} 🪞",
  "Jusqu'à ton prochain tour, interdiction de dire « genre » : chaque oubli = {pen} 🚫",
  "Jusqu'à ton prochain tour, tu ne peux répondre que par des questions : chaque oubli = {pen} ❓",
  "Jusqu'à ton prochain tour, tu dois chuchoter : chaque phrase trop forte = {pen} 🤫",
  "Jusqu'à ton prochain tour, interdiction de dire « quoi » : chaque oubli = {pen} 🤐",
  "Jusqu'à ton prochain tour, tu dois saluer chaque personne qui revient dans la pièce : chaque oubli = {pen} 👋",
  "Jusqu'à ton prochain tour, tu deviens le « pouce » : quand tu poses ton pouce sur la table, le dernier à t'imiter prend {pen} 👍",
  "Jusqu'à ton prochain tour, interdiction de dire un chiffre : chaque oubli = {pen} 🔢",
  "Jusqu'à ton prochain tour, tu dois parler de toi à la troisième personne : chaque oubli = {pen} 🗣️",
  "Jusqu'à ton prochain tour, tout le monde doit t'appeler « Votre Altesse » : chaque oubli = {pen} 👑",
  "Jusqu'à ton prochain tour, interdiction de dire « en fait » : chaque oubli = {pen} 🚫",
  "Jusqu'à ton prochain tour, tu dois rester debout : chaque fois que tu t'assois = {pen} 🧍"
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
  // Hard / Extrême : plus de « boire » et de complices, moins de gages et de règles.
  const strong = lvl === "hard" || lvl === "extreme";
  const [drink, duo, duel, gage] = strong ? [0.6, 0.75, 0.85, 0.95] : [0.55, 0.65, 0.75, 0.9];
  const roll = rng();
  if (roll < drink) return pick(DRINK[lvl], rng);
  if (roll < duo) return pick(DUO[lvl], rng);
  if (roll < duel) return `${pick(DUELS, rng)} → le perdant boit ${BIG[lvl] === "2 shots" ? "un shot" : BIG[lvl]}`;
  if (roll < gage) return `${pick(GAGES, rng)} — ou bois ${BIG[lvl]}`;
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
