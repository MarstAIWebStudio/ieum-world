
const guns = [
  ["pistol","권총",18,260,12,60,130,55,false],
  ["heavy_pistol","대형 권총",32,420,8,40,180,65,false],
  ["revolver","리볼버",48,520,6,36,220,75,false],
  ["machine_pistol","기관권총",13,100,20,100,250,35,true],
  ["smg","기관단총",15,90,30,150,280,45,true],
  ["compact_smg","소형 기관단총",12,75,40,160,300,38,true],
  ["vector","고속 기관단총",11,55,25,150,320,38,true],
  ["shotgun","산탄총",9,700,8,48,350,20,false],
  ["double_shotgun","더블 배럴",12,850,2,32,400,18,false],
  ["rifle","돌격소총",22,110,30,150,420,100,true],
  ["ak47","AK 계열 소총",27,125,30,150,450,95,true],
  ["burst_rifle","점사 소총",24,100,27,135,450,105,false],
  ["battle_rifle","전투소총",35,230,20,100,500,125,false],
  ["marksman","지정사수소총",42,360,15,75,520,150,false],
  ["sniper","저격소총",90,1100,5,30,650,250,false],
  ["semi_sniper","반자동 저격소총",58,550,10,50,600,220,false],
  ["lmg","경기관총",23,100,75,225,750,100,true],
  ["minigun","미니건",12,55,200,400,1200,85,true],
  ["tactical_rifle","전술 소총",25,130,35,175,470,110,true],
  ["precision_rifle","정밀 소총",65,750,7,35,700,200,false]
].map(([id,name,damage,cooldown,magSize,reserve,reload,range,automatic]) => ({
  id, name, type:"gun", damage, cooldown, magSize, reserve, reload,
  range, automatic, cost: id === "pistol" ? 0 : 40 + damage * 3
}));

const melee = [
  ["fist","주먹",8,450,1.5,0],
  ["dagger","단검",17,350,1.8,35],
  ["dual_daggers","쌍단검",12,220,1.8,55],
  ["katana","카타나",38,600,2.7,100],
  ["dual_katana","쌍카타나",27,420,2.5,150],
  ["three_swords","삼도류",45,650,3.0,250],
  ["long_sword","장검",34,620,2.8,90],
  ["greatsword","대검",62,950,3.2,180],
  ["rapier","레이피어",25,400,2.6,80],
  ["short_sword","단검형 검",24,420,2.2,65],
  ["battle_axe","전투 도끼",52,850,2.7,150],
  ["hatchet","손도끼",30,500,2.0,60],
  ["war_hammer","전투 해머",68,1050,2.5,200],
  ["spear","창",36,650,3.5,100],
  ["staff","전투 지팡이",25,450,3.0,80],
  ["machete","마체테",32,500,2.3,75],
  ["scythe","대형 낫",48,800,3.1,160],
  ["claymore","클레이모어",58,900,3.0,180],
  ["tonfa","톤파",20,300,1.9,70],
  ["energy_blade","에너지 블레이드",55,550,2.8,300]
].map(([id,name,damage,cooldown,range,cost]) => ({
  id, name, type:"melee", damage, cooldown, range, cost
}));

export const WEAPONS = Object.fromEntries(
  [...guns, ...melee].map(weapon => [weapon.id, weapon])
);

export const GUNS = guns;
export const MELEE_WEAPONS = melee;

export class Inventory {
  constructor() {
    this.capacity = 12;
    this.items = ["fist", "pistol"];
    this.equippedGun = "pistol";
    this.equippedMelee = "fist";
    this.ammo = Object.fromEntries(
      guns.map(weapon => [
        weapon.id,
        { magazine: weapon.magSize, reserve: weapon.reserve }
      ])
    );
    this.reloading = new Set();
  }

  has(id) {
    return this.items.includes(id);
  }

  add(id) {
    if (!WEAPONS[id] || this.has(id) || this.items.length >= this.capacity) {
      return false;
    }

    this.items.push(id);
    return true;
  }

  remove(id) {
    if (id === "fist" || id === "pistol") return false;

    const index = this.items.indexOf(id);
    if (index < 0) return false;

    this.items.splice(index, 1);

    if (this.equippedGun === id) this.equippedGun = "pistol";
    if (this.equippedMelee === id) this.equippedMelee = "fist";

    return true;
  }

  equip(id) {
    if (!this.has(id)) return false;

    if (WEAPONS[id].type === "gun") this.equippedGun = id;
    else this.equippedMelee = id;

    return true;
  }

  getActive() {
    return WEAPONS[this.equippedGun] || WEAPONS.pistol;
  }

  getMelee() {
    return WEAPONS[this.equippedMelee] || WEAPONS.fist;
  }

  getAmmo(id = this.equippedGun) {
    const weapon = WEAPONS[id];
    if (!weapon || weapon.type !== "gun") return null;
    return { ...this.ammo[id] };
  }

  fire(id = this.equippedGun) {
    const weapon = WEAPONS[id];
    if (!weapon || weapon.type !== "gun" || this.reloading.has(id)) {
      return false;
    }

    if (this.ammo[id].magazine <= 0) return false;

    this.ammo[id].magazine -= 1;
    return true;
  }

  async reload(id = this.equippedGun) {
    const weapon = WEAPONS[id];
    const ammo = this.ammo[id];

    if (
      !weapon ||
      weapon.type !== "gun" ||
      !ammo ||
      this.reloading.has(id) ||
      ammo.magazine >= weapon.magSize ||
      ammo.reserve <= 0
    ) {
      return false;
    }

    this.reloading.add(id);

    try {
      await new Promise(resolve =>
        setTimeout(resolve, weapon.reload)
      );

      const needed = weapon.magSize - ammo.magazine;
      const loaded = Math.min(needed, ammo.reserve);

      ammo.magazine += loaded;
      ammo.reserve -= loaded;

      return true;
    } finally {
      this.reloading.delete(id);
    }
  }

  addAmmo(id, amount) {
    const weapon = WEAPONS[id];
    if (!weapon || weapon.type !== "gun" || amount <= 0) return false;

    this.ammo[id].reserve += Math.floor(amount);
    return true;
  }

  serialize() {
    return {
      capacity: this.capacity,
      items: [...this.items],
      equippedGun: this.equippedGun,
      equippedMelee: this.equippedMelee,
      ammo: structuredClone(this.ammo)
    };
  }
}
