// « Comment jouer » : règles courtes affichées au lancement de chaque jeu.
// Téléphones : fenêtre au chargement (case « Ne plus afficher pour ce jeu ») + bouton ❓ pour la
// rouvrir. TV (?tv=1 / spectateur) : règles en grand pendant 20 secondes, sans bouton.
// Le style vit dans neon-game.css (.howto-*).

export const HOW_TO = {
  blindtest: {
    icon: "🎧", title: "Blind test",
    rules: [
      "L’hôte choisit les thèmes et le nombre d’extraits, puis lance.",
      "La musique sort de la TV (sinon du téléphone de l’hôte).",
      "Sur ton téléphone : 4 propositions. Touche la bonne réponse le plus vite possible.",
      "Bonne réponse = 500 à 1000 points selon ta rapidité. Mauvaise = 0.",
      "La réponse s’affiche quand tout le monde a répondu (ou au bout de 25 s)."
    ]
  },
  mostLikely: {
    icon: "👑", title: "Qui est le plus susceptible ?",
    rules: [
      "Une question s’affiche : « Qui est le plus susceptible de… ? »",
      "Vote en secret pour la personne qui colle le mieux.",
      "Prédis aussi qui sera désigné par le groupe.",
      "Les votes sont révélés un par un : le plus désigné prend la punition.",
      "Bonne prédiction = 1 point de devin. Le meilleur devin gagne."
    ]
  },
  never: {
    icon: "🍺", title: "Je n’ai jamais",
    rules: [
      "Une phrase « Je n’ai jamais… » s’affiche.",
      "Réponds en secret : « Je l’ai déjà fait » ou « Jamais ».",
      "Parie aussi sur le nombre de joueurs qui l’ont fait.",
      "Tout est révélé d’un coup : ceux qui l’ont fait prennent la punition.",
      "Le pronostic le plus proche marque 1 point."
    ]
  },
  truth: {
    icon: "🎯", title: "Action ou Vérité",
    rules: [
      "Chacun son tour, dans l’ordre affiché.",
      "Le joueur choisit Action ou Vérité, puis répond ou fait le défi.",
      "Il peut refuser… et prend alors la punition.",
      "Les autres jugent en secret : ✅ validé ou 🙄 bidon.",
      "Majorité de « bidon » = punition quand même (égalité = validé)."
    ]
  },
  survivor: {
    icon: "🏝️", title: "Survivor",
    rules: [
      "Chaque manche commence par une épreuve, sur téléphone ou en vrai.",
      "Le gagnant est immunisé, le perdant prend une punition.",
      "Au conseil, chacun vote en secret : le plus voté perd un flambeau 🔥.",
      "Des idoles et des avantages secrets peuvent tout changer.",
      "Plus de flambeau = éliminé. En finale, le jury des éliminés désigne le Survivant."
    ]
  },
  traitor: {
    icon: "🕵️", title: "Mission Traître",
    rules: [
      "Chacun reçoit un rôle secret : innocent ou traître. Ne le montre à personne !",
      "Les traîtres ont des missions secrètes à réussir discrètement pendant la soirée.",
      "Le jour : on discute, puis on vote pour bannir un suspect.",
      "La nuit : tout le monde touche son écran, les traîtres choisissent une victime.",
      "Innocents : bannissez tous les traîtres. Traîtres : égalez les innocents ou réussissez vos missions."
    ]
  },
  bomb: {
    icon: "💣", title: "La Bombe",
    rules: [
      "La bombe passe de téléphone en téléphone. La mèche est cachée !",
      "Quand tu l’as : réponds (catégorie, mot avec la syllabe ou question), puis passe-la.",
      "Le groupe peut contester une réponse douteuse.",
      "Si elle explose dans tes mains : tu perds une vie et tu prends une punition.",
      "Des pouvoirs aident (+5 s, demi-tour, saut…). Le dernier survivant gagne."
    ]
  },
  roulette: {
    icon: "🎡", title: "Roulette Chaos",
    rules: [
      "Chacun son tour, lance la roue depuis ton téléphone.",
      "🍺 BOIS, 🎁 DISTRIBUE (tu répartis des gorgées), 👥 TOUS, ⚔️ DUEL sur téléphone.",
      "🍀 CHANCE te donne un bonus à garder (bouclier, miroir, cadeau empoisonné).",
      "⚡ CHAOS déclenche un événement pour le groupe.",
      "Événements rares : Furie (tout compte double), Mort subite, Jackpot…"
    ]
  },
  kings: {
    icon: "👑", title: "Chaos Kings",
    rules: [
      "Chacun son tour, pioche une carte depuis ton téléphone.",
      "Chaque valeur a sa règle : lis le scénario et applique-le.",
      "Certaines cartes se jouent sur les téléphones : cible, réflexe, pote, règle, maître des questions.",
      "Chaque roi remplit la Chaos Cup… celui qui tire le 4e roi la boit.",
      "La jauge de chaos déclenche des effets qui durent plusieurs tours."
    ]
  },
  monopoly: {
    icon: "🎲", title: "Monopoly Party",
    rules: [
      "Lance les dés à ton tour. Un double = tu rejoues (3 doubles = prison).",
      "Achète les lieux libres : les autres te paient un loyer en jetons ET en gorgées.",
      "Un quartier complet double les loyers. Rénove tes lieux (⭐ à ⭐⭐⭐).",
      "Cases spéciales : chance, défi, duel, casino, taxi…",
      "À la fin des tours, le plus riche (jetons + lieux) gagne."
    ]
  }
};

const storageKey = gameId => `partyhubHowTo:${gameId}`;

function element(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text != null) el.textContent = text;
  return el;
}

function openHowTo(gameId, { tv = false } = {}) {
  const info = HOW_TO[gameId];
  if (!info) return;
  document.getElementById("howtoOverlay")?.remove();
  const overlay = element("div", `howto-overlay${tv ? " howto-tv" : ""}`);
  overlay.id = "howtoOverlay";
  const card = element("div", "howto-card");
  card.append(element("span", "howto-kicker", "Comment jouer"), element("h2", "", `${info.icon} ${info.title}`));
  const list = element("ol", "howto-rules");
  info.rules.forEach(rule => list.append(element("li", "", rule)));
  card.append(list);
  const close = () => overlay.remove();
  if (tv) {
    const bar = element("div", "howto-timer");
    bar.append(element("i"));
    card.append(bar);
    setTimeout(close, 20000);
  } else {
    const label = element("label", "howto-skip");
    const box = document.createElement("input");
    box.type = "checkbox";
    try { box.checked = localStorage.getItem(storageKey(gameId)) === "hide"; } catch { /* stockage indisponible */ }
    label.append(box, document.createTextNode(" Ne plus afficher au lancement de ce jeu"));
    const go = element("button", "btn primary big-btn", "C’est parti !");
    go.type = "button";
    go.addEventListener("click", () => {
      try {
        if (box.checked) localStorage.setItem(storageKey(gameId), "hide");
        else localStorage.removeItem(storageKey(gameId));
      } catch { /* stockage indisponible */ }
      close();
    });
    card.append(label, go);
    overlay.addEventListener("click", event => { if (event.target === overlay) close(); });
  }
  overlay.append(card);
  document.body.append(overlay);
}

// À appeler une fois au chargement de la page du jeu.
export function initHowTo(gameId, { spectator = false } = {}) {
  if (!HOW_TO[gameId]) return;
  if (spectator) {
    openHowTo(gameId, { tv: true });
    return;
  }
  const help = element("button", "howto-help", "❓");
  help.type = "button";
  help.title = "Comment jouer";
  help.setAttribute("aria-label", "Comment jouer");
  help.addEventListener("click", () => openHowTo(gameId));
  document.body.append(help);
  let hidden = false;
  try { hidden = localStorage.getItem(storageKey(gameId)) === "hide"; } catch { /* stockage indisponible */ }
  if (!hidden) openHowTo(gameId);
}
