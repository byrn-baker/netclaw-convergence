# Local topology image attachments

The Network Context pane has a **Network topology** upload area immediately
below its IP/prefix heading, before device observations. Images remain inside
the pane's scrollable content. Choosing a file pins the pane so the file picker
does not dismiss the context.

- PNG, JPEG and WebP only, up to 5 MB; MIME/signature and browser decode checks.
- Maximum 24 megapixels and 12,000 pixels on either side.
- Inline preview, replacement and explicitly confirmed removal. A failed
  replacement leaves the prior attachment intact. Original files are untouched.
- **Expand image** opens a large, explicitly requested image viewer with
  Fit to window, Actual size (100%) with scrolling, Close, and Escape. Closing
  restores focus to the expand control and preserves the underlying attachment.
- The ordinary context pane only occupies verified blank space to the right of
  terminal text/cursor. If insufficient space exists, widen the terminal; it
  will not open a floating panel over output. The expanded image viewer is a
  separate modal opened only on explicit request.
- Stored as blobs in this browser's IndexedDB, assigned by testbed device ID,
  across **every interface, IP seen on the device, route and VRF**. Route evidence
  still remains VRF-scoped; sharing a picture never merges route observations.
  Existing v2/v1 attachments are adopted device-wide on first use (prefer v2,
  then most recently saved). Other legacy records are left untouched.
  Original files are untouched; replacement resets device points.
- Not uploaded to a router, server, model, or external provider. No automatic
  image recognition: use **Map devices** to confirm device positions once.

## Share topology

- **Selected devices** links the same image and mappings to the checked profiles.
- **Network-wide default** supplies all device views without their own assignment,
  including devices added later. Setting a new default replaces the old default.
- Existing device images and opt-outs are preserved unless **Replace existing
  images** is checked. With network-wide replacement, only currently listed
  devices are explicitly reassigned; future devices inherit the default.
- **Map devices** updates the shared mapping set. Same-origin tabs and open panes
  refresh through local notifications/BroadcastChannel; no SSH or backend calls.
  Stale mapping edits are rejected, not silently applied over newer edits.
- **Replace image** creates a separate device-specific attachment. Share the
  replacement explicitly to redistribute it. **Remove from this device** opts
  that device out without deleting another device's image or the network default.
- **Use network default for this device** rejoins the default. **Stop using as
  network default** removes inheritance but preserves explicit device links.

This is sharing across device views in the current browser's NetClaw workspace,
not cross-user/cross-machine publishing. No files are uploaded to physical devices.
Image/mapping records are stored once and referenced by device assignments; updates
use atomic IndexedDB transactions. Replacing/removing the final reference removes
that library blob; the user's original image and old legacy records stay untouched.

## Dynamic device lights

1. Upload an image, select **Map devices**, choose a testbed device, and click its
   symbol. Repeat for the devices shown and **Save mappings**. Sliders also allow
   keyboard placement. The expanded viewer supports mapping at actual size.
2. Green stays on the router whose terminal you are using (not the hovered IP's
   owner). Blinking red follows the closest known reporting device(s) from the
   same live correlation used by Network Context. These are roles, not alarms.
3. Local/connected longest-match evidence on the current router means green only.
   Exception: when inspecting a host IP (or /32), a fresh exact local-address
   report from a different router marks that router red even if the current router
   is on the same connected subnet. A connected subnet does not prove ownership
   of every address on it. The current router's own local /32 stays green only.
   Red and green are never placed on the same device. Inferred or equal candidates
   are explicitly labeled; VRF-ambiguous, stale, unavailable or unknown evidence
   does not produce an asserted reporting light. Unmapped devices prompt mapping.

The lights update for the current hovered/selected entry and collection refreshes.
Pinning keeps the selected entry; unpin to resume hover navigation. Normal and
expanded views use the same image-relative positions, including letterboxing and
resizing. Reduced-motion preferences show steady red instead of blinking.

This is browser-local convenience storage, not company-wide/RBAC storage or an
encrypted secrets vault. Another browser, host, port or browser profile has
separate storage. Clearing site data removes attachments. Use an appropriate
trusted browser profile for sensitive diagrams. No company-wide synchronization
or automatic AI interpretation is implied by manual mappings.

The synthetic `/test/terminal-design.html` preview uses temporary in-memory
images only and clears them when the pane closes or page reloads. It never
writes to the real attachment store.

No API restart is required for image attachments; refresh Canvas. Tests:
`node test/topology-image.mjs`, `node test/topology-image-markers.mjs`,
`node test/topology-image-ui.mjs`, `node test/topology-image-sharing.mjs`,
`npm run test:enrichment-layout`, and
`npm run build`. The storage unit test uses a fake IndexedDB transaction surface;
prior browser QA verified file selection and inline preview before marker support.
Marker verification includes pure logic/geometry tests and real JSX server rendering,
not a visual browser test. The synthetic design preview has remote, local/connected,
and unknown examples; it makes no network-device connections.
