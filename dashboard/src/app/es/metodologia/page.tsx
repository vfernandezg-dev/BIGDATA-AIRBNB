import { methodologyMetadata, MethodologyView } from "@/views/methodology";

export const metadata = methodologyMetadata("es");

export default function Page() {
  return <MethodologyView lang="es" />;
}
