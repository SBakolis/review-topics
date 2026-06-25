import { describe, expect, test } from "vitest";
import {
  buildPrDiffArgs,
  buildPrViewArgs,
  parsePrepareSessionArgs,
} from "../scripts/prepare-session.mjs";

describe("parsePrepareSessionArgs", () => {
  test("keeps a single positional argument as the output path", () => {
    expect(parsePrepareSessionArgs(["node", "prepare-session.mjs", "tmp/session.json"])).toEqual({
      outputPath: "tmp/session.json",
    });
  });

  test("parses explicit output and PR selector flags", () => {
    expect(
      parsePrepareSessionArgs([
        "node",
        "prepare-session.mjs",
        "--output",
        "tmp/session.json",
        "--pr",
        "123",
      ]),
    ).toEqual({
      outputPath: "tmp/session.json",
      prSelector: "123",
    });
  });

  test("rejects missing flag values", () => {
    expect(() => parsePrepareSessionArgs(["node", "prepare-session.mjs", "--pr"])).toThrow(
      "Missing value for --pr",
    );
  });
});

describe("PR gh args", () => {
  test("builds current-checkout PR commands without a selector", () => {
    expect(buildPrViewArgs()).toEqual([
      "pr",
      "view",
      "--json",
      "number,title,url,baseRefName,headRefName,baseRefOid,headRefOid,files,headRepositoryOwner,headRepository",
    ]);
    expect(buildPrDiffArgs()).toEqual(["pr", "diff", "--patch"]);
  });

  test("builds selected PR commands with a selector", () => {
    expect(buildPrViewArgs("123")).toEqual([
      "pr",
      "view",
      "123",
      "--json",
      "number,title,url,baseRefName,headRefName,baseRefOid,headRefOid,files,headRepositoryOwner,headRepository",
    ]);
    expect(buildPrDiffArgs("123")).toEqual(["pr", "diff", "123", "--patch"]);
  });
});
