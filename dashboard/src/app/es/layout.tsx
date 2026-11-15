import { SiteLayout, siteMetadata } from "@/views/site-layout";

export const metadata = siteMetadata("es");

export default function Layout({ children }: LayoutProps<"/es">) {
  return <SiteLayout lang="es">{children}</SiteLayout>;
}
