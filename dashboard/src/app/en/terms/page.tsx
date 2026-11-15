import { termsMetadata, TermsView } from "@/views/terms";

export const metadata = termsMetadata("en");

export default function Page() {
  return <TermsView lang="en" />;
}
