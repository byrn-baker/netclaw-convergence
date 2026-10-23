# Privacy

The extension contains no analytics, telemetry service or remote asset loader.
It connects to the explicitly selected loopback NetClaw HUD from the VS Code
extension host. WSL/SSH hosting is provided by VS Code's remote extensions.

Explicit prompts, selected text and selected RAG passages go to your existing
NetClaw and may reach its configured model provider or tools. Uploaded files are
retained/indexed by that NetClaw. Copilot/Claude Code/Codex receive the data returned
to their enabled MCP tools and may disclose it to their own providers. Their
telemetry, billing, retention and organizational policy remain separate.

Environment inventory exposes presence, not existing secret values. A replacement
is entered with password input and sent only to the selected existing environment
writer. No workspace file is harvested automatically. Returned content is rendered
as inert text. Redaction is best-effort defense, not a guarantee that arbitrary
model replies, logs or selected text contain no sensitive data. Review before export
or disclosure. Do not place secrets in assistant draft proposals.

Host-local extension storage retains profiles, conversations, opted-in drafts,
Canvas data and assistant proposal/request records. HUD cookies for the editor are
stored in VS Code SecretStorage. Each terminal MCP registration has private session
state under extension storage (0700 directory, 0600 files). The adapter does not
copy provider credentials or browser sessions. Settings Sync is not used for profiles.

Disconnect invalidates current views but does not cancel backend work. Disabling an
assistant registration denies later calls, including calls through a cached server.
Uninstall does not revoke already-submitted NetClaw work or erase NetClaw data.
Review/delete extension storage separately if desired after disabling registrations.

Spec151 testbed drafts keep existing literal credentials behind baseline-bound
keep tokens. New literal values remain in webview memory until an explicit save;
they are not written into VS Code webview state. Invalidation clears drafts.
Private testbed/configuration recovery copies can contain the original credentials
and remain on the selected host. Exports require a destination and credential
choice, with owner-only file permissions. CSV excludes credentials.

Reviewed setup actions may download dependencies or source through existing
installers. Private setup evidence records target identity, input hashes and
controlled outcomes; baseline copies remain under the selected runtime home.
Raw child output is not forwarded into the workbench. The bundled decorative
image was generated using public descriptive art direction without private data;
viewing it makes no image-generation or remote asset request.

Security pages invoke only the selected native CLI with fixed operations and explicit scope. Security bindings retain paths/identities in host-local extension storage, not credentials. Existing policy secrets are masked before entering a webview; drafts remain in memory. Logs and status are bounded and redacted, but arbitrary upstream text still requires operator care. Native read commands may contact the selected security service. DefenseClaw update checks are disabled for these invocations.

Security changes retain mode0600 original configuration/policy and operation evidence under this editor's private `security-operations` directory; originals can contain secrets. There is no automatic log export, cloud telemetry setup or external disclosure. Unknown outcomes are retained for inspection and are never replayed. Settings, observed loading and actual enforcement are reported separately.

## Workspace files and local lifecycle controls (Spec152 source preview)

Management discovery requires an owned HUD session and returns installation paths,
identity and the native workspace, never file contents or credential values. File
operations run on the extension host through a separately reviewed local helper.
The control webview contains metadata only. Markdown appears as native source text;
this feature opens no HTML/Markdown preview and makes no content-driven remote fetch.
No management capability is added to the assistant MCP provider.

Bindings contain host context, paths, identity and helper hashes. Drafts use VS Code’s
native document model; its local editor backup/Hot Exit policy is controlled by the
operator. The isolated preview disables Hot Exit. No document text is placed in
webview state, routine audit output, telemetry or assistant context by this feature.
Private originals and metadata-only operation journals live beneath the selected
home’s `netclaw-hud/management` (0700 directories, 0600 files). Private service launch
definitions may contain the existing process environment and must be treated as
credentials; they are never returned to the panel or included in operation journals.
Owned service output stays in that same private service directory.

The initial binding persists so a selected installation can be started while its
HTTP server is stopped. Every subsequent action rechecks host, identity, workspace,
source and service scope, and every mutation requires explicit native review. A
failed/unknown save never authorizes restart. Unknown outcomes require observation
before another mutation. There is no delete/reset/uninstall or arbitrary-shell
operation. Nothing is pushed or published by the preview.
