import yaml from "js-yaml";

export const ARTIFACT_FORMATS = Object.freeze([
  { id: "json", label: "JSON", extension: "json", mime: "application/json" },
  { id: "jsonl", label: "JSONL", extension: "jsonl", mime: "application/x-ndjson" },
  { id: "yaml", label: "YAML", extension: "yaml", mime: "application/yaml" },
  { id: "xml", label: "XML", extension: "xml", mime: "application/xml" },
  { id: "csv", label: "CSV", extension: "csv", mime: "text/csv" },
  { id: "raw", label: "Raw text", extension: "txt", mime: "text/plain" },
]);

const FORMAT_BY_ID = new Map(ARTIFACT_FORMATS.map((format) => [format.id, format]));

export function artifactFormat(formatId) {
  return FORMAT_BY_ID.get(String(formatId || "").toLowerCase()) || FORMAT_BY_ID.get("json");
}

function normalizeSource(source) {
  return String(source || "")
    .replace(/\0/g, "")
    .replace(/\r\n?/g, "\n")
    .slice(0, 1_000_000)
    .replace(/\s+$/, "");
}

function sourceLines(source) {
  const normalized = normalizeSource(source);
  return normalized ? normalized.split("\n") : [];
}

function parsedJson(source) {
  const normalized = normalizeSource(source).trim();
  if (!normalized) return { parsed: false, value: null };
  try {
    return { parsed: true, value: JSON.parse(normalized) };
  } catch {
    return { parsed: false, value: null };
  }
}

function valueHasHierarchy(value) {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) {
    return value.some((item) => item && typeof item === "object");
  }
  return Object.values(value).some((item) => item && typeof item === "object");
}

function commandHierarchy(source) {
  const roots = [];
  const stack = [];
  let nestedCount = 0;

  sourceLines(source).forEach((rawLine) => {
    const expanded = rawLine.replace(/\t/g, "  ");
    const command = expanded.trim().replace(/\s*\{$/, "").trim();
    if (!command || command === "!" || /^[}\]];?$/.test(command)) return;

    const indent = expanded.match(/^ */)?.[0].length || 0;
    const node = { command };
    while (stack.length && indent <= stack.at(-1).indent) stack.pop();

    if (stack.length) {
      const parent = stack.at(-1).node;
      if (!parent.children) parent.children = [];
      parent.children.push(node);
      nestedCount += 1;
    } else {
      roots.push(node);
    }
    stack.push({ indent, node });
  });

  return { roots, nestedCount };
}

function countCommands(nodes) {
  return nodes.reduce(
    (total, node) => total + 1 + countCommands(Array.isArray(node.children) ? node.children : []),
    0,
  );
}

function structuredModel(source, device) {
  const parsed = parsedJson(source);
  if (parsed.parsed) {
    return {
      value: parsed.value,
      structure: valueHasHierarchy(parsed.value) ? "hierarchical" : "structured",
      records: Array.isArray(parsed.value) ? parsed.value.length : 1,
      parsedJson: true,
    };
  }

  const hierarchy = commandHierarchy(source);
  if (hierarchy.nestedCount > 0) {
    return {
      value: {
        source: "terminal",
        ...(device ? { device } : {}),
        sections: hierarchy.roots,
      },
      structure: "hierarchical",
      records: countCommands(hierarchy.roots),
      parsedJson: false,
    };
  }

  const entries = sourceLines(source).map((line) => line.trim()).filter(Boolean);
  return {
    value: {
      source: "terminal",
      ...(device ? { device } : {}),
      entries,
    },
    structure: "flat",
    records: entries.length,
    parsedJson: false,
  };
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function xmlTag(key) {
  const tag = String(key || "value").replace(/[^A-Za-z0-9_.-]+/g, "-");
  return /^[A-Za-z_]/.test(tag) ? tag : `field-${tag}`;
}

function xmlValue(value, key = "value", indent = 0) {
  const pad = " ".repeat(indent);
  const tag = xmlTag(key);
  if (Array.isArray(value)) {
    if (!value.length) return `${pad}<${tag}></${tag}>`;
    return `${pad}<${tag}>\n${value.map((item) => xmlValue(item, "item", indent + 2)).join("\n")}\n${pad}</${tag}>`;
  }
  if (value && typeof value === "object") {
    return `${pad}<${tag}>\n${Object.entries(value).map(([childKey, item]) => xmlValue(item, childKey, indent + 2)).join("\n")}\n${pad}</${tag}>`;
  }
  return `${pad}<${tag}>${xmlEscape(value == null ? "" : value)}</${tag}>`;
}

function csvCell(value) {
  const text = value && typeof value === "object" ? JSON.stringify(value) : String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function flattenCommandHierarchy(nodes, parents = [], rows = []) {
  nodes.forEach((node) => {
    rows.push([parents.join(" > "), node.command]);
    if (Array.isArray(node.children)) {
      flattenCommandHierarchy(node.children, [...parents, node.command], rows);
    }
  });
  return rows;
}

function csvFromValue(value) {
  if (Array.isArray(value) && value.every((item) => item && typeof item === "object" && !Array.isArray(item))) {
    const keys = [...new Set(value.flatMap((item) => Object.keys(item)))];
    if (keys.length) {
      return [
        keys.map(csvCell).join(","),
        ...value.map((item) => keys.map((key) => csvCell(item[key])).join(",")),
      ].join("\n");
    }
  }
  if (value && typeof value === "object" && Array.isArray(value.sections)) {
    return [
      "parent,command",
      ...flattenCommandHierarchy(value.sections).map((row) => row.map(csvCell).join(",")),
    ].join("\n");
  }
  if (value && typeof value === "object" && Array.isArray(value.entries)) {
    return [
      "text",
      ...value.entries.map((entry) => csvCell(entry)),
    ].join("\n");
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return [
      "field,value",
      ...Object.entries(value).map(([key, item]) => `${csvCell(key)},${csvCell(item)}`),
    ].join("\n");
  }
  return [
    "value",
    csvCell(value),
  ].join("\n");
}

function parseCsvRows(content) {
  const text = String(content ?? "").replace(/\r\n?/g, "\n");
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  let quoteClosed = false;

  const pushField = () => {
    row.push(field);
    field = "";
    quoteClosed = false;
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
          quoteClosed = true;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (quoteClosed && character !== "," && character !== "\n") {
      throw new Error(`Unexpected character after closing quote at column ${index + 1}`);
    }
    if (character === '"') {
      if (field) throw new Error(`Unexpected quote at column ${index + 1}`);
      quoted = true;
    } else if (character === ",") {
      pushField();
    } else if (character === "\n") {
      pushRow();
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error("Unterminated quoted CSV field");
  if (field || row.length || quoteClosed || !text.endsWith("\n")) pushRow();
  return rows;
}

function validateXmlDocument(content) {
  const xml = String(content ?? "").trim();
  if (!xml) throw new Error("XML document is empty");

  const declaration = /^<\?xml\s+version=(?:"1\.[01]"|'1\.[01]')(?:\s+encoding=(?:"[A-Za-z0-9._-]+"|'[A-Za-z0-9._-]+'))?\s*\?>/;
  const declarationMatch = declaration.exec(xml);
  const body = declarationMatch ? xml.slice(declarationMatch[0].length).trim() : xml;
  const stack = [];
  let rootName = "";
  let rootClosed = false;
  let cursor = 0;

  const validateText = (text) => {
    if (!stack.length && text.trim()) throw new Error("Text is not allowed outside the XML root");
    const unescaped = text.replace(/&(?:amp|lt|gt|quot|apos|#\d+|#x[0-9A-Fa-f]+);/g, "");
    if (unescaped.includes("&")) throw new Error("XML contains an unescaped ampersand");
  };

  while (cursor < body.length) {
    if (body[cursor] !== "<") {
      const nextTag = body.indexOf("<", cursor);
      const end = nextTag === -1 ? body.length : nextTag;
      validateText(body.slice(cursor, end));
      cursor = end;
      continue;
    }

    const end = body.indexOf(">", cursor + 1);
    if (end === -1) throw new Error("XML tag is not closed");
    const token = body.slice(cursor + 1, end).trim();
    const closing = token.startsWith("/");
    const name = closing ? token.slice(1) : token;
    if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(name)) {
      throw new Error(`Invalid XML tag <${token}>`);
    }

    if (closing) {
      const expected = stack.pop();
      if (expected !== name) throw new Error(`Expected </${expected || "none"}> but found </${name}>`);
      if (!stack.length) rootClosed = true;
    } else {
      if (!stack.length) {
        if (rootClosed || rootName) throw new Error("XML must contain exactly one root element");
        rootName = name;
      }
      stack.push(name);
    }
    cursor = end + 1;
  }

  if (stack.length) throw new Error(`XML element <${stack.at(-1)}> is not closed`);
  if (rootName !== "artifact") throw new Error("XML root must be <artifact>");
}

function safeBaseName(value) {
  const clean = String(value || "terminal-output")
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return clean || "terminal-output";
}

function artifactContent(source, format, model) {
  const normalized = normalizeSource(source);
  const { value } = model;

  if (format.id === "raw") return normalized;
  if (format.id === "json") return `${JSON.stringify(value, null, 2)}\n`;
  if (format.id === "jsonl") {
    const records = model.parsedJson
      ? (Array.isArray(value) ? value : [value])
      : model.structure === "hierarchical"
        ? value.sections
        : value.entries.map((text) => ({ text }));
    return `${records.map((record) => JSON.stringify(record)).join("\n")}\n`;
  }
  if (format.id === "yaml") {
    return yaml.dump(value, {
      noRefs: true,
      lineWidth: -1,
      noCompatMode: true,
      quotingType: '"',
      forceQuotes: true,
    });
  }
  if (format.id === "xml") return `<?xml version="1.0" encoding="UTF-8"?>\n${xmlValue(value, "artifact")}\n`;
  if (format.id === "csv") return `${csvFromValue(value)}\n`;
  return normalized;
}

export function validateArtifactContent(content, formatId) {
  const format = artifactFormat(formatId);
  try {
    if (format.id === "json") JSON.parse(content);
    if (format.id === "jsonl") {
      const normalized = String(content ?? "").replace(/\r\n?/g, "\n").replace(/\n$/, "");
      if (normalized) {
        normalized.split("\n").forEach((line, index) => {
          if (!line.trim()) throw new Error(`JSONL record ${index + 1} is empty`);
          JSON.parse(line);
        });
      }
    }
    if (format.id === "yaml") yaml.load(String(content ?? ""));
    if (format.id === "xml") validateXmlDocument(content);
    if (format.id === "csv") {
      const rows = parseCsvRows(content);
      if (!rows.length || !rows[0].length) throw new Error("CSV requires a header row");
      if (rows[0].every((cell) => !cell.trim())) throw new Error("CSV header cannot be empty");
      const width = rows[0].length;
      rows.forEach((row, index) => {
        if (row.length !== width) {
          throw new Error(`CSV row ${index + 1} has ${row.length} fields; expected ${width}`);
        }
      });
    }
    return { status: "valid", label: format.id === "raw" ? "Ready" : "Validated" };
  } catch (error) {
    return { status: "invalid", label: "Invalid", message: String(error.message || error) };
  }
}

export function buildTerminalArtifact({
  source,
  format: formatId = "json",
  device = "",
  name = "",
} = {}) {
  const format = artifactFormat(formatId);
  const normalized = normalizeSource(source);
  const model = structuredModel(normalized, device);
  const content = artifactContent(normalized, format, model);
  const base = safeBaseName(name || (device ? `${device}-output` : "terminal-output"))
    .replace(/\.(jsonl?|ya?ml|xml|csv|txt)$/i, "");

  return {
    format: format.id,
    label: format.label,
    extension: format.extension,
    mime: format.mime,
    name: `${base}.${format.extension}`,
    content,
    records: model.records,
    structure: model.structure,
    bytes: new TextEncoder().encode(content).byteLength,
    validation: validateArtifactContent(content, format.id),
  };
}
