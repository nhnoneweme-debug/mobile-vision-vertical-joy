import { createFileRoute } from "@tanstack/react-router";
import { DumpChat } from "@/components/dump/DumpChat";

export const Route = createFileRoute("/_authenticated/dormir")({
  head: () => ({ meta: [{ title: "Dormir — Personal IA" }] }),
  component: () => <DumpChat mode="night" />,
});
