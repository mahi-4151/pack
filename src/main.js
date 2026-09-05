import { DungeonGame } from './dungeon-game.js';

const root = document.querySelector('#game');
const game = new DungeonGame(root);

// Useful for visual QA and for demonstrating the distinct result cards.
if (import.meta.env?.DEV) window.dungeonGame = game;
