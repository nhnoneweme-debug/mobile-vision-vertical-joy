import { createFileRoute, notFound } from "@tanstack/react-router";
import { MobileShell } from "@/components/shell/MobileShell";
import { AreaPlaceholder } from "@/components/placeholders/AreaPlaceholder";
import { getArea } from "@/components/map/areas";

export const Route = createFileRoute("/_authenticated/area/$slug")({
  head: ({ params }) => {
    const area = getArea(params.slug);
    return {
      meta: [
        { title: `${area?.name ?? "Área"} — Personal IA` },
        { name: "description", content: area?.description ?? "Área do mundo Personal IA." },
      ],
    };
  },
  loader: ({ params }) => {
    const area = getArea(params.slug);
    if (!area) throw notFound();
    return { area };
  },
  component: AreaPage,
});

function AreaPage() {
  const { area } = Route.useLoaderData();
  return (
    <MobileShell>
      <AreaPlaceholder area={area} />
    </MobileShell>
  );
}
