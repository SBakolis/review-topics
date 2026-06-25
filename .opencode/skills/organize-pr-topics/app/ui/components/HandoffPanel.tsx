import { useId, useState } from "react";

type PostStatus = "idle" | "posting" | "posted" | "failed";

type PostResult = {
  posted: number;
  failed: number;
  skipped: number;
  results: Array<{
    id: string;
    status: "posted" | "failed" | "skipped";
    githubUrl?: string;
    error?: string;
  }>;
};

export function HandoffPanel() {
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);
  const [postStatus, setPostStatus] = useState<PostStatus>("idle");
  const [postResult, setPostResult] = useState<PostResult | null>(null);
  const [postError, setPostError] = useState<string | null>(null);
  const promptId = useId();

  async function loadPrompt() {
    setStatus("loading");
    setError(null);
    try {
      const response = await fetch("/api/handoff");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const body = (await response.json()) as { prompt: string };
      setPrompt(body.prompt);
      setStatus("idle");
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
      setStatus("failed");
    }
  }

  async function postComments() {
    setPostStatus("posting");
    setPostError(null);
    try {
      const response = await fetch("/api/comments/post-all", { method: "POST" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const body = (await response.json()) as PostResult;
      setPostResult(body);
      setPostStatus("posted");
    } catch (postAllError: unknown) {
      setPostError(postAllError instanceof Error ? postAllError.message : String(postAllError));
      setPostStatus("failed");
    }
  }

  const postLabel =
    postStatus === "posting"
      ? "Posting..."
      : postStatus === "posted"
        ? "Posted"
        : "Post comments to GitHub";

  return (
    <section className="handoff-panel">
      <h2>Agent handoff</h2>
      <button disabled={postStatus === "posting"} onClick={postComments} type="button">
        {postLabel}
      </button>
      {postError ? <p className="comment-error">{postError}</p> : null}
      {postResult ? (
        <p className="post-summary">
          Posted {postResult.posted}, failed {postResult.failed}, skipped {postResult.skipped}
        </p>
      ) : null}
      {postResult?.results.filter((r) => r.status === "failed").length ? (
        <ul className="post-failures">
          {postResult.results
            .filter((r) => r.status === "failed")
            .map((r) => (
              <li key={r.id}>
                {r.id}: {r.error ?? "unknown error"}
              </li>
            ))}
        </ul>
      ) : null}
      <button disabled={status === "loading"} onClick={loadPrompt} type="button">
        {status === "loading" ? "Generating..." : "Generate agent fix prompt"}
      </button>
      {error ? <p className="comment-error">{error}</p> : null}
      {prompt ? (
        <>
          <label className="composer-label" htmlFor={promptId}>
            Agent fix prompt
          </label>
          <textarea id={promptId} readOnly value={prompt} />
        </>
      ) : null}
    </section>
  );
}
