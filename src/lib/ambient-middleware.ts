// Middleware global de contexto ambiental: anexa hora local, fuso, localização
// autorizada e âncoras da sessão a TODA chamada de server function, para que
// nenhuma resposta de IA fique sem noção de tempo e lugar.
import { createMiddleware } from "@tanstack/react-start";

import { clientMomentHeaders } from "@/lib/client-moment";

export const attachClientMoment = createMiddleware({ type: "function" }).client(
  async ({ next }) => next({ headers: clientMomentHeaders() }),
);
