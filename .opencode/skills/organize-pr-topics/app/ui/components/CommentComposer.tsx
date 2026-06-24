import { useState } from "react";

type Props = {
  topicId: string;
  path?: string;
  line?: number;
  side?: "LEFT" | "RIGHT";
};

type SaveStatus = "idle" | "saving" | "saved" | "failed";

export function CommentComposer({ topicId, path, line, side }: Props) {
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setStatus("saving");
    setError(null);
    try {
      const response = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicId,
          body,
          path,
          line,
          side,
          kind: path ? "inline" : "topic",
        }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      setBody("");
      setStatus("saved");
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
      setStatus("failed");
    }
  }

  const disabled = !body.trim() || status === "saving";
  const buttonLabel =
    status === "saving" ? "Saving..." : status === "saved" ? "Saved" : "Save comment";

  return (
    <div className="comment-composer">
      <textarea
        value={body}
        onChange={(event) => {
          setBody(event.target.value);
          if (status === "saved" || status === "failed") {
            setStatus("idle");
          }
        }}
        placeholder="Leave a review comment"
      />
      <div className="comment-composer-actions">
        <button disabled={disabled} onClick={save} type="button">
          {buttonLabel}
        </button>
        {error ? <span className="comment-error">{error}</span> : null}
      </div>
    </div>
  );
}
