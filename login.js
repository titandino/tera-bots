const config = require('./config.json');
const Bot = require('./bots/'+config.botToUse);

let currentBot;

module.exports = (d, loginData, account) => {
	console.log('Client connected. Sending login arbiter for '+loginData.name+'...');
	
    d.toServer('C_CHECK_VERSION', 1, {
        version: [
            { index: 0, value: config.protocolVersion }, { index: 1, value: 346285 }
        ]
    });
    d.toServer('C_LOGIN_ARBITER', 2, {
        unk1: 0,
        unk2: 0,
        language: 2,
        patchVersion: config.patchVersion,
        name: loginData.name,
        ticket: Buffer.from(loginData.ticket),
    });

    d.hook('S_CHECK_VERSION', 1, data => {
		console.log('Version check ' + ((data.ok == 1) ? 'passed' : 'failed'));
	})

	d.hook('S_LOGIN_ACCOUNT_INFO', 1, () => {
		d.toServer('C_SET_VISIBLE_RANGE', 1, {
			range: 1800
		});
		d.toServer('C_GET_USER_LIST', 1);
	});

	d.hook('S_GET_USER_LIST', 14, event => {
		const characters = new Map();
		for (const character of event.characters) {
			characters.set(character.name.toLowerCase(), {
				id: character.id,
				description: `${character.name} Level ${character.level}`,
			});
		}

		const character = characters.get(account.character.toLowerCase());
		if (!character) {
			console.error(`No character found by name: "${account.character}"`);
			console.error('Character list:');
			for (const char of characters.values()) {
				  console.error(`- ${char.description} (id: ${char.id})`);
			}
		  } else {
			console.log(`Logging into character: ${character.description} (id: ${character.id})`);
			require('./fakeclientlib')(d);
			currentBot = new Bot(d);
			d.toServer('C_SELECT_USER', 1, {
				  id: character.id,
				  unk: 0,
			});
		  }
	});

	d.hook('S_LOAD_TOPO', 2, event => {
		d.toServer('C_LOAD_TOPO_FIN', 1);
	});

	d.hook('S_LOGIN', 13, event => {
		console.log('Successfully logged in! GameId: ' + event.gameId);
	});
}