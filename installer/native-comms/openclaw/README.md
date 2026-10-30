# Pinned OpenClaw Comms helper

`entry.ts` is compiled as the stable `dist/netclaw-comms-helper.js` entry in
OpenClaw's exact upstream build graph. `build.py` verifies the source commit and
restores its temporary inputs/build entries after compilation. Use a dedicated
private checkout and the pin's frozen pnpm lockfile. No compiled runtime chunk is
discovered by filename or imported from another installation.

The helper loads exactly one setup-only plugin with runtime activation disabled.
Every text prompt is masked, including upstream prompts that omit secret flags.
Results go to a private attempt file. The caller must journal the attempt,
validate all staged files, promote only the selected channel delta with its
original revision, and perform native readback. A returned configuration is not
authentication, transport, or proof that a deferred post-write hook succeeded.

Staging constrains promotion; it is not an OS sandbox. Pairing, provider app
creation, delegated OAuth and crypto bootstrap require individual effect and
auxiliary-artifact contracts before their native paths can be selected. The
interactive helper does not install plugins, run post-write hooks, or start services.

`acquire.ts` separately uses the pinned native npm acquisition API with exact
package versions/integrities, private npm projects/cache and lifecycle scripts
disabled. It binds the host peer to the selected installation, checks compiled
runtime entries using the upstream resolver, and records intent before native
acquisition. An interrupted attempt cannot be replayed just because its final
receipt is absent. `register.ts` updates that home's native SQLite plugin index,
preserves other install records, checks static discovery, and leaves channel
configuration and activation untouched. Reconciliation compares exact logical
records; native SQLite metadata/cache reads can change database bytes.

The installer builds the helper once per selected home using the pinned upstream
checkout, frozen dependency lock and private pnpm 11.2.2. It promotes the compiled
graph under that home's OpenClaw package and verifies every file against an owned
manifest before reuse. Build/plugin acquisition require network access to the
documented source/package registries; provider credentials are not passed to them.

Actual isolated Slack/Discord typed acquisition, registration and configuration
checks are recorded in Spec155 verification. Interactive adapters, deferred
hooks and remaining platform qualification are still open; these checks do not
claim provider authentication or a live channel connection.
