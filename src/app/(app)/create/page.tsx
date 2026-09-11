import type { Metadata } from "next";
import { CreateForm } from "./CreateForm";

export const metadata: Metadata = {
  title: "Open a war room",
  description: "Pick your team, map and control zone. Open a shared war room in one click.",
  alternates: { canonical: "/create" },
  openGraph: {
    title: "Open a war room",
    description: "Pick your team, map and control zone. Open a shared war room in one click.",
    url: "/create",
  },
};

export default function CreatePage() {
  return <CreateForm />;
}
