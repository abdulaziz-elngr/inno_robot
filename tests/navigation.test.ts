import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanupTestDb, initTestDb, uid } from "./helpers/db";

// The embedded test database is shared by every describe in this file; clean it up once at the end.
afterAll(cleanupTestDb);

/**
 * Campus navigation: destinations are predefined, admin-managed rows the robot is
 * allowed to visit. Routes are human-authored step lists (PREDEFINED/ESCORT), never
 * autonomous planning. Only published + navigable locations may back a destination.
 */

describe("navigation destinations and routes", () => {
  const actorId = uid("actor");
  let locationId: string;
  let destinationId: string;

  beforeAll(async () => {
    await initTestDb();
    const { createLocation } = await import("@/server/services/locations");
    locationId = await createLocation(
      {
        key: "MAIN_LIBRARY",
        nameEn: "Main Library",
        nameAr: "المكتبة الرئيسية",
        descriptionEn: "",
        descriptionAr: "",
        directionsEn: "",
        directionsAr: "",
        buildingId: null,
        floorId: null,
        room: "A-1",
        latitude: null,
        longitude: null,
        imageUrl: "",
        accessibilityNotes: "",
        published: true,
        navigable: true,
      },
      actorId,
    );
  });

  it("creates a destination bound to a published navigable location", async () => {
    const { upsertNavigationDestination, listNavigationDestinations } = await import("@/server/services/locations");
    destinationId = await upsertNavigationDestination(
      { key: "MAIN_LIBRARY", locationId, nameEn: "Main Library", nameAr: "المكتبة الرئيسية", requiresConfirmation: true, active: true },
      actorId,
    );

    const rows = await listNavigationDestinations();
    const row = rows.find((r) => r.key === "MAIN_LIBRARY");
    expect(row?.locationNavigable).toBe(true);
    expect(row?.requiresConfirmation).toBe(true);
    expect(row?.routeCount).toBe(0);
  });

  it("upserts by key instead of creating duplicates", async () => {
    const { upsertNavigationDestination, listNavigationDestinations } = await import("@/server/services/locations");
    const again = await upsertNavigationDestination(
      { key: "MAIN_LIBRARY", locationId, nameEn: "Central Library", nameAr: "المكتبة المركزية", requiresConfirmation: false, active: true },
      actorId,
    );

    expect(again).toBe(destinationId);
    const rows = await listNavigationDestinations();
    expect(rows.filter((r) => r.key === "MAIN_LIBRARY")).toHaveLength(1);
    expect(rows.find((r) => r.key === "MAIN_LIBRARY")?.nameEn).toBe("Central Library");
  });

  it("saves a predefined route with bilingual steps and reports it in the destination list", async () => {
    const { upsertNavigationRoute, listNavigationRoutes, listNavigationDestinations } = await import("@/server/services/locations");
    const steps = [
      { en: "Leave the lobby through the main doors", ar: "اخرج من الرئيسي عبر الأبواب الرئيسية" },
      { en: "Turn left and follow the corridor", ar: "اتجه يساراً واتبع الممر" },
      { en: "The library entrance is on your right", ar: "مدخل المكتبة على يمينك" },
    ];
    await upsertNavigationRoute({ destinationId, mode: "PREDEFINED", steps, active: true }, actorId);

    const routes = await listNavigationRoutes();
    const route = routes.find((r) => r.destinationId === destinationId);
    expect(route?.mode).toBe("PREDEFINED");
    expect(route?.steps).toHaveLength(3);
    expect(route?.steps[0]?.ar).toContain("الرئيسي");

    const destinations = await listNavigationDestinations();
    expect(destinations.find((d) => d.id === destinationId)?.routeCount).toBe(1);
  });

  it("replaces the existing route on upsert rather than stacking a second one", async () => {
    const { upsertNavigationRoute, listNavigationRoutes } = await import("@/server/services/locations");
    await upsertNavigationRoute({ destinationId, mode: "ESCORT", steps: [{ en: "Follow the staff escort", ar: "اتبع المرافق" }], active: true }, actorId);

    const routes = (await listNavigationRoutes()).filter((r) => r.destinationId === destinationId);
    expect(routes).toHaveLength(1);
    expect(routes[0]?.mode).toBe("ESCORT");
  });

  it("deactivating a route removes it from the robot's active navigation options", async () => {
    const { upsertNavigationRoute } = await import("@/server/services/locations");
    // getNavigationRoute (commands.ts) is what the assistant uses — it only returns active routes.
    const { getNavigationRoute } = await import("@/server/services/commands");

    await upsertNavigationRoute({ destinationId, mode: "PREDEFINED", steps: [{ en: "Step", ar: "خطوة" }], active: true }, actorId);
    expect((await getNavigationRoute("MAIN_LIBRARY"))?.route).not.toBeNull();

    await upsertNavigationRoute({ destinationId, mode: "PREDEFINED", steps: [{ en: "Step", ar: "خطوة" }], active: false }, actorId);
    const resolved = await getNavigationRoute("MAIN_LIBRARY");
    expect(resolved?.destination.key).toBe("MAIN_LIBRARY");
    expect(resolved?.route).toBeNull();
  });

  it("getNavigationRoute returns null for an unknown destination key", async () => {
    const { getNavigationRoute } = await import("@/server/services/commands");
    expect(await getNavigationRoute("DOES_NOT_EXIST")).toBeNull();
  });

  it("deleting a destination removes its routes (cascade)", async () => {
    const { upsertNavigationDestination, upsertNavigationRoute, deleteNavigationDestination, listNavigationRoutes } = await import("@/server/services/locations");
    const tempId = await upsertNavigationDestination(
      { key: "TEMP_SPOT", locationId: null, nameEn: "Temp Spot", nameAr: "مكان مؤقت", requiresConfirmation: true, active: true },
      actorId,
    );
    await upsertNavigationRoute({ destinationId: tempId, mode: "PREDEFINED", steps: [{ en: "Go", ar: "اذهب" }], active: true }, actorId);
    expect((await listNavigationRoutes()).some((r) => r.destinationId === tempId)).toBe(true);

    await deleteNavigationDestination(tempId, actorId);
    expect((await listNavigationRoutes()).some((r) => r.destinationId === tempId)).toBe(false);
  });
});

describe("resolveLocationMention (assistant location lookup)", () => {
  beforeAll(async () => {
    await initTestDb();
    // Distinct keys from the destinations suite: both describes share one embedded DB.
    const { createLocation } = await import("@/server/services/locations");
    const actorId = uid("actor");
    await createLocation(
      { key: "CENTRAL_LIBRARY", nameEn: "Central Library", nameAr: "المكتبة المركزية", descriptionEn: "", descriptionAr: "", directionsEn: "", directionsAr: "", buildingId: null, floorId: null, room: "", latitude: null, longitude: null, imageUrl: "", accessibilityNotes: "", published: true, navigable: true },
      actorId,
    );
    await createLocation(
      { key: "REGISTRATION_OFFICE", nameEn: "Registration Office", nameAr: "مكتب التسجيل", descriptionEn: "", descriptionAr: "", directionsEn: "", directionsAr: "", buildingId: null, floorId: null, room: "", latitude: null, longitude: null, imageUrl: "", accessibilityNotes: "", published: true, navigable: false },
      actorId,
    );
    // Unpublished locations must never be resolved for a public question.
    await createLocation(
      { key: "SERVER_ROOM", nameEn: "Server Room", nameAr: "غرفة الخوادم", descriptionEn: "", descriptionAr: "", directionsEn: "", directionsAr: "", buildingId: null, floorId: null, room: "", latitude: null, longitude: null, imageUrl: "", accessibilityNotes: "", published: false, navigable: false },
      actorId,
    );
  });

  it("resolves an exact machine key", async () => {
    const { resolveLocationMention } = await import("@/server/services/locations");
    const row = await resolveLocationMention("CENTRAL_LIBRARY", "en");
    expect(row?.key).toBe("CENTRAL_LIBRARY");
  });

  it("resolves an English name mention", async () => {
    const { resolveLocationMention } = await import("@/server/services/locations");
    const row = await resolveLocationMention("Where is the Central Library?", "en");
    expect(row?.key).toBe("CENTRAL_LIBRARY");
  });

  it("resolves an Arabic name mention", async () => {
    const { resolveLocationMention } = await import("@/server/services/locations");
    const row = await resolveLocationMention("أين مكتب التسجيل؟", "ar");
    expect(row?.key).toBe("REGISTRATION_OFFICE");
  });

  it("never resolves an unpublished location", async () => {
    const { resolveLocationMention } = await import("@/server/services/locations");
    expect(await resolveLocationMention("SERVER_ROOM", "en")).toBeNull();
    expect(await resolveLocationMention("Where is the Server Room?", "en")).toBeNull();
  });

  it("returns null for unrelated text and empty input", async () => {
    const { resolveLocationMention } = await import("@/server/services/locations");
    expect(await resolveLocationMention("What is the tuition fee?", "en")).toBeNull();
    expect(await resolveLocationMention("   ", "en")).toBeNull();
  });
});
