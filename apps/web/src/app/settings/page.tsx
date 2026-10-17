import { Suspense } from "react";
import { and, eq, isNotNull } from "drizzle-orm";
import { getDb } from "@/db";
import { parentDevices } from "@/db/schema";
import { InstallApp } from "@/components/InstallApp";
import { PageLoading, ParentShell } from "@/components/ParentShell";
import { btn, Card, CardHeader, field, PageHeader } from "@/components/ui";
import { requireParent } from "@/lib/auth";
import { AlertsCard } from "../dashboard/AlertsCard";
import { ChangePasswordForm } from "../dashboard/ChangePasswordForm";
import { ParentAppCard } from "../dashboard/ParentAppCard";
import { setParentPin } from "../dashboard/actions";

async function Settings() {
  const parent = await requireParent();
  const parentPhones = await getDb()
    .select({ id: parentDevices.id, name: parentDevices.name, lastSeenAt: parentDevices.lastSeenAt })
    .from(parentDevices)
    .where(and(eq(parentDevices.parentId, parent.id), isNotNull(parentDevices.tokenHash)));

  return (
    <ParentShell width="max-w-3xl">
      <PageHeader title="Settings" subtitle="Alerts, your PIN, the apps and your account." />
      <div className="space-y-6">
        <AlertsCard />

        <Card>
          <CardHeader
            icon="🔒"
            title="Parent PIN"
            description={
              <>
                A 6-digit PIN you type on a kid&apos;s phone to open Settings or uninstall the app.{" "}
                {parent.approvalPinHash ? "A PIN is set. Enter a new one to change it." : "No PIN is set yet."}
              </>
            }
          />
          <form action={setParentPin} className="flex flex-wrap items-center gap-3">
            <input
              name="pin"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              required
              placeholder="6 digits"
              autoComplete="off"
              aria-label="New parent PIN"
              className={`${field} !mt-0 w-40`}
            />
            <button className={btn.secondary}>{parent.approvalPinHash ? "Change PIN" : "Set PIN"}</button>
          </form>
        </Card>

        <ParentAppCard phones={parentPhones} />
        <InstallApp />

        <Card>
          <CardHeader
            icon="🌐"
            title="Web apps"
            description="Both work in a browser (iPhone and tablets too) and can be added to the home screen as apps. The kid page cannot lock the phone: only the Android kid app does that."
          />
          <ul className="space-y-2 text-sm">
            <li>
              Parent:{" "}
              <a className={btn.link} href="/dashboard">
                study-plan-savin.vercel.app/dashboard
              </a>
            </li>
            <li>
              Kid:{" "}
              <a className={btn.link} href="/kid">
                study-plan-savin.vercel.app/kid
              </a>
            </li>
          </ul>
        </Card>

        <Card>
          <CardHeader
            icon="👤"
            title="Account"
            description={parent.email ? `Signed in as ${parent.email}.` : "Change the password you use to sign in."}
          />
          <ChangePasswordForm />
        </Card>
      </div>
    </ParentShell>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Settings />
    </Suspense>
  );
}
