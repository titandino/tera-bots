const { fork } = require('child_process');
const fs = require('fs');
const config = require('./config.json');
const moment = require('moment');

const INACTIVE_RESTART_TIME = 2 * 60 * 1000; // If spawned process stays inactivefor 1 minute it will kill it and restart.
const DELAY_TO_RESTART = 1 * 60 * 1000; // Delay to restart after process exits.

const spawned_childs = {};
const write_queue = [];
let writing = false;

function emptyQueue() {
	if (write_queue.length == 0) {
		writing = false;
		return;
	}

	fs.appendFile('errors.log', write_queue[0], 'utf8', (err) => {
		write_queue.shift();
		emptyQueue();
	});
}

function writeToFile(data) {
	write_queue.push(data);
	if (!writing) {
		writing = true;
		emptyQueue();
	}
}

function spawnBotClient(accountIndex) {
	const account = config.accounts[accountIndex];

	console.log(`[${moment().format('MM/DD HH:mm:ss [PDT]')}] Starting bot on account with index ${accountIndex} (${account.character})`);
	const child = { process: fork('bot', [accountIndex], {silent: true}), io: []};
	spawned_childs[accountIndex] = child;

	child.kill_timer = setTimeout(() => {
		child.process.kill();
	}, INACTIVE_RESTART_TIME);

	const log = (msg) => {
		console.log(msg);
		child.io.push(msg);
		if (child.io.length > 100) {
			child.io.shift();
		}
	}

	const process_io = (data) => {
		const data_string = `[${moment().format('MM/DD HH:mm:ss [PDT]')}] ${accountIndex}: ${data.toString().trim()}`;

		clearTimeout(child.kill_timer);
		child.kill_timer = setTimeout(() => {
			child.process.kill();
		}, INACTIVE_RESTART_TIME);

		return data_string;
	};

	child.process.stdout.on('data', data => log(process_io(data)));

	child.process.stderr.on('data', data => {
		const data_string = process_io(data);
		log(data_string);
		writeToFile(data_string + '\r\n');
	});

	child.process.on('exit', () => {
		log(`[${moment().format('MM/DD HH:mm:ss [PDT]')}] Account with index ${accountIndex} exited.`);
		clearTimeout(child.kill_timer);
		setTimeout(spawnBotClient, DELAY_TO_RESTART, accountIndex);
	});
}

function spawnDiscordClient() {
	const child = fork('./bots/worldbosshunter/discord');
	child.on('message', (msg) => {
		if (!(msg.account in spawned_childs)) {
			child.send({message: `ERROR: No account with index ${msg.account} running.`});
			return;
		}

		const bot_child = spawned_childs[msg.account];

		if (msg.command === '!status') {
			child.send({io: bot_child.io.slice(bot_child.io.length - (msg.size || bot_child.io.length))});
		} else if (msg.command === '!relog') {
			if (!bot_child.process.killed) { 
				child.send({message: `Relogging account with index ${msg.account}.`});
				bot_child.process.kill();
			} else {
				child.send({message: `This account is already relogging.`});
			}
		}
	});
	child.on('exit', spawnDiscordClient);
}

for (const accountIndex in config.accounts) {
	spawnBotClient(accountIndex);
}

spawnDiscordClient();