import { redirect } from "next/navigation";

import { DEFAULT_LOCALE, getLocalePath } from "@/i18n/config";

export default function RootPage() {
  redirect(getLocalePath(DEFAULT_LOCALE));
}
