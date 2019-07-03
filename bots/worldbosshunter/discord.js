const config = require('./config.json');
const bosses = require('./bosses.js');
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const Discord = require('discord.js');
const client = new Discord.Client();

const BamSchema = new Schema({
	name: { type: String, required: true },
	location: { type: String, required: true },
	channel: { type: Number, required: true },
	gameId: { type: String, unique: true, required: true },
	firstSeen: { type: Date, default: Date.now },
	lastSeen: { type: Date, default: Date.now }
});
const Bam = mongoose.model('Bam', BamSchema);

client.on('ready', () => {
	client.user.setUsername('Country Bot');
});

async function getSpawnTimes() {
	let array = [];
	let now = Date.now();

	for (let i = 0; i < bosses.length; i++) {
		const boss = bosses[i];
		for (let channel = 1; channel <= boss.channelCount; channel++) {
			const [doc] = await Bam.find({ name: boss.name, channel }).sort({ lastSeen: -1 }).limit(1);
			if (doc) {
				array.push({name: boss.name, channel, time: now - doc.lastSeen});
			} else {
				array.push({name: boss.name, channel, time: -1});
			}
		}
	}

	array.sort((a, b) => {
		return a.time - b.time;
	});

	return array;
}

let lastCommandMessage = null;

client.on('message', async msg => {
	try {
		if (msg.channel.name != config.channelName)
			return;
		let [message, command, argument] = /([^\s]+)\s*(.*)/g.exec(msg.content);
		command = command.toLowerCase().trim();
		argument = argument.toLowerCase().trim();

		if (command === '!timers') {
			const arr = await getSpawnTimes();
			const strings = [];
			for (let i = 0; i < arr.length; i++) {
				if (!argument || arr[i].name.toLowerCase().includes(argument)) {
					if (arr[i].time != -1) {
						strings.push((arr[i].time > 18000000 ? '**' : '') + `${arr[i].name}, channel ${arr[i].channel}: ${formatSeconds(arr[i].time)}` + (arr[i].time > 18000000 ? '**' : ''));
					} else {
						strings.push(`${arr[i].name}, channel ${arr[i].channel}: Not Available!`);
					}
				}
			}

			if (strings.length > 0) {
				msg.reply(`\n${strings.join('\n')}`);
			} else {
				msg.reply('Invalid argument!');
			}
		} else if (command === '!status' || command == '!relog') {
			let [account, size] = argument.split(',');
			account = parseInt(account); size = parseInt(size) || 20;

			if (isNaN(account)) {
				msg.reply('You have to specify an account number for this command.');
				return; 
			}

			if (lastCommandMessage) { 
				msg.reply('I\'m busy right now.'); 
				return; 
			}
			lastCommandMessage = msg;
			
			size = Math.min(size, 20);

			process.send({command, account, size});
		}
	} catch(e) {
		// Whatever, those errors dont matter.
	}
});

process.on('message', (msg) => {
	try {
		if (msg.message) {
			lastCommandMessage.reply(msg.message);
		} else if (msg.io) {
			lastCommandMessage.reply(msg.io.join('\n'));
		}
	} catch(e) {

	}
	lastCommandMessage = null;
});

function formatSeconds(seconds) {
	let hours = Math.floor(seconds / 1000 / 60 / 60);
	let minutes = Math.floor(seconds / 1000 / 60 % 60);
	return `${hours > 0 ? hours + ` hour${hours > 1 ? 's' : ''}, ` : ''}${minutes} minute${minutes > 1 ? 's' : ''}`
}

mongoose.connect(config.mongodb, {
	useCreateIndex: true,
	useNewUrlParser: true
});
client.login(config.token);