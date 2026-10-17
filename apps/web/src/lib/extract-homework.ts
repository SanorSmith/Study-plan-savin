import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { fileBlock } from "@/lib/paper-grading";

const MAX_BYTES = 4 * 1024 * 1024;
const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
type MediaType = (typeof MEDIA_TYPES)[number];

const Extracted = z.object({
  questions: z.array(
    z.object({
      text: z.string(),
      type: z.enum(["multiple_choice", "numeric", "short_text"]),
      options: z.array(z.string()).nullable(),
      suggestedAnswer: z.string(),
    }),
  ),
});

const schema = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          type: { type: "string", enum: ["multiple_choice", "numeric", "short_text"] },
          options: { type: ["array", "null"], items: { type: "string" } },
          suggestedAnswer: { type: "string" },
        },
        required: ["text", "type", "options", "suggestedAnswer"],
        additionalProperties: false,
      },
    },
  },
  required: ["questions"],
  additionalProperties: false,
};

export class ExtractError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Reads a photo of a homework sheet and returns suggested questions with a suggested answer each.
 * Only suggestions: a parent must confirm the answer key before anything is assigned to a kid.
 */
export async function extractQuestions(file: File, grade: string) {
  if (!MEDIA_TYPES.includes(file.type as MediaType)) throw new ExtractError(415, "Use a JPEG, PNG or WebP photo, or a PDF");
  if (file.size > MAX_BYTES) throw new ExtractError(413, "The file is too large (4 MB at most)");

  const data = Buffer.from(await file.arrayBuffer()).toString("base64");
  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-sonnet-5-5",
    max_tokens: 8000,
    output_config: { effort: "medium", format: { type: "json_schema", schema } },
    messages: [
      {
        role: "user",
        content: [
          fileBlock({ mediaType: file.type as MediaType, base64: data }),
          {
            type: "text",
            text: `This is a photo or PDF of a school homework sheet${grade ? ` for grade ${grade}` : ""}. Extract every question as a self-contained item, and give your best answer for each as suggestedAnswer. Use "multiple_choice" with options when choices are printed, "numeric" for number answers (digits only), otherwise "short_text". Skip anything you cannot read rather than guessing.`,
          },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal") throw new ExtractError(422, "could not process image");
  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new ExtractError(502, "empty response");
  const parsed = Extracted.safeParse(JSON.parse(block.text));
  if (!parsed.success) throw new ExtractError(502, "invalid model output");
  return parsed.data;
}
