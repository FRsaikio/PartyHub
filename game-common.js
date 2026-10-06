// Fonctions partagées par les mini-jeux.

// Détermine si ce téléphone pilote la partie (init de l'état, manche suivante,
// retour lobby global...). Un seul appareil doit répondre true :
// - le joueur marqué host dans la room ;
// - sinon (room créée depuis l'écran TV, aucun host téléphone) le premier joueur réel de la liste.
export function resolveIsHost(savedData) {
  savedData = savedData || {};
  if (savedData.isHost === true) return true;

  const players = Array.isArray(savedData.players) ? savedData.players : [];
  if (players.some(player => player?.host)) return false;

  const me = savedData.currentPlayer || savedData.playerName;
  const firstRealPlayer = players.find(player => player && !player.fake);
  return !!me && firstRealPlayer?.name === me;
}
