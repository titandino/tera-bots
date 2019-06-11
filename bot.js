const config = require('./config.json');
const path = require('path');
const webClient = require('tera-auth-ticket');
const { Connection, FakeClient } = require('tera-network-proxy');

global.TeraProxy = { DevMode: true };

const account = config.account;
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
		environment: 'live',
		regionShort: 'na',
		majorPatch: 81,
		minorPatch: 3,
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
	dispatch.toServer = (...args) => dispatch.write(true, args);
	dispatch.toClient = (...args) => dispatch.write(false, args);

	client.on('connect', () => {
		require('./actions/login')(dispatch, data);
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
