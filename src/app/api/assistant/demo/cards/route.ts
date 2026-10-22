import { assertSimulationAllowed, handle, json } from "@/server/http";

export const dynamic = "force-dynamic";

/**
 * GET /api/assistant/demo/cards — the documented development card fixtures (from
 * `npm run db:seed`), offered as one-tap options on the demo page. These are public
 * test fixtures, never real student cards; the endpoint is simulation-gated.
 */
export async function GET() {
  return handle(async () => {
    assertSimulationAllowed();
    return json({
      simulated: true,
      note: "Development fixtures created by `npm run db:seed`. Not real cards.",
      cards: [
        { cardUid: "04A1B2C3D4E5F6", label: "Mariam Hassan — active card", expected: "identified" },
        { cardUid: "04A1B2C3D4E5F7", label: "Omar Khaled — active card", expected: "identified" },
        { cardUid: "04A1B2C3D4E5F9", label: "Youssef Adel — revoked card", expected: "rejected" },
        { cardUid: "00000000DEAD00", label: "Unknown card", expected: "unknown" },
      ],
    });
  });
}
