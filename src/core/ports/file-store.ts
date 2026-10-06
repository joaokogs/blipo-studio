import type { Scope } from "@/core/domain";

export interface LogicalTarget {
  readonly scope: Scope;
  readonly path: string;
}

export interface FileContent {
  readonly content: string;
  readonly version: string;
}

export interface CreateFileOperation {
  readonly type: "create";
  readonly target: LogicalTarget;
  readonly content: string;
}

export interface UpdateFileOperation {
  readonly type: "update";
  readonly target: LogicalTarget;
  readonly content: string;
  readonly expectedVersion: string;
}

export interface DeleteFileOperation {
  readonly type: "delete";
  readonly target: LogicalTarget;
  readonly expectedVersion: string;
}

export type FileOperation = CreateFileOperation | UpdateFileOperation | DeleteFileOperation;

export interface FileChangePlan {
  readonly operations: readonly FileOperation[];
}

export interface ApplyReport {
  readonly applied: number;
}

export interface FileStore {
  read(target: LogicalTarget): Promise<FileContent | null>;
  apply(plan: FileChangePlan): Promise<ApplyReport>;
}
