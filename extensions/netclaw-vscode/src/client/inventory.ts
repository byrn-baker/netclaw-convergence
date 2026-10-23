import { HudClient, HudError, Json } from "./hud";

export const testbedReadOnlyNote =
  "This running HUD supports viewing device details. Editing, imports and full exports need the updated NetClaw HUD to be started. Reload this page after updating or restarting the HUD. This inventory reports each device's selected connection; credentials and other connections are not included.";
export const mcpReadOnlyNote =
  "This running HUD supports viewing configuration and reviewing one environment setting at a time. The full configuration form and setup actions need the updated NetClaw HUD to be started. Reload fields after updating or restarting the HUD.";

/** Only a missing new route permits compatibility reads. Other failures stay errors. */
async function readInventory(
  client: HudClient,
  route: string,
  legacyRoute: string,
  project: (data: Json) => Json,
): Promise<Json> {
  try {
    return await client.request("GET", route);
  } catch (error) {
    if (!(error instanceof HudError) || error.status !== 404) throw error;
  }
  // Older inventory routes do not enforce the installation header themselves.
  await client.verifyIdentity();
  const data = await client.request("GET", legacyRoute);
  await client.verifyIdentity();
  return {
    ...project(data),
    readOnly: true,
    observedAt: new Date().toISOString(),
  };
}

const text = (value: unknown) => (typeof value === "string" ? value : "");
const records = (value: unknown): Json[] => {
  if (
    !Array.isArray(value) ||
    value.some((v) => !v || typeof v !== "object" || Array.isArray(v))
  )
    throw Error(
      "The HUD returned an invalid inventory. Reload after checking the HUD.",
    );
  return value;
};

export async function loadTestbed(client: HudClient): Promise<Json> {
  const snapshot = await readInventory(
    client,
    "/api/testbed/document",
    "/api/terminal/devices",
    (data) => ({
      source: "HUD inventory · /api/terminal/devices",
      note: testbedReadOnlyNote,
      devices: records(data.devices).map((d) => {
        if (!text(d.id))
          throw Error("The HUD returned a device without an identity.");
        return {
          id: d.id,
          alias: text(d.alias),
          os: text(d.os),
          type: text(d.type),
          platform: text(d.platform),
          connections: text(d.connection)
            ? [
                {
                  name: d.connection,
                  protocol: text(d.protocol),
                  host: text(d.host),
                  port:
                    Number.isInteger(d.port) && d.port > 0 && d.port <= 65535
                      ? d.port
                      : null,
                },
              ]
            : [],
        };
      }),
    }),
  );
  // Existing HUDs include the pyATS defaults mapping in their projection.
  // Filter it here as well as server-side so an extension upgrade works with
  // an already-running HUD and never offers shared settings as an endpoint.
  return {
    ...snapshot,
    devices: records(snapshot.devices).map((device) => ({
      ...device,
      connections: records(device.connections || []).filter(
        (c) => c.name !== "defaults",
      ),
    })),
  };
}

export function loadMcpConfiguration(client: HudClient): Promise<Json> {
  return readInventory(
    client,
    "/api/mcp/configuration",
    "/api/hud/configuration",
    (data) => ({
      source: text(data.environmentFile) || "HUD environment inventory",
      note: mcpReadOnlyNote,
      integrations: records(data.integrations).map((d) => {
        if (!text(d.id))
          throw Error("The HUD returned an integration without an identity.");
        return {
          id: d.id,
          name: d.id.replaceAll("-", " "),
          notes: text(d.notes),
          setupNote: mcpReadOnlyNote,
          fields: records(d.fields).map((f) => {
            if (
              !/^[A-Za-z_][A-Za-z0-9_]*$/.test(text(f.key)) ||
              typeof f.isSet !== "boolean"
            )
              throw Error(
                "The HUD returned invalid environment field metadata.",
              );
            return {
              key: f.key,
              label: f.key,
              isSet: f.isSet,
              requirement: "unknown",
            };
          }),
        };
      }),
    }),
  );
}

export function requireEditableInventory(snapshot: Json | undefined) {
  if (!snapshot) throw Error("Reload the inventory before continuing.");
  if (snapshot.readOnly)
    throw Error(
      "This view is read-only until the updated NetClaw HUD is running. Reload after updating or restarting the HUD.",
    );
}
