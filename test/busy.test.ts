import assert from "node:assert/strict";
import { test } from "node:test";

import { buildBusyLines, type FleetEntry } from "../index.ts";

function entry(agent: string, goal: string): FleetEntry {
	return { agent, goal };
}

test("buildBusyLines returns nothing when nothing is busy", () => {
	assert.deepEqual(buildBusyLines(false, { entries: [], totalActive: 0 }), []);
});

test("buildBusyLines shows the main agent line when only the main agent is busy", () => {
	assert.deepEqual(buildBusyLines(true, { entries: [], totalActive: 0 }), ["main agent is mid-turn"]);
});

test("buildBusyLines lists one line per run", () => {
	assert.deepEqual(
		buildBusyLines(false, {
			entries: [entry("research", "scouting libraries"), entry("tests", "running the suite")],
			totalActive: 2,
		}),
		["research: scouting libraries", "tests: running the suite"],
	);
});

test("buildBusyLines falls back to defaults for missing agent and goal", () => {
	assert.deepEqual(buildBusyLines(false, { entries: [{}, { agent: "worker" }], totalActive: 2 }), [
		"agent: running",
		"worker: running",
	]);
});

test("buildBusyLines truncates past 6 lines and adds an overflow line", () => {
	const entries = Array.from({ length: 8 }, (_, i) => entry(`agent-${i + 1}`, `goal ${i + 1}`));
	assert.deepEqual(buildBusyLines(false, { entries, totalActive: 8 }), [
		"agent-1: goal 1",
		"agent-2: goal 2",
		"agent-3: goal 3",
		"agent-4: goal 4",
		"agent-5: goal 5",
		"agent-6: goal 6",
		"... and 2 more",
	]);
});

test("buildBusyLines adds a remainder line when totalActive exceeds the entries length", () => {
	assert.deepEqual(buildBusyLines(false, { entries: [entry("research", "scouting libraries")], totalActive: 4 }), [
		"research: scouting libraries",
		"... and 3 more",
	]);
});

test("buildBusyLines keeps truncation working with a remainder and a busy main agent", () => {
	const entries = Array.from({ length: 7 }, (_, i) => entry(`agent-${i + 1}`, `goal ${i + 1}`));
	const lines = buildBusyLines(true, { entries, totalActive: 10 });
	assert.equal(lines.length, 7);
	assert.equal(lines[0], "main agent is mid-turn");
	assert.equal(lines[6], "... and 3 more");
});
