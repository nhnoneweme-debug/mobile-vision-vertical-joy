import { createFileRoute } from "@tanstack/react-router";
import { DumpChat } from "@/components/dump/DumpChat";

export const Route = createFileRoute("/_authenticated/despertar")({
  head: () => ({ meta: [{ title: "Despertar — Weme" }] }),
  component: () => <DumpChat mode="morning" />,
});
