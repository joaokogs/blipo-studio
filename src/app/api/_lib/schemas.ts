import { z } from "zod";
import {
  AGENT_MODES,
  PROVIDER_IDS,
  RESOURCE_KINDS,
  SKILL_DESCRIPTION_MAX_LENGTH,
  SCOPES,
  StudioError,
} from "@/core/domain";

function enumFrom<T extends string>(values: readonly T[]) {
  return z.enum(values as unknown as [T, ...T[]]);
}

export const providerSchema = enumFrom(PROVIDER_IDS);
export const scopeSchema = enumFrom(SCOPES);
export const kindSchema = enumFrom(RESOURCE_KINDS);
export const modeSchema = enumFrom(AGENT_MODES);

export const nameSchema = z.string().min(1).max(64);
export const versionSchema = z.string().min(1).max(256);
export const contentSchema = z.string();

export const listRequestSchema = z.strictObject({
  provider: providerSchema,
  scope: scopeSchema.optional(),
});

export const readRequestSchema = z.strictObject({
  provider: providerSchema,
  scope: scopeSchema,
  kind: kindSchema,
  name: nameSchema,
});

export const validateRequestSchema = z.strictObject({
  provider: providerSchema,
  scope: scopeSchema,
  kind: kindSchema,
  name: nameSchema,
  content: contentSchema,
});

export const templateRequestSchema = z.strictObject({
  provider: providerSchema,
  kind: kindSchema,
  name: nameSchema,
  description: z.string().min(1).max(SKILL_DESCRIPTION_MAX_LENGTH),
  mode: modeSchema.optional(),
  disableModelInvocation: z.boolean().optional(),
});

export const mutateRequestSchema = z.discriminatedUnion("action", [
  z.strictObject({
    provider: providerSchema,
    action: z.literal("create"),
    scope: scopeSchema,
    kind: kindSchema,
    name: nameSchema,
    content: contentSchema,
    mode: modeSchema.optional(),
  }),
  z.strictObject({
    provider: providerSchema,
    action: z.literal("update"),
    scope: scopeSchema,
    kind: kindSchema,
    name: nameSchema,
    content: contentSchema,
    expectedVersion: versionSchema,
  }),
  z.strictObject({
    provider: providerSchema,
    action: z.literal("delete"),
    scope: scopeSchema,
    kind: kindSchema,
    name: nameSchema,
    expectedVersion: versionSchema,
  }),
]);

export type MutateRequest = z.infer<typeof mutateRequestSchema>;

export function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join(".") || "corpo"}: ${issue.message}`)
      .join("; ");
    throw new StudioError("validation_error", message);
  }
  return result.data;
}
