PartyHub V40.1 — Chaos Kings Rework Prototype

Base utilisée : PartyHub.com-v36-lobby-premium.zip

Modifications ciblées :
- games/chaos-kings/chaos-kings.js uniquement.

Ajouts :
- Nouveau système de variantes via variants[].
- As / Waterfall : 20 variantes.
- Roi / King : 20 variantes.
- Les autres cartes ont déjà un début de pool variants[] pour rester compatibles.
- Le tirage utilise maintenant un pool unique aléatoire au lieu de rester bloqué sur Chill / Party / Chaos / Hardcore pour le texte principal.
- L'intensité alcool devient aléatoire avec un plafond lié au réglage global : soft, normal, hard, danger/extreme.

Non modifié :
- Firebase rooms.
- TV mode.
- Roulette.
- Most Likely.
- Survivor.
- Lobby.
- Reset Chaos Kings réservé au host.
- Pioche Chaos Kings accessible à tous les joueurs.
