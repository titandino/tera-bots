const config = require('./config.json');
const os = require('os');

module.exports = function Fish(dispatch) {
	let cid;
	let started = false;

	function teleportTo(position) {
		dispatch.toClient('S_INSTANT_MOVE', 1, { id: cid, x: position.x, y: position.y, z: position.z, w: 0 });
        dispatch.toServer('C_PLAYER_LOCATION', 1, {
        	x1: position.x, y1: position.y, z1: position.z+20,
        	x2: position.x, y2: position.y, z2: position.z+20,
        	time: Math.round(os.uptime() * 1000),
        	w: 0,
        	type: 2,
        	speed: 0,
        	unk: 0,
        	unk2: 0
        });
    	setTimeout(function() {
    		dispatch.toServer('C_PLAYER_LOCATION', 1, {
        		x1: position.x, y1: position.y, z1: position.z,
        		x2: position.x, y2: position.y, z2: position.z,
        		time: Math.round(os.uptime() * 1000),
        		w: 0,
        		type: 7,
        		speed: 0,
        		unk: 0,
        		unk2: 0
       		});
		}, 500);
	}

	dispatch.hook('S_LOGIN', 13, event => {
		cid = event.gameId;
	});

	dispatch.hook('S_LOAD_TOPO', 2, event => {
		if (started) {
        	lastChannel = currentChannel;
    	}
    });

	dispatch.hook('S_CURRENT_CHANNEL', 2, event => {
		lastChannel = event.channel;
		currentChannel = event.channel;

		if (!started) {
			currentZone = event.zone;
			started = true;
		}
	});
};
