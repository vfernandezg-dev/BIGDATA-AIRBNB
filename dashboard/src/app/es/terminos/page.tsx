import { termsMetadata, TermsView } from "@/views/terms";

export const metadata = termsMetadata("es");

export default function Page() {
  return <TermsView lang="es" />;
}
