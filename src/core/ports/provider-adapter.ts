import type { Operation, ProviderId, Resource } from "@/core/domain";
import type { FileChangePlan } from "./file-store";

export interface ResourceChangeRequest {
  readonly resource: Resource;
  readonly operation: Operation;
  readonly content?: string;
  readonly expectedVersion?: string;
}

export interface ProviderAdapter {
  readonly providerId: ProviderId;
  planChanges(request: ResourceChangeRequest): Promise<FileChangePlan>;
}
