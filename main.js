'use strict';

const nslib = require('./nslib.js');
const nn = require('./nn.js');

const dist = (x1, y1, x2, y2) => {
	const alpha = x1 - x2;
	const beta  = y1 - y2;
	return Math.sqrt((alpha * alpha) + (beta * beta));
}

const calcAngle = (x1, y1, x2, y2) => {
	const dx = x2 - x1;
	const dy = y2 - y1;
	return Math.atan2(dy, dx);
}

class SmartBot {
	constructor() {
		this.bot = new nslib.Bot();
		this.nn = new nn.Network([18, 10, 5, 3]);
		this.interval = null;
		this.bot.onInitGame = (() => {
			this.interval = setInterval(() => {this.tick();}, 50);
		});
	}
	tick() {
		const U = this.bot.users;
		let nn_input = [];
		const MAX_VISIBILITY = 400;
		for(let angleDeg = 0;angleDeg < 360;angleDeg += 20) {
			let minD = MAX_VISIBILITY/*Infinity*/;
			for(let plrID in U) {
				if(plrID == this.bot.ingameId) continue;
				const plr = U[plrID];
				const tmp = -calcAngle(plr.x, plr.y,
									   U[this.bot.ingameId].x, U[this.bot.ingameId].y) + Math.PI
				const anglePlayer = tmp / (Math.PI * 2) * 360;
				if(anglePlayer >= angleDeg && anglePlayer < angleDeg + 20) {
					minD = Math.min(minD, dist(plr.x, plr.y, U[this.bot.ingameId].x, U[this.bot.ingameId].y));
				}
			}
			nn_input.push(1 - (minD / MAX_VISIBILITY));
		}
		//console.log(nn_input);
		let out = this.nn.run(nn_input);
		let mv = 1;
		if(out[0] > 0.5)  mv *= 2; // up
		if(out[0] < -0.5) mv *= 3; // down
		if(out[1] > 0.5)  mv *= 5; // left
		if(out[1] < -0.5) mv *= 7; // right
		this.bot.move(mv);
		this.bot.shootAtAngle(out[2]);
		//console.log(out);
	}
}

let BOT_COUNT = 10;

let bots = [];
for(let b = 0;b < BOT_COUNT;b ++) {
	let sb = new SmartBot();
	sb.bot.startConnect();
	bots.push(sb);
}

const mainLoop = () => {
	setTimeout(() => {
		const U = bots[0].bot.users;
		let bestScore = -9999;
		let bestUID = null;
		for(let uid in U) {
			if(U[uid].name == 'asd') continue;
			let score = U[uid].kills - U[uid].deaths * 3;
			if(score > bestScore) {
				bestScore = score;
				bestUID = uid;
			}
		}
		if(bestUID == null) {
			throw "WTF";
		}
		console.log('round best:', bestUID, U[bestUID]);

		let bestNN = null;
		for(let i = 0;i < bots.length;i ++) {
			if(bots[i].bot.ingameId == bestUID) {
				bestNN = nn.copyNN(bots[i].nn);
			}
			clearInterval(bots[i].interval);
			bots[i].bot.socket.terminate();
		}
		bots = [];

		setTimeout(() => {
		for(let b = 0;b < BOT_COUNT;b ++) {
			let sb = new SmartBot();
			sb.nn = nn.copyNN(bestNN);
			const chance = (b / BOT_COUNT) * 0.1 + 0.01;
			nn.mutate(sb.nn, chance);
			bots.push(sb);
		}

		for(let sb of bots) {
			sb.bot.startConnect();
		}

		mainLoop(); }, 1000);
	}, 20000);
}
mainLoop();
