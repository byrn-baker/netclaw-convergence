# Upgrade the voice webhook service

Spec 124 requires authenticated requests before voice callbacks can read call state or dispatch agent work. Unsigned or invalid Twilio callbacks return 403. Missing authentication configuration returns 503. Interactive callbacks also require an allowed caller or outbound recipient. The JSON alert-trigger API uses a separate bearer token.

Twilio signs callbacks with the **account Auth Token**, not the API key secret. NetClaw validates the full public URL and form parameters with Twilio's SDK. Behind a proxy, configure the public HTTPS origin explicitly; forwarded headers cannot choose the signing origin. See [Twilio's Flask validation guidance](https://www.twilio.com/docs/usage/tutorials/how-to-secure-your-flask-app-by-validating-incoming-twilio-requests).

## Migrate configuration

Run on the NetClaw host from the repository root, using the environment file your voice service loads:

```bash
# Preview missing setting names; no writes or secret values printed
python3 scripts/migrate-voice-auth.py --env-file .env --public-url https://voice.example.com

# Apply; prompts privately for the account Auth Token if not already configured
python3 scripts/migrate-voice-auth.py --env-file .env --public-url https://voice.example.com --apply
```

The script preserves unrelated settings, generates `VOICE_ALERT_TOKEN` if absent, and stores the public origin in `VOICE_WEBHOOK_URL`. Existing files are backed up to `.env.pre-voice-auth`; both files use mode 0600. Repeating the same migration preserves the values and file contents. An existing backup is never overwritten. A failed atomic replacement preserves the original and backup.

Load the migrated settings into the service environment and restart the webhook service. Confirm Twilio is configured with the same public host and scheme, and keep the proxy's `/webhooks/twilio/voice/...` paths intact. Verify a real signed callback in a sandbox before restoring production traffic. A provider call has not been tested by the offline audit.

Configure authorized alert senders to use `Authorization: Bearer <VOICE_ALERT_TOKEN>` over HTTPS when posting JSON to `/webhooks/twilio/voice/trigger-alert`. Retrieve that token privately from the host's environment file; do not paste it into chats, shell history, logs, or Git. The migration creates configuration only: it does not send a call or authorize a new alert schedule.

The old source contained a shared fallback gateway token. It is removed. Set your own `OPENCLAW_GATEWAY_TOKEN`; **rotate the gateway token if you used the former fallback**, because it was present in repository history. Existing explicitly configured tokens are preserved by the migration.

## CML TLS

Voice CML requests now verify TLS by default. For a private CA, set `CML_CA_BUNDLE` to the absolute path of its PEM file. For an explicitly approved disposable lab only, `CML_VERIFY_SSL=false` retains the old unverified behavior. Leave verification enabled for production. No CML credentials or device configuration are changed by migration.

## Recover configuration

```bash
python3 scripts/migrate-voice-auth.py --env-file .env --restore
python3 scripts/migrate-voice-auth.py --env-file .env --restore --apply
```

The first command previews; the second restores the saved file with mode 0600. Reload the service environment after recovery. Old configuration without authentication will remain unavailable under the secured server. Do not restore unauthenticated server code to a public endpoint. Keep the backup private and outside Git.
