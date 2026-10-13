"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { neonAuth } from "@/lib/neon-auth";

type State = { error: string } | null;

const Credentials = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

export async function signIn(_prev: State, form: FormData): Promise<State> {
  const parsed = Credentials.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { error } = await neonAuth.signIn.email(parsed.data);
  if (error) return { error: error.message || "Wrong email or password" };
  redirect("/dashboard");
}

export async function signUp(_prev: State, form: FormData): Promise<State> {
  const parsed = Credentials.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const name = String(form.get("name") ?? "").trim() || parsed.data.email.split("@")[0];

  const { error } = await neonAuth.signUp.email({ ...parsed.data, name });
  if (error) return { error: error.message || "Could not create the account" };
  redirect("/dashboard");
}

export async function signOut() {
  await neonAuth.signOut();
  redirect("/login");
}
