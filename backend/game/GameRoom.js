
import crypto from 'node:crypto';

export const WEAPONS = {
  fist: { id: 'fist', name: '주먹', cost: 0, damage: 12, range: 2.2, cooldown: 550 },
  sword: { id: 'sword', name: '청동 검', cost: 50, damage: 28, range: 3, cooldown: 650 },
  spear: { id: 'spear', name: '전쟁 창', cost: 100, damage: 40, range: 4.2, cooldown: 900 },
  hammer: { id: 'hammer', name: '파괴 망치', cost: 180, damage: 65, range: 2.8, cooldown: 1300 }
};

const MAX_WALL_TIER = 5;
const CHAPTER_MS = 5 * 60 * 1000;

function createCode() {
  // 암호학적 난수로 만든 20자리 서버 키
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(20);
  let result = '';

  for (const byte of bytes) {
    result += alphabet[byte % alphabet.length];
  }

  return result;
}

export class GameRoom {
  constructor({ mode, visibility, name, ownerId, ownerName }) {
    this.id = crypto.randomUUID();
    this.code = createCode();
    this.mode = mode;
    this.visibility = visibility;
    this.name = String(name || '새로운 국가').slice(0, 30);
    this.ownerId = ownerId;
    this.ownerName = ownerName;
    this.createdAt = Date.now();
    this.chapter = 1;
    this.paused = false;
    this.pausedAt = 0;
    this.nextChapterAt = Date.now() + CHAPTER_MS;
    this.players = new Map();
    this.countries = new Map();
    this.beacon = { health: 1000, maxHealth: 1000 };
    this.wallTier = 0;
  }

  get maxPlayers() {
    if (this.mode === 'multiplayer') return 4;
    if (this.mode === 'server') return 0;
    return 1;
  }

  get playerCount() {
    return this.players.size;
  }

  hasPlayer(userId) {
    return [...this.players.values()].some(p => p.userId === userId);
  }

  canJoin() {
    return this.maxPlayers === 0 || this.players.size < this.maxPlayers;
  }

  addPlayer({ socketId, userId, username }) {
    if (!this.canJoin()) {
      throw new Error('이 방은 가득 찼습니다.');
    }

    if (this.hasPlayer(userId)) {
      throw new Error('이미 이 서버에 접속 중입니다.');
    }

    const spawn = this.players.size;
    const angle = spawn * Math.PI * 2 / 4;

    const player = {
      id: socketId,
      userId,
      username,
      x: Math.sin(angle) * 3,
      y: 18.2,
      z: 12 + Math.cos(angle) * 3,
      rotation: Math.PI,
      health: 100,
      maxHealth: 100,
      coins: 100,
      weapon: 'fist',
      damageBonus: 0,
      defense: 0,
      wallTier: 0,
      kills: 0,
      alive: true,
      lastAttack: 0,
      lastMove: 0,
      countryId: null
    };

    this.players.set(socketId, player);
    return player;
  }

  removePlayer(socketId) {
    const player = this.players.get(socketId);
    if (!player) return null;

    this.players.delete(socketId);

    if (player.countryId) {
      const country = this.countries.get(player.countryId);
      country?.members.delete(player.userId);
    }

    return player;
  }

  getPublicState() {
    return {
      id: this.id,
      name: this.name,
      mode: this.mode,
      visibility: this.visibility,
      players: this.players.size,
      maxPlayers: this.maxPlayers,
      chapter: this.chapter,
      paused: this.paused,
      ownerName: this.ownerName,
      createdAt: this.createdAt
    };
  }

  getPlayerState(player) {
    return {
      id: player.id,
      username: player.username,
      x: player.x,
      y: player.y,
      z: player.z,
      rotation: player.rotation,
      health: player.health,
      maxHealth: player.maxHealth,
      coins: player.coins,
      weapon: player.weapon,
      damageBonus: player.damageBonus,
      defense: player.defense,
      wallTier: player.wallTier,
      kills: player.kills,
      alive: player.alive
    };
  }

  getState() {
    return {
      roomId: this.id,
      chapter: this.chapter,
      paused: this.paused,
      beacon: this.beacon,
      wallTier: this.wallTier,
      players: [...this.players.values()].map(p => this.getPlayerState(p))
    };
  }

  buy(player, itemId) {
    if (!player || !player.alive) {
      return { ok: false, error: '현재 구매할 수 없습니다.' };
    }

    if (this.paused) {
      return { ok: false, error: '게임이 일시정지되어 있습니다.' };
    }

    if (WEAPONS[itemId]) {
      const weapon = WEAPONS[itemId];

      if (player.weapon === itemId) {
        return { ok: false, error: '이미 장착한 무기입니다.' };
      }

      if (player.coins < weapon.cost) {
        return { ok: false, error: '코인이 부족합니다.' };
      }

      player.coins -= weapon.cost;
      player.weapon = itemId;

      return { ok: true, game: this.getPlayerState(player) };
    }

    const upgrades = {
      health: { cost: 30 },
      damage: { cost: 60 }
    };

    if (itemId === 'wall') {
      if (this.wallTier >= MAX_WALL_TIER) {
        return { ok: false, error: '성벽이 최대 레벨입니다.' };
      }

      const cost = 80 * (this.wallTier + 1);

      if (player.coins < cost) {
        return { ok: false, error: '코인이 부족합니다.' };
      }

      player.coins -= cost;
      player.wallTier += 1;
      this.wallTier = Math.max(this.wallTier, player.wallTier);

      return {
        ok: true,
        game: this.getPlayerState(player),
        wallTier: this.wallTier
      };
    }

    const upgrade = upgrades[itemId];

    if (!upgrade) {
      return { ok: false, error: '존재하지 않는 상품입니다.' };
    }

    if (player.coins < upgrade.cost) {
      return { ok: false, error: '코인이 부족합니다.' };
    }

    player.coins -= upgrade.cost;

    if (itemId === 'health') {
      player.maxHealth += 20;
      player.health = Math.min(player.maxHealth, player.health + 20);
    }

    if (itemId === 'damage') {
      player.damageBonus += 5;
    }

    return { ok: true, game: this.getPlayerState(player) };
  }

  attack(attacker, weaponId) {
    if (this.paused) {
      return { ok: false, error: '게임이 일시정지되어 있습니다.' };
    }

    if (!attacker?.alive) {
      return { ok: false, error: '부활한 후 공격할 수 있습니다.' };
    }

    const weapon = WEAPONS[attacker.weapon];

    if (!weapon || weaponId !== attacker.weapon) {
      return { ok: false, error: '장착한 무기와 일치하지 않습니다.' };
    }

    const now = Date.now();

    if (now - attacker.lastAttack < weapon.cooldown) {
      return { ok: false, error: '공격 대기시간이 남아 있습니다.' };
    }

    attacker.lastAttack = now;

    let target = null;
    let targetDistance = Infinity;

    for (const candidate of this.players.values()) {
      if (candidate.id === attacker.id || !candidate.alive) continue;

      const dx = candidate.x - attacker.x;
      const dz = candidate.z - attacker.z;
      const distance = Math.hypot(dx, dz);

      if (distance > weapon.range || distance >= targetDistance) continue;

      const facingX = Math.sin(attacker.rotation);
      const facingZ = Math.cos(attacker.rotation);
      const dot = dx * facingX + dz * facingZ;

      if (dot < -0.25) continue;

      target = candidate;
      targetDistance = distance;
    }

    if (!target) {
      return { ok: true, hit: false, message: '공격이 빗나갔습니다.' };
    }

    const damage = Math.max(
      1,
      weapon.damage + attacker.damageBonus - target.defense
    );

    target.health = Math.max(0, target.health - damage);

    let killed = false;

    if (target.health <= 0) {
      target.alive = false;
      attacker.kills += 1;
      attacker.coins += 10;
      killed = true;

      // 5초 후 서버가 부활 상태를 복구한다.
      setTimeout(() => {
        const current = this.players.get(target.id);
        if (!current || current.alive) return;

        current.health = current.maxHealth;
        current.alive = true;
        current.x = 0;
        current.y = 18.2;
        current.z = 12;
      }, 5000);
    }

    return {
      ok: true,
      hit: true,
      damage,
      killed,
      coins: attacker.coins,
      kills: attacker.kills,
      target: this.getPlayerState(target),
      message: killed
        ? `${target.username} 처치! +10 코인`
        : `${target.username}에게 ${damage} 피해`
    };
  }

  move(player, position) {
    if (!player || this.paused || !player.alive) return false;

    const now = Date.now();

    // 초당 최대 약 20회 이동 입력 처리
    if (now - player.lastMove < 45) return false;
    player.lastMove = now;

    const { x, y, z, rotation } = position || {};

    if (![x, y, z, rotation].every(Number.isFinite)) return false;

    const dx = x - player.x;
    const dz = z - player.z;
    const distance = Math.hypot(dx, dz);

    // 비정상적인 순간이동 입력 차단
    if (distance > 2.5) return false;

    player.x = Math.max(-100, Math.min(100, x));
    player.y = Math.max(0, Math.min(100, y));
    player.z = Math.max(-100, Math.min(100, z));
    player.rotation = rotation;
    return true;
  }

  pause(userId, value) {
    const player = [...this.players.values()].find(p => p.userId === userId);

    if (!player || player.userId !== this.ownerId) {
      return { ok: false, error: '방장만 일시정지할 수 있습니다.' };
    }

    if (value && !this.paused) {
      this.paused = true;
      this.pausedAt = Date.now();
    } else if (!value && this.paused) {
      const duration = Date.now() - this.pausedAt;
      this.nextChapterAt += duration;
      this.paused = false;
      this.pausedAt = 0;
    }

    return { ok: true, paused: this.paused };
  }

  tick(now = Date.now()) {
    if (this.paused) return null;
    if (now < this.nextChapterAt) return null;

    const elapsedChapters = Math.floor((now - this.nextChapterAt) / CHAPTER_MS) + 1;
    this.chapter += elapsedChapters;
    this.nextChapterAt += elapsedChapters * CHAPTER_MS;

    // 챕터 진행에 따라 신호기 내구도가 회복된다.
    this.beacon.health = Math.min(
      this.beacon.maxHealth,
      this.beacon.health + elapsedChapters * 50
    );

    return {
      chapter: this.chapter,
      beacon: this.beacon
    };
  }
}
