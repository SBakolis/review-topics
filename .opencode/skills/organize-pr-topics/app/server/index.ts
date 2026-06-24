import Fastify, { type FastifyServerOptions } from "fastify";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { ZodError } from "zod";
import {
  ReviewCommentSchema,
  type ReviewComment,
  type ReviewSession,
} from "../shared/schema";
import { SessionStore } from "./session";

export interface ReviewSessionStore {
  get(): ReviewSession;
  addComment(comment: ReviewComment): Promise<ReviewComment>;
}

export function buildServer(
  store: ReviewSessionStore,
  options: FastifyServerOptions = {},
) {
  const app = Fastify(options);

  app.get("/api/session", async () => store.get());

  app.post("/api/comments", async (request, reply) => {
    try {
      const body =
        request.body && typeof request.body === "object" ? request.body : {};
      const comment = ReviewCommentSchema.parse({
        ...body,
        id: randomUUID(),
        postingStatus: "draft",
      });

      return store.addComment(comment);
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.status(400).send({
          error: "Invalid comment payload",
          details: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        });
      }

      throw error;
    }
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

  return app;
}

export async function startServer() {
  const sessionPath = process.env.PR_TOPIC_SESSION_PATH;

  if (!sessionPath) {
    throw new Error("PR_TOPIC_SESSION_PATH is required.");
  }

  const store = new SessionStore(sessionPath);
  await store.load();

  const app = buildServer(store, { logger: true });
  const port = Number(process.env.PORT ?? 4173);
  await app.listen({ port, host: "127.0.0.1" });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
