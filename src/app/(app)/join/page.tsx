import type { Metadata } from "next";
import { JoinForm } from "./JoinForm";

export const metadata: Metadata = {
  title: "Join a war room",
  description: "Enter a six-character code and your callsign.",
  alternates: { canonical: "/join" },
  openGraph: {
    title: "Join a war room",
    description: "Enter a six-character code and your callsign.",
    url: "/join",
  },
};

export default function JoinPage() {
  return <JoinForm />;
}
