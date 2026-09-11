import type { Metadata } from "next";
import { DashboardLoader } from "@/components/admin/dashboard-loader";

export const metadata: Metadata = {
  title: "Audit · Dashboard demo",
  description: "Run a Wardogs server from one dashboard. An early build, open to anyone.",
  robots: { index: false, follow: false },
};

export default function AuditPage() {
  return (
    <>
      <h1 className="sr-only">Audit · Dashboard demo</h1>
      <DashboardLoader panel="audit" />
    </>
  );
}
