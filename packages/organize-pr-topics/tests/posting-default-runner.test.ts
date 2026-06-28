import { describe, expect, it, vi } from "vitest";

const mockExecFile = vi.fn();

vi.mock("node:child_process", () => ({
  execFile: mockExecFile,
}));

describe("defaultRunner argv shape", () => {
  it("postPrLevelComment produces a well-formed gh argv via defaultRunner", async () => {
    mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
      const cb = typeof _opts === "function" ? _opts : callback;
      process.nextTick(() => cb(null, JSON.stringify({ html_url: "u" }), ""));
    });

    const { postPrLevelComment } = await import("../app/server/comments");
    const result = await postPrLevelComment("octo", "example", 12, "hello");

    expect(mockExecFile).toHaveBeenCalledTimes(1);
    const callArgs = mockExecFile.mock.calls[0];
    expect(callArgs[0]).toBe("gh");
    expect(callArgs[1]).toEqual([
      "api",
      "repos/octo/example/issues/12/comments",
      "--method",
      "POST",
      "--field",
      "body=hello",
    ]);

    expect(result).toEqual({ html_url: "u" });
    mockExecFile.mockReset();
  });

  it("postInlineComment produces a well-formed gh argv via defaultRunner", async () => {
    mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
      const cb = typeof _opts === "function" ? _opts : callback;
      process.nextTick(() => cb(null, JSON.stringify({ html_url: "u2" }), ""));
    });

    const { postInlineComment } = await import("../app/server/comments");
    const result = await postInlineComment("octo", "example", 12, {
      body: "b",
      commitId: "sha1",
      path: "p.ts",
      line: 7,
      side: "RIGHT",
    });

    expect(mockExecFile).toHaveBeenCalledTimes(1);
    const callArgs = mockExecFile.mock.calls[0];
    expect(callArgs[0]).toBe("gh");
    expect(callArgs[1]).toEqual([
      "api",
      "repos/octo/example/pulls/12/comments",
      "--method",
      "POST",
      "--field",
      "body=b",
      "--field",
      "commit_id=sha1",
      "--field",
      "path=p.ts",
      "--field",
      "line=7",
      "--field",
      "side=RIGHT",
    ]);

    expect(result).toEqual({ html_url: "u2" });
    mockExecFile.mockReset();
  });
});
