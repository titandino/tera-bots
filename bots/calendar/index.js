const os = require('os');
const moment = require('moment');

const KARAT_ID = 181139;
const FASHION_COUPON = 91344;

const MERCHANT_LOC = {
    x: 17785.369140625,
    y: 8249.794921875,
    z: -3411.2294921875
}

const TEMPLATE_MERCHANT = [135,];

const CLAIM_INTERVAL = 30;
const SELL_INTERVAL = 60;

function getPSTDate() {
    let d = new Date();
    let utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    let nd = new Date(utc + (3600000 * -7));
    return nd;
}

function getTime(month, day) {
    let date = new Date(2019, month-1, day);
    date.setHours(-(new Date().getTimezoneOffset() / 60) + 8);
    date.setMinutes(0);
    date.setSeconds(0);
    date.setMilliseconds(0);
    return date.valueOf() / 1000;
}

class Calendar {

    constructor(d) {
        this.d = d;

        this.playerLocation = {};
        this.merchantContract = {};
        this.itemsToProcess = [];
        this.npcList = [];

        this.installHooks();
    }

    start(month, day) {
        this.time = getTime(month, day);
        this.startMoney = this.d.game.inventory.money / 10000n;
        this.startTime = Date.now();
        this.mainLoop = setInterval(this.loop.bind(this), 100);
        console.log('Starting...');
    }

    stop() {
        this.time = null;
        console.log(this.getMoneyText());
        clearInterval(this.mainLoop);
        if (this.claimInterval) {
            clearInterval(this.claimInterval);
            this.claimInterval = null;
        }
        this.mainLoop = null;
        console.log('Stopping...');
    }

    getMoneyText() {
        let gained = Number((this.d.game.inventory.money / 10000n) - this.startMoney);
        let hours = (((Date.now() - this.startTime) / 1000) / 60) / 60;
        let moneyPerHour = Math.round(gained / hours);
        return 'Gained: ' + gained + ' (' + moneyPerHour + ' p/h)';
    }

    loop() {
        let dateNow = getPSTDate();
        if (dateNow.getHours() == 0 && dateNow.getMinutes() > 45) {
            this.stop();
            process.exit();
            return;
        }

        if (this.lock)
            return;

        if (!this.merchantContract.type) {
            if (this.lastDialog && this.lastDialog.options[0] && this.currentContract && this.currentContract.type == 9) {
                let data = Buffer.alloc(4);
                data.writeUInt32LE(this.lastDialog.options[0].type);
                this.merchantContract = {
                    type: 9,
                    recipientId: this.lastDialog.gameId,
                    dialogOption: this.lastDialog.options[0].type,
                    name: "",
                    data: data
                }
                console.log('Got merchant contract.');
                console.log(this.merchantContract);
                return;
            }
            let npc = this.findClosestNpc();
            if (!npc || npc.distance > 175) {
                console.log('No merchant found close enough. Teleporting to it.');
                this.teleportTo(MERCHANT_LOC);
                this.sleep(1000);
            } else {
                this.contactNpc(npc.gameId);
                this.sleep(2000);
            }
            return;
        }

        if (this.d.game.inventory.getTotalAmountInBag(FASHION_COUPON) < 300000) {
            if (!this.claimInterval)
                this.claimInterval = this.interval = setInterval(() => this.d.toServer('C_GET_ATTENDANCE_REWARD', 1, { time: this.time }), CLAIM_INTERVAL);
        } else {
            clearInterval(this.claimInterval);
            this.claimInterval = null;
        }

        if (this.d.game.inventory.getTotalAmountInBag(FASHION_COUPON) < 4500) {
            return;
        } else {
            if (!this.currentContract) {
                if (this.d.game.inventory.getTotalAmountInBag(KARAT_ID) <= 0) {
                    this.openFashion();
                } else {
                    this.openMerchant();
                }
            } else {
                if (this.currentContract.type == 9) {
                    if (this.d.game.inventory.getTotalAmountInBag(KARAT_ID) <= 0) {
                        this.cancelContract();
                        return;
                    }

                    let delay = SELL_INTERVAL;
                    this.itemsToProcess = this.d.game.inventory.findAllInBag(KARAT_ID);
                    for (let item of this.itemsToProcess.slice(0, 18)) {
                        setTimeout(() => {
                            if (this.currentContract) {
                                this.d.toServer('C_STORE_SELL_ADD_BASKET', 1, {
                                    cid: this.d.game.me.gameId,
                                    npc: this.currentContract.id,
                                    item: item.id,
                                    quantity: 1,
                                    slot: item.slot + 40
                                });
                            }
                        }, delay);
                        delay += SELL_INTERVAL;
                    }

                    this.itemsToProcess = this.itemsToProcess.slice(18);

                    this.sleep(delay+200);

                    setTimeout(() => {
                        if (this.currentContract) {
                            this.d.toServer('C_STORE_COMMIT', 1, { gameId: this.d.game.me.gameId, contract: this.currentContract.id });
                        }
                    }, delay);
                } else if (this.currentContract.type == 20) {
                    if (this.d.game.inventory.getTotalAmountInBag(KARAT_ID) > 0) {
                        this.cancelContract();
                        return;
                    }
                    let delay = SELL_INTERVAL;
                    this.lock = true;
                    for (let i = 0; i < 18; i++) {
                        setTimeout(() => {
                            if (this.currentContract) {
                                this.d.toServer('C_MEDAL_STORE_BUY_ADD_BASKET', 1, {
                                    gameId: this.d.game.me.gameId,
                                    contract: this.currentContract.id,
                                    item: KARAT_ID,
                                    amount: 1
                                });
                            }
                        }, delay);
                        delay += SELL_INTERVAL;
                    }
                    setTimeout(() => {
                        if (this.currentContract) {
                            this.d.toServer('C_MEDAL_STORE_COMMIT', 1, { gameId: this.d.game.me.gameId, contract: this.currentContract.id });
                            console.log(this.getMoneyText());
                        }
                        this.lock = false;
                    }, delay);
                }
            }
        }
    }

    contactNpc(gameId) {
        this.d.toServer('C_NPC_CONTACT', 2, {
            gameId: gameId
        });
    }

    findClosestNpc() {
        let npc = Object.values(this.npcList).filter(x => TEMPLATE_MERCHANT.includes(x.templateId));
        for (let i = npc.length; i-- > 0; npc[i].distance = npc[i].loc.dist3D(this.playerLocation.loc));
        npc = npc.reduce((result, obj) => {
            return (!(obj.distance > result.distance)) ? obj : result;
        }, {});
        return npc;
    }

    cancelContract() {
        if (this.currentContract) {
            this.d.toServer('C_CANCEL_CONTRACT', 1, {
                type: this.currentContract.type,
                id: this.currentContract.id
            });
            this.currentContract = null;
        }
    }

    openMerchant() {
        this.d.toServer('C_REQUEST_CONTRACT', 2, this.merchantContract);
    }

    openFashion() {
        this.d.toServer('C_USE_ITEM', 3, {
            gameId: this.d.game.me.gameId,
            id: FASHION_COUPON,
            dbid: 0,
            target: 0,
            amount: 1,
            dest: { x: 0, y: 0, z: 0 },
            loc: { x: 0, y: 0, z: 0 },
            w: 0,
            unk1: 0,
            unk2: 0,
            unk3: 0,
            unk4: 1
        });
    }

    sleep(ms) {
        this.lock = true;
        setTimeout(() => {
            this.lock = false;
        }, ms);
    }

    teleportTo(position) {
        this.d.toClient('S_INSTANT_MOVE', 3, {
            gameId: this.d.game.me.gameId,
            loc: position,
            w: 2.9032503886720615
        });
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
        setTimeout(() => {
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

    installHooks() {
        this.d.hook('C_REQUEST_CONTRACT', 2, event => {
            if (event.type == 9) {
                Object.assign(this.merchantContract, event);
            }
        });

        this.d.hook('S_CANCEL_CONTRACT', 1, event => {
            if (event.type == this.currentContract.type)
                this.currentContract = null;
        });

        this.d.hook('S_REQUEST_CONTRACT', 1, event => {
            this.currentContract = event;
        });

        this.d.hook('S_DIALOG_EVENT', 'raw', event => {
            this.d.toServer('C_DIALOG_EVENT', 1, {
                unk1: -1467822183,
                unk2: 2,
                unk3: 0
            });
        });

        this.d.hook('C_PLAYER_LOCATION', 5, event => {
            this.playerLocation = event;
        });

        this.d.hook('S_LOAD_TOPO', 3, event => {
            this.playerLocation.loc = event.loc;
            this.playerLocation.w = 0;
            console.log('Logged in fully. Starting in 5 seconds...');
            setTimeout(() => {
                this.start(8, 1);
            });
        });

        this.d.hook('S_DIALOG', 2, event => {
            this.lastDialog = event;
            this.d.toServer('C_DIALOG_EVENT', 1, {
                unk1: -1467822183,
                unk2: 0,
                unk3: 0
            });
            this.d.toServer('C_SHOW_INVEN', 1, {
                unk: 1
            });
            this.d.toServer('C_DIALOG', 1, {
                id: event.id,
                index: 1,
                questReward: -1,
                unk: -1
            });
        })

        this.d.hook('S_SPAWN_NPC', 11, event => {
            if (TEMPLATE_MERCHANT.includes(event.templateId) && event.owner === 0n || this.d.game.me.is(event.owner)) {
                this.npcList[event.gameId] = event;
            }
        });

        this.d.hook('S_DESPAWN_NPC', 3, event => {
            delete this.npcList[event.gameId];
        });
    }
}

module.exports = Calendar;