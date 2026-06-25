import { readFile, writeFile } from "node:fs/promises";
import {
  ReviewCommentSchema,
  ReviewSessionSchema,
  type ReviewComment,
  type ReviewSession,
} from "../shared/schema";

export class SessionStore {
  private session: ReviewSession | undefined;
  private writeQueue = Promise.resolve();

  constructor(private readonly path: string) {}

  async load() {
    const raw = await readFile(this.path, "utf8");
    this.session = ReviewSessionSchema.parse(JSON.parse(raw));
    return this.session;
  }

  get() {
    if (!this.session) {
      throw new Error("Session has not been loaded.");
    }

    return this.session;
  }

  async addComment(comment: ReviewComment) {
    const validComment = ReviewCommentSchema.parse(comment);
    const operation = this.writeQueue.then(async () => {
      const session = this.get();
      session.comments.push(validComment);
      await writeFile(this.path, JSON.stringify(session, null, 2));
      return validComment;
    });

    this.writeQueue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  async updateComment(id: string, updates: Partial<ReviewComment>) {
    const operation = this.writeQueue.then(async () => {
      const session = this.get();
      const index = session.comments.findIndex((comment) => comment.id === id);
      if (index === -1) {
        throw new Error(`Comment not found: ${id}`);
      }
      const merged = ReviewCommentSchema.parse({
        ...session.comments[index],
        ...updates,
      });
      session.comments[index] = merged;
      await writeFile(this.path, JSON.stringify(session, null, 2));
      return merged;
    });

    this.writeQueue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  async setFileViewed(path: string, viewed: boolean) {
    const operation = this.writeQueue.then(async () => {
      const session = this.get();
      const set = new Set(session.viewedFiles);
      if (viewed) {
        set.add(path);
      } else {
        set.delete(path);
      }
      session.viewedFiles = [...set];
      await writeFile(this.path, JSON.stringify(session, null, 2));
      return session;
    });

    this.writeQueue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  async setFileCollapsed(path: string, collapsed: boolean) {
    const operation = this.writeQueue.then(async () => {
      const session = this.get();
      const set = new Set(session.collapsedFiles);
      if (collapsed) {
        set.add(path);
      } else {
        set.delete(path);
      }
      session.collapsedFiles = [...set];
      await writeFile(this.path, JSON.stringify(session, null, 2));
      return session;
    });

    this.writeQueue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  async syncViewedFilesFromGithub(viewedPaths: string[]) {
    const operation = this.writeQueue.then(async () => {
      const session = this.get();
      const set = new Set(session.viewedFiles);
      for (const path of viewedPaths) {
        set.add(path);
      }
      session.viewedFiles = [...set];
      await writeFile(this.path, JSON.stringify(session, null, 2));
      return session;
    });

    this.writeQueue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }
}
