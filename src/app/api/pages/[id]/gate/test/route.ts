import { z } from "zod";
import { json, parseBody, route } from "@/lib/api";
import { checkGateAnswer } from "@/lib/pages/gate";
import { requireEditablePage } from "@/lib/pages/access";
import { pageView } from "@/lib/pages/service";

type Ctx = { params: Promise<{ id: string }> };

/** Permite testar a resposta no preview do editor. */
export const POST = route(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const page = await requireEditablePage(id);
  const { answer } = await parseBody(req, z.object({ answer: z.string().max(200) }));
  const { content } = pageView(page);
  const ok = await checkGateAnswer(page.gateHashes, content.gate.mode, answer);
  return json({ ok });
});
