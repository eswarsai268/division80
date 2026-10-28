import { describe, expect, it } from "vitest";
import { normalizeImportedPhone } from "../src/utils/importPhone.js";

describe("normalizeImportedPhone", () => {
  it("preserves country code and strips common display separators", () => {
    expect(normalizeImportedPhone(" +91 (98765) 43210 ")).toBe("+919876543210");
  });

  it("keeps a valid local number as supplied and treats blank cells as missing", () => {
    expect(normalizeImportedPhone("9876543210")).toBe("9876543210");
    expect(normalizeImportedPhone("   ")).toBeNull();
  });

  it.each(["123", "+0123456789", "98765abc10", "9876543210\n+12345678", "1".repeat(33)])(
    "rejects invalid phone value %s",
    (value) => expect(normalizeImportedPhone(value)).toBeUndefined(),
  );
});
