export type DiffLineType = "same" | "added" | "removed";

export interface DiffLine {
  readonly type: DiffLineType;
  readonly text: string;
}

const MAX_CELLS = 1_000_000;

export function diffLines(before: string, after: string): readonly DiffLine[] {
  const a = before.split("\n");
  const b = after.split("\n");

  if (a.length * b.length > MAX_CELLS) {
    return naiveDiff(a, b);
  }

  const rows = a.length;
  const columns = b.length;
  const dp: number[][] = Array.from({ length: rows + 1 }, () =>
    new Array<number>(columns + 1).fill(0),
  );

  for (let i = rows - 1; i >= 0; i -= 1) {
    for (let j = columns - 1; j >= 0; j -= 1) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const result: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < rows && j < columns) {
    if (a[i] === b[j]) {
      result.push({ type: "same", text: a[i] });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      result.push({ type: "removed", text: a[i] });
      i += 1;
    } else {
      result.push({ type: "added", text: b[j] });
      j += 1;
    }
  }
  while (i < rows) {
    result.push({ type: "removed", text: a[i] });
    i += 1;
  }
  while (j < columns) {
    result.push({ type: "added", text: b[j] });
    j += 1;
  }

  return result;
}

function naiveDiff(a: readonly string[], b: readonly string[]): readonly DiffLine[] {
  const result: DiffLine[] = [];
  const max = Math.max(a.length, b.length);
  for (let index = 0; index < max; index += 1) {
    if (a[index] === b[index]) {
      if (a[index] !== undefined) {
        result.push({ type: "same", text: a[index] });
      }
    } else {
      if (a[index] !== undefined) {
        result.push({ type: "removed", text: a[index] });
      }
      if (b[index] !== undefined) {
        result.push({ type: "added", text: b[index] });
      }
    }
  }
  return result;
}
