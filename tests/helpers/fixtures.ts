import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const FIXTURES_DIR = fileURLToPath(new URL("../fixtures/opencode", import.meta.url));

export function fixturePath(...segments: readonly string[]): string {
  return join(FIXTURES_DIR, ...segments);
}

export async function readFixture(...segments: readonly string[]): Promise<string> {
  return readFile(fixturePath(...segments), "utf8");
}
