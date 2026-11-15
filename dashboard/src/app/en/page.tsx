import { homeMetadata, HomeView } from "@/views/home";

export const metadata = homeMetadata("en");

export default function Page() {
  return <HomeView lang="en" />;
}
