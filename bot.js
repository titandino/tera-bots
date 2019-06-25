const config = require('./config.json');
const path = require('path');
const webClient = require('tera-auth-ticket');
const { Connection, FakeClient } = require('tera-network-proxy');

global.TeraProxy = { DevMode: false };

let accountNumber = parseInt(process.argv[2]);
if (isNaN(accountNumber) || !(accountNumber in config.accounts)) {
	console.log("Please, specify a valid account number to login to.");
	process.exit(1);
}

const account = config.accounts[accountNumber];

console.log(`Logging into character ${account.character} on account ${account.email}.`);

const web = new webClient(account.email, account.password, account.blackBoxToken);
web.getLogin((err, data) =>  {
	if (err) { 
		console.log(err);
		process.exit(1);
    }

	const connection = new Connection(path.join(__dirname, '.', 'mods'), {
		serverId: config.serverId,
		platform: 'pc',
		region: 'NA',
		environment: 'live',
		regionShort: 'na',
		majorPatch: config.major,
		minorPatch: config.minor,
		protocolVersion: config.protocolVersion,
		maps: {
			sysmsg: {},
			protocol: loadProtocolMap(config.protocolVersion)
		}
	});
	
	const client = new FakeClient(connection);
	connection.clientInterfaceConnection = client;

	const srvConn = connection.connect(client, { host: config.host, port: config.port });

	let dispatch = connection.dispatch;
	dispatch.toServer = (...args) => dispatch.write(true, ...args);
	dispatch.toClient = (...args) => dispatch.write(false, ...args);

	client.on('connect', () => {
		require('./login')(dispatch, data, account);
	});

	srvConn.setTimeout(0);
	srvConn.on('connect', () => console.log(`TCP connection established to ${srvConn.remoteAddress}:${srvConn.remotePort}`));
	srvConn.on('timeout', () => console.log('Server timeout'));
	srvConn.on('close', () => console.log('Server disconnected'));
	srvConn.on('error', (err) => console.log(err));

	client.on('close', () => console.log('Client closed'));
	client.on('error', event => console.log(event));
});

function loadProtocolMap(version) {
	const parseMap = require('tera-data-parser').parsers.Map;
	const teradata = path.join(__dirname, '.', 'node_modules', 'tera-data');
	const filename = `protocol.${version}.map`;

	let baseMap = {};
	try {
		baseMap = parseMap(path.join(teradata, 'map_base', filename));
	} catch (e) {
		if (e.code !== 'ENOENT')
			throw e;
	}

	let customMap = {};
	try {
		customMap = parseMap(path.join(teradata, 'map', filename));
	} catch (e) {
		if (e.code !== 'ENOENT')
			throw e;
	}

	return Object.assign(customMap, baseMap);
}
