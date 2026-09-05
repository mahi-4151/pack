const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

const ICONS = {
  coin: '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="12"/><path d="M18.7 8.8c-4.4-1.6-8.6.8-7.2 4.2 1.7 4.1 9.5 1.1 9 6-.3 3-4.4 4-8.1 2.4M16 7v18"/></svg>',
  pearl: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3.5c7.5 0 12.5 6.6 11.1 14.1C26 23.5 21.7 28.5 16 28.5S6 23.5 4.9 17.6C3.5 10.1 8.5 3.5 16 3.5Z"/><circle cx="16" cy="16" r="6.2"/></svg>',
};

/**
 * A deliberately compact interaction layer for the cinematic game presentation.
 * The fixed artwork carries the camera moment; this module owns the live HUD,
 * encounter rules, loot collection and the three explicit screen states.
 */
export class DungeonGame {
  constructor(root) {
    this.root = root;
    this.state = 'fighting'; // fighting | pause | map | loot | clear | over
    this.playerHp = 100;
    this.enemyHp = 100;
    this.maxEnemyHp = 100;
    this.score = 18750;
    this.coins = 0;
    this.pearls = 0;
    this.dodgingUntil = 0;
    this.specialReadyAt = 0;
    this.startedAt = performance.now();
    this.enemyTimer = null;
    this.animationFrame = null;

    this.el = {
      enemyHealth: $('[data-enemy-health]'),
      playerHealth: $('[data-player-health]'),
      playerHp: $('[data-player-hp]'),
      hearts: $$('.heart', $('[data-hearts]')),
      score: $('[data-score]'),
      coins: $('[data-coins]'),
      pearls: $('[data-pearls]'),
      notice: $('[data-notice]'),
      noticeTitle: $('[data-notice-title]'),
      noticeText: $('[data-notice-text]'),
      damage: $('[data-damage-number]'),
      lootField: $('[data-loot-field]'),
      lootItems: $('[data-loot-items]'),
      specialCooldown: $('[data-special-cooldown]'),
      timeBonus: $('[data-time-bonus]'),
      totalPoints: $('[data-total-points]'),
      savedLoot: $('[data-saved-loot]'),
      sr: $('[data-sr-status]'),
      modals: Object.fromEntries($$('[data-modal]').map((modal) => [modal.dataset.modal, modal])),
    };

    this.bind();
    this.render();
    this.startEnemyPressure();
    this.tick();
  }

  bind() {
    $$('[data-action]', this.root).forEach((button) => {
      button.addEventListener('click', () => this.action(button.dataset.action));
    });
    $$('[data-direction]', this.root).forEach((button) => {
      const direction = button.dataset.direction;
      const release = () => button.classList.remove('is-pressed');
      button.addEventListener('pointerdown', () => {
        if (this.state !== 'fighting') return;
        button.classList.add('is-pressed');
        this.move(direction);
      });
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('pointerleave', release);
    });

    $('[data-pause]').addEventListener('click', () => this.openPause());
    $('[data-map]').addEventListener('click', () => this.openMap());
    $('[data-resume]').addEventListener('click', () => this.resume());
    $$('[data-close-map]').forEach((button) => button.addEventListener('click', () => this.closeMap()));
    $('[data-forfeit]').addEventListener('click', () => this.gameOver('The expedition was abandoned in the dark.'));
    $('[data-retry]').addEventListener('click', () => this.reset());
    $('[data-next-level]').addEventListener('click', () => this.nextLevel());
    $('[data-store]').addEventListener('click', () => this.announce('RELIQUARY STORE', 'The merchant caravan arrives between expeditions.'));

    window.addEventListener('keydown', (event) => this.keyboard(event));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'fighting') this.openPause();
    });
  }

  keyboard(event) {
    if (event.repeat) return;
    if (event.code === 'Escape') {
      if (this.state === 'map') this.closeMap();
      else if (this.state === 'pause') this.resume();
      return;
    }
    if (this.state !== 'fighting') return;
    const keys = {
      Space: 'attack',
      KeyJ: 'attack',
      ShiftLeft: 'dodge',
      KeyK: 'dodge',
      KeyQ: 'special',
    };
    if (keys[event.code]) {
      event.preventDefault();
      this.action(keys[event.code]);
      return;
    }
    const moveKeys = { ArrowUp: 'n', KeyW: 'n', ArrowDown: 's', KeyS: 's', ArrowLeft: 'w', KeyA: 'w', ArrowRight: 'e', KeyD: 'e' };
    if (moveKeys[event.code]) {
      event.preventDefault();
      this.move(moveKeys[event.code]);
    }
    if (event.code === 'KeyM') this.openMap();
  }

  action(name) {
    if (this.state !== 'fighting') return;
    if (name === 'attack') {
      this.root.classList.add('is-attacking');
      this.damageEnemy(16, 'SWORD STRIKE', false);
      setTimeout(() => this.root.classList.remove('is-attacking'), 250);
    }
    if (name === 'dodge') this.dodge();
    if (name === 'special') this.special();
  }

  move(direction) {
    const names = { n: 'ADVANCING', s: 'FALLING BACK', e: 'CIRCLING RIGHT', w: 'CIRCLING LEFT', ne: 'CUTTING IN', nw: 'CUTTING IN', se: 'EVADING', sw: 'EVADING' };
    const x = direction.includes('e') ? '-1.2%' : direction.includes('w') ? '1.2%' : '0';
    const y = direction.includes('n') ? '.5%' : direction.includes('s') ? '-.5%' : '0';
    this.root.style.setProperty('--move-x', x);
    this.root.style.setProperty('--move-y', y);
    this.announce(names[direction], 'The knight shifts across the flagstones.');
    setTimeout(() => {
      this.root.style.removeProperty('--move-x');
      this.root.style.removeProperty('--move-y');
    }, 280);
  }

  dodge() {
    this.dodgingUntil = performance.now() + 900;
    this.root.classList.remove('is-dodging');
    void this.root.offsetWidth;
    this.root.classList.add('is-dodging');
    this.announce('COMBAT ROLL', 'Invulnerability window open.');
    this.status('You roll beneath the wraith’s blade.');
    setTimeout(() => this.root.classList.remove('is-dodging'), 730);
  }

  special() {
    const now = performance.now();
    if (now < this.specialReadyAt) {
      const seconds = ((this.specialReadyAt - now) / 1000).toFixed(1);
      this.announce('GAUNTLET RECHARGING', `${seconds}s until the rune gauntlet is ready.`);
      return;
    }
    this.specialReadyAt = now + 6500;
    this.root.classList.remove('is-special');
    void this.root.offsetWidth;
    this.root.classList.add('is-special');
    this.damageEnemy(34, 'RUNE GAUNTLET', true);
    this.status('Blue runes tear through the spectral armor.');
    setTimeout(() => this.root.classList.remove('is-special'), 800);
  }

  damageEnemy(amount, source, special) {
    if (this.enemyHp <= 0) return;
    this.enemyHp = Math.max(0, this.enemyHp - amount);
    this.score += special ? 620 : 180;
    this.render();
    this.floatDamage(`-${amount}`, special);
    this.announce(source, this.enemyHp > 0 ? 'The wraith recoils into its mist.' : 'The spectral warrior has fallen.');
    this.status(`${source}: ${amount} damage. Spectral Warrior has ${this.enemyHp} health remaining.`);
    if (this.enemyHp === 0) setTimeout(() => this.enemyDefeated(), 260);
  }

  damagePlayer(amount) {
    if (this.state !== 'fighting') return;
    if (performance.now() < this.dodgingUntil) {
      this.announce('DODGED', 'The wraith’s blade cuts only through fog.');
      this.floatDamage('DODGED', true);
      this.status('Dodged the Spectral Warrior strike.');
      return;
    }
    this.playerHp = Math.max(0, this.playerHp - amount);
    this.render();
    this.root.classList.remove('is-struck');
    void this.root.offsetWidth;
    this.root.classList.add('is-struck');
    setTimeout(() => this.root.classList.remove('is-struck'), 480);
    this.announce('WRAITH STRIKE', `The spectral blade deals ${amount} damage.`);
    this.floatDamage(`-${amount}`, false);
    this.status(`You took ${amount} damage. ${this.playerHp} vigor remains.`);
    if (this.playerHp === 0) setTimeout(() => this.gameOver('The wraith’s blade extinguished your last ember.'), 300);
  }

  enemyDefeated() {
    if (this.state !== 'fighting') return;
    this.state = 'loot';
    this.stopEnemyPressure();
    this.announce('WRAITH VANQUISHED', 'Coins and moon pearls scatter across the crypt floor.');
    this.status('Spectral Warrior defeated. Collect the coins and pearls.');
    this.spawnLoot();
  }

  spawnLoot() {
    const placement = [
      ['coin', 7, 38], ['coin', 28, 63], ['coin', 49, 28], ['coin', 72, 57], ['coin', 87, 30], ['coin', 57, 77],
      ['pearl', 39, 75], ['pearl', 76, 75],
    ];
    this.el.lootItems.innerHTML = placement.map(([type, left, top], index) => `
      <button type="button" class="loot-token loot-token--${type}" data-token="${type}" style="left:${left}%;top:${top}%;animation-delay:-${index * .17}s" aria-label="Collect ${type}">${ICONS[type]}</button>
    `).join('');
    this.el.lootField.hidden = false;
    $$('[data-token]', this.el.lootItems).forEach((token) => token.addEventListener('click', () => this.collect(token)));
  }

  collect(token) {
    if (this.state !== 'loot' || token.classList.contains('is-collected')) return;
    const type = token.dataset.token;
    token.classList.add('is-collected');
    if (type === 'coin') {
      this.coins += 1;
      this.score += 125;
      this.announce('COIN CLAIMED', 'Ancient gold added to your hoard.');
    } else {
      this.pearls += 1;
      this.score += 350;
      this.announce('MOON PEARL CLAIMED', 'A cold pearl hums with dormant magic.');
    }
    this.render();
    this.status(`Collected a ${type}.`);
    setTimeout(() => token.remove(), 390);
    if ($$('[data-token]:not(.is-collected)', this.el.lootItems).length === 0) {
      setTimeout(() => this.levelClear(), 800);
    }
  }

  levelClear() {
    if (this.state !== 'loot') return;
    this.state = 'clear';
    this.root.classList.add('is-cleared');
    this.el.lootField.hidden = true;
    const elapsed = Math.max(1, Math.floor((performance.now() - this.startedAt) / 1000));
    const bonus = Math.max(600, 3000 - elapsed * 25);
    this.score += bonus;
    this.el.timeBonus.textContent = bonus.toLocaleString();
    this.render();
    this.showModal('clear');
    this.status(`Level clear. Time bonus ${bonus} points.`);
  }

  openPause() {
    if (this.state !== 'fighting') return;
    this.state = 'pause';
    this.root.classList.add('is-paused');
    this.showModal('pause');
    this.status('Game paused.');
  }

  resume() {
    if (this.state !== 'pause') return;
    this.hideModal('pause');
    this.root.classList.remove('is-paused');
    this.state = 'fighting';
    this.announce('RESUME', 'The wraith emerges from the blue mist.');
    this.status('Encounter resumed.');
  }

  openMap() {
    if (this.state !== 'fighting') return;
    this.state = 'map';
    this.root.classList.add('is-map');
    this.showModal('map');
    this.status('Level map opened.');
  }

  closeMap() {
    if (this.state !== 'map') return;
    this.hideModal('map');
    this.root.classList.remove('is-map');
    this.state = 'fighting';
    this.announce('RETURNING TO CRYPT', 'The battle continues.');
  }

  gameOver(reason) {
    if (this.state === 'over' || this.state === 'clear') return;
    this.state = 'over';
    this.stopEnemyPressure();
    this.root.classList.remove('is-paused', 'is-map');
    this.root.classList.add('is-over');
    this.hideModal('pause');
    this.el.totalPoints.textContent = this.score.toLocaleString();
    this.el.savedLoot.textContent = `${this.coins} coins · ${this.pearls} pearls`;
    this.showModal('over');
    this.status(`Game over. ${reason}`);
  }

  nextLevel() {
    this.hideModal('clear');
    this.root.classList.remove('is-cleared');
    this.enemyHp = 120;
    this.maxEnemyHp = 120;
    this.playerHp = Math.min(100, this.playerHp + 35);
    this.coins = 0;
    this.pearls = 0;
    this.startedAt = performance.now();
    this.state = 'fighting';
    this.render();
    this.startEnemyPressure();
    this.announce('RUNE KEEP', 'A new gate groans open beyond the crypt.');
    this.status('Next level begun: Rune Keep.');
  }

  reset() {
    this.hideModal('over');
    this.root.classList.remove('is-over', 'is-cleared', 'is-map', 'is-paused');
    this.el.lootField.hidden = true;
    this.playerHp = 100;
    this.enemyHp = 100;
    this.maxEnemyHp = 100;
    this.score = 18750;
    this.coins = 0;
    this.pearls = 0;
    this.specialReadyAt = 0;
    this.startedAt = performance.now();
    this.state = 'fighting';
    this.render();
    this.startEnemyPressure();
    this.announce('THE SUNKEN CRYPT', 'Defeat the wraith and gather its forgotten treasure.');
    this.status('New encounter started.');
  }

  startEnemyPressure() {
    this.stopEnemyPressure();
    this.enemyTimer = setInterval(() => {
      if (this.state !== 'fighting') return;
      this.announce('INCOMING STRIKE', 'Roll now to evade the wraith’s blade.');
      setTimeout(() => this.damagePlayer(11), 540);
    }, 4100);
  }

  stopEnemyPressure() {
    if (this.enemyTimer) clearInterval(this.enemyTimer);
    this.enemyTimer = null;
  }

  showModal(name) { this.el.modals[name].hidden = false; }
  hideModal(name) { this.el.modals[name].hidden = true; }

  render() {
    const enemyRatio = this.enemyHp / this.maxEnemyHp;
    this.el.enemyHealth.style.transform = `scaleX(${Math.max(0, enemyRatio)})`;
    this.el.playerHealth.style.transform = `scaleX(${this.playerHp / 100})`;
    this.el.playerHp.textContent = `${this.playerHp} / 100`;
    this.el.score.textContent = this.score.toLocaleString();
    this.el.coins.textContent = String(this.coins);
    this.el.pearls.textContent = String(this.pearls);
    this.el.hearts.forEach((heart, index) => heart.classList.toggle('is-lost', index >= Math.ceil(this.playerHp / 20)));
  }

  tick() {
    const now = performance.now();
    const cooldown = Math.max(0, (this.specialReadyAt - now) / 6500);
    this.el.specialCooldown.style.setProperty('--cooldown', String(cooldown));
    $('[data-action="special"]').classList.toggle('is-cooling', cooldown > 0);
    this.animationFrame = requestAnimationFrame(() => this.tick());
  }

  announce(title, message) {
    this.el.noticeTitle.textContent = title;
    this.el.noticeText.textContent = message;
    this.el.notice.classList.remove('is-hit');
    void this.el.notice.offsetWidth;
    this.el.notice.classList.add('is-hit');
  }

  floatDamage(text, special) {
    this.el.damage.textContent = text;
    this.el.damage.classList.toggle('is-special', special);
    this.el.damage.classList.remove('is-on');
    void this.el.damage.offsetWidth;
    this.el.damage.classList.add('is-on');
  }

  status(text) { this.el.sr.textContent = text; }
}
