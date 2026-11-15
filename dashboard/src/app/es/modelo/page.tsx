import { modelMetadata, ModelView } from "@/views/model";

export const metadata = modelMetadata("es");

export default function Page() {
  return <ModelView lang="es" />;
}
