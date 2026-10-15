import { getAuthUser } from "@/lib/auth";
import { ExtractError, extractQuestions } from "@/lib/extract-homework";
import { EXTRACT_LIMIT, rateLimit, tooManyRequests } from "@/lib/rate-limit";

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
  try {
    return Response.json(await extractQuestions(file, String(form.get("grade") ?? "")));
  } catch (e) {
    if (e instanceof ExtractError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
