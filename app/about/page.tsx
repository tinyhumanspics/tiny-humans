import type { Metadata } from "next";
import en from "@/messages/en.json";
import AboutPage from "@/features/about/AboutPage";

export const metadata: Metadata = {
  title: en.about.meta.title,
  description: en.about.meta.description,
  alternates: { canonical: "/about" },
};

export default function Page() {
  return <AboutPage />;
}
