import { describe, expect, it } from "vitest";
import { chunkRows, MAX_IMPORT_BATCH_SIZE, mergeChunkResult } from "./import-form";

describe("admin app import batching", () => {
  it("splits rows into 200-row chunks", () => {
    const rows = Array.from({ length: 401 }, (_, i) => i);
    const chunks = chunkRows(rows);

    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(MAX_IMPORT_BATCH_SIZE);
    expect(chunks[1]).toHaveLength(MAX_IMPORT_BATCH_SIZE);
    expect(chunks[2]).toHaveLength(1);
    expect(chunks[2][0]).toBe(400);
  });

  it("merges chunk results and offsets row numbers", () => {
    const merged = mergeChunkResult(
      {
        ok: true,
        imported: 199,
        skipped: 1,
        total: 200,
        placeholders_created: 50,
        errors: [{ row: 7, email: "a@example.com", reason: "failed" }],
      },
      {
        ok: true,
        imported: 1,
        skipped: 1,
        total: 2,
        placeholders_created: 1,
        errors: [{ row: 1, email: "b@example.com", reason: "failed" }],
      },
      200,
    );

    expect(merged.imported).toBe(200);
    expect(merged.skipped).toBe(2);
    expect(merged.total).toBe(202);
    expect(merged.placeholders_created).toBe(51);
    expect(merged.errors).toEqual([
      { row: 7, email: "a@example.com", reason: "failed" },
      { row: 201, email: "b@example.com", reason: "failed" },
    ]);
  });
});

