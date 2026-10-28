import { z } from 'zod'

/** F038 workstation export contract, schema v1. Unknown schema versions are rejected. */

const slug = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{0,79}$/)
  .nullable()
const sha256 = z.string().regex(/^[0-9a-f]{64}$/)

// Relative media paths only: no leading slash, no "..", no backslashes, raster images only.
export const mediaPath = z
  .string()
  .max(255)
  .regex(/^[A-Za-z0-9][A-Za-z0-9/_.-]*\.(png|jpe?g|webp)$/i)
  .refine((value) => !value.split('/').includes('..') && !value.includes('//'), {
    message: 'Media paths cannot leave the media folder.',
  })

const asset = z.object({
  role: z.enum(['figure', 'option', 'source_page']),
  path: mediaPath,
  sha256,
  width: z.number().int().min(1).max(20000).nullable().optional(),
  height: z.number().int().min(1).max(20000).nullable().optional(),
  // Workstation crop review: only an approved figure may be served.
  review: z.enum(['approved', 'pending', 'rejected']).optional(),
})

const option = z.object({
  key: z.string().regex(/^[A-F1-6]$/),
  text: z.string().max(4000),
  asset: z.number().int().min(0).max(50).nullable().optional(),
})

export const exportQuestion = z.object({
  externalKey: z.string().regex(/^[a-z0-9][a-z0-9-]{0,119}$/),
  type: z.enum(['NAT', 'MSQ', 'MCQ', 'DESCRIPTIVE']),
  prompt: z.string().max(20000),
  options: z.array(option).max(6).default([]),
  assets: z.array(asset).max(20).default([]),
  answer: z
    .object({
      raw: z.string().max(200).nullable(),
      status: z.string().max(60),
      verification: z.enum(['second-pass-reproduced']).nullable().optional(),
    })
    .nullable(),
  explanation: z.string().max(20000).nullable().optional(),
  topic: slug.optional(),
  subtopic: slug.optional(),
  difficulty: z.enum(['easy', 'medium', 'hard', 'unassessed']).default('unassessed'),
  estimatedSeconds: z.number().int().min(1).max(3600).nullable().optional(),
  visualDependency: z.boolean().default(false),
  // D-060: 'block' shows the exact printed crop (the first figure) instead of the text.
  display: z.enum(['text', 'block']).default('text'),
  // Marks for a drawing task when the paper sets them (NID DAT tasks differ).
  taskMarks: z.number().min(0.5).max(200).nullable().optional(),
  licence: z.string().min(1).max(80),
  sourceKind: z.enum(['official', 'owner_authorized', 'original']),
  // Workstation-side reasons the question cannot be served yet (for example a crop awaiting review).
  holds: z
    .array(z.string().regex(/^[a-z0-9-]{1,60}$/))
    .max(20)
    .default([]),
  provenance: z.object({
    exam: z.string().regex(/^[a-z0-9-]{1,40}$/),
    year: z.number().int().min(1990).max(2100).nullable(),
    paperId: z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/),
    questionNo: z.string().max(20).nullable(),
    page: z.number().int().min(0).max(1000).nullable().optional(),
    sourceSha256: sha256.nullable().optional(),
    extraction: z.string().max(60).nullable().optional(),
    ocr: z.boolean().optional(),
    answerKeySource: z.string().max(200).nullable().optional(),
    verification: z.string().max(60).nullable().optional(),
  }),
})

export const bankExport = z.object({
  schemaVersion: z.literal(1),
  exportedAt: z.string().datetime({ offset: true }),
  questions: z.array(exportQuestion).max(20000),
})

export type BankExport = z.infer<typeof bankExport>
export type ExportQuestion = z.infer<typeof exportQuestion>
