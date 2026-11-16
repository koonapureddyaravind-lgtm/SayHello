import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function RootPage() {
  const store = await cookies();
  const hasSession = Boolean(store.get("of_access")?.value || store.get("of_refresh")?.value);
  redirect(hasSession ? "/dashboard" : "/login");
}
