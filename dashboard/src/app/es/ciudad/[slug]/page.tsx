import { cityMetadata, cityStaticParams, CityView } from "@/views/city";

type Props = PageProps<"/es/ciudad/[slug]">;

export function generateStaticParams() {
  return cityStaticParams();
}

export function generateMetadata({ params }: Props) {
  return cityMetadata("es", params);
}

export default function Page({ params }: Props) {
  return <CityView lang="es" params={params} />;
}
