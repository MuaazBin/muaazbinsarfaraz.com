const launchButton = document.querySelector('[data-launch-game]');
const gameStage = document.querySelector('[data-game-stage]');
const gameFrame = document.querySelector('[data-game-frame]');

launchButton?.addEventListener('click', () => {
  if (!gameFrame?.src) gameFrame.src = gameFrame.dataset.src;
  gameStage?.classList.add('game-loaded');
  gameFrame?.focus();
});
