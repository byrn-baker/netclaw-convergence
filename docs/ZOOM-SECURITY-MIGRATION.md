# Zoom security upgrade

Spec 124 authenticates both RTMS webhooks and panel subscriptions. Older builds
accepted lifecycle requests without verifying their signatures and allowed panel
clients to choose arbitrary meetings. Upgrade before exposing these endpoints.

1. Install updated `mcp-servers/zoom-rtms-mcp/requirements.txt` into its dedicated
   Zoom environment. The panel now explicitly depends on `cryptography`.
2. Keep the Zoom Marketplace app's existing **Event Subscription secret token**
   as `ZOOM_RTMS_WEBHOOK_SECRET`. Keep its Client ID and Client Secret as
   `ZOOM_CLIENT_ID` and `ZOOM_CLIENT_SECRET`. These are different credentials;
   do not generate substitute tokens that disagree with Zoom.
3. Preview and apply the environment migration:

   ```bash
   python3 scripts/migrate-zoom-auth.py --env-file ~/.openclaw/.env
   python3 scripts/migrate-zoom-auth.py --env-file ~/.openclaw/.env --apply
   ```

   Missing values come from existing environment variables or hidden prompts.
   No secret is printed. Other settings remain intact; a private
   `.env.pre-zoom-auth` backup supports `--restore` preview and `--restore --apply`.
4. Keep the HTTPS reverse proxy forwarding to loopback ports 8899/8900. Those are
   now the default bind addresses. If the proxy is on another host, explicitly
   configure `ZOOM_RTMS_WEBHOOK_HOST` / `ZOOM_PANEL_FEED_HOST` and restrict origin
   access appropriately. Authentication remains mandatory regardless of bind.
5. Deploy the updated panel JS, restart the Zoom service, and reopen the app from
   a meeting. It requests `getAppContext` through the Zoom SDK. Ensure that API is
   available to the app. An ordinary browser URL or unsigned meeting query string
   no longer grants access to live meeting data.

Webhooks verify Zoom's signature against the exact raw body and require a fresh
request timestamp. Keep the host clock synchronized. Missing credentials return
503; invalid signatures return403 before callbacks execute. Endpoint URL
validation is also authenticated.

The panel verifies the encrypted app context, issuer, audience, meeting/user,
and expiration. Each WebSocket receives only its authenticated meeting's feed;
expired contexts trigger reconnection with a fresh SDK context. The anonymous
“choose the active meeting” fallback has been removed. Guest Mode remains based
on a Zoom-issued context, not on whether the guest has an account. Guest and
Collaborate acceptance still requires testing in a real Zoom client.

Restoring environment values does not disable authentication. Fix the app's
credentials/API configuration rather than exposing the previous unauthenticated
implementation. No meeting transcripts or keys are migrated.

Protocol references: [Zoom webhook verification](https://developers.zoom.us/docs/api/webhooks/),
[Zoom app-context format](https://developers.zoom.us/docs/zoom-apps/zoom-app-context/),
[SDK getAppContext](https://appssdk.zoom.us/classes/ZoomSdk.ZoomSdk.html#getAppContext).
