import { z } from "zod";

export const PrInfoSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  number: z.number().int().positive(),
  title: z.string().min(1),
  url: z.string().url(),
  baseRefName: z.string().min(1),
  headRefName: z.string().min(1),
  baseSha: z.string().min(1),
  headSha: z.string().min(1),
  nodeId: z.string().min(1),
});

export const PrFileSchema = z.object({
  path: z.string().min(1),
  previousPath: z.string().min(1).optional(),
  status: z.string().min(1),
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
});

export const ReviewTopicSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  rationale: z.string().min(1),
  files: z.array(z.string().min(1)).min(1),
});

export const ReviewCommentSchema = z.object({
  id: z.string().min(1),
  topicId: z.string().min(1),
  body: z.string().min(1),
  path: z.string().min(1).optional(),
  line: z.number().int().positive().optional(),
  side: z.enum(["LEFT", "RIGHT"]).optional(),
  kind: z.enum(["inline", "topic"]),
  postingStatus: z.enum(["draft", "posting", "posted", "failed"]),
  error: z.string().optional(),
  githubUrl: z.string().url().optional(),
});

export const ReviewSessionSchema = z.object({
  pr: PrInfoSchema,
  files: z.array(PrFileSchema),
  diff: z.string(),
  topics: z.array(ReviewTopicSchema).min(1),
  comments: z.array(ReviewCommentSchema),
  viewedFiles: z.array(z.string().min(1)).default([]),
  collapsedFiles: z.array(z.string().min(1)).default([]),
});

export type PrInfo = z.infer<typeof PrInfoSchema>;
export type PrFile = z.infer<typeof PrFileSchema>;
export type ReviewTopic = z.infer<typeof ReviewTopicSchema>;
export type ReviewComment = z.infer<typeof ReviewCommentSchema>;
export type ReviewSession = z.infer<typeof ReviewSessionSchema>;
