import type { Metadata } from "next";
import { DashboardLoader } from "@/components/admin/dashboard-loader";

export const metadata: Metadata = {
  title: "History · Dashboard demo",
  description: "Run a Wardogs server from one dashboard. An early build, open to anyone.",
  robots: { index: false, follow: false },
};

export default function HistoryPage() {
  return (
    <>
      <h1 className="sr-only">History · Dashboard demo</h1>
      <DashboardLoader panel="history" />
    </>
  );
}
