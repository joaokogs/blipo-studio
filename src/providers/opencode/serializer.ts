import {
  isAlias,
  isMap,
  isScalar,
  isSeq,
  parseDocument,
  visit,
  type Document,
  type YAMLMap,
} from "yaml";
import { parseFrontmatterYaml } from "./frontmatter";

const FIELD = "disable-model-invocation";
const OPENING = /^---[ \t]*\r?\n/;
const CLOSING = /^---[ \t]*(?:\r?\n|$)/m;

export type DisableModelInvocationLockReason = "merge" | "anchor";

export type DisableModelInvocationState =
  | { readonly kind: "absent" }
  | { readonly kind: "boolean"; readonly value: boolean }
  | { readonly kind: "invalid" }
  | {
      readonly kind: "locked";
      readonly value?: boolean;
      readonly reason: DisableModelInvocationLockReason;
    };

interface FrontmatterRegion {
  readonly yamlStart: number;
  readonly yamlEnd: number;
  readonly yaml: string;
  readonly eol: string;
}

function locateFrontmatter(content: string): FrontmatterRegion | null {
  const opening = OPENING.exec(content);
  if (!opening) {
    return null;
  }

  const yamlStart = opening[0].length;
  const rest = content.slice(yamlStart);
  const closing = CLOSING.exec(rest);
  if (!closing) {
    return null;
  }

  const yamlEnd = yamlStart + closing.index;
  return {
    yamlStart,
    yamlEnd,
    yaml: content.slice(yamlStart, yamlEnd),
    eol: content.includes("\r\n") ? "\r\n" : "\n",
  };
}

function toBoolean(value: unknown): boolean | undefined {
  return value === true || value === false ? value : undefined;
}

function mergeSources(node: unknown, doc: Document): YAMLMap[] {
  if (isMap(node)) {
    return [node];
  }
  if (isAlias(node)) {
    const resolved = node.resolve(doc);
    return resolved && isMap(resolved) ? [resolved] : [];
  }
  if (isSeq(node)) {
    return node.items.flatMap((item) => mergeSources(item, doc));
  }
  return [];
}

function mergeProvidesField(
  map: YAMLMap,
  doc: Document,
  visited: Set<YAMLMap> = new Set(),
): boolean {
  if (visited.has(map)) {
    return false;
  }
  visited.add(map);

  for (const item of map.items) {
    if (!isScalar(item.key) || item.key.value !== "<<") {
      continue;
    }
    for (const source of mergeSources(item.value, doc)) {
      if (source.items.some((pair) => isScalar(pair.key) && pair.key.value === FIELD)) {
        return true;
      }
      if (mergeProvidesField(source, doc, visited)) {
        return true;
      }
    }
  }
  return false;
}

function hasAliasTo(doc: Document, target: unknown): boolean {
  let found = false;
  visit(doc, {
    Alias(_key, node) {
      if (node.resolve(doc) === target) {
        found = true;
        return visit.BREAK;
      }
      return undefined;
    },
  });
  return found;
}

interface ResolvedFrontmatter {
  readonly data: Record<string, unknown>;
  readonly locked: DisableModelInvocationLockReason | null;
}

function inspect(region: FrontmatterRegion): ResolvedFrontmatter | null {
  const parsed = parseFrontmatterYaml(region.yaml);
  if (!parsed.ok) {
    return null;
  }

  const doc = parseDocument(region.yaml);
  if (doc.errors.length > 0 || !isMap(doc.contents)) {
    return null;
  }

  const map = doc.contents;
  const pair = map.items.find((item) => isScalar(item.key) && item.key.value === FIELD);

  const inherited = !pair && FIELD in parsed.data;
  if (inherited || (pair && mergeProvidesField(map, doc))) {
    return { data: parsed.data, locked: "merge" };
  }

  if (pair && isScalar(pair.value) && pair.value.anchor && hasAliasTo(doc, pair.value)) {
    return { data: parsed.data, locked: "anchor" };
  }

  return { data: parsed.data, locked: null };
}

export function readDisableModelInvocation(content: string): DisableModelInvocationState {
  const region = locateFrontmatter(content);
  if (!region) {
    return { kind: "invalid" };
  }

  const inspected = inspect(region);
  if (!inspected) {
    return { kind: "invalid" };
  }

  if (inspected.locked) {
    return {
      kind: "locked",
      value: toBoolean(inspected.data[FIELD]),
      reason: inspected.locked,
    };
  }

  if (!(FIELD in inspected.data)) {
    return { kind: "absent" };
  }

  const value = toBoolean(inspected.data[FIELD]);
  return value === undefined ? { kind: "invalid" } : { kind: "boolean", value };
}

export function writeDisableModelInvocation(content: string, value: boolean | undefined): string {
  const region = locateFrontmatter(content);
  if (!region) {
    return content;
  }

  const inspected = inspect(region);
  if (!inspected || inspected.locked) {
    return content;
  }

  const doc = parseDocument(region.yaml);
  if (doc.errors.length > 0 || !isMap(doc.contents)) {
    return content;
  }

  const map = doc.contents;
  const pair = map.items.find((item) => isScalar(item.key) && item.key.value === FIELD);

  if (value === undefined) {
    if (!pair) {
      return content;
    }
    map.items = map.items.filter((item) => item !== pair);
  } else if (pair) {
    if (isScalar(pair.value)) {
      pair.value.value = value;
    } else {
      doc.set(FIELD, value);
    }
  } else {
    doc.set(FIELD, value);
  }

  const nextYaml = doc.toString().replace(/\n/g, region.eol);
  return content.slice(0, region.yamlStart) + nextYaml + content.slice(region.yamlEnd);
}
