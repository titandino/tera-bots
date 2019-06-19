
const EBOY = 'Hiinako';
const GF_PREY = 'Madi';

class Tracker {
  constructor(d) {
    this.d = d;
    this.installHooks();
  }

  installHooks() {
    this.d.hook('S_GUILD_MEMBER_LIST', 1, event => {
      this.members = event.members;
    });

    this.d.hook('S_LOAD_TOPO', 3, event => {
      setInterval(this.loop.bind(this), 3000);
    });
  }

  loop() {
    if (this.members) {
        this.members.forEach(member => {
            if (member.name == EBOY) {
                this.eboyLocation = member.location1;
            } else if (member.name == GF_PREY) {
                this.gfLocation = member.location1;
            }
        });
        if (gfLocation == eboyLocation) {
            console.log('She is currently playing with the eboy. Get the razorblade and the noose.');
        }
    }
  }
}

module.exports = Tracker;
