// Dés du Diable : gratuit, juste du chaos. Certains résultats font gagner/perdre des jetons.

import { sound, sleep, formatChips, showResult, cinematic, goldRain } from "./ui.js";

// Résultats (ordre indifférent : "1-6" et "6-1" sont identiques).
const RULES = {
  "1-1": { text: "☠️ Snake Eyes : demi-verre cul sec + relance obligatoire." },
  "2-2": { text: "🍺 Double 2 : bois avec tes deux voisins." },
  "3-3": { text: "😈 Double 3 : jusqu'à ton prochain lancer, tu bois 1 gorgée à chaque rire." },
  "4-4": { text: "💣 Double 4 : gage choisi par le groupe." },
  "5-5": { text: "🔥 Double 5 : tout le monde prend un shot." },
  "6-6": { text: "👑 Devil Jackpot : distribue 10 gorgées et gagne 500 jetons.", chips: 500, jackpot: true },
  "1-6": { text: "😈 Le démon : jusqu'à ton prochain lancer, tu bois 1 gorgée à chaque prénom prononcé." },
  "2-5": { text: "🍺 Shot partagé avec la personne de ton choix." },
  "3-4": { text: "💣 Gage choisi par le groupe." },
  "1-2": { text: "💀 Mini enfer : un shot." },
  "1-3": { text: "🚨 Le dernier à lever la main boit." },
  "1-4": { text: "🍺 Bois 5 gorgées." },
  "1-5": { text: "🔥 Shot + choisis quelqu’un qui boit avec toi." },
  "2-3": { text: "😈 Parle avec un accent jusqu'à ton prochain lancer." },
  "2-4": { text: "💀 Demi-verre cul sec ou un shot." },
  "2-6": { text: "👑 Distribue 6 gorgées." },
  "3-5": { text: "🚨 Tout le monde vote : tu bois ou tu désignes une victime." },
  "3-6": { text: "🔥 Shot collectif avec les perdants du dernier jeu." },
  "4-5": { text: "☠️ Taxe du casino : perds 300 jetons ou prends un shot.", pay: 300, alt: "Prendre le shot" },
  "4-6": { text: "💣 Mission impossible : fais rire quelqu’un, sinon shot." },
  "5-6": { text: "👑 Tu gagnes 500 jetons… mais tu bois.", chips: 500 }
};

// Position des points sur une grille 3×3 (cases 1 à 9) pour chaque face.
const PIPS = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };

// Dé en 3D : un cube à 6 faces. Rotation du cube (en degrés) qui amène chaque
// valeur face à l'écran ; doit correspondre aux faces .f1…f6 de style.css.
const SHOW = { 1: [0, 0], 2: [0, -90], 3: [-90, 0], 4: [90, 0], 5: [0, 90], 6: [0, 180] };

function buildCube(dieEl) {
  const cube = document.createElement("div");
  cube.className = "die-cube";
  for (let n = 1; n <= 6; n++) {
    const face = document.createElement("div");
    face.className = `die-face f${n}`;
    face.append(...Array.from({ length: 9 }, (_, i) => {
      const cell = document.createElement("span");
      cell.className = PIPS[n].includes(i + 1) ? "pip" : "pip empty";
      return cell;
    }));
    cube.appendChild(face);
  }
  const shadow = document.createElement("div");
  shadow.className = "die-shadow";
  dieEl.replaceChildren(cube, shadow);
  dieEl.turns = { x: 0, y: 0 };
  return cube;
}

// Fait rouler le cube de plusieurs tours, puis le pose sur `value`.
function spinTo(dieEl, value, animate = true) {
  const cube = dieEl.querySelector(".die-cube");
  const [baseX, baseY] = SHOW[value];
  if (animate) {
    // 2 à 3 tours complets supplémentaires sur chaque axe (toujours dans le même sens).
    dieEl.turns.x += 2 + Math.floor(Math.random() * 2);
    dieEl.turns.y += 2 + Math.floor(Math.random() * 2);
  }
  cube.style.transition = animate ? "transform 1.25s cubic-bezier(0.2, 0.75, 0.25, 1)" : "none";
  cube.style.transform = `rotateX(${baseX + dieEl.turns.x * 360}deg) rotateY(${baseY + dieEl.turns.y * 360}deg)`;
  dieEl.dataset.value = value;
  dieEl.setAttribute("aria-label", `Dé : ${value}`);
}

const roll = () => Math.floor(Math.random() * 6) + 1;

export function initDice(ctx) {
  const dice = [document.getElementById("die1"), document.getElementById("die2")];
  const rollBtn = document.getElementById("rollDiceBtn");
  const resultBox = document.getElementById("diceResult");
  let rolling = false;

  dice.forEach(d => { buildCube(d); spinTo(d, roll(), false); });
  showResult(resultBox, { title: "Les dés attendent…", lines: ["Gratuit, mais le diable n'oublie rien."], tone: "info" });

  rollBtn.addEventListener("click", async () => {
    if (rolling) return;
    rolling = true;
    rollBtn.disabled = true;
    sound.spin();

    const a = roll();
    const b = roll();

    // Lancer : saut + rebond (CSS) pendant que chaque cube roule jusqu'à sa face.
    dice.forEach(d => {
      d.classList.remove("thrown");
      void d.offsetWidth;
      d.classList.add("thrown");
    });
    spinTo(dice[0], a);
    spinTo(dice[1], b);

    await sleep(1300);
    dice.forEach(d => d.classList.remove("thrown"));
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
