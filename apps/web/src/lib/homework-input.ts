import { z } from "zod";

export const QuestionInput = z
  .object({
    text: z.string().trim().min(1).max(1000),
    type: z.enum(["multiple_choice", "numeric", "short_text"]),
    options: z.array(z.string().trim().min(1).max(200)).max(8).nullable(),
    answerKey: z.string().trim().min(1).max(500),
  })
  .superRefine((q, ctx) => {
    if (q.type === "multiple_choice") {
      if (!q.options || q.options.length < 2) {
        ctx.addIssue({ code: "custom", message: "Multiple choice needs at least 2 options" });
      } else if (!q.options.includes(q.answerKey)) {
        ctx.addIssue({ code: "custom", message: "Answer key must be one of the options" });
      }
    }
    if (q.type === "numeric" && !Number.isFinite(Number(q.answerKey.replace(",", ".")))) {
      ctx.addIssue({ code: "custom", message: "Answer key must be a number" });
    }
  });

export const HomeworkInput = z.object({
  subject: z.string().trim().min(1, "Subject is required").max(60),
  questions: z.array(QuestionInput).min(1, "Add at least one question").max(100),
});
