// Textes de Mission Traître : missions secrètes des traîtres, punitions des perdants
// (par niveau d'alcool) et récompenses des gagnants. Les 10 premières missions et les
// punitions sont reprises de l'ancienne version.

export const MISSIONS = [
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
  },
  // ---------- Nouvelles missions ----------
  {
    title: "Faire changer de place",
    objective: "Fais changer de place au moins un joueur (il doit s'asseoir ailleurs).",
    rules: ["Il doit bouger de lui-même.", "Tu ne peux pas lui ordonner directement.", "Aller aux toilettes ne compte pas."],
    example: "Exemple : « Viens voir ce truc sur mon téléphone » ou propose de mieux voir la TV."
  },
  {
    title: "Faire chanter quelqu'un",
    objective: "Fais chanter au moins une phrase d'une chanson à un joueur.",
    rules: ["Il doit chanter, pas juste dire les paroles.", "Tu peux commencer une chanson, il doit la continuer.", "Une seule personne suffit."],
    example: "Exemple : commence un refrain connu et arrête-toi au milieu."
  },
  {
    title: "Obtenir un câlin",
    objective: "Fais-toi faire un câlin (ou un check) par un joueur.",
    rules: ["Le geste doit venir de lui.", "Tu peux le provoquer, pas l'exiger.", "Visible par le groupe."],
    example: "Exemple : « J'ai passé une semaine horrible… »"
  },
  {
    title: "Faire dire ton prénom trois fois",
    objective: "Fais en sorte que les autres prononcent ton prénom au moins 3 fois en 2 minutes.",
    rules: ["Ça doit sortir naturellement.", "Tu ne peux pas demander « dis mon prénom ».", "Plusieurs joueurs peuvent compter."],
    example: "Exemple : pose une question en parlant de toi à la troisième personne."
  },
  {
    title: "Faire porter un toast",
    objective: "Fais porter un toast à un autre joueur (« À … ! »).",
    rules: ["Ce n'est pas toi qui le portes.", "Le toast doit être annoncé à voix haute.", "Tout le monde n'est pas obligé de trinquer."],
    example: "Exemple : « On ne trinque à rien ce soir ? C'est triste. »"
  },
  {
    title: "Faire sortir un téléphone",
    objective: "Fais sortir son téléphone à un joueur pour qu'il montre une photo.",
    rules: ["Il doit montrer une photo au groupe ou à toi.", "Ce jeu ne compte pas.", "Tu ne peux pas dire « montre-moi une photo » directement."],
    example: "Exemple : « T'as vu le chien de ma tante ? Tu as un animal toi ? »"
  },
  {
    title: "Défendre un innocent",
    objective: "Défends quelqu'un avec conviction pendant au moins 20 secondes à la table ronde.",
    rules: ["La personne défendue doit être innocente (selon toi).", "Tu dois avoir l'air sincère.", "Si personne ne réagit, ça ne compte pas."],
    example: "Exemple : « Franchement, Léa est trop nulle pour mentir, regardez-la. »"
  },
  {
    title: "Faire dire « je te jure »",
    objective: "Fais dire « je te jure » (ou « je vous jure ») à un joueur.",
    rules: ["Il doit le dire naturellement.", "Tu peux le mettre en doute pour qu'il se justifie.", "Tu ne dois pas le dire avant lui."],
    example: "Exemple : « Mouais… t'es sûr de ce que tu dis ? »"
  },
  {
    title: "Lancer un jeu de mains",
    objective: "Fais faire un « pierre-feuille-ciseaux » ou un bras de fer entre deux joueurs.",
    rules: ["Deux joueurs doivent jouer.", "Tu peux être l'un des deux.", "Le groupe doit voir le résultat."],
    example: "Exemple : « On règle ça au pierre-feuille-ciseaux ? »"
  },
  {
    title: "Faire boire de l'eau",
    objective: "Fais boire un verre d'eau à un joueur.",
    rules: ["Il doit boire de l'eau, pas autre chose.", "Tu peux lui en servir un.", "Il doit au moins en boire une gorgée."],
    example: "Exemple : « Tiens, hydrate-toi champion, ça va être long. »"
  },
  {
    title: "Faire accuser deux fois la même personne",
    objective: "Fais accuser le même innocent par deux joueurs différents pendant la manche.",
    rules: ["Deux joueurs distincts doivent l'accuser.", "Ce ne doit pas être un traître.", "Tu peux semer le doute, pas dicter."],
    example: "Exemple : « Il a pas un peu trop regardé son téléphone tout à l'heure ? »"
  },
  {
    title: "Faire faire une imitation",
    objective: "Fais imiter quelqu'un (célébrité, prof, joueur…) à un joueur.",
    rules: ["L'imitation doit durer quelques secondes.", "Tu ne peux pas imiter à sa place.", "Une seule imitation suffit."],
    example: "Exemple : « Tu fais trop bien la voix de … non ? Fais-la ! »"
  },
  {
    title: "Faire dire « c'est pas moi »",
    objective: "Fais dire exactement « c'est pas moi » à un joueur.",
    rules: ["La phrase doit être claire.", "Accuser quelqu'un est autorisé.", "Ça ne compte pas si c'est toi qui la dis."],
    example: "Exemple : « Qui a fini les chips ?! »"
  },
  {
    title: "Faire voter contre un innocent",
    objective: "À la prochaine table ronde, au moins deux joueurs doivent voter contre la même personne innocente.",
    rules: ["Valide seulement si ça arrive vraiment.", "Ne vote pas toi-même contre un traître allié.", "Sois subtil."],
    example: "Exemple : rappelle discrètement un détail « suspect » sur ta cible."
  },
  {
    title: "Placer le mot secret",
    objective: "Place le mot secret 3 fois dans la conversation sans que personne ne le relève.",
    rules: ["Tu dois le dire toi-même, 3 fois.","Si quelqu'un te demande « pourquoi tu dis ça ? », c'est raté.","Phrases naturelles uniquement."],
    example: "Exemple : glisse-le dans une anecdote, une question, une blague.",
    secretWord: true
  },
  {
    title: "Faire écrire le mot secret",
    objective: "Fais écrire le mot secret à un joueur (message, papier, recherche…).",
    rules: ["Il doit l'écrire lui-même.","Tu peux lui demander de chercher quelque chose.","Le montrer suffit comme preuve."],
    example: "Exemple : « Tu peux chercher un truc sur Google pour moi ? »",
    secretWord: true
  },
  {
    title: "Le mot secret en chanson",
    objective: "Fais chanter ou fredonner une chanson qui contient le mot secret (ou invente-la avec quelqu'un).",
    rules: ["Quelqu'un d'autre doit chanter avec toi.","Le mot doit être chanté.","Ça doit avoir l'air spontané."],
    example: "Exemple : lance un « jeu des chansons » sur un thème.",
    secretWord: true
  },
  {
    title: "Faire deviner le mot secret",
    objective: "Fais deviner le mot secret à un joueur sans jamais le prononcer.",
    rules: ["Tu ne dis jamais le mot.","Il doit le dire à voix haute.","Personne ne doit comprendre que c'est un jeu."],
    example: "Exemple : « Comment ça s'appelle déjà, le truc qui… ? »",
    secretWord: true
  },
  {
    title: "Faire applaudir la table",
    objective: "Fais applaudir au moins trois joueurs en même temps.",
    rules: ["Les applaudissements doivent être sincères.","Tu peux provoquer une raison d'applaudir.","Pas de « applaudissez ! » direct."],
    example: "Exemple : annonce fièrement un exploit ridicule."
  },
  {
    title: "Faire vouvoyer quelqu'un",
    objective: "Fais vouvoyer un joueur par un autre joueur.",
    rules: ["Le vouvoiement doit être prononcé.","Une phrase suffit.","Tu ne peux pas demander « vouvoie-le »."],
    example: "Exemple : lance un jeu de rôle « patron / employé »."
  },
  {
    title: "Faire parler avec un accent",
    objective: "Fais parler un joueur avec un accent pendant au moins une phrase.",
    rules: ["N'importe quel accent.","Ça doit venir de lui.","Tu peux en faire un toi-même pour lancer."],
    example: "Exemple : « Il paraît que tu imites trop bien les Marseillais ? »"
  },
  {
    title: "Faire approuver une idée absurde",
    objective: "Fais dire « t'as raison » à quelqu'un sur une idée absurde que tu défends.",
    rules: ["L'idée doit être absurde.","Une personne suffit.","Ne force pas trop."],
    example: "Exemple : « Les pâtes, c'est meilleur froid, non ? »"
  },
  {
    title: "Faire raconter un rêve",
    objective: "Fais raconter un rêve (vrai ou inventé) à un joueur.",
    rules: ["Au moins 3 phrases.","Tu peux poser la question.","Pas toi-même."],
    example: "Exemple : « J'ai fait un rêve bizarre cette nuit, vous rêvez de quoi vous ? »"
  },
  {
    title: "Faire montrer un talent",
    objective: "Fais montrer un talent caché à un joueur (souplesse, beatbox, langue…).",
    rules: ["Il doit vraiment le faire devant le groupe.","Tu peux lancer le défi.","Ton propre talent ne compte pas."],
    example: "Exemple : « Qui ici sait faire un truc inutile mais impressionnant ? »"
  },
  {
    title: "Faire chuchoter",
    objective: "Fais chuchoter au moins deux joueurs en même temps.",
    rules: ["Ils doivent chuchoter quelques secondes.","Une raison crédible est permise.","Pas d'ordre direct."],
    example: "Exemple : « Chut ! Vous avez entendu ce bruit ? »"
  },
  {
    title: "Faire voter à main levée",
    objective: "Fais organiser un vote à main levée sur un sujet sans rapport avec le jeu.",
    rules: ["Au moins 3 mains levées.","Le sujet doit être hors jeu.","Tu peux proposer le sujet."],
    example: "Exemple : « Qui ici a déjà dormi dans une voiture ? Levez la main. »"
  },
  {
    title: "Se faire servir à boire",
    objective: "Fais-toi servir à boire par un autre joueur.",
    rules: ["Il doit te servir lui-même.","Demander poliment est autorisé, insister non.","L'eau compte."],
    example: "Exemple : tends ton verre vide en soupirant."
  },
  {
    title: "Faire répéter une blague",
    objective: "Raconte une blague et fais-la répéter par un autre joueur à quelqu'un d'autre.",
    rules: ["La blague doit être racontée deux fois.","La 2e fois, pas par toi.","Le groupe doit l'entendre."],
    example: "Exemple : « Raconte-la à Max, il l'a pas entendue ! »"
  },
  {
    title: "Faire un selfie de groupe",
    objective: "Fais prendre une photo d'au moins 3 joueurs.",
    rules: ["La photo doit être prise.","Pas forcément avec ton téléphone.","3 personnes minimum dessus."],
    example: "Exemple : « Attendez, cette soirée mérite une photo souvenir. »"
  },
  {
    title: "Faire danser",
    objective: "Fais danser au moins un joueur pendant 5 secondes.",
    rules: ["Danse visible par le groupe.","Une musique n'est pas obligatoire.","Tu peux danser aussi."],
    example: "Exemple : « Personne ne sait faire la danse de … ici ? »"
  },
  {
    title: "Faire parler de bouffe",
    objective: "Fais parler la table de nourriture pendant au moins 30 secondes.",
    rules: ["Au moins deux joueurs participent.","Tu peux lancer le sujet.","Ça doit durer 30 secondes."],
    example: "Exemple : « Le meilleur fast-food, c'est lequel, sérieux ? »"
  },
  {
    title: "Faire promettre un secret",
    objective: "Fais promettre à un joueur de garder un secret (inventé).",
    rules: ["Il doit dire « promis » ou « je dirai rien ».","Le secret peut être faux.","Personne d'autre ne doit l'entendre."],
    example: "Exemple : « Je peux te dire un truc ? Mais tu le répètes pas. »"
  },
  {
    title: "Faire compter à voix haute",
    objective: "Fais compter à voix haute jusqu'à 10 un joueur.",
    rules: ["Il doit compter lui-même.","Un défi peut servir de prétexte.","Jusqu'à 10 minimum."],
    example: "Exemple : « Retiens ta respiration, on compte combien tu tiens ! »"
  },
  {
    title: "Faire deviner un film",
    objective: "Lance un « devine le film » mimé et fais deviner au moins un film.",
    rules: ["Quelqu'un doit mimer ou deviner.","Au moins une bonne réponse.","Tu peux être le mime."],
    example: "Exemple : « Je mime un film, vous avez 30 secondes. »"
  },
  {
    title: "Faire changer de boisson",
    objective: "Fais changer de verre ou de boisson à un joueur.",
    rules: ["Il doit prendre une autre boisson.","Tu peux proposer un échange.","Visible par toi."],
    example: "Exemple : « Goûte ça, c'est meilleur que ce que tu bois. »"
  },
  {
    title: "Faire dire un compliment",
    objective: "Fais faire un compliment par un joueur à un autre (pas toi).",
    rules: ["Le compliment doit être sincère ou drôle.","Entre deux autres joueurs.","À voix haute."],
    example: "Exemple : « Qui a le meilleur style ce soir d'après vous ? »"
  },
  {
    title: "Faire raconter une première fois",
    objective: "Fais raconter à un joueur une « première fois » (premier job, premier concert…).",
    rules: ["Au moins 3 phrases.","Thème libre.","Pas toi."],
    example: "Exemple : « C'était quoi ton premier concert ? »"
  },
  {
    title: "Faire parier",
    objective: "Fais parier quelque chose (gorgée, gage…) entre deux joueurs.",
    rules: ["Le pari doit être accepté par les deux.","Tu peux en être l'arbitre.","Pas sur le jeu en cours."],
    example: "Exemple : « Je parie que tu tiens pas 10 secondes sur un pied. »"
  },
  {
    title: "Faire bloquer quelqu'un",
    objective: "Pose une question qui fait dire « euh… » à un joueur pendant au moins 3 secondes.",
    rules: ["Le blanc doit être audible.","Question honnête.","Une personne suffit."],
    example: "Exemple : « Cite-moi trois capitales d'Afrique, vite ! »"
  },
  {
    title: "Faire donner un surnom",
    objective: "Fais donner un nouveau surnom à un joueur par un autre.",
    rules: ["Le surnom doit être prononcé.","Pas par toi.","Il doit être repris au moins une fois."],
    example: "Exemple : « Il lui faut un surnom de catcheur, vous proposez quoi ? »"
  },
  {
    title: "Te faire innocenter",
    objective: "Fais dire par un joueur que tu ne peux pas être le traître.",
    rules: ["La phrase doit être claire.","Tu peux te plaindre d'être soupçonné.","Un seul joueur suffit."],
    example: "Exemple : « Personne ne me croit jamais… »"
  },
  {
    title: "Faire accuser au pif",
    objective: "Fais dire à un joueur « je pense que c'est … » en visant un innocent.",
    rules: ["La cible doit être innocente.","Il doit nommer quelqu'un.","Ne vise pas un traître allié."],
    example: "Exemple : « Si tu devais parier sur quelqu'un là, maintenant ? »"
  },
  {
    title: "Faire tenir un objet",
    objective: "Fais tenir un objet inutile à un joueur pendant 1 minute.",
    rules: ["L'objet doit rester dans sa main 1 minute.","Tu peux le lui confier.","Il ne doit pas savoir pourquoi."],
    example: "Exemple : « Tiens-moi ça deux secondes. »"
  },
  {
    title: "Faire parler d'enfance",
    objective: "Fais raconter un souvenir d'école ou d'enfance à un joueur.",
    rules: ["Au moins 3 phrases.","Pas toi.","Une question peut lancer le sujet."],
    example: "Exemple : « T'étais quel genre d'élève au collège ? »"
  },
  {
    title: "Faire faire une grimace",
    objective: "Fais tirer la langue ou faire une grimace à un joueur.",
    rules: ["Visible par toi.","Un défi photo marche.","Pas d'ordre direct."],
    example: "Exemple : « On fait une photo grimace ? »"
  },
  {
    title: "Faire noter sur 10",
    objective: "Fais donner une note sur 10 à quelque chose par au moins deux joueurs.",
    rules: ["Deux notes minimum.","Sujet libre.","Tu peux lancer le classement."],
    example: "Exemple : « Cette musique, vous lui mettez combien sur 10 ? »"
  },
  {
    title: "Faire regarder ailleurs",
    objective: "Fais regarder dehors (ou vers la porte) au moins deux joueurs en même temps.",
    rules: ["Deux joueurs regardent en même temps.","Une excuse crédible est autorisée.","Pas de bruit volontaire."],
    example: "Exemple : « Il pleut encore dehors ou pas ? »"
  },
  {
    title: "Faire dire « traître » trois fois",
    objective: "Fais dire le mot « traître » trois fois par d'autres joueurs pendant la manche.",
    rules: ["Trois fois au total, pas par toi.","N'importe quels joueurs.","Pendant cette manche."],
    example: "Exemple : lance la discussion sur les pires traîtres des séries."
  },
  {
    title: "Faire parler d'animaux",
    objective: "Fais raconter une histoire d'animal à un joueur.",
    rules: ["Au moins 3 phrases.","Vrai ou inventé.","Pas toi."],
    example: "Exemple : « Vous avez déjà eu un animal bizarre ? »"
  },
  {
    title: "Provoquer un fou rire",
    objective: "Fais rire un joueur précis au point qu'il doive s'arrêter de parler.",
    rules: ["Fou rire visible.","Une personne suffit.","Les chatouilles ne comptent pas."],
    example: "Exemple : grimace discrète pendant qu'il parle."
  },
  {
    title: "Lancer un « tu préfères »",
    objective: "Fais répondre trois joueurs à un « tu préfères… ? » que tu proposes.",
    rules: ["Trois réponses minimum.","La question doit être drôle.","Tout le monde peut répondre."],
    example: "Exemple : « Tu préfères ne plus jamais boire de café ou ne plus dormir plus de 6 h ? »"
  },
  {
    title: "Faire parler d'un ex",
    objective: "Fais prononcer le prénom d'un ou d'une ex à un joueur.",
    rules: ["Le prénom doit être dit.","Sois délicat… ou pas.","Une seule personne suffit."],
    example: "Exemple : « Le pire date de ta vie, c'était avec qui ? »"
  },
  {
    title: "Faire rejouer une scène culte",
    objective: "Fais rejouer une scène de film ou de série à deux joueurs.",
    rules: ["Deux joueurs jouent la scène.","Au moins une réplique chacun.","Tu peux être le réalisateur."],
    example: "Exemple : « Vous deux, rejouez la scène du … »"
  },
  {
    title: "Faire dire l'heure",
    objective: "Fais dire l'heure à voix haute à un joueur.",
    rules: ["Il doit dire l'heure.","Ne la demande pas directement.","Une fois suffit."],
    example: "Exemple : « On a encore le temps pour une partie ? »"
  },
  {
    title: "Faire dire « bonne question »",
    objective: "Fais dire exactement « bonne question » à un joueur.",
    rules: ["L'expression exacte.","Pose des questions difficiles.","Une fois suffit."],
    example: "Exemple : « Si t'étais un légume, tu serais lequel et pourquoi ? »"
  },
  {
    title: "Faire grignoter",
    objective: "Fais manger quelque chose à un joueur (chips, bonbon…).",
    rules: ["Il doit manger devant toi.","Tu peux lui proposer.","Pendant cette manche."],
    example: "Exemple : fais passer le bol de chips mine de rien."
  }
];

// Mots secrets tirés au hasard pour la mission « Faire dire un mot secret ».
export const SECRET_WORDS = ["pizza","licorne","banane","vacances","dinosaure","fromage","Netflix","trampoline","pingouin","karaoké","tacos","Mbappé","girafe","parapluie","ananas","astronaute","chaussette","volcan","croissant","kangourou","moustache","saucisson","fusée","pyjama","raclette","sardine","camping","baguette","tortue","ninja","zombie","pirate","vampire","sorcière","princesse","cowboy","hamburger","spaghetti","sushi","crêpe","Nutella","avocat","brocoli","concombre","citrouille","caramel","chocolat","popcorn","PlayStation","TikTok","Instagram","Spotify","YouTube","wifi","Bluetooth","selfie","emoji","podcast","Paris","Marseille","Tokyo","Brésil","Australie","Canada","Espagne","Japon","Égypte","Hawaï","piscine","plage","montagne","désert","jungle","igloo","château","sous-marin","hélicoptère","trottinette","guitare","batterie","trompette","disco","rap","opéra","salsa","tango","football","basket","tennis","rugby","ski","surf","judo","bowling","pétanque","aspirateur","frigo","micro-ondes","tournevis","lampe","canapé","oreiller","valise","cactus","tournesol","mamie","voisin","facteur","pompier","dentiste","boulanger","magicien","clown","Père Noël","superhéros"];

export const WINNER_REWARDS = [
  "Les gagnants peuvent distribuer 5 gorgées 👑",
  "Les gagnants choisissent quelqu’un qui boit 🍻",
  "Les gagnants inventent une mini-règle pour le prochain jeu",
  "Les gagnants sont safe pour la prochaine punition"
];
