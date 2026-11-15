import { SiteLayout, siteMetadata } from "@/views/site-layout";

export const metadata = siteMetadata("en");

export default function Layout({ children }: LayoutProps<"/en">) {
  return <SiteLayout lang="en">{children}</SiteLayout>;
}
