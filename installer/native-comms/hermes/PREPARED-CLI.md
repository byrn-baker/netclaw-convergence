# Owned Hermes Comms prerequisites

These helpers configure one selected installation. Configuration, authentication,
transport and delivery remain separate observations. The installer does not run
message, device, model, call, meeting or gateway operations during these checks.

## WhatsApp

The selected Hermes source supplies the bridge and frozen npm lock. The owned
copy includes a narrowly checked guard that stops pair-only startup before any
message/poll/media handlers are installed. QR pairing opens only the reviewed
native terminal. The first attempt has a durable owner/run/plan/nonce request;
interruption or an unknown result does not reopen QR. Successful native exit,
authenticated identity and the entire private account directory must agree
before promotion. The original promotion is retained while later native key
rotation is accepted only for the same account. No fixture is live pairing proof.

## Photon

The owned sidecar uses the selected Hermes source lock and its exact attachment
patch. Install runs frozen npm acquisition with install scripts disabled, then
that reviewed patch. Configuration binds loopback and a dedicated local token.
A Photon project ID/secret is required; setup does not start the sidecar or join
a conversation. Its installed dependency graph is observed independently.

## Home Assistant

The official external plugin is pinned to NousResearch/hermes-homeassistant
`ba30cb0cf86c52bdb5cde98974bc062e97966529` (2.0.1). Its five audited runtime/license
files are copied without install hooks. The native manifest, enablement,
compatibility and isolation policy gates are retained. An existing explicit
disable is never removed. This integration is Focused-only because the same
plugin registers `ha_list_entities`, `ha_get_state`, `ha_list_services` and
`ha_call_service` device tools. An explicit entity list controls event ingress;
blank means no watched entities. Generic sender allowlists do not filter its
trusted Home Assistant events. No device tool or subscription runs during setup.

## Raft

Official preparation: https://docs.raft.build/features/agents/external/

Create an External Agent in the intended Raft workspace and use its setup card
to prepare a dedicated profile. The native CLI's device authorization must be
completed by that workspace's authorized operator. This installer imports only
that one profile's `credential.json` through a masked native field; it never
imports a full environment or searches the operator's profiles. Provide compact,
single-line JSON from the prepared credential file and its chosen profile slug.

The installer acquires `@botiverse/raft@0.0.26` using the checked-in frozen npm
lock with install scripts disabled. It writes credentials under
`<runtime-home>/.setup/comms/raft/profile-home/profiles/<slug>/credential.json`.
The fixed owned `raft` launcher pins `HOME`, `HERMES_REAL_HOME` and `RAFT_HOME` and
removes competing profile overrides. Its only setup invocation is `--version`.
Native Hermes readback requires the exact local profile and owned launcher;
neither a profile name nor a successful version command proves authentication.
A missing prepared profile remains `configuration_required`.

## Buzz

Official source: https://github.com/block/buzz
Pinned preparation source: `9e8c9fc04daf20259cd259dcaec89109587cc7f5`.

Prepare a native CLI from this source with its Rust 1.95.0 toolchain and frozen
Cargo.lock, using `cargo build --locked --release -p buzz-cli`. The audited lock
SHA-256 is `3973f7269346a67a71eb5a68f74c068bf6386dfa999db3a397ab25629a1f76ed`.
The version output is `buzz 0.1.0`. Review the resulting native binary's SHA-256
and enter its absolute path and digest into setup. This is an explicitly reviewed
prepared binary handoff; local installer fixtures do not attest its build origin.

The installer reads that exact digest, rejects links and scripts, copies the
native Mach-O/ELF binary into the selected home and runs only `--version`. It
never borrows a `buzz` binary from PATH or the user's credential files. A missing
binary remains `configuration_required`; an unsettled version probe is not
replayed. Use a dedicated existing community-member private key in 64-character
hex form and explicit channel UUIDs. Empty user allowlists deny access, mentions
are required, and empty channel selections are refused because upstream would
otherwise watch every joined channel. No community request, membership change,
message, upload or subscription is part of setup.
