import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

/** Write a reviewed export privately without using the inventory mutation path. */
export function writePrivateExport(
  destination: string,
  source: string,
  content: string,
) {
  const check = () => {
    const target = fs.existsSync(destination)
      ? fs.lstatSync(destination)
      : undefined;
    if (target && (!target.isFile() || target.isSymbolicLink()))
      throw Error("Export destination must be a regular file.");
    const inventory = fs.existsSync(source) ? fs.statSync(source) : undefined;
    const resolved = (file: string) =>
      fs.existsSync(file) ? fs.realpathSync(file) : path.resolve(file);
    if (
      resolved(destination) === resolved(source) ||
      (target &&
        inventory &&
        target.dev === inventory.dev &&
        target.ino === inventory.ino)
    )
      throw Error(
        "Export to a separate file. Use the reviewed testbed save to update the active inventory.",
      );
  };
  check();
  const temp = path.join(
    path.dirname(destination),
    `.netclaw-export-${randomUUID()}.tmp`,
  );
  let fd: number | undefined;
  try {
    fd = fs.openSync(temp, "wx", 0o600);
    fs.writeFileSync(fd, content);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    check();
    fs.renameSync(temp, destination);
    if (fs.readFileSync(destination, "utf8") !== content)
      throw Error(
        "Export verification failed. Inspect the chosen destination before using it.",
      );
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
    if (fs.existsSync(temp)) fs.unlinkSync(temp);
  }
}
