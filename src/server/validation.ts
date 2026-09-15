import { z } from "zod";
export const termSchema = z
  .object({
    year: z.number().int().min(2000).max(2100),
    season: z.string().min(1).max(30),
  })
  .strict();
export const preferencesSchema = z
  .object({
    start: termSchema,
    target: termSchema.optional(),
    minCredits: z.number().int().min(1).max(30),
    maxCredits: z.number().int().min(1).max(30),
    includeSummer: z.boolean(),
    workload: z.enum(["balanced", "fastest", "light"]),
    unavailable: z.array(z.string().max(30)).max(300),
  })
  .strict()
  .refine(
    (v) => v.minCredits <= v.maxCredits,
    "Minimum credits cannot exceed maximum",
  );
export const studentCourseSchema = z
  .object({
    courseId: z.string().max(30),
    status: z.enum(["COMPLETED", "IN_PROGRESS", "PLANNED"]),
    grade: z.number().min(0).max(4).optional(),
    credits: z.number().positive().max(30).optional(),
    term: termSchema.optional(),
  })
  .strict()
  .refine(
    (c) => c.status !== "IN_PROGRESS" || c.term !== undefined,
    "In-progress courses need a term",
  );
export const stateSchema = z
  .object({
    programCatalogId: z.string().max(100),
    courses: z.array(studentCourseSchema).max(300),
    preferences: preferencesSchema,
    programs: z.array(z.string().max(100)).max(10),
  })
  .strict()
  .refine(
    (s) => new Set(s.courses.map((c) => c.courseId)).size === s.courses.length,
    "Duplicate course",
  );
export const registerSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((v) => v.toLowerCase()),
    password: z.string().min(12).max(128),
  })
  .strict();
export const credentialsSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .transform((v) => v.toLowerCase()),
  password: z.string().min(1).max(128),
});
export type StudentState = z.infer<typeof stateSchema>;
