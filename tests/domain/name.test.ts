import { describe, expect, it } from "vitest";
import {
  RESOURCE_NAME_MAX_LENGTH,
  describeInvalidResourceName,
  isValidResourceName,
} from "@/core/domain";

describe("isValidResourceName", () => {
  it("aceita nomes seguros", () => {
    for (const name of ["a", "git-release", "agent123", "a1-b2-c3"]) {
      expect(isValidResourceName(name)).toBe(true);
    }
  });

  it("rejeita maiúsculas, separadores, pontos e hífens inválidos", () => {
    for (const name of ["Bad", "with space", "a/b", "a\\b", "a.b", "-lead", "trail-", "a--b", "a_b"]) {
      expect(isValidResourceName(name)).toBe(false);
    }
  });

  it("rejeita nomes vazios e longos demais", () => {
    expect(isValidResourceName("")).toBe(false);
    expect(isValidResourceName("a".repeat(RESOURCE_NAME_MAX_LENGTH + 1))).toBe(false);
  });

  it("rejeita nomes reservados do Windows", () => {
    for (const name of ["con", "nul", "com1", "lpt9", "aux"]) {
      expect(isValidResourceName(name)).toBe(false);
      expect(describeInvalidResourceName(name)).toMatch(/reservado/i);
    }
  });
});
