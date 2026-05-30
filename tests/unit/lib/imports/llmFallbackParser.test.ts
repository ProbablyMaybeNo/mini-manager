import { describe, expect, test, vi } from "vitest";
import {
  parseWithLlm,
  type GroqLike,
} from "@/lib/imports/llmFallbackParser";

function makeMockClient(reply: string): GroqLike {
  return {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: reply } }],
        }),
      },
    },
  };
}

const goodJson = JSON.stringify({
  armyName: "Goff Waaagh",
  totalPoints: 1990,
  faction: "Orks",
  units: [
    { name: "Warboss", count: 1, points: 80, notes: null },
    { name: "Boyz", count: 20, points: 180, notes: "Choppas + slugga" },
    { name: "Killa Kans", count: 3, points: 135, notes: null },
  ],
});

describe("parseWithLlm", () => {
  test("converts a clean LLM JSON reply into an ImportedTree", async () => {
    const client = makeMockClient(goodJson);
    const result = await parseWithLlm("messy list contents", { client });

    expect(result.tree.armyName).toBe("Goff Waaagh");
    expect(result.tree.faction).toBe("Orks");
    expect(result.tree.totalPoints).toBe(1990);
    expect(result.tree.units).toHaveLength(3);
    expect(result.tree.units[1]!.name).toBe("Boyz");
    expect(result.tree.units[1]!.count).toBe(20);
    expect(result.tree.units[1]!.notes).toBe("Choppas + slugga");
    expect(result.confidence).toBe(0.7);
    expect(result.warnings).toHaveLength(0);
  });

  test("strips ```json fences from a fenced reply", async () => {
    const client = makeMockClient("```json\n" + goodJson + "\n```");
    const result = await parseWithLlm("messy list", { client });
    expect(result.tree.units).toHaveLength(3);
    expect(result.confidence).toBe(0.7);
  });

  test("salvages JSON when the LLM wraps it in prose", async () => {
    const client = makeMockClient(
      "Sure! Here is the JSON:\n" + goodJson + "\nHope that helps.",
    );
    const result = await parseWithLlm("messy list", { client });
    expect(result.tree.armyName).toBe("Goff Waaagh");
  });

  test("returns zero confidence + warning on invalid JSON", async () => {
    const client = makeMockClient("not json at all <xml/>");
    const result = await parseWithLlm("messy", { client });
    expect(result.confidence).toBe(0);
    expect(result.warnings[0]).toMatch(/not valid JSON/i);
  });

  test("rejects empty input before any API call", async () => {
    const create = vi.fn();
    const result = await parseWithLlm("", {
      client: { chat: { completions: { create } } } as GroqLike,
    });
    expect(create).not.toHaveBeenCalled();
    expect(result.confidence).toBe(0);
    expect(result.warnings[0]).toBe("Empty input");
  });

  test("rejects oversized input (>8000 chars) before any API call", async () => {
    const create = vi.fn();
    const huge = "x".repeat(8001);
    const result = await parseWithLlm(huge, {
      client: { chat: { completions: { create } } } as GroqLike,
    });
    expect(create).not.toHaveBeenCalled();
    expect(result.confidence).toBe(0);
    expect(result.warnings[0]).toMatch(/too long/i);
  });

  test("filters out malformed units (missing name or non-positive count)", async () => {
    const bad = JSON.stringify({
      armyName: "Mixed",
      totalPoints: null,
      faction: null,
      units: [
        { name: "Good Unit", count: 5, points: null, notes: null },
        { name: "", count: 5, points: null, notes: null },
        { name: "No Count", count: 0, points: null, notes: null },
        { name: "Negative", count: -3, points: null, notes: null },
        { count: 7, points: null, notes: null },
        { name: "Coerced From String", count: "10", points: "60" },
      ],
    });
    const client = makeMockClient(bad);
    const result = await parseWithLlm("messy", { client });

    expect(result.tree.units.map((u) => u.name)).toEqual([
      "Good Unit",
      "Coerced From String",
    ]);
    expect(result.tree.units[1]!.count).toBe(10);
    expect(result.tree.units[1]!.points).toBe(60);
  });

  test("empty unit array yields zero confidence", async () => {
    const client = makeMockClient(
      JSON.stringify({
        armyName: "Empty",
        totalPoints: null,
        faction: null,
        units: [],
      }),
    );
    const result = await parseWithLlm("messy", { client });
    expect(result.confidence).toBe(0);
    expect(result.warnings[0]).toMatch(/no units/i);
  });

  test("returns failure when no client and no API key configured", async () => {
    const prev = process.env["GROQ_API_KEY"];
    delete process.env["GROQ_API_KEY"];
    try {
      const result = await parseWithLlm("messy");
      expect(result.confidence).toBe(0);
      expect(result.warnings[0]).toMatch(/GROQ_API_KEY is not configured/);
    } finally {
      if (prev !== undefined) process.env["GROQ_API_KEY"] = prev;
    }
  });

  test("surfaces SDK errors as warnings rather than throwing", async () => {
    const client: GroqLike = {
      chat: {
        completions: {
          create: vi.fn().mockRejectedValue(new Error("rate-limited")),
        },
      },
    };
    const result = await parseWithLlm("messy", { client });
    expect(result.confidence).toBe(0);
    expect(result.warnings[0]).toMatch(/LLM call failed.*rate-limited/);
  });
});
