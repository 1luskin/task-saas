import { requireBossPage } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { PageTitle } from "@/components/ui";
import { ImportClient } from "./import-client";

export default async function ImportPage() {
  await requireBossPage();
  const { t } = await getI18n();
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle>{t("imp.title")}</PageTitle>
      <ImportClient />
    </div>
  );
}
