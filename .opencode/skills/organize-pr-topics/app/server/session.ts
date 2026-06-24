import { readFile, writeFile } from "node:fs/promises";
import {
  ReviewCommentSchema,
  ReviewSessionSchema,
  type ReviewComment,
  type ReviewSession,
} from "../shared/schema";

export class SessionStore {
  private session: ReviewSession | undefined;

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
    const session = this.get();
    session.comments.push(validComment);
    await writeFile(this.path, JSON.stringify(session, null, 2));
    return validComment;
  }
}
