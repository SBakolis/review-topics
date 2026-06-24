import type { ReviewSession, ReviewTopic } from "../../shared/schema";
import { CommentComposer } from "./CommentComposer";

type Props = {
  session: ReviewSession;
  topic: ReviewTopic;
};

function extractFileDiff(diff: string, filePath: string): string {
  const marker = `diff --git a/${filePath} b/${filePath}`;
  const startIndex = diff.indexOf(marker);
  if (startIndex === -1) {
    return "";
  }

  const nextDiffIndex = diff.indexOf("diff --git", startIndex + marker.length);
  const endIndex = nextDiffIndex === -1 ? diff.length : nextDiffIndex;
  return diff.slice(startIndex, endIndex).trimEnd();
}

export function DiffReview({ session, topic }: Props) {
  return (
    <div className="diff-review">
      {topic.files.map((file) => {
        const fileDiff = extractFileDiff(session.diff, file);
        return (
          <section className="file-card" key={file}>
            <header className="file-card-header">{file}</header>
            {fileDiff ? (
              <pre className="file-diff">{fileDiff}</pre>
            ) : (
              <p className="file-diff-empty">No diff available for {file}.</p>
            )}
            <CommentComposer topicId={topic.id} path={file} />
          </section>
        );
      })}
    </div>
  );
}
