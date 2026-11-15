import { licensesMetadata, LicensesView } from "@/views/licenses";

export const metadata = licensesMetadata("en");

export default function Page() {
  return <LicensesView lang="en" />;
}
