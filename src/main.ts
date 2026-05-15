import './style.css';
import { BreakoutGame } from './game/BreakoutGame';

const root = document.querySelector<HTMLDivElement>('#app');

if (!root) {
  throw new Error('Missing #app root element.');
}

const autopilot = new URLSearchParams(window.location.search).get('autopilot') === 'true';

BreakoutGame.create(root, { autopilot }).catch((error: unknown) => {
  console.error(error);
  root.innerHTML = `
    <main class="boot-error">
      <h1>Breakout failed to start.</h1>
      <p>Open the developer console for details.</p>
    </main>
  `;
});
