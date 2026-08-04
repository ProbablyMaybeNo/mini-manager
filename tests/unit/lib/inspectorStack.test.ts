import { describe, expect, test } from "vitest";
import { inspectorHref, readInspectorStack } from "@/lib/inspectorStack";

const params = (search: string) => new URLSearchParams(search);

describe("readInspectorStack", () => {
  test("no open param means the inspector is closed", () => {
    expect(readInspectorStack(params(""))).toEqual([]);
    expect(readInspectorStack(params("tour=create"))).toEqual([]);
  });

  test("open alone is the root tier", () => {
    expect(readInspectorStack(params("open=a"))).toEqual(["a"]);
  });

  test("subs stack under the root, in URL order", () => {
    expect(readInspectorStack(params("open=a&sub=b&sub=c"))).toEqual(["a", "b", "c"]);
  });

  test("a sub without a root is meaningless", () => {
    expect(readInspectorStack(params("sub=b"))).toEqual([]);
  });

  test("the stack is a path down the tree, so repeats are dropped", () => {
    expect(readInspectorStack(params("open=a&sub=b&sub=b&sub=a"))).toEqual(["a", "b"]);
  });

  test("unrelated params are ignored", () => {
    expect(readInspectorStack(params("tour=create&open=a&x=1&sub=b"))).toEqual(["a", "b"]);
  });
});

describe("inspectorHref", () => {
  test("an empty stack is the closed URL", () => {
    expect(inspectorHref("/dashboard", params("open=a&sub=b"), [])).toBe("/dashboard");
  });

  test("one tier writes open", () => {
    expect(inspectorHref("/dashboard", params(""), ["a"])).toBe("/dashboard?open=a");
  });

  test("deeper tiers append one sub each", () => {
    expect(inspectorHref("/dashboard", params(""), ["a", "b", "c"])).toBe(
      "/dashboard?open=a&sub=b&sub=c",
    );
  });

  test("unrelated params survive, inspector params are replaced not duplicated", () => {
    expect(inspectorHref("/dashboard", params("tour=create&open=a&sub=b"), ["c"])).toBe(
      "/dashboard?tour=create&open=c",
    );
  });

  test("closing keeps the rest of the query string", () => {
    expect(inspectorHref("/dashboard", params("open=a&ref=email"), [])).toBe(
      "/dashboard?ref=email",
    );
  });

  test("round-trips: what is written is what is read back", () => {
    const href = inspectorHref("/dashboard", params("tour=create"), ["a", "b"]);
    const search = href.slice(href.indexOf("?"));
    expect(readInspectorStack(params(search))).toEqual(["a", "b"]);
  });
});
