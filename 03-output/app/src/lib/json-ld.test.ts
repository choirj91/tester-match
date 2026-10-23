import { describe, expect, it } from "vitest";
import { serializeJsonLd } from "./json-ld";

describe("serializeJsonLd", () => {
  it("cannot close the surrounding script tag", () => {
    const out = serializeJsonLd({ name: "</script><script>alert(1)</script>" });
    expect(out).not.toMatch(/<\/script/i);
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
  });

  it("escapes HTML comment and ampersand sequences", () => {
    const out = serializeJsonLd({ text: "<!-- a && b -->" });
    expect(out).not.toContain("<!--");
    expect(out).not.toContain("&");
  });

  it("escapes JS line separators", () => {
    const out = serializeJsonLd({ text: "a\u2028b\u2029c" });
    expect(out).not.toMatch(/[\u2028\u2029]/);
  });

  it("round-trips to the same value", () => {
    const value = {
      "@type": "SoftwareApplication",
      name: "<고양이 주점> & 친구들",
      description: "</script>\u2028줄바꿈",
      nested: [{ n: 1 }],
    };
    expect(JSON.parse(serializeJsonLd(value))).toEqual(value);
  });
});
