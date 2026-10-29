import { PolicyVersionPage } from "@/components/policy-version-page";
import { getCurrentUser } from "@/lib/auth";

export const metadata = { title: "개인정보처리방침" };

export default async function PrivacyPage({ searchParams }: { searchParams: Promise<{ version?: string }> }) {
  const [user, { version }] = await Promise.all([getCurrentUser(), searchParams]);
  return <PolicyVersionPage kind="privacy" user={user} requested={version} />;
}
