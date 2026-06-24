import Fastify from "fastify";
import { randomUUID } from "node:crypto";
import { ReviewCommentSchema } from "../shared/schema";
import { SessionStore } from "./session";

const sessionPath = process.env.PR_TOPIC_SESSION_PATH;

if (!sessionPath) {
  throw new Error("PR_TOPIC_SESSION_PATH is required.");
}

const store = new SessionStore(sessionPath);
await store.load();

const app = Fastify({ logger: true });

app.get("/api/session", async () => store.get());

app.post("/api/comments", async (request) => {
  const body =
    request.body && typeof request.body === "object" ? request.body : {};
  const comment = ReviewCommentSchema.parse({
    ...body,
    id: randomUUID(),
    postingStatus: "draft",
  });

  return store.addComment(comment);
});

app.get("/api/handoff", async () => {
  const session = store.get();
  const comments = session.comments
    .map(
      (comment) =>
        `- ${comment.path ?? "PR"}${comment.line ? `:${comment.line}` : ""}: ${comment.body}`,
    )
    .join("\n");

  return {
    prompt: `Please fix the review comments posted for ${session.pr.url}.\n\n${comments}`,
  };
});

const port = Number(process.env.PORT ?? 4173);
await app.listen({ port, host: "127.0.0.1" });
