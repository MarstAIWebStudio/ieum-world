
export const WEAPONS = {
  fist: {
    id: 'fist',
    name: '주먹',
    cost: 0,
    damage: 12,
    range: 2.2,
    cooldown: 550
  },
  sword: {
    id: 'sword',
    name: '청동 검',
    cost: 50,
    damage: 28,
    range: 3,
    cooldown: 650
  },
  spear: {
    id: 'spear',
    name: '전쟁 창',
    cost: 100,
    damage: 40,
    range: 4.2,
    cooldown: 900
  },
  hammer: {
    id: 'hammer',
    name: '파괴 망치',
    cost: 180,
    damage: 65,
    range: 2.8,
    cooldown: 1300
  }
};

export function canAttack(lastAttack, weapon, now = Date.now()) {
  return now - lastAttack >= weapon.cooldown;
}

export function findTarget(attacker, targets, weapon) {
  let best = null;
  let bestDistance = Infinity;

  for (const target of targets) {
    if (!target || target.id === attacker.id || target.health <= 0) {
      continue;
    }

    const dx = target.x - attacker.x;
    const dz = target.z - attacker.z;
    const distance = Math.hypot(dx, dz);

    if (distance > weapon.range || distance >= bestDistance) continue;

    const facingX = Math.sin(attacker.rotation || 0);
    const facingZ = Math.cos(attacker.rotation || 0);
    const dot = dx * facingX + dz * facingZ;

    if (dot < -0.25) continue;

    best = target;
    bestDistance = distance;
  }

  return best;
}

export function calculateDamage(weapon, attacker, target) {
  const bonus = Math.max(0, Number(attacker.damageBonus || 0));
  const defense = Math.max(0, Number(target.defense || 0));

  return Math.max(1, Math.round(weapon.damage + bonus - defense));
}
