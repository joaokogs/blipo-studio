import { isAbsolute, join, relative, resolve, sep } from "node:path";

export function isInside(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  if (rel === "") {
    return true;
  }
  return !rel.startsWith("..") && !isAbsolute(rel);
}

export function relativeSegments(parent: string, child: string): readonly string[] {
  const rel = relative(parent, child);
  if (rel === "") {
    return [];
  }
  return rel.split(sep).filter((segment) => segment.length > 0);
}

export function joinRoot(root: string, ...segments: readonly string[]): string {
  return resolve(join(root, ...segments));
}
