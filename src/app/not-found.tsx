import Link from "next/link";
import { getT } from "@/lib/i18n/server";

export default async function NotFound() {
  const { t } = await getT();
  return (
    <main className="mx-auto flex min-h-[60dvh] max-w-md flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold">{t.errors.notFoundTitle}</h1>
      <p className="mt-2 text-sm text-muted">{t.errors.notFoundBody}</p>
      <Link href="/" className="mt-6 text-sm text-accent hover:underline">
        {t.errors.backToDashboard}
      </Link>
    </main>
  );
}
