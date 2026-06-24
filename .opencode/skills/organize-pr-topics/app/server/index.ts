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
  await registerUiHandler(app);

  const port = Number(process.env.PORT ?? 4173);
  await app.listen({ port, host: "127.0.0.1" });
}

async function registerUiHandler(app: ReturnType<typeof buildServer>) {
  const isDev = process.env.NODE_ENV !== "production";

  if (isDev) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      root: new URL("../ui", import.meta.url).pathname,
      server: { middlewareMode: true },
    });

    app.get("/*", async (request, reply) => {
      if (request.url.startsWith("/api/")) {
        return reply.status(404).send({ error: "Not found" });
      }
      reply.hijack();
      vite.middlewares(request.raw, reply.raw, () => {
        if (!reply.raw.headersSent) {
          reply.raw.statusCode = 404;
          reply.raw.end("Not found");
        }
      });
    });
    return;
  }

  const fastifyStatic = await import("@fastify/static");
  const { resolve } = await import("node:path");
  await app.register(fastifyStatic.default, {
    root: resolve(new URL("../..", import.meta.url).pathname, "dist/ui"),
    prefix: "/",
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
