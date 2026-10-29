import { PolicyVersionPage } from "@/components/policy-version-page";
import { getCurrentUser } from "@/lib/auth";

export const metadata = { title: "이용약관" };

export default async function TermsPage({ searchParams }: { searchParams: Promise<{ version?: string }> }) {
  const [user, { version }] = await Promise.all([getCurrentUser(), searchParams]);
  return <PolicyVersionPage kind="terms" user={user} requested={version} />;
}
