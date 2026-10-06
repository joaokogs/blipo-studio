import type { Scope, StorageKind } from "@/core/domain";

export interface LogicalTarget {
  readonly scope: Scope;
  readonly storage: StorageKind;
  readonly name: string;
}

export interface FileContent {
  readonly content: string;
  readonly version: string;
}

export interface StoredFile {
  readonly target: LogicalTarget;
  readonly raw: string;
  readonly version: string;
  readonly size: number;
}

export interface ScanIssue {
  readonly path: string;
  readonly code: string;
  readonly message: string;
}

export interface ListReport {
  readonly files: readonly StoredFile[];
  readonly issues: readonly ScanIssue[];
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

export interface BackupRef {
  readonly id: string;
  readonly path: string;
  readonly createdAt: string;
}

export interface ApplyReport {
  readonly applied: number;
  readonly backup?: BackupRef;
  readonly result?: FileContent;
}

export interface FileStore {
  list(scope: Scope): Promise<ListReport>;
  read(target: LogicalTarget): Promise<FileContent | null>;
  apply(plan: FileChangePlan): Promise<ApplyReport>;
}
