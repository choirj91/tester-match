import { describe, expect, it } from "vitest";
import { appDedupeKey } from "./app-dedupe";

const STORE_URL = "https://play.google.com/apps/test/com.example.fridge/1";

describe("appDedupeKey", () => {
  it("gives identical rows the same key", () => {
    const a = appDedupeKey({ name: "MagicFridge", store_invite_url: STORE_URL });
    const b = appDedupeKey({ name: "MagicFridge", store_invite_url: STORE_URL });
    expect(a).toBe(b);
  });

  it("ignores case and surrounding or repeated whitespace in the name", () => {
    const base = appDedupeKey({ name: "Magic Fridge", store_invite_url: STORE_URL });
    expect(appDedupeKey({ name: "  magic   fridge ", store_invite_url: STORE_URL })).toBe(base);
  });

  it("treats a Hangul name the same whether composed or decomposed", () => {
    const composed = appDedupeKey({ name: "냉장고".normalize("NFC"), store_invite_url: STORE_URL });
    const decomposed = appDedupeKey({
      name: "냉장고".normalize("NFD"),
      store_invite_url: STORE_URL,
    });
    expect(decomposed).toBe(composed);
  });

  it("ignores surrounding whitespace in the store link", () => {
    const base = appDedupeKey({ name: "MagicFridge", store_invite_url: STORE_URL });
    expect(appDedupeKey({ name: "MagicFridge", store_invite_url: ` ${STORE_URL} ` })).toBe(base);
  });

  it("treats a missing store link the same whether null, undefined or blank", () => {
    const base = appDedupeKey({ name: "MagicFridge", store_invite_url: null });
    expect(appDedupeKey({ name: "MagicFridge" })).toBe(base);
    expect(appDedupeKey({ name: "MagicFridge", store_invite_url: "  " })).toBe(base);
  });

  it("separates apps that share a name but not a store link", () => {
    const a = appDedupeKey({ name: "MagicFridge", store_invite_url: STORE_URL });
    const b = appDedupeKey({ name: "MagicFridge", store_invite_url: `${STORE_URL}2` });
    expect(a).not.toBe(b);
  });

  it("separates apps that share a store link but not a name", () => {
    const a = appDedupeKey({ name: "MagicFridge", store_invite_url: STORE_URL });
    const b = appDedupeKey({ name: "MagicFreezer", store_invite_url: STORE_URL });
    expect(a).not.toBe(b);
  });

  it("does not let a name spill into the link part of the key", () => {
    const a = appDedupeKey({ name: "a", store_invite_url: "b c" });
    const b = appDedupeKey({ name: "a b", store_invite_url: "c" });
    expect(a).not.toBe(b);
  });
});
