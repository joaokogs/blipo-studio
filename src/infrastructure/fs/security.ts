import { lstat, realpath } from "node:fs/promises";
import type { Stats } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { StudioError } from "@/core/domain";
import { isInside } from "./paths";

export async function lstatOrNull(target: string): Promise<Stats | null> {
  try {
    return await lstat(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function realpathOrSelf(target: string): Promise<string> {
  try {
    return await realpath(target);
  } catch {
    return target;
  }
}

async function deepestExistingWithin(rootAbs: string, targetAbs: string): Promise<string> {
  let current = targetAbs;

  while (isInside(rootAbs, current)) {
    const stats = await lstatOrNull(current);
    if (stats) {
      return current;
    }
    if (current === rootAbs || current === dirname(current)) {
      break;
    }
    current = dirname(current);
  }

  return rootAbs;
}

export async function assertSafeTarget(rootAbs: string, targetAbs: string): Promise<void> {
  if (!isInside(rootAbs, targetAbs)) {
    throw new StudioError("unsafe_path", "O alvo está fora da raiz permitida.");
  }

  const rel = relative(rootAbs, targetAbs);
  const segments = rel === "" ? [] : rel.split(sep).filter((segment) => segment.length > 0);

  const chain = [rootAbs];
  for (let index = 0; index < segments.length; index += 1) {
    chain.push(join(rootAbs, ...segments.slice(0, index + 1)));
  }

  for (const candidate of chain) {
    const stats = await lstatOrNull(candidate);
    if (stats?.isSymbolicLink()) {
      throw new StudioError(
        "unsafe_path",
        `O caminho contém um link simbólico ou junction: ${candidate}`,
      );
    }
  }

  const existing = await deepestExistingWithin(rootAbs, targetAbs);
  if (existing !== rootAbs) {
    const realRoot = await realpathOrSelf(rootAbs);
    const realExisting = await realpathOrSelf(existing);
    if (!isInside(realRoot, realExisting)) {
      throw new StudioError(
        "unsafe_path",
        "O caminho resolve para fora da raiz permitida (link simbólico ou junction).",
      );
    }
  }
}
