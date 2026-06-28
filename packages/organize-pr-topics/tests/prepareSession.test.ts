import { resolve } from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  buildPrDiffArgs,
  buildPrViewArgs,
  main,
  parsePrepareSessionArgs,
} from "../scripts/prepare-session.mjs";

const mocks = vi.hoisted(() => ({
  execFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execFileSync: mocks.execFileSync,
}));

vi.mock("node:fs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:fs")>()),
  writeFileSync: mocks.writeFileSync,
}));

beforeEach(() => {
  mocks.execFileSync.mockReset();
  mocks.writeFileSync.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

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

describe("main", () => {
  test("uses selected PR commands and explicit output path", async () => {
    mocks.execFileSync.mockImplementation((command, args: string[]) => {
      if (command !== "gh") {
        throw new Error(`Unexpected command: ${command}`);
      }

      if (args[0] === "pr" && args[1] === "view") {
        return JSON.stringify({
          number: 123,
          title: "PR title",
          url: "https://github.com/owner/repo/pull/123",
          baseRefName: "main",
          headRefName: "feature",
          baseRefOid: "base-sha",
          headRefOid: "head-sha",
          files: [
            {
              path: "file.ts",
              status: "MODIFIED",
              additions: 1,
              deletions: 0,
            },
          ],
          headRepositoryOwner: { login: "owner" },
          headRepository: { name: "repo" },
        });
      }

      if (args[0] === "pr" && args[1] === "diff") {
        return "diff --git a/file.ts b/file.ts";
      }

      throw new Error(`Unexpected gh args: ${args.join(" ")}`);
    });

    await main(["node", "prepare-session.mjs", "--pr", "123", "--output", "tmp/session.json"]);

    expect(mocks.execFileSync).toHaveBeenNthCalledWith(
      1,
      "gh",
      [
        "pr",
        "view",
        "123",
        "--json",
        "number,title,url,baseRefName,headRefName,baseRefOid,headRefOid,files,headRepositoryOwner,headRepository",
      ],
      { encoding: "utf8" },
    );
    expect(mocks.execFileSync).toHaveBeenNthCalledWith(
      2,
      "gh",
      ["pr", "diff", "123", "--patch"],
      { encoding: "utf8" },
    );
    expect(mocks.writeFileSync).toHaveBeenCalledWith(
      resolve("tmp/session.json"),
      expect.any(String),
    );
  });
});
