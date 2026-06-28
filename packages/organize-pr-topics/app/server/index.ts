import Fastify, { type FastifyServerOptions } from "fastify";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ZodError } from "zod";
import {
  ReviewCommentSchema,
  type ReviewComment,
  type ReviewSession,
} from "../shared/schema";
import { SessionStore } from "./session";
import {
  buildTopicCommentBody,
  postInlineComment,
  postPrLevelComment,
  type InlineCommentInput,
} from "./comments";

const FALLBACK_HANDOFF_PROMPT = `Please fix the review comments posted for {PR_URL}.\n\n{COMMENTS}`;
const SKILL_DIR = resolve(new URL("../..", import.meta.url).pathname);

async function loadHandoffTemplate(): Promise<string | null> {
  const templatePath = resolve(SKILL_DIR, "templates/fix-comments-prompt.md");
  try {
    return await readFile(templatePath, "utf8");
  } catch {
    return null;
  }
}

async function buildHandoffPrompt(
  session: ReviewSession,
  commentsList: string,
): Promise<string> {
  const template = await loadHandoffTemplate();
  if (template) {
    return `${template}\n\nPR: ${session.pr.url}\n\n## Comments\n\n${commentsList}`;
  }
  return FALLBACK_HANDOFF_PROMPT.replace("{PR_URL}", session.pr.url).replace(
    "{COMMENTS}",
    commentsList,
  );
}

export interface ReviewSessionStore {
  get(): ReviewSession;
  addComment(comment: ReviewComment): Promise<ReviewComment>;
  updateComment(id: string, updates: Partial<ReviewComment>): Promise<ReviewComment>;
}

export interface PostingAdapters {
  postInlineComment: typeof postInlineComment;
  postPrLevelComment: typeof postPrLevelComment;
}

export class PostAllGuard {
  private inFlight = false;

  tryAcquire(): boolean {
    if (this.inFlight) {
      return false;
    }
    this.inFlight = true;
    return true;
  }

  release(): void {
    this.inFlight = false;
  }

  get isLocked(): boolean {
    return this.inFlight;
  }
}

export function buildServer(
  store: ReviewSessionStore,
  options: FastifyServerOptions = {},
  adapters: PostingAdapters = { postInlineComment, postPrLevelComment },
  guard: PostAllGuard = new PostAllGuard(),
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

  app.post("/api/comments/post-all", async (_request, reply) => {
    if (!guard.tryAcquire()) {
      return reply.status(409).send({ error: "post-all already in progress" });
    }

    try {
      const session = store.get();
      const { pr, topics } = session;
      const topicById = new Map(topics.map((topic) => [topic.id, topic]));

      const results: Array<{
        id: string;
        status: "posted" | "failed" | "skipped";
        githubUrl?: string;
        error?: string;
      }> = [];
      let posted = 0;
      let failed = 0;
      let skipped = 0;

      for (const comment of session.comments) {
        if (comment.postingStatus === "posted" || comment.postingStatus === "failed") {
          skipped += 1;
          results.push({ id: comment.id, status: "skipped" });
          continue;
        }

        try {
          let githubUrl: string | undefined;

          if (comment.path && comment.line && comment.side) {
            const commitId = comment.side === "LEFT" ? pr.baseSha : pr.headSha;
            const inlinePayload: InlineCommentInput = {
              body: comment.body,
              commitId,
              path: comment.path,
              line: comment.line,
              side: comment.side,
            };
            const response = await adapters.postInlineComment(
              pr.owner,
              pr.repo,
              pr.number,
              inlinePayload,
            );
            githubUrl = response.html_url;
          } else {
            const topic = comment.topicId ? topicById.get(comment.topicId) : undefined;
            const body = topic
              ? buildTopicCommentBody(topic.title, comment.body)
              : comment.body;
            const response = await adapters.postPrLevelComment(
              pr.owner,
              pr.repo,
              pr.number,
              body,
            );
            githubUrl = response.html_url;
          }

          await store.updateComment(comment.id, {
            postingStatus: "posted",
            githubUrl,
            error: undefined,
          });
          posted += 1;
          results.push({ id: comment.id, status: "posted", githubUrl });
        } catch (postError: unknown) {
          const message = postError instanceof Error ? postError.message : String(postError);
          await store.updateComment(comment.id, {
            postingStatus: "failed",
            error: message,
          });
          failed += 1;
          results.push({ id: comment.id, status: "failed", error: message });
        }
      }

      return { posted, failed, skipped, results };
    } finally {
      guard.release();
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

    const prompt = await buildHandoffPrompt(session, comments);

    return { prompt };
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
    root: resolve(new URL("../..", import.meta.url).pathname, "dist/client"),
    prefix: "/",
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
