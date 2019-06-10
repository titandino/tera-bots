const config = require('./config.json');
const path = require('path');
const webClient = require('tera-auth-ticket');
const { Connection, FakeClient } = require('tera-network-proxy');

let accountNumber = 0;

// let accountNumber = parseInt(process.argv[2]);
// if (isNaN(accountNumber) || !(accountNumber in config.accounts)) {
// 	console.log("Please, specify a valid account number to login to.");
// 	process.exit(1);
// }

const account = config.accounts[accountNumber];
console.log(`Logging into character ${account.character} on account ${account.email}.`);

const web = new webClient(account.email, account.password, config.blackBoxToken);
web.getLogin((err, data) =>  {
	if (err) { 
		console.log(err);
		return;
    }

	const connection = new Connection(path.join(__dirname, '.', 'mods'), {
		serverId: 4105,
		platform: 'pc',
		region: 'NA',
		regionShort: 'na',
		protocol: config.protocolVersion,
		majorPatch: 81,
		minorPatch: 3,
		sysmsg: {}
	});
	
	const client = new FakeClient(connection);
	connection.info.clientInterface = client;

	const srvConn = connection.connect(client, { host: config.host, port: config.port });

	let dispatch = connection.dispatch;

	client.on('connect', () => {
		console.log('Client connected. Sending login arbiter for '+data.name+'...');
		dispatch.write(true, 'C_CHECK_VERSION', 1, {
			version: [
				{ index: 0, value: 347372 }, { index: 1, value: 346284 }
			]
		});
		dispatch.write(true, 'C_LOGIN_ARBITER', 2, {
			unk1: 0,
			unk2: 0,
			language: 2,
			patchVersion: config.patchVersion,
			name: data.name,
			ticket: Buffer.from(data.ticket),
		});
	});

	client.on('close', () => {
		console.log('Client closed.');
	});

	client.on('error', event => {
		console.log('Error:');
		console.log(event);
	})

	dispatch.hook('S_CHECK_VERSION', 1, data => {
		console.log('Version check: ' + (data.ok == 1));
	})

	dispatch.hook('S_LOGIN_ACCOUNT_INFO', 1, () => {
		dispatch.write(true, 'C_GET_USER_LIST', 1);
	});

	dispatch.hook('S_GET_USER_LIST', 14, event => {
		const characters = new Map();
		for (const character of event.characters) {
			characters.set(character.name.toLowerCase(), {
				id: character.id,
				description: `${character.name} Level ${character.level}`,
			});
		}

		const character = characters.get(account.character.toLowerCase());
		if (!character) {
			console.error(`[client] no character "${account.character}"`);
			console.error('[client] character list:');
			for (const char of characters.values()) {
				  console.error(`- ${char.description} (id: ${char.id})`);
			}
		  } else {
			console.log(`[client] logging onto ${character.description} (id: ${character.id})`);
			dispatch.write(true, 'C_SELECT_USER', 1, {
				  id: character.id,
				  unk: 0,
			});
		  }
	});

	dispatch.hook('S_LOAD_TOPO', 2, event => {
		dispatch.write(true, 'C_LOAD_TOPO_FIN', 1);
	});

	srvConn.setTimeout(0);

	srvConn.on('connect', () => {
		console.log(`<connected to ${srvConn.remoteAddress}:${srvConn.remotePort}>`);
	});

	srvConn.on('timeout', () => {
		console.log('<timeout>');
	});

	srvConn.on('close', () => {
		console.log('<disconnected>');
	});

	srvConn.on('error', (err) => {
		console.log(err);
  	});
});
