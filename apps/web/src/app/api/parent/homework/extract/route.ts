import { ExtractError, extractQuestions } from "@/lib/extract-homework";
import { getParentApp } from "@/lib/parent-device";
import { EXTRACT_LIMIT, rateLimit, tooManyRequests } from "@/lib/rate-limit";

/** The parent app sends a photo of a worksheet and gets suggested questions back. Nothing is assigned yet. */
export async function POST(request: Request) {
  const parent = await getParentApp();
  if (!parent) return Response.json({ error: "sign in required" }, { status: 401 });
  const rl = await rateLimit(`extract:${parent.authUserId}`, EXTRACT_LIMIT);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);
  const form = await request.formData().catch(() => null);
  const file = form?.get("image");
  if (!form || !(file instanceof File)) return Response.json({ error: "image is required" }, { status: 400 });
  try {
    return Response.json(await extractQuestions(file, String(form.get("grade") ?? "")));
  } catch (e) {
    if (e instanceof ExtractError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
