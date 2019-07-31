const KARAT_ID = 181139;
const FASHION_COUPON = 91344;

const TEMPLATE_MERCHANT = [9903, 9906, 1960, 1961];

const CLAIM_INTERVAL = 5;
const SELL_INTERVAL = 10;

let date = new Date(2019, 6, 16);
date.setHours(1);
date.setMinutes(0);
date.setSeconds(0);
date.setMilliseconds(0);

const TIME = date.valueOf() / 1000;

class Money {

    constructor(d) {
        this.d = d;

        this.merchantContract = {};
        this.itemsToProcess = [];

        this.installHooks();
    }

    start() {
        this.startMoney = d.game.inventory.money / 10000n;
        this.startTime = Date.now();
        this.mainLoop = setInterval(this.loop.bind(this), 100);
        console.log('Starting moneymaker.');
    }

    stop() {
        console.log(this.getMoneyText());
        clearInterval(this.mainLoop);
        if (this.claimInterval) {
            clearInterval(this.claimInterval);
            this.claimInterval = null;
        }
        this.mainLoop = null;
        console.log('Stopping moneymaker.');
    }

    getMoneyText() {
        let gained = Number((this.d.game.inventory.money / 10000n) - this.startMoney);
        let hours = (((Date.now() - this.startTime) / 1000) / 60) / 60;
        let moneyPerHour = Math.round(gained / hours);
        return 'Gained: ' + gained + ' (' + moneyPerHour + ' p/h)';
    }

    loop() {
        if (this.lock)
            return;
        console.log(this.getMoneyText());

        if (this.d.game.inventory.getTotalAmountInBag(FASHION_COUPON) < 300000) {
            if (!this.claimInterval)
                this.claimInterval = this.interval = setInterval(() => this.d.toServer('C_GET_ATTENDANCE_REWARD', 1, { time: TIME }), CLAIM_INTERVAL);
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
                    this.lock = true;
                    this.itemsToProcess = this.d.game.inventory.findAllInBag(KARAT_ID);
                    for (let item of this.itemsToProcess.slice(0, 18)) {
                        this.d.setTimeout(() => {
                            this.d.toServer('C_STORE_SELL_ADD_BASKET', 1, {
                                cid: this.d.game.me.gameId,
                                npc: this.currentContract.id,
                                item: item.id,
                                quantity: 1,
                                slot: item.slot + 40
                            });
                        }, delay);
                        delay += SELL_INTERVAL;
                    }

                    this.itemsToProcess = this.itemsToProcess.slice(18);

                    this.d.setTimeout(() => {
                        if (this.currentContract)
                            this.d.toServer('C_STORE_COMMIT', 1, { gameId: this.d.game.me.gameId, contract: this.currentContract.id });
                        this.lock = false;
                    }, delay);
                } else if (this.currentContract.type == 20) {
                    if (this.d.game.inventory.getTotalAmountInBag(KARAT_ID) > 0) {
                        this.cancelContract();
                        return;
                    }
                    let delay = SELL_INTERVAL;
                    this.lock = true;
                    for (let i = 0; i < 18; i++) {
                        this.d.setTimeout(() => {
                            this.d.toServer('C_MEDAL_STORE_BUY_ADD_BASKET', 1, {
                                gameId: this.d.game.me.gameId,
                                contract: this.currentContract.id,
                                item: KARAT_ID,
                                amount: 1
                            });
                        }, delay);
                        delay += SELL_INTERVAL;
                    }
                    this.d.setTimeout(() => {
                        if (this.currentContract)
                            this.d.toServer('C_MEDAL_STORE_COMMIT', 1, { gameId: this.d.game.me.gameId, contract: this.currentContract.id });
                        this.lock = false;
                    }, delay);
                }
            }
        }
    }

    cancelContract() {
        this.d.toServer('C_CANCEL_CONTRACT', 1, {
            type: this.currentContract.type,
            id: this.currentContract.id
        });
    }

    openMerchant() {
        this.d.toServer('C_REQUEST_CONTRACT', 1, this.merchantContract);
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

    contactNpc(gameId) {
        this.d.send('C_NPC_CONTACT', 2, {
            gameId: gameId
        });
    }

    findClosestNpc() {
		let npc = Object.values(this.npcList).filter(x => TEMPLATE_MERCHANT.includes(x.templateId));
		for (let i = npc.length; i-- > 0; npc[i].distance = npc[i].loc.dist3D(playerLocation.loc));
		npc = npc.reduce((result, obj) => {
			return (!(obj.distance > result.distance)) ? obj : result;
		}, {});
		return npc;
	}

    installHooks() {
        this.d.hook('S_INVEN', 19, event => {
            if (this.mainLoop) return false;
        });

        this.d.hook('S_SYSTEM_MESSAGE_LOOT_ITEM', 'raw', () => {
            if (this.mainLoop) return false;
        });

        this.d.hook('C_REQUEST_CONTRACT', 1, event => {
            if (event.type == 9) {
                Object.assign(this.merchantContract, event);
            }
        });

        this.d.hook('S_CANCEL_CONTRACT', 1, event => {
            if (event.type == this.currentContract.type)
                this.currentContract = null;
            if (this.mainLoop) return false;
        });

        this.d.hook('S_REQUEST_CONTRACT', 1, event => {
            this.currentContract = event;
            if (this.mainLoop) return false;
        });

        this.d.hook('S_DIALOG', 2, event => {
            mod.send('C_DIALOG', 1, {
                id: event.id,
                index: 1,
                questReward: -1,
                unk: -1
            });
        })

        this.d.hook('S_SPAWN_NPC', 11, event => {
            if (TEMPLATE_SELLER.includes(event.templateId) && event.owner === 0n || mod.game.me.is(event.owner)) {
                this.npcList[event.gameId] = event;
            }
        });

        this.d.hook('S_DESPAWN_NPC', 3, event => {
            delete this.npcList[event.gameId];
        });
    }
}

module.exports = Money;