import { modelMetadata, ModelView } from "@/views/model";

export const metadata = modelMetadata("en");

export default function Page() {
  return <ModelView lang="en" />;
}
