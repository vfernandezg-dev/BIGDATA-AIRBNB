import { licensesMetadata, LicensesView } from "@/views/licenses";

export const metadata = licensesMetadata("es");

export default function Page() {
  return <LicensesView lang="es" />;
}
