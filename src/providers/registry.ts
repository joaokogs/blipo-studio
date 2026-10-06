import type { ProviderId } from "@/core/domain";
import type { ProviderAdapter } from "@/core/ports";
import { openCodeAdapter } from "@/providers/opencode/adapter";

const adapters: Partial<Record<ProviderId, ProviderAdapter>> = {
  opencode: openCodeAdapter,
};

export function getAdapter(providerId: ProviderId): ProviderAdapter | undefined {
  return adapters[providerId];
}

export function listImplementedProviderIds(): readonly ProviderId[] {
  return Object.keys(adapters) as ProviderId[];
}
