import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth";
import { EXTRACT_LIMIT, rateLimit, tooManyRequests } from "@/lib/rate-limit";

const MAX_BYTES = 4 * 1024 * 1024;
const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
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

// Returns suggested questions only. The parent must confirm the answer key
// before anything is assigned to a kid.
export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return Response.json({ error: "sign in required" }, { status: 401 });
  const rl = await rateLimit(`extract:${user.id}`, EXTRACT_LIMIT);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);
  const form = await request.formData();
  const file = form.get("image");
  if (!(file instanceof File)) {
    return Response.json({ error: "image is required" }, { status: 400 });
  }
  if (!MEDIA_TYPES.includes(file.type as MediaType)) {
    return Response.json({ error: "unsupported image type" }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "image too large" }, { status: 413 });
  }

  const grade = String(form.get("grade") ?? "");
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
          {
            type: "image",
            source: { type: "base64", media_type: file.type as MediaType, data },
          },
          {
            type: "text",
            text: `This is a photo of a school homework sheet${grade ? ` for grade ${grade}` : ""}. Extract every question as a self-contained item, and give your best answer for each as suggestedAnswer. Use "multiple_choice" with options when choices are printed, "numeric" for number answers (digits only), otherwise "short_text". Skip anything you cannot read rather than guessing.`,
          },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    return Response.json({ error: "could not process image" }, { status: 422 });
  }
  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    return Response.json({ error: "empty response" }, { status: 502 });
  }
  const parsed = Extracted.safeParse(JSON.parse(block.text));
  if (!parsed.success) {
    return Response.json({ error: "invalid model output" }, { status: 502 });
  }
  return Response.json(parsed.data);
}
