const config = require('./config.json');
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const Discord = require('discord.js');
const client = new Discord.Client();
const os = require('os');
const moment = require('moment');
const bosses = require('./bosses.js');

const BamSchema = new Schema({
    name: { type: String, required: true },
    location: { type: String, required: true },
    channel: { type: Number, required: true },
    gameId: { type: String, unique: true, required: true },
    firstSeen: { type: Date, default: Date.now },
    lastSeen: { type: Date, default: Date.now },
});
const Bam = mongoose.model('Bam', BamSchema);

const idleLocations = {
    7004: { x: 75279, y: 85914, z: 1155 }, // Castanica
    7014: { x: -74436, y: -1713, z: 2972 }, // Elenea
    7021: { x: -47042, y: 10099, z: 5003 }, // Dragonfall
    7022: { x: -11812, y: 51409, z: 5987 }, // Habere
};

let cid;
let availableBosses = [];
let started = false;


let currentZone = 0;
let currentBoss = 0;
let currentLocation = 0;
let currentChannel = 1;

let lastLocation;
let lastBoss;
let lastLocationIdx;
let lastChannel;
const worldBossMap = new Map();
let nearbyPlayers = new Map();

let d;

module.exports = function (dispatch) {
    d = dispatch;
    installHooks();

    for (const boss of bosses) {
        let arr = new Array(boss.channelCount);
        worldBossMap.set(boss.name, arr);

        for (let channel = 1; channel <= boss.channelCount; channel++) {
            Bam.find({ name: boss.name, channel }).sort({ lastSeen: -1 }).limit(1).then((documents) => {
                const [doc] = documents;
                if (doc) {
                    arr[channel - 1] = doc;
                }
            });
        }
    }

    mongoose.connect(config.mongodb, {
        useCreateIndex: true,
        useNewUrlParser: true
    });
    client.login(config.token);
};

function installHooks() {
    d.hook('S_LOAD_TOPO', 'raw', event => {
        if (started) {
            lastChannel = currentChannel;
        }
    });

    d.hook('S_CURRENT_CHANNEL', 2, event => {
        lastChannel = event.channel;
        currentChannel = event.channel;

        if (!started) {
            currentZone = event.zone;
            updateAvailableBosses();
            started = true;
            setTimeout(takeAction, config.actionDelay);
        }
    });

    d.hook('S_SPAWN_USER', 14, event => {
        nearbyPlayers.set(event.name, event);
    });

    d.hook('S_SPAWN_NPC', 11, event => {
        const boss = lastBoss;
        const location = lastLocation;

        if (boss && location && event.templateId == boss.templateId && boss.huntingZoneId == boss.huntingZoneId) {
            let firstSeen = true;
            const bossArray = worldBossMap.get(boss.name);
            let doc = bossArray[lastChannel - 1];
            if (!doc || doc.gameId != event.gameId.toString()) {
                doc = new Bam({ name: boss.name, location: location.name, channel: lastChannel, gameId: event.gameId.toString() });
                bossArray[lastChannel - 1] = doc;
            } else {
                doc.lastSeen = Date.now();
                firstSeen = false;
            }
            doc.save();

            setTimeout(function () {
                client.guilds.every(function(guild) {
                    if (guild.id == config.guildId) {
                        let channel = guild.channels.find(ch => ch.name == config.channelName);
                        if (channel != null) {
                            let message = `${boss.name} at ${(location ? location.name : 'somewhere')} (location: ${lastLocationIdx}) in channel ${lastChannel}! ${firstSeen ? '@here' : ''} ${moment().format('MM/DD H:mma [PDT] ')}`;
                            message += `${event.mode == 1 ? '\r\n**__IN COMBAT__**' : ''} ${nearbyPlayers.size > 0 ? '\r\nNearby players: ' + Array.from(nearbyPlayers, ([name, player]) => name + ' ('+player.guildName+')') : ''}`;
                            message += `${event.hpLevel == 5 ? '' : '\r\nHealth: ~' + ((event.hpLevel * 20) + 10) + '%'}`
                            channel.send(message);
                        } else {
                            console.error(`Could not find the channel with the name ${config.channelName}.`);
                        }
                    }
                });
            }, 500);
        }

        if ((event.templateId == 1003 && event.huntingZoneId == 152) || (event.templateId == 1000 && event.huntingZoneId == 429)) {
            setTimeout(function () {
                client.guilds.every(function (guild) {
                    if (guild.id == config.guildId) {
                        let channel = guild.channels.find(ch => ch.name == config.channelName);
                        if (channel != null) {
                            channel.send(`@here CRABS! CRABS! CRABS! CRABS! CRABS! CRABS!`);
                        } else {
                            console.error(`Could not find the channel with the name ${config.channelName}.`);
                        }
                    }
                });
            }, 500);
        }
    });
}

function teleportTo(position) {
    d.toServer('C_PLAYER_LOCATION', 5, {
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
        w: 0,
        lookDirection: 0,
        type: 2,
        jumpDistance: 0,
        inShuttle: false,
        time: Math.round(os.uptime() * 1000)
    });
    setTimeout(function () {
        d.toServer('C_PLAYER_LOCATION', 5, {
            loc: position,
            dest: position,
            w: 0,
            lookDirection: 0,
            type: 7,
            jumpDistance: 0,
            inShuttle: false,
            time: Math.round(os.uptime() * 1000) + 500
        });
    }, 500);
}

function updateAvailableBosses() {
    const now = Date.now();
    availableBosses = [];

    for (const boss of bosses) {
        if (boss.zone == currentZone) {
            const bossArray = worldBossMap.get(boss.name);

            for (let channel = 1; channel <= boss.channelCount; channel++) {
                const doc = bossArray[channel - 1];
                let cooldown = false;

                if (doc && now - doc.lastSeen < 5 * 60 * 60 * 1000 && now - doc.lastSeen > 5 * 60 * 1000) {
                    cooldown = true;
                }

                if (!cooldown) {
                    availableBosses.push({ boss, channel });
                }
            }
        }
    }

    availableBosses.sort((a, b) => a.channel - b.channel);
}

function takeAction() {
    if (!availableBosses[currentBoss]) {
        currentBoss = 0;
        teleportTo(idleLocations[currentZone]);
        console.log(`Idle for 1 minute in channel ${currentChannel} zone ${currentZone}...`);
        setTimeout(() => {
            updateAvailableBosses();
            takeAction();
        }, 60000);

        return;
    }

    const { boss, channel } = availableBosses[currentBoss];

    if (currentChannel != channel) {
        currentLocation = 0;
        console.log(`Checking channel ${channel}`);
        d.toServer('C_SELECT_CHANNEL', 1, {
            unk: 1,
            zone: currentZone,
            channel: channel - 1,
        });
        nearbyPlayers = new Map();
        setTimeout(() => lastChannel = currentChannel, 5000);
        setTimeout(takeAction, 7000);
        return;
    }

    const location = boss.locations[currentLocation];

    lastLocation = location;
    lastBoss = boss;
    lastLocationIdx = currentLocation;

    nearbyPlayers = new Map();
    teleportTo(location.coords);

    console.log(`Checking at ${location.name}`);

    setTimeout(() => {
        currentLocation++;

        if (!(currentLocation in boss.locations)) {
            currentLocation = 0;
            currentBoss++;
        }

        if (!(currentBoss in availableBosses)) {
            currentBoss = 0;
            updateAvailableBosses();
        }

        takeAction();
    }, config.actionDelay);
}