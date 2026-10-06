// Machine à sous infernale.
// La mise est prélevée au lancement ; les gains renvoient mise comprise (×multiplicateur).

import { sound, sleep, pick, formatChips, showResult, cinematic, goldRain } from "./ui.js";

// Poids : plus le nombre est grand, plus le symbole sort souvent. Le 7 est rare.
const SYMBOLS = [
  { s: "💀", w: 3 }, { s: "🔥", w: 3 }, { s: "🍺", w: 3 },
  { s: "👑", w: 2 }, { s: "💣", w: 3 }, { s: "😈", w: 3 },
  { s: "🚨", w: 3 }, { s: "🃏", w: 3 }, { s: "7️⃣", w: 1 }
];
const BAG = SYMBOLS.flatMap(({ s, w }) => Array(w).fill(s));
const randomSymbol = () => pick(BAG);

// Combos spéciaux : texte + gain (multiplicateur de la mise) + effets éventuels.
const COMBOS = {
  "7️⃣7️⃣7️⃣": { text: "☠️ 777 INFERNAL : tout le monde cul sec sauf toi.", mult: 10, jackpot: true },
  "💀💀💀": { text: "💀 Cul sec + relance obligatoire.", mult: 3 },
  "🔥🔥🔥": { text: "🔥 Tout le monde prend un shot.", mult: 4 },
  "🍺🍺🍺": { text: "🍺 Distribue 20 gorgées.", mult: 3 },
  "👑👑👑": { text: "👑 Couronne noire : immunité + tu voles 300 jetons au plus riche.", mult: 3, steal: 300 },
  "💣💣💣": { text: "💣 Bombe totale : défi humiliation ou double shot.", mult: 3 },
  "😈😈😈": { text: "😈 Mode démon : tu bois à chaque rire pendant 7 minutes.", mult: 3 },
  "🚨🚨🚨": { text: "🚨 Contrôle casino : le dernier à toucher son téléphone fait cul sec.", mult: 3 },
  "🃏🃏🃏": { text: "🃏 Joker maudit : invente une règle, mais tu subis aussi la prochaine sanction.", mult: 3 },
  "💣🔥💀": { text: "☠️ TRIPLE CHAOS : shot + défi + relance forcée.", mult: 1.5 },
  "👑💀👑": { text: "👑 VIP empoisonné : choisis une victime, elle boit avec toi.", mult: 1.5 },
  "🚨🔥💀": { text: "🚨 Dernier à lever son téléphone : double shot.", mult: 1.5 },
  "🃏🍺💀": { text: "🍺 Choisis un duo : ils finissent un verre ensemble.", mult: 1.5 },
  "💣👑💀": { text: "💀 ALL IN TRAP : utilise une protection ou cul sec.", mult: 1.5, trap: true },
  "🔥💀🔥": { text: "🔥 Casino meltdown : tout le monde boit, toi tu relances.", mult: 1.5 },
  "7️⃣💀7️⃣": { text: "☠️ Faux jackpot : +500 jetons, mais tu prends un shot.", mult: 1, bonus: 500 },
  "7️⃣👑7️⃣": { text: "👑 Jackpot royal : tu voles 500 jetons au plus riche et distribues 10 gorgées.", mult: 1.5, steal: 500 }
};

// Sanctions en cas de combinaison perdante. `pay` = alternative en jetons.
const FAILS = [
  { text: "💀 Mauvaise combinaison : shot immédiat." },
  { text: "🔥 Double shot pour le lanceur." },
  { text: "🍺 Bois avec ton voisin de gauche." },
  { text: "🍺 Bois avec ton voisin de droite." },
  { text: "😈 Tu bois à chaque prénom entendu pendant 2 minutes." },
  { text: "💣 Défi humiliation obligatoire." },
  { text: "🚨 Le plus sobre boit avec toi." },
  { text: "🃏 Choisis quelqu’un : il partage ta sanction." },
  { text: "👑 Le joueur avec le plus de jetons te donne une punition." },
  { text: "🔥 Tout le monde vote : tu bois ou tu fais boire ? Égalité = les deux." },
  { text: "💀 Rejoue tout de suite. Si tu reperds : cul sec." },
  { text: "😈 Tu finis chaque phrase par « casino » pendant 5 minutes. Oubli = gorgée." },
  { text: "🚨 Le dernier à crier JACKPOT boit avec toi." },
  { text: "💣 Perds 200 jetons ou prends un double shot.", pay: 200, alt: "Prendre le double shot" }
];

const SYMBOL_HEIGHT_VAR = "--slot-symbol-h";

export function initSlots(ctx) {
  const machine = document.getElementById("slotMachine");
  const reels = [...machine.querySelectorAll(".reel-strip")];
  const spinBtn = document.getElementById("spinBtn");
  const resultBox = document.getElementById("slotResult");
  let spinning = false;

  // Affiche un symbole de départ sur chaque rouleau.
  reels.forEach(strip => fillStrip(strip, [randomSymbol()]));

  function fillStrip(strip, symbols) {
    strip.replaceChildren(...symbols.map(s => {
      const cell = document.createElement("div");
      cell.className = "reel-symbol";
      cell.textContent = s;
      return cell;
    }));
  }

  // Fait défiler un rouleau puis l'arrête sur `finalSymbol`.
  async function spinReel(strip, finalSymbol, duration) {
    const current = strip.lastElementChild?.textContent || randomSymbol();
    const symbols = [current, ...Array.from({ length: 22 }, randomSymbol), finalSymbol];
    fillStrip(strip, symbols);

    const h = parseFloat(getComputedStyle(machine).getPropertyValue(SYMBOL_HEIGHT_VAR)) || 96;
    strip.style.transition = "none";
    strip.style.transform = "translateY(0)";
    void strip.offsetHeight;
    strip.style.transition = `transform ${duration}ms cubic-bezier(0.15, 0.85, 0.25, 1)`;
    strip.style.transform = `translateY(${-(symbols.length - 1) * h}px)`;
    await sleep(duration + 30);

    // On ne garde que le symbole final, sans décalage.
    strip.style.transition = "none";
    strip.style.transform = "translateY(0)";
    fillStrip(strip, [finalSymbol]);
    sound.card();
  }

  spinBtn.addEventListener("click", async () => {
    if (spinning) return;
    const bet = ctx.placeBet();
    if (!bet) return;

    spinning = true;
    spinBtn.disabled = true;
    machine.classList.remove("win", "jackpot", "lose");
    machine.classList.add("spinning");
    showResult(resultBox, { title: "Les rouleaux tournent…", tone: "info" });
    sound.spin();

    const result = [randomSymbol(), randomSymbol(), randomSymbol()];
    await Promise.all([
      spinReel(reels[0], result[0], 1100),
      spinReel(reels[1], result[1], 1550),
      spinReel(reels[2], result[2], 2000)
    ]);

    machine.classList.remove("spinning");
    resolve(result, bet);
    spinning = false;
    spinBtn.disabled = false;
  });

  function resolve(result, bet) {
    const combo = result.join("");
    const special = COMBOS[combo];
    const triple = result[0] === result[1] && result[1] === result[2];

    if (special || triple) {
      const rule = special || { text: "🎰 Triple ! Distribue 5 gorgées.", mult: 3 };
      let payout = Math.floor(bet.amount * rule.mult) + (rule.bonus || 0);
      const lines = [rule.text];

      if (bet.allIn) {
        payout *= 2;
        lines.push("🔥 ALL IN réussi : gain doublé.");
      }
      ctx.wallet.add(payout);
      lines.push(`💰 +${formatChips(payout)} jetons`);

      if (rule.steal) {
        const stolen = ctx.wallet.stealFromRichest(rule.steal);
        if (stolen?.amount) {
          lines.push(`🦹 Tu voles ${formatChips(stolen.amount)} jetons à ${stolen.victim}.`);
          ctx.wallet.announce(`a volé ${formatChips(stolen.amount)} jetons à ${stolen.victim} à la machine à sous !`, "pink");
        }
      }

      if (rule.jackpot) {
        machine.classList.add("jackpot");
        sound.jackpot();
        cinematic("JACKPOT 777", `+${formatChips(payout)} jetons`, "gold");
        goldRain();
        ctx.wallet.announce(`a touché le JACKPOT 777 ! +${formatChips(payout)} jetons`, "gold");
      } else {
        machine.classList.add("win");
        sound.win();
        if (payout >= bet.amount * 4) ctx.wallet.announce(`a gagné ${formatChips(payout)} jetons à la machine à sous`, "gold");
      }

      // Le piège « utilise une protection ou cul sec ».
      const choices = rule.trap ? ctx.sanctionChoices() : [];
      showResult(resultBox, { title: `${result.join("  ")}`, lines, tone: rule.jackpot ? "gold" : "win", choices });
      return;
    }

    // Combinaison perdante
    machine.classList.add("lose");
    sound.lose();
    const fail = pick(FAILS);
    const lines = [fail.text, `💸 Mise perdue : -${formatChips(bet.amount)} jetons`];
    if (bet.allIn) lines.push("⚠️ ALL IN raté : sanction doublée.");

    const choices = [];
    if (fail.pay) {
      choices.push({
        label: `Payer ${formatChips(fail.pay)} jetons`,
        variant: "primary",
        onClick: () => {
          if (!ctx.wallet.canAfford(fail.pay)) return ctx.toast("Pas assez de jetons : c'est le double shot.", "lose");
          ctx.wallet.add(-fail.pay);
          ctx.toast(`💸 -${formatChips(fail.pay)} jetons : sanction évitée.`, "info");
        }
      });
      choices.push({ label: fail.alt, variant: "secondary" });
    } else {
      choices.push(...ctx.sanctionChoices());
    }

    showResult(resultBox, { title: `${result.join("  ")}`, lines, tone: "lose", choices });
  }
}
