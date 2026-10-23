
export const WEAPONS = [
  // 총기 20종
  {id:"pistol",name:"Pistol",type:"gun",damage:18,fireRate:260,magSize:12,reserve:60,reload:1.3,range:55,spread:0.035,automatic:false},
  {id:"heavy_pistol",name:"Heavy Pistol",type:"gun",damage:32,fireRate:420,magSize:8,reserve:40,reload:1.6,range:65,spread:0.025,automatic:false},
  {id:"revolver",name:"Revolver",type:"gun",damage:48,fireRate:520,magSize:6,reserve:36,reload:2.0,range:75,spread:0.02,automatic:false},
  {id:"machine_pistol",name:"Machine Pistol",type:"gun",damage:13,fireRate:100,magSize:20,reserve:100,reload:1.5,range:35,spread:0.08,automatic:true},
  {id:"smg",name:"SMG",type:"gun",damage:15,fireRate:90,magSize:30,reserve:150,reload:1.6,range:45,spread:0.055,automatic:true},
  {id:"compact_smg",name:"Compact SMG",type:"gun",damage:12,fireRate:75,magSize:40,reserve:160,reload:1.8,range:38,spread:0.07,automatic:true},
  {id:"vector",name:"Vector",type:"gun",damage:11,fireRate:55,magSize:25,reserve:150,reload:1.4,range:38,spread:0.065,automatic:true},
  {id:"shotgun",name:"Shotgun",type:"gun",damage:9,fireRate:700,magSize:8,reserve:48,reload:2.1,range:20,spread:0.19,pellets:8,automatic:false},
  {id:"double_shotgun",name:"Double Shotgun",type:"gun",damage:12,fireRate:850,magSize:2,reserve:32,reload:1.8,range:18,spread:0.22,pellets:10,automatic:false},
  {id:"rifle",name:"Assault Rifle",type:"gun",damage:22,fireRate:110,magSize:30,reserve:150,reload:1.8,range:100,spread:0.035,automatic:true},
  {id:"ak47",name:"AK-Style Rifle",type:"gun",damage:27,fireRate:125,magSize:30,reserve:150,reload:2.0,range:95,spread:0.055,automatic:true},
  {id:"burst_rifle",name:"Burst Rifle",type:"gun",damage:24,fireRate:100,magSize:27,reserve:135,reload:1.8,range:105,spread:0.03,burst:3,automatic:false},
  {id:"battle_rifle",name:"Battle Rifle",type:"gun",damage:35,fireRate:230,magSize:20,reserve:100,reload:2.0,range:125,spread:0.025,automatic:false},
  {id:"marksman",name:"Marksman Rifle",type:"gun",damage:42,fireRate:360,magSize:15,reserve:75,reload:2.0,range:150,spread:0.012,automatic:false},
  {id:"sniper",name:"Sniper Rifle",type:"gun",damage:90,fireRate:1100,magSize:5,reserve:30,reload:2.6,range:250,spread:0.002,automatic:false},
  {id:"semi_sniper",name:"Semi-auto Sniper",type:"gun",damage:58,fireRate:550,magSize:10,reserve:50,reload:2.3,range:220,spread:0.006,automatic:false},
  {id:"lmg",name:"Light Machine Gun",type:"gun",damage:23,fireRate:100,magSize:75,reserve:225,reload:3.2,range:100,spread:0.065,automatic:true},
  {id:"minigun",name:"Minigun",type:"gun",damage:12,fireRate:55,magSize:200,reserve:400,reload:5.0,range:85,spread:0.09,automatic:true},
  {id:"tactical_rifle",name:"Tactical Rifle",type:"gun",damage:25,fireRate:130,magSize:35,reserve:175,reload:1.7,range:110,spread:0.028,automatic:true},
  {id:"precision_rifle",name:"Precision Rifle",type:"gun",damage:65,fireRate:750,magSize:7,reserve:35,reload:2.4,range:200,spread:0.003,automatic:false},

  // 근접 무기 20종
  {id:"fists",name:"Fists",type:"melee",damage:8,reach:1.5,fireRate:450},
  {id:"dagger",name:"Dagger",type:"melee",damage:17,reach:1.8,fireRate:350},
  {id:"dual_daggers",name:"Dual Daggers",type:"melee",damage:12,reach:1.8,fireRate:220},
  {id:"katana",name:"Katana",type:"melee",damage:38,reach:2.7,fireRate:600},
  {id:"dual_katana",name:"Dual Katanas",type:"melee",damage:27,reach:2.5,fireRate:420},
  {id:"three_swords",name:"Three-Sword Style",type:"melee",damage:45,reach:3.0,fireRate:650},
  {id:"long_sword",name:"Long Sword",type:"melee",damage:34,reach:2.8,fireRate:620},
  {id:"greatsword",name:"Greatsword",type:"melee",damage:62,reach:3.2,fireRate:950},
  {id:"rapier",name:"Rapier",type:"melee",damage:25,reach:2.6,fireRate:400},
  {id:"short_sword",name:"Short Sword",type:"melee",damage:24,reach:2.2,fireRate:420},
  {id:"battle_axe",name:"Battle Axe",type:"melee",damage:52,reach:2.7,fireRate:850},
  {id:"hatchet",name:"Hatchet",type:"melee",damage:30,reach:2.0,fireRate:500},
  {id:"war_hammer",name:"War Hammer",type:"melee",damage:68,reach:2.5,fireRate:1050},
  {id:"spear",name:"Spear",type:"melee",damage:36,reach:3.5,fireRate:650},
  {id:"staff",name:"Combat Staff",type:"melee",damage:25,reach:3.0,fireRate:450},
  {id:"machete",name:"Machete",type:"melee",damage:32,reach:2.3,fireRate:500},
  {id:"scythe",name:"Scythe",type:"melee",damage:48,reach:3.1,fireRate:800},
  {id:"claymore",name:"Claymore",type:"melee",damage:58,reach:3.0,fireRate:900},
  {id:"tonfa",name:"Tonfa",type:"melee",damage:20,reach:1.9,fireRate:300},
  {id:"energy_blade",name:"Energy Blade",type:"melee",damage:55,reach:2.8,fireRate:550}
];

export const getWeapon = (id) =>
  WEAPONS.find((weapon) => weapon.id === id) ?? WEAPONS[0];

export class Inventory {
  constructor() {
    this.capacity = 12;
    this.items = [];
    this.equippedGun = "pistol";
    this.equippedMelee = "fists";
    this.reloading = new Set();
    this.ammo = {};
    this.attachments = {};
    this.consumables = { medkit: 2, armor: 0 };
    this.addWeapon("pistol");
    this.addWeapon("fists");
  }

  addWeapon(id) {
    const weapon = getWeapon(id);
    if (!weapon || this.items.some((item) => item.id === id)) return false;
    if (this.items.length >= this.capacity) return false;

    this.items.push({ id: weapon.id, count: 1 });

    if (weapon.type === "gun") {
      this.ammo[id] ??= {
        magazine: weapon.magSize,
        reserve: weapon.reserve
      };
    }

    return true;
  }

  removeWeapon(id) {
    if (id === "pistol" || id === "fists") return false;
    const index = this.items.findIndex((item) => item.id === id);
    if (index < 0) return false;

    this.items.splice(index, 1);

    if (this.equippedGun === id) this.equippedGun = "pistol";
    if (this.equippedMelee === id) this.equippedMelee = "fists";

    delete this.ammo[id];
    delete this.attachments[id];
    return true;
  }

  equip(id) {
    const weapon = getWeapon(id);
    if (!this.items.some((item) => item.id === id)) return false;

    if (weapon.type === "gun") this.equippedGun = id;
    else this.equippedMelee = id;

    return true;
  }

  getEquipped() {
    return {
      gun: getWeapon(this.equippedGun),
      melee: getWeapon(this.equippedMelee)
    };
  }

  getAmmo(id = this.equippedGun) {
    const weapon = getWeapon(id);
    if (weapon.type !== "gun") return null;

    this.ammo[id] ??= {
      magazine: weapon.magSize,
      reserve: weapon.reserve
    };

    return { ...this.ammo[id] };
  }

  consumeAmmo(id = this.equippedGun, amount = 1) {
    const weapon = getWeapon(id);
    if (weapon.type !== "gun" || this.reloading.has(id)) return false;

    const ammo = this.getAmmo(id);
    if (!ammo || ammo.magazine < amount) return false;

    this.ammo[id].magazine -= amount;
    return true;
  }

  async reload(id = this.equippedGun) {
    const weapon = getWeapon(id);
    if (weapon.type !== "gun" || this.reloading.has(id)) return false;

    const ammo = this.getAmmo(id);
    if (!ammo || ammo.magazine >= weapon.magSize || ammo.reserve <= 0) {
      return false;
    }

    this.reloading.add(id);

    await new Promise((resolve) =>
      setTimeout(resolve, weapon.reload * 1000)
    );

    const current = this.ammo[id];
    const needed = weapon.magSize - current.magazine;
    const loaded = Math.min(needed, current.reserve);

    current.magazine += loaded;
    current.reserve -= loaded;
    this.reloading.delete(id);

    return true;
  }

  addAmmo(id, amount) {
    const weapon = getWeapon(id);
    if (weapon.type !== "gun" || amount <= 0) return false;

    const ammo = this.getAmmo(id);
    ammo.reserve += Math.floor(amount);
    this.ammo[id].reserve = ammo.reserve;
    return true;
  }

  useConsumable(id) {
    if (!Object.hasOwn(this.consumables, id)) return false;
    if (this.consumables[id] <= 0) return false;

    this.consumables[id]--;
    return true;
  }

  serialize() {
    return {
      capacity: this.capacity,
      items: this.items.map((item) => ({ ...item })),
      equippedGun: this.equippedGun,
      equippedMelee: this.equippedMelee,
      ammo: structuredClone(this.ammo),
      consumables: { ...this.consumables }
    };
  }
}
