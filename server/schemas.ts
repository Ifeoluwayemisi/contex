import { z } from 'zod';

export const GemmaMetadataSchema = z.object({
  summary: z.string().min(1, "Summary is required"),
  topics: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
  documentType: z.string().default("Document"),
  distinctivePhrases: z.array(z.string()).default([]),
  dateMentions: z.array(z.string()).default([]),
  suggestedCollections: z.array(z.string()).default([]),
});

export type ValidatedGemmaMetadata = z.infer<typeof GemmaMetadataSchema>;

export const GemmaSearchExplanationSchema = z.object({
  explanation: z.string().min(1, "Explanation required"),
  keyMatchReason: z.string().default("Content matches search criteria"),
  directQuote: z.string().default(""),
});

export type ValidatedGemmaSearchExplanation = z.infer<typeof GemmaSearchExplanationSchema>;

export const GemmaRecallInterpretationSchema = z.object({
  coreConcepts: z.array(z.string()).default([]),
  uncertainAspects: z.array(z.string()).default([]),
  possiblePhrases: z.array(z.string()).default([]),
  timeClues: z.array(z.string()).default([]),
  docTypeClue: z.string().optional().default(""),
  recollectionSummary: z.string().default(""),
});

export type ValidatedGemmaRecallInterpretation = z.infer<typeof GemmaRecallInterpretationSchema>;
