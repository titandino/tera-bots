const os = require('os');

const ITEMS_FISHES = [
  [206400, 206401], // Tier 0
  [206402, 206403], // Tier 1
  [206404, 206405], // Tier 2
  [206406, 206407], // Tier 3
  [206408, 206409, 206410], // Tier 4
  [206411, 206412, 206413], // Tier 5
  [206414, 206415, 206416, 206417], // Tier 6
  [206418, 206419, 206420, 206421], // Tier 7
  [206422, 206423, 206424, 206425], // Tier 8
  [206426, 206427, 206428, 206429, 206430], // Tier 9
  [206431, 206432, 206433, 206434, 206435], // Tier 10
  [206500, 206501, 206502, 206503, 206504, 206505] // BAF
];

const ITEMS_RODS = [
  [...range(206721, 206728)], //Fairywing Rods
  [...range(206701, 206708)], //Xermetal Rods
  [...range(206711, 206718)], //Ash Sapling Rods
  [206700] //Old Rod
];

const PRICES = [2, 4, 6, 8, 10, 12, 14, 16, 19, 22, 25, 50];
const FILET_ID = 204052;
const BAITS = {
  70271: 206000, // Bait I 0%
  70272: 206001, // Bait II 20%
  70273: 206002, // Bait III 40%
  70274: 206003, // Bait IV 60%
  70275: 206004, // Bait V 80%
  70365: 206905, // Dappled Bait 80% + 5%
  70364: 206904, // Rainbow Bait 80% + 10%
  70363: 206903, // Mechanical Worm 80% + 15%
  70362: 206902, // Enhanced Mechanical Worm 80% + 20%
  70361: 206901, // Popo Bait 80% + 25%
  70360: 206900, // Popori Bait 80% + 30%
  70281: 206005, // Red Angleworm 0%
  70282: 206006, // Green Angleworm 20%
  70283: 206007, // Blue Angleworm 40%
  70284: 206008, // Purple Angleworm 60%
  70285: 206009, // Golden Angleworm 80%
  70286: 206828, // Celisium Fragment Bait
  70379: 143188, // Event Bait I
  5000012: 143188 // Event Bait II
};

const ITEMS_BANKER = [60264, 160326, 170003, 210111, 216754];
const ITEMS_SELLER = [
  160324,
  170004,
  210109,
  60262,
  60263,
  160325,
  170006,
  210110
];
const TEMPLATE_SELLER = [9903, 9906, 1960, 1961];
const TEMPLATE_BANKER = 1962;

const FISHING_POSITION = { x: -2750.390869140625, y: 88371.3359375, z: -1340 };

class Fishing {
  constructor(d) {
    this.d = d;
    this.d.me.initialize('abnormalities');
    this.installHooks();
  }

  installHooks() {
    this.d.hook('S_SPAWN_USER', 14, event => {
      if (event.gm) {
        console.log('GM DETECTED! LOGGING OUT TO LOBBY NOW!');
        this.d.toServer('C_RETURN_TO_LOBBY', 1, {});
      }
    });

    this.d.hook('S_LOAD_TOPO', 3, event => {
      setInterval(this.loop.bind(this), 3000);
    });
  }

  loop() {
    if (this.d.me.location.dist3D(FISHING_POSITION) > 30) {
      console.log('Teleporting back to fishing location...');
      teleportTo(FISHING_POSITION);
    } else {
      let filets = this.d.inventory.findInBag(204052);
      let fishes = this.d.inventory.findAllInBag(flatSingle(ITEMS_FISHES));
      let bait = this.d.inventory.findInBag(Object.values(BAITS));

      if (!bait) {
        if (!filets || filets.amount < 60) {
          console.log('Ran out of filets for bait. Making more...');
          //TODO dismantle fish into filets
        } else {
          console.log('Crafting more bait...');
          //TODO craft bait
        }
      } else {
        if (Object.keys(BAITS).every(el => abnormalityDuration(Number(el)) <= 0)) {
          console.log('Activating bait...');
          this.useItem(bait);
        }
      }
    }
  }

  useItem(item) {
    this.d.toServer('C_USE_ITEM', 3, {
      gameId: this.d.me.gameId,
      id: item.id,
      dbid: item.dbid,
      amount: 1,
      loc: playerLoc.loc,
      w: playerLoc.w,
      unk4: true
    });
  }

  teleportTo(position) {
    this.d.toServer('C_PLAYER_LOCATION', 5, {
      loc: {
        x: position.x,
        y: position.y,
        z: position.z + 20
      },
      dest: {
        x: position.x,
        y: position.y,
        z: position.z + 20
      },
      w: 2.9032503886720615,
      lookDirection: 0,
      type: 2,
      jumpDistance: 0,
      inShuttle: false,
      time: Math.round(os.uptime() * 1000)
    });
    setTimeout(function() {
      this.d.toServer('C_PLAYER_LOCATION', 5, {
        loc: position,
        dest: position,
        w: 2.9032503886720615,
        lookDirection: 0,
        type: 7,
        jumpDistance: 0,
        inShuttle: false,
        time: Math.round(os.uptime() * 1000) + 500
      });
    }, 500);
  }
}

function* range(a, b) {
  for (var i = a; i <= b; ++i) yield i;
}

const flatSingle = arr => [].concat(...arr);

module.exports = Fishing;
