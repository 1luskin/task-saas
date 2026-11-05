import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { wrapText } from "@/lib/pdf";

// Dummy-Font: jedes Zeichen 1 Einheit breit pro Punktgröße
const font = { widthOfTextAtSize: (s: string, size: number) => s.length * size } as never;

describe("wrapText", () => {
  it("bricht nach Breite um und behält Absätze", () => {
    expect(wrapText("aa bb cc", font, 1, 5)).toEqual(["aa bb", "cc"]);
    expect(wrapText("a\nb", font, 1, 10)).toEqual(["a", "b"]);
  });
  it("trennt überlange Wörter hart", () => {
    expect(wrapText("abcdefgh", font, 1, 3)).toEqual(["abc", "def", "gh"]);
  });
});
