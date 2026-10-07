import type { Metadata } from "next";
import en from "@/messages/en.json";
import { LANDING_PATH } from "@/config/landing";
import LandingPage from "@/features/landing/LandingPage";

export const metadata: Metadata = {
  title: { absolute: `${en.landing.meta.title} | Tiny Humans` },
  description: en.landing.meta.description,
  alternates: { canonical: LANDING_PATH },
  openGraph: { title: en.landing.meta.title, description: en.landing.meta.description, url: LANDING_PATH },
  twitter: { title: en.landing.meta.title, description: en.landing.meta.description },
};

export default function Page() {
  return <LandingPage />;
}
