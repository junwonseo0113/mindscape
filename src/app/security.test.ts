import { beforeEach, describe, expect, it } from "vitest";
import { FREE_ATTEMPTS, lockRemaining, recordFailure, recordSuccess } from "./loginThrottle";
import { ITERATIONS, hashLocalPassword, needsRehash, verifyLocalPassword } from "./localPassword";

const mem = new Map<string, string>();
(globalThis as any).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };

describe("login throttle", () => {
  beforeEach(() => mem.clear());
  it("allows a few tries, then makes each wait longer", () => {
    const t = 1_000_000;
    for (let i = 0; i < FREE_ATTEMPTS - 1; i++) expect(recordFailure(t)).toBe(0);
    const first = recordFailure(t);
    expect(first).toBeGreaterThan(0);
    expect(recordFailure(t)).toBeGreaterThan(first);
    expect(lockRemaining(t)).toBeGreaterThan(0);
  });
  it("clears on a correct login", () => {
    for (let i = 0; i < FREE_ATTEMPTS + 2; i++) recordFailure();
    recordSuccess();
    expect(lockRemaining()).toBe(0);
  });
});

describe("password hashing", () => {
  it("hashes with the current iteration count and verifies", async () => {
    const h = await hashLocalPassword("correct horse");
    expect(h.split("$")[1]).toBe(String(ITERATIONS));
    expect(await verifyLocalPassword("correct horse", h)).toBe(true);
    expect(await verifyLocalPassword("wrong", h)).toBe(false);
    expect(needsRehash(h)).toBe(false);
  }, 20000);
  it("flags old and plaintext values for rehashing, rejects tampered ones", async () => {
    expect(needsRehash("pbkdf2$210000$aaaa$bbbb")).toBe(true);
    expect(needsRehash("plaintext")).toBe(true);
    expect(await verifyLocalPassword("x", "pbkdf2$999999999$aaaa$bbbb")).toBe(false);
    expect(await verifyLocalPassword("x", "pbkdf2$abc$$")).toBe(false);
  });
});
