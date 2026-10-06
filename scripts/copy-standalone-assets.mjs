import { existsSync } from "node:fs";
import { cp, mkdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(process.cwd());
const standalone = join(root, ".next", "standalone");

if (!existsSync(standalone)) {
  console.error("Saída standalone ausente em .next/standalone. Rode `next build` primeiro.");
  process.exit(1);
}

async function copyInto(source, destination) {
  if (!existsSync(source)) {
    return false;
  }
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  await cp(source, destination, { recursive: true });
  return true;
}

const copiedStatic = await copyInto(join(root, ".next", "static"), join(standalone, ".next", "static"));
const copiedPublic = await copyInto(join(root, "public"), join(standalone, "public"));

console.log(
  `Standalone: static=${copiedStatic ? "ok" : "ausente"}, public=${copiedPublic ? "ok" : "ausente"}.`,
);
