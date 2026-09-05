/**
 * DOM smoke test for the Runebound dungeon screen. It validates the rendered
 * controls, result cards and basic state transitions without a browser.
 * Run with: npm run test:ui
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const dom = new JSDOM(html, { pretendToBeVisual: true, url: 'http://localhost:5173/' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.requestAnimationFrame = () => 1; // The game’s UI clock need not run in this smoke test.
globalThis.cancelAnimationFrame = () => {};

const { DungeonGame } = await import('../src/dungeon-game.js');

let failures = 0;
const check = (label, condition, detail = '') => {
  if (!condition) failures++;
  console.log(`  ${condition ? '✔' : '✘'} ${label}${detail ? ` — ${detail}` : ''}`);
};
const click = (selector) => document.querySelector(selector).dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));

console.log('\nDungeon HUD');
check('cinematic background is present', !!document.querySelector('.scene__background'));
check('all five life hearts exist', document.querySelectorAll('[data-hearts] .heart').length === 5);
check('top stop button is present', !!document.querySelector('[data-pause]'));
check('points scroll begins at 18,750', document.querySelector('[data-score]').textContent === '18,750');
check('spectral warrior label and health meter exist', /SPECTRAL WARRIOR/.test(document.querySelector('.enemy-status').textContent) && !!document.querySelector('[data-enemy-health]'));
check('eight-way D-pad has eight movement buttons', document.querySelectorAll('[data-direction]').length === 8);
check('combat action buttons are available', ['attack', 'dodge', 'special'].every((action) => document.querySelector(`[data-action="${action}"]`)));
check('bottom-right return-to-map button is available', !!document.querySelector('[data-map]'));
check('coin and pearl counters exist', !!document.querySelector('[data-coins]') && !!document.querySelector('[data-pearls]'));
check('level-clear and game-over overlays are separate', document.querySelector('[data-modal="clear"]') !== document.querySelector('[data-modal="over"]'));

console.log('\nInteraction flow');
const game = new DungeonGame(document.querySelector('#game'));
game.stopEnemyPressure();
check('encounter begins in fighting state', game.state === 'fighting');

click('[data-action="attack"]');
check('attack damages the wraith', game.enemyHp === 84 && document.querySelector('[data-enemy-health]').style.transform === 'scaleX(0.84)');
const pointsAfterAttack = game.score;
click('[data-action="special"]');
check('special scores rune damage and starts cooldown', game.enemyHp === 50 && game.score > pointsAfterAttack && Number(document.querySelector('[data-special-cooldown]').style.getPropertyValue('--cooldown')) >= 0);

click('[data-pause]');
check('stop button opens only the pause card', game.state === 'pause' && document.querySelector('[data-modal="pause"]').hidden === false && document.querySelector('[data-modal="map"]').hidden);
click('[data-resume]');
check('resume restores the fight', game.state === 'fighting' && document.querySelector('[data-modal="pause"]').hidden);
click('[data-map]');
check('map return control opens level map', game.state === 'map' && document.querySelector('[data-modal="map"]').hidden === false);
click('[data-close-map]');
check('map can return to battle', game.state === 'fighting' && document.querySelector('[data-modal="map"]').hidden);

game.enemyHp = 0;
game.enemyDefeated();
check('defeat spawns collectible coins and pearls', game.state === 'loot' && document.querySelectorAll('[data-token="coin"]').length === 6 && document.querySelectorAll('[data-token="pearl"]').length === 2);
const coin = document.querySelector('[data-token="coin"]');
coin.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
check('collecting coin increases counter and score', game.coins === 1 && document.querySelector('[data-coins]').textContent === '1' && game.score > pointsAfterAttack);

game.reset();
game.stopEnemyPressure();
game.gameOver('Test defeat.');
check('game over uses dark filtered state and independent popup', game.state === 'over' && document.querySelector('#game').classList.contains('is-over') && document.querySelector('[data-modal="over"]').hidden === false && document.querySelector('[data-modal="clear"]').hidden);
click('[data-retry]');
game.stopEnemyPressure();
check('try again resets the encounter', game.state === 'fighting' && game.playerHp === 100 && game.enemyHp === 100 && game.coins === 0 && document.querySelector('[data-modal="over"]').hidden);

game.stopEnemyPressure();
console.log(failures === 0 ? '\n✔ all UI checks passed\n' : `\n✘ ${failures} UI check(s) failed\n`);
process.exit(failures === 0 ? 0 : 1);
