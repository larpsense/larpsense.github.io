document.documentElement.classList.add("js");
if (window.lucide) lucide.createIcons();

const seen = new IntersectionObserver(
	(list) => list.forEach((e) => e.isIntersecting && (e.target.classList.add("in"), seen.unobserve(e.target))),
	{ threshold: 0.12 }
);
document.querySelectorAll("h2, .sub, .bar, .ticks, .shot, #about p").forEach((el) => {
	el.classList.add("rev");
	seen.observe(el);
});
document.querySelectorAll(".grid").forEach((g) =>
	[...g.children].forEach((c, i) => {
		c.classList.add("rev");
		c.style.transitionDelay = i * 110 + "ms";
		seen.observe(c);
	})
);

/* demo data mirrors init.luau command shapes */
const CMDS = [
	{ name: "speed", aliases: ["ws"], desc: "sets your walkspeed", args: ["number"] },
	{ name: "goto", aliases: [], desc: "goes to a player", args: ["player"] },
];
const PLAYERS = ["larp", "larpsense", "sense"];

const byName = {};
CMDS.forEach((c) => {
	byName[c.name] = c;
	c.aliases.forEach((a) => (byName[a] = c));
});

const box = document.getElementById("cmd");
const hl = document.getElementById("hl");
const ph = document.getElementById("ph");
const sug = document.getElementById("sug");

function esc(s) {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function tokens(t) {
	const m = t.match(/\S+/g);
	return m ? m : [];
}

function findPlayer(q) {
	q = q.trim().toLowerCase();
	if (!q) return null;
	let hit = PLAYERS.find((p) => p.toLowerCase() === q);
	if (hit) return hit;
	hit = PLAYERS.find((p) => p.toLowerCase().startsWith(q));
	return hit || null;
}

function check(raw, type) {
	if (type === "string") {
		if (!raw || !isNaN(Number(raw))) return [false, null];
		return [true, raw];
	}
	if (type === "number") {
		const n = Number(raw);
		return raw !== "" && !isNaN(n) ? [true, n] : [false, null];
	}
	if (type === "boolean") {
		const l = (raw || "").toLowerCase();
		if (l === "true") return [true, true];
		if (l === "false") return [true, false];
		return [false, null];
	}
	if (type === "player") return findPlayer(raw || "") ? [true, raw] : [false, null];
	return [false, null];
}

function infer(v) {
	if (v !== "" && !isNaN(Number(v))) return "number";
	const l = v.toLowerCase();
	if (l === "true" || l === "false") return "boolean";
	return "string";
}

function parse(text) {
	const toks = tokens(text);
	if (!toks.length) return { kind: "empty" };
	const cmd = byName[toks[0].toLowerCase()];
	if (!cmd) return { kind: "unknown", name: toks[0].toLowerCase(), toks };
	const want = cmd.args;
	const rawArgs = toks.slice(1);
	if (want[want.length - 1] === "string" && rawArgs.length > want.length) {
		rawArgs[want.length - 1] = rawArgs.slice(want.length - 1).join(" ");
		rawArgs.length = want.length;
	}
	if (rawArgs.length < want.length) return { kind: "incomplete", cmd, toks };
	for (let i = 0; i < want.length; i++) {
		const [ok] = check(rawArgs[i], want[i]);
		if (!ok)
			return { kind: "badarg", cmd, toks, bad: i + 1, got: rawArgs[i], gotType: infer(rawArgs[i]), wantType: want[i] };
	}
	return { kind: "valid", cmd, toks };
}

function dist(a, b) {
	const d = [];
	for (let i = 0; i <= a.length; i++) d[i] = [i];
	for (let j = 0; j <= b.length; j++) d[0][j] = j;
	for (let i = 1; i <= a.length; i++)
		for (let j = 1; j <= b.length; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
			if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
				d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
		}
	return d[a.length][b.length];
}

function closest(q) {
	q = q.toLowerCase();
	if (!q) return null;
	let best = null, bestd = Infinity, bestn = null;
	CMDS.forEach((c) => {
		[c.name, ...c.aliases].forEach((n) => {
			n = n.toLowerCase();
			let d;
			const swap = q.length >= 2 ? q[1] + q[0] + q.slice(2) : q;
			if (n.startsWith(q) || q.startsWith(n) || n.startsWith(swap) || swap.startsWith(n)) d = 0;
			else d = dist(q, n);
			if (d < bestd) { best = c; bestd = d; bestn = n; }
		});
	});
	if (best && bestd <= Math.max(1, Math.floor(q.length / 3))) return { cmd: best, name: bestn };
	return null;
}

function matchPlayer(q) {
	if (!q) return null;
	const exact = PLAYERS.find((p) => p.toLowerCase() === q.toLowerCase());
	if (exact) return exact;
	return PLAYERS.find((p) => p.toLowerCase().startsWith(q.toLowerCase())) || null;
}

function ghost(text, caretAtEnd) {
	if (!caretAtEnd) return null;
	const toks = tokens(text);
	if (!toks.length) return null;
	if (toks.length === 1 && !/\s$/.test(text)) {
		if (!byName[toks[0].toLowerCase()]) {
			const q = toks[0].toLowerCase();
			for (const c of CMDS) {
				for (const n of [c.name, ...c.aliases]) {
					if (n.startsWith(q) && n.length > q.length) {
						const rest = n.slice(q.length);
						return { text: text + rest, rest };
					}
				}
			}
			return null;
		}
	}
	const res = parse(text);
	if (res.kind !== "incomplete" && res.kind !== "valid") return null;
	const rawArgs = toks.slice(1);
	let want = res.cmd.args[res.cmd.args.length - 1];
	if (rawArgs.length < res.cmd.args.length) want = res.cmd.args[rawArgs.length];
	if (want !== "player") return null;
	if (!rawArgs.length) return null;
	if (want === "player" && rawArgs.length > 1) return null;
	if (want === "player" && /\s$/.test(text)) return null;
	const chunk = toks[toks.length - 1];
	if (!chunk) return null;
	const full = matchPlayer(chunk);
	if (!full || full.length <= chunk.length) return null;
	const rest = full.slice(chunk.length);
	return { text: text + rest, rest };
}

function render() {
	const t = box.value;
	const atEnd = box.selectionStart === t.length;
	ph.style.display = t ? "none" : "block";
	const res = parse(t);
	let html = "";
	if (t) {
		const spans = [];
		const re = /\S+/g;
		let m;
		while ((m = re.exec(t))) spans.push({ s: m.index, e: m.index + m[0].length, w: m[0] });
		const red = new Set();
		if (res.kind === "unknown") spans.forEach((_, i) => red.add(i));
		if (res.kind === "badarg") red.add(res.bad);
		let cur = 0, out = "";
		spans.forEach((r, i) => {
			out += esc(t.slice(cur, r.s));
			out += red.has(i) ? `<span class="r">${esc(r.w)}</span>` : esc(r.w);
			cur = r.e;
		});
		out += esc(t.slice(cur));
		html = out;
	}
	const g = ghost(t, atEnd);
	if (g) html += `<span class="g">${esc(g.rest)}</span>`;
	hl.innerHTML = html;

	let s = "";
	if (res.kind === "unknown") {
		const c = closest(res.name);
		s = c
			? `invalid command "${res.name}", did you mean "${c.name}"?`
			: "invalid command, no suggestions.";
	} else if (res.kind === "badarg") {
		s = `invalid argument ${res.bad}, expected ${art(res.wantType)} ${res.wantType}, got ${res.gotType}`;
	} else if (res.kind === "empty") {
		s = "start typing to see suggestions here.";
	} else {
		const parts = [toks0(t)];
		res.cmd.args.forEach((a) => parts.push(`<${a}>`));
		s = parts.join(" ") + (res.cmd.desc ? " — " + res.cmd.desc : "");
	}
	sug.textContent = s;

	const shown = t + (g ? g.rest : "");
	box.style.width = Math.max(shown.length, 1) + "ch";
	return g;
}

function toks0(t) {
	const toks = tokens(t);
	return toks.length ? toks[0].toLowerCase() : "";
}

function art(t) {
	return t === "players" ? "a list of" : "a";
}

let gnow = null;
box.addEventListener("input", () => { gnow = render(); });
box.addEventListener("click", () => render());
box.addEventListener("keyup", () => render());

box.addEventListener("keydown", (e) => {
	if (e.key === "Tab") {
		e.preventDefault();
		const g = ghost(box.value, box.selectionStart === box.value.length);
		if (g) {
			box.value = g.text;
			box.selectionStart = box.selectionEnd = g.text.length;
			render();
		}
	}
	if (e.key === "Enter") {
		const res = parse(box.value);
		if (res.kind === "valid") sug.textContent = `ran ${tokens(box.value)[0].toLowerCase()}`;
		box.value = "";
		render();
	}
});

document.getElementById("bar").addEventListener("click", () => box.focus());
render();

let touched = false, demoDead = false;
box.addEventListener("focus", () => { touched = true; demoDead = true; }, { once: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function typeDemo(s) {
	for (const ch of s) {
		if (demoDead || touched) return false;
		box.value += ch;
		box.selectionStart = box.selectionEnd = box.value.length;
		render();
		await wait(65);
	}
	return true;
}
async function demo() {
	demoDead = false;
	await wait(600);
	if (touched) return;
	if (!(await typeDemo("wlakspeed 50"))) return;
	await wait(1100);
	if (touched) return;
	while (box.value.length) {
		if (demoDead || touched) return;
		box.value = box.value.slice(0, -1);
		box.selectionStart = box.selectionEnd = box.value.length;
		render();
		await wait(18);
	}
	if (!(await typeDemo("speed 100"))) return;
	await wait(900);
	if (touched) return;
	sug.textContent = "ran speed";
	box.value = "";
	render();
	await wait(700);
	if (!(await typeDemo("goto lar"))) return;
	await wait(1200);
}
const demoSeen = new IntersectionObserver((l) => {
	if (l[0].isIntersecting) { demoSeen.disconnect(); if (!touched) demo(); }
}, { threshold: 0.35 });
demoSeen.observe(document.getElementById("bar"));

const TITLE = "@ larpsense";
let ti = TITLE.length, tdir = -1;
(function tickTitle() {
	if (tdir < 0) {
		ti--;
		document.title = TITLE.slice(0, Math.max(ti, 1));
		if (ti <= 1) { tdir = 1; setTimeout(tickTitle, 500); return; }
		setTimeout(tickTitle, 70);
	} else {
		ti++;
		document.title = TITLE.slice(0, ti);
		if (ti >= TITLE.length) { tdir = -1; setTimeout(tickTitle, 1600); return; }
		setTimeout(tickTitle, 120);
	}
})();
