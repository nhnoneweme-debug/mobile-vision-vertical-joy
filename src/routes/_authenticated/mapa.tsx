import { createFileRoute, redirect } from "@tanstack/react-router";

// A antiga home ("Mapa") foi substituída pela nova /home.
// Mantemos /mapa apenas como redirect para não quebrar links antigos.
// O código do layout antigo está preservado em src/_legacy/MapaLegacy.tsx.
export const Route = createFileRoute("/_authenticated/mapa")({
  beforeLoad: () => {
    throw redirect({ to: "/home", replace: true });
  },
});
