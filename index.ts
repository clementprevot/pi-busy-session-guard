/**
 * Confirms session switches and forks while work is still active:
 * background pi-subagents runs (via the pi-subagents in-process RPC) and
 * mid-turn agent runs. Headless sessions are never blocked.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export interface FleetEntry {
	agent?: string;
	goal?: string;
}

export interface RunSummary {
	entries: FleetEntry[];
	totalActive: number;
}

interface FleetDto {
	entries?: FleetEntry[];
	totalActive?: number;
}

interface SubagentStatusReply {
	success?: boolean;
	data?: { fleet?: FleetDto };
}

const RPC_TIMEOUT_MS = 500;

// No reply means pi-subagents is absent or not ready yet; treat as no runs
// so the guard never blocks a switch on its own infrastructure.
function activeSubagentRuns(pi: ExtensionAPI): Promise<RunSummary> {
	const requestId = crypto.randomUUID();
	const replyChannel = `subagents:rpc:v1:reply:${requestId}`;

	return new Promise((resolve) => {
		let settled = false;
		const unsubscribe = pi.events.on(replyChannel, (data: unknown) => {
			const reply = data as SubagentStatusReply;
			if (!reply?.success || !reply.data?.fleet) return finish({ entries: [], totalActive: 0 });
			const fleet = reply.data.fleet;
			finish({ entries: fleet.entries ?? [], totalActive: fleet.totalActive ?? fleet.entries?.length ?? 0 });
		});
		const timer = setTimeout(() => finish({ entries: [], totalActive: 0 }), RPC_TIMEOUT_MS);

		function finish(result: RunSummary) {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			unsubscribe();
			resolve(result);
		}

		pi.events.emit("subagents:rpc:v1:request", { version: 1, requestId, method: "status" });
	});
}

// Builds the confirmation message body: main agent line, one line per run,
// then truncation at 6 lines with an overflow line for the rest.
export function buildBusyLines(mainAgentBusy: boolean, runs: RunSummary): string[] {
	const lines: string[] = [];
	if (mainAgentBusy) lines.push("main agent is mid-turn");
	for (const run of runs.entries) {
		lines.push(`${run.agent ?? "agent"}: ${run.goal ?? "running"}`);
	}
	const rest = runs.totalActive - runs.entries.length;
	if (rest > 0) lines.push(`... and ${rest} more`);
	const shown = lines.slice(0, 6);
	const overflow = lines.length - shown.length;
	if (overflow > 0) shown.push(`... and ${overflow} more`);
	return shown;
}

export default function (pi: ExtensionAPI) {
	let mainAgentBusy = false;

	pi.on("agent_start", () => {
		mainAgentBusy = true;
	});
	// agent_end can be followed by a retry or compaction; only agent_settled means idle
	pi.on("agent_settled", () => {
		mainAgentBusy = false;
	});
	pi.on("session_start", () => {
		mainAgentBusy = false;
	});

	async function confirmIfBusy(
		action: string,
		ctx: { hasUI: boolean; ui: { confirm: (title: string, message: string) => Promise<boolean>; notify: (message: string, type?: "info" | "warning" | "error") => void } },
	): Promise<{ cancel?: boolean } | undefined> {
		if (!ctx.hasUI) return;

		const runs = await activeSubagentRuns(pi);
		if (!mainAgentBusy && runs.totalActive === 0) return;

		const shown = buildBusyLines(mainAgentBusy, runs);

		const ok = await ctx.ui.confirm(
			`${action} while ${runs.totalActive + (mainAgentBusy ? 1 : 0)} run(s) are active?`,
			shown.map((line) => `- ${line}`).join("\n"),
		);
		if (!ok) {
			ctx.ui.notify(`${action} cancelled`, "info");
			return { cancel: true };
		}
	}

	pi.on("session_before_switch", async (event: { reason: "new" | "resume" }, ctx) =>
		confirmIfBusy(event.reason === "new" ? "New session" : "Resume session", ctx),
	);
	pi.on("session_before_fork", async (_event: unknown, ctx) => confirmIfBusy("Fork session", ctx));
}
