import { useId, useState } from "react";

export function HandoffPanel() {
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);
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

  return (
    <section className="handoff-panel">
      <h2>Agent handoff</h2>
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

