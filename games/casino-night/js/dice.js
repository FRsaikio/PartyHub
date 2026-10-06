// Dés du Diable : gratuit, juste du chaos. Certains résultats font gagner/perdre des jetons.

import { sound, sleep, formatChips, showResult, cinematic, goldRain } from "./ui.js";

// Résultats (ordre indifférent : "1-6" et "6-1" sont identiques).
const RULES = {
  "1-1": { text: "☠️ Snake Eyes : cul sec + relance obligatoire." },
  "2-2": { text: "🍺 Double 2 : bois avec tes deux voisins." },
  "3-3": { text: "😈 Double 3 : tu bois à chaque rire pendant 3 minutes." },
  "4-4": { text: "💣 Double 4 : défi humiliation obligatoire." },
  "5-5": { text: "🔥 Double 5 : tout le monde prend un shot." },
  "6-6": { text: "👑 Devil Jackpot : distribue 25 gorgées et gagne 500 jetons.", chips: 500, jackpot: true },
  "1-6": { text: "😈 Le démon : tu bois à chaque prénom entendu pendant 5 minutes." },
  "2-5": { text: "🍺 Shot partagé avec la personne de ton choix." },
  "3-4": { text: "💣 Défi humiliation." },
  "1-2": { text: "💀 Mini enfer : double shot." },
  "1-3": { text: "🚨 Le dernier à lever la main boit." },
  "1-4": { text: "🍺 Bois 8 gorgées." },
  "1-5": { text: "🔥 Shot + choisis quelqu’un qui boit avec toi." },
  "2-3": { text: "😈 Parle avec un accent pendant 5 minutes." },
  "2-4": { text: "💀 Verre cul sec ou double shot." },
  "2-6": { text: "👑 Distribue 12 gorgées." },
  "3-5": { text: "🚨 Tout le monde vote : tu bois ou tu désignes une victime." },
  "3-6": { text: "🔥 Shot collectif avec les perdants du dernier jeu." },
  "4-5": { text: "☠️ Taxe du casino : perds 300 jetons ou prends un shot.", pay: 300, alt: "Prendre le shot" },
  "4-6": { text: "💣 Mission impossible : fais rire quelqu’un, sinon shot." },
  "5-6": { text: "👑 Tu gagnes 500 jetons… mais tu bois.", chips: 500 }
};

// Position des points sur une grille 3×3 (cases 1 à 9) pour chaque face.
const PIPS = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };

function setFace(dieEl, n) {
  dieEl.dataset.value = n;
  dieEl.setAttribute("aria-label", `Dé : ${n}`);
  dieEl.replaceChildren(...Array.from({ length: 9 }, (_, i) => {
    const cell = document.createElement("span");
    cell.className = PIPS[n].includes(i + 1) ? "pip" : "pip empty";
    return cell;
  }));
}

const roll = () => Math.floor(Math.random() * 6) + 1;

export function initDice(ctx) {
  const dice = [document.getElementById("die1"), document.getElementById("die2")];
  const rollBtn = document.getElementById("rollDiceBtn");
  const resultBox = document.getElementById("diceResult");
  let rolling = false;

  dice.forEach(d => setFace(d, roll()));
  showResult(resultBox, { title: "Les dés attendent…", lines: ["Gratuit, mais le diable n'oublie rien."], tone: "info" });

  rollBtn.addEventListener("click", async () => {
    if (rolling) return;
    rolling = true;
    rollBtn.disabled = true;
    dice.forEach(d => d.classList.add("rolling"));
    sound.spin();

    for (let i = 0; i < 12; i++) {
      dice.forEach(d => setFace(d, roll()));
      await sleep(70 + i * 6);
    }

    const a = roll();
    const b = roll();
    setFace(dice[0], a);
    setFace(dice[1], b);
    dice.forEach(d => d.classList.remove("rolling"));
    sound.card();

    const key = a <= b ? `${a}-${b}` : `${b}-${a}`;
    const rule = RULES[key] || { text: "🍺 Bois 5 gorgées." };
    const lines = [rule.text];
    if (a + b === 7) lines.push("🎰 Total 7 : tu rejoues ou tu bois double.");

    let tone = a === b ? "gold" : "info";
    let choices = [];

    if (rule.chips) {
      ctx.wallet.add(rule.chips);
      lines.push(`💰 +${formatChips(rule.chips)} jetons`);
      tone = "gold";
    }

    if (rule.pay) {
      choices = [
        {
          label: `Payer ${formatChips(rule.pay)} jetons`,
          variant: "primary",
          onClick: () => {
            if (!ctx.wallet.canAfford(rule.pay)) return ctx.toast("Pas assez de jetons : c'est le shot.", "lose");
            ctx.wallet.add(-rule.pay);
            ctx.toast(`💸 -${formatChips(rule.pay)} jetons : le diable est payé.`, "info");
          }
        },
        { label: rule.alt, variant: "secondary" }
      ];
    }

    if (rule.jackpot) {
      sound.jackpot();
      cinematic("DEVIL JACKPOT", "Double 6", "gold");
      goldRain();
      ctx.wallet.announce("a sorti le DEVIL JACKPOT (double 6) ! +500 jetons", "gold");
    } else if (a === b) {
      sound.alarm();
      cinematic("DOUBLE DÉS", "Le casino te regarde", "red");
    }

    showResult(resultBox, { title: `${a} + ${b} = ${a + b}`, lines, tone, choices });
    rolling = false;
    rollBtn.disabled = false;
  });
}
