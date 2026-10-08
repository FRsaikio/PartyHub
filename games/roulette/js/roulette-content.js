// Actions de la Roulette par catégorie.
//
// {n} = gorgées de la case (selon le niveau d'alcool, ×2 en Furie / Mort subite) : c'est ce
// nombre que le jeu ajoute au compteur, le texte doit donc le reprendre tel quel.
// {h} = moitié arrondie (case TOUS : chacun boit {h}).
// CHAOS est rangé par niveau d'alcool ; sans alcool, les textes viennent de GAGES_*.

export const ACTIONS = {
  BOIS: [
    "Bois {n} 🍻",
    "Bois {n} sans les mains 🥤",
    "Bois {n} en regardant la personne de ton choix dans les yeux 👀",
    "Bois {n} avec ta main faible 🍺",
    "Bois {n}, en trinquant avec ton voisin de droite 🥂",
    "Bois {n} debout, comme un champion 🏆",
    "Bois {n} en tenant ton verre avec deux doigts 🤏",
    "Bois {n} pendant que le groupe compte à voix haute 📣",
    "Bois {n} et porte un toast à la soirée 🎉",
    "Bois {n}, puis choisis la prochaine musique 🎵"
  ],

  DISTRIBUE: [
    "Distribue {n} comme tu veux 🎁",
    "Distribue {n} : régale-toi 😈",
    "Distribue {n}, mais pas toutes à la même personne 🎁",
    "Distribue {n} à ceux qui t'ont fait boire 🔥"
  ],

  TOUS: [
    "Tout le monde boit {h} 👥",
    "Santé ! Tout le monde trinque et boit {h} 🥂",
    "Tout le monde boit {h}, le dernier à lever son verre en reboit 1 🍻",
    "Tout le monde boit {h} sans les mains 🥤",
    "Tout le monde boit {h} en criant le nom du lanceur 📣",
    "Waterfall : tout le monde boit {h}, dans l'ordre à partir du lanceur 🌊"
  ],

  CHAOS: {
    soft: [
      "Le groupe invente un mini-gage pour le lanceur 🎭",
      "Tout le monde change de place 🔀",
      "Le lanceur choisit quelqu'un qui boit 2 gorgées avec lui 🤝",
      "Jusqu'au prochain tour du lanceur, interdiction de dire « oui » : 1 gorgée par oubli 🚫",
      "Le dernier à toucher son nez boit 2 gorgées 👃",
      "Le plus jeune boit 1 gorgée, le plus âgé aussi 🎂",
      "Ceux qui ont un téléphone à moins de 20 % de batterie boivent 1 gorgée 🔋"
    ],
    normal: [
      "Double peine : le lanceur boit 3 gorgées ET en distribue 3 💀",
      "Le groupe vote : le lanceur ou son voisin de gauche boit 4 gorgées 🗳️",
      "Le prochain joueur à faire boire quelqu'un fait boire double ⚡",
      "Tout le monde change de place, le dernier assis boit 3 gorgées 🔀",
      "Le dernier à toucher son nez boit 3 gorgées 👃",
      "Jusqu'au prochain tour du lanceur, interdiction de prononcer un prénom : 2 gorgées par oubli 🤐",
      "Le lanceur désigne un binôme : jusqu'à son prochain tour, ils boivent toujours ensemble 🔗",
      "Waterfall de 5 secondes lancé par le lanceur 🌊"
    ],
    hard: [
      "Le lanceur prend un shot, ou tout le monde boit 3 gorgées : le groupe vote 🗳️",
      "Double peine : le lanceur boit 5 gorgées ET en distribue 5 💀",
      "Shot pour le lanceur et la personne de son choix 🥃",
      "Le dernier à se lever boit un shot 🧍",
      "Waterfall de 8 secondes lancé par le lanceur 🌊",
      "Jusqu'au prochain tour du lanceur, quiconque le regarde dans les yeux boit 2 gorgées 👀",
      "Le groupe choisit la punition du lanceur : shot ou moitié de verre cul sec 🗳️"
    ],
    extreme: [
      "Cul sec de ton verre, lanceur 💀",
      "2 shots pour le lanceur, ou 1 shot pour tout le monde : le groupe vote 🗳️",
      "Double peine : shot pour le lanceur ET pour la personne de son choix ☠️",
      "Waterfall de 10 secondes, personne ne s'arrête avant le lanceur 🌊",
      "Le dernier à se lever boit un shot 🧍",
      "Le groupe choisit la punition du lanceur parmi : 2 shots, cul sec, 8 gorgées ☠️",
      "Jusqu'au prochain tour du lanceur, il boit 1 gorgée à chaque fois que quelqu'un rit 😂"
    ]
  }
};

// Sans alcool : gages à la place des gorgées.
export const GAGES_BOIS = [
  "Gage : fais 10 squats 🦵",
  "Gage : imite quelqu'un de la soirée jusqu'à ce qu'on devine 🎭",
  "Gage : parle avec un accent jusqu'à ton prochain tour 🎤",
  "Gage : danse 15 secondes sans musique 💃",
  "Gage : fais un compliment sincère à chacun 💐",
  "Gage : chante un refrain choisi par le groupe 🎵",
  "Gage : fais la planche 30 secondes 🧱"
];

export const GAGES_TOUS = [
  "Tout le monde fait 10 squats 🦵",
  "Tout le monde change de place 🔀",
  "Photo de groupe avec la grimace la plus moche possible 🤳",
  "Tout le monde chante le refrain de la chanson en cours 🎵",
  "Tout le monde imite son voisin de gauche pendant 10 secondes 🎭"
];
