# @clementprevot/pi-busy-session-guard

A [Pi](https://pi.dev) extension that asks before you abandon active work: before starting a new session, resuming, or forking, it checks whether anything is still running and asks for confirmation, so you never silently abandon an active run.

## Install

```bash
pi install npm:@clementprevot/pi-busy-session-guard
```

Updates ship with `pi update --extensions`. The extension applies to your next session (quit and relaunch or issue a `/reload` command).

## How it works

The extension tracks the main agent state (`agent_start`, `agent_settled`, `session_start`) and asks pi-subagents for its active background runs over its in-process RPC channel (`subagents:rpc:v1:request` / reply). Before a new session, a resume, or a fork, it shows what is still running and asks you to confirm:

```
New session while 3 run(s) are active?
- main agent is mid-turn
- research: scouting libraries
... and 1 more
```

pi-subagents is optional: if nothing replies within 500ms, the extension treats that as no active runs, so it never blocks on missing infrastructure. Headless sessions (no UI) are never blocked either.

## Configuration

None.

## Pairs well with

This guard protects the commands shipped by two sibling extensions from the same author: [@clementprevot/pi-session-archive](https://www.npmjs.com/package/@clementprevot/pi-session-archive) and [@clementprevot/pi-session-search](https://www.npmjs.com/package/@clementprevot/pi-session-search).

## Local development

```bash
corepack enable
yarn install
yarn test
yarn typecheck
```

To try the extension in a live session without installing it:

```bash
pi -e /path/to/this/repo
```

## License

[MIT](LICENSE)
