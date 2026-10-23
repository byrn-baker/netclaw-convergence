// Extracted from NetClaw Canvas; see LICENSE for the adapted workflow.


const apiError = async (res) => { let detail = ""; try { const j = await res.json(); detail = j.error?.message || j.message || JSON.stringify(j.error || j); } catch {} return new Error("API " + res.status + (detail ? ": " + detail : "")); };

async function callTerraTerminal(messages) {
  const res = await fetch("/api/terminal/terra", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) throw await apiError(res);
  const data = await res.json();
  const text = String(data.response || "").trim();
  if (!text) throw new Error("empty response from Instant Assist");
  return text;
}

export { apiError, callTerraTerminal };
