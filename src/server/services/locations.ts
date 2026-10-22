import { and, eq, ilike, or, sql } from "drizzle-orm";
import { ApiError } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { campusBuildings, campusFloors, campusLocations, navigationDestinations, navigationRoutes } from "@/server/db/schema";
import type { LocationInput, locationQuerySchema, NavigationDestinationInput, floorSchema, navigationRouteSchema } from "@/lib/validation/admin";
import type { z } from "zod";
import { audit } from "./audit";

type LocationQuery = z.infer<typeof locationQuerySchema>;
type RouteInput = z.infer<typeof navigationRouteSchema>;

export type LocationRecord = typeof campusLocations.$inferSelect;

/* ── Buildings & floors ─────────────────────────────────────────────────────── */

export async function listBuildings() {
  return db.select().from(campusBuildings).orderBy(campusBuildings.orderIndex, campusBuildings.nameEn);
}

export async function createBuilding(input: { code: string; nameEn: string; nameAr: string; orderIndex: number }, actorId: string) {
  const [existing] = await db.select({ id: campusBuildings.id }).from(campusBuildings).where(eq(campusBuildings.code, input.code)).limit(1);
  if (existing) throw new ApiError(409, "A building with this code already exists.", "BUILDING_EXISTS");
  const id = crypto.randomUUID();
  await db.insert(campusBuildings).values({ id, ...input });
  await audit({ actorUserId: actorId, actorLabel: "admin", action: "building.created", targetType: "building", targetId: id });
  return id;
}

export async function updateBuilding(id: string, input: { code?: string; nameEn?: string; nameAr?: string; orderIndex?: number }, actorId: string) {
  await db
    .update(campusBuildings)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(campusBuildings.id, id));
  await audit({ actorUserId: actorId, actorLabel: "admin", action: "building.updated", targetType: "building", targetId: id });
}

export async function listFloors(buildingId?: string) {
  const where = buildingId ? eq(campusFloors.buildingId, buildingId) : undefined;
  return db.select().from(campusFloors).where(where).orderBy(campusFloors.orderIndex);
}

export async function createFloor(input: z.infer<typeof floorSchema>, actorId: string) {
  const id = crypto.randomUUID();
  await db.insert(campusFloors).values({ id, ...input });
  await audit({ actorUserId: actorId, actorLabel: "admin", action: "floor.created", targetType: "floor", targetId: id });
  return id;
}

/* ── Locations ──────────────────────────────────────────────────────────────── */

export async function listLocations(query: LocationQuery) {
  const { page, pageSize, q, buildingId, published, navigable } = query;
  const filters = [];
  if (q) {
    const like = `%${q}%`;
    filters.push(or(ilike(campusLocations.nameEn, like), ilike(campusLocations.nameAr, like), ilike(campusLocations.key, like), ilike(campusLocations.room, like)));
  }
  if (buildingId) filters.push(eq(campusLocations.buildingId, buildingId));
  if (published === "true") filters.push(eq(campusLocations.published, true));
  if (published === "false") filters.push(eq(campusLocations.published, false));
  if (navigable === "true") filters.push(eq(campusLocations.navigable, true));
  const where = filters.length ? and(...filters) : undefined;

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        id: campusLocations.id,
        key: campusLocations.key,
        nameEn: campusLocations.nameEn,
        nameAr: campusLocations.nameAr,
        buildingId: campusLocations.buildingId,
        buildingNameEn: campusBuildings.nameEn,
        buildingNameAr: campusBuildings.nameAr,
        room: campusLocations.room,
        published: campusLocations.published,
        navigable: campusLocations.navigable,
        imageUrl: campusLocations.imageUrl,
        updatedAt: campusLocations.updatedAt,
      })
      .from(campusLocations)
      .leftJoin(campusBuildings, eq(campusLocations.buildingId, campusBuildings.id))
      .where(where)
      .orderBy(campusLocations.nameEn)
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(campusLocations).where(where),
  ]);
  return { rows, total: totalRow[0]?.count ?? 0, page, pageSize };
}

export async function getLocation(id: string): Promise<LocationRecord> {
  const [row] = await db.select().from(campusLocations).where(eq(campusLocations.id, id)).limit(1);
  if (!row) throw new ApiError(404, "Location not found.", "LOCATION_NOT_FOUND");
  return row;
}

export async function getLocationDetail(id: string) {
  const location = await getLocation(id);
  const [building] = location.buildingId
    ? await db.select().from(campusBuildings).where(eq(campusBuildings.id, location.buildingId)).limit(1)
    : [];
  const [floor] = location.floorId ? await db.select().from(campusFloors).where(eq(campusFloors.id, location.floorId)).limit(1) : [];
  const destinations = await db
    .select()
    .from(navigationDestinations)
    .where(eq(navigationDestinations.locationId, id))
    .orderBy(navigationDestinations.key);
  return { location, building: building ?? null, floor: floor ?? null, destinations };
}

export async function createLocation(input: LocationInput, actorId: string) {
  const [existing] = await db.select({ id: campusLocations.id }).from(campusLocations).where(eq(campusLocations.key, input.key)).limit(1);
  if (existing) throw new ApiError(409, "A location with this key already exists.", "LOCATION_EXISTS");
  await assertBuildingFloor(input);
  const id = crypto.randomUUID();
  await db.insert(campusLocations).values({
    id,
    key: input.key,
    nameEn: input.nameEn,
    nameAr: input.nameAr,
    descriptionEn: input.descriptionEn || null,
    descriptionAr: input.descriptionAr || null,
    directionsEn: input.directionsEn || null,
    directionsAr: input.directionsAr || null,
    buildingId: input.buildingId || null,
    floorId: input.floorId || null,
    room: input.room || null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    imageUrl: input.imageUrl || null,
    accessibilityNotes: input.accessibilityNotes || null,
    published: input.published,
    navigable: input.navigable,
  });
  await audit({ actorUserId: actorId, actorLabel: "admin", action: "location.created", targetType: "location", targetId: id, metadata: { key: input.key } });
  return id;
}

export async function updateLocation(id: string, input: LocationInput, actorId: string) {
  await getLocation(id);
  await assertBuildingFloor(input);
  await db
    .update(campusLocations)
    .set({
      key: input.key,
      nameEn: input.nameEn,
      nameAr: input.nameAr,
      descriptionEn: input.descriptionEn || null,
      descriptionAr: input.descriptionAr || null,
      directionsEn: input.directionsEn || null,
      directionsAr: input.directionsAr || null,
      buildingId: input.buildingId || null,
      floorId: input.floorId || null,
      room: input.room || null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      imageUrl: input.imageUrl || null,
      accessibilityNotes: input.accessibilityNotes || null,
      published: input.published,
      navigable: input.navigable,
      updatedAt: new Date(),
    })
    .where(eq(campusLocations.id, id));
  await audit({ actorUserId: actorId, actorLabel: "admin", action: "location.updated", targetType: "location", targetId: id });
}

export async function deleteLocation(id: string, actorId: string) {
  await db.delete(campusLocations).where(eq(campusLocations.id, id));
  await audit({ actorUserId: actorId, actorLabel: "admin", action: "location.deleted", targetType: "location", targetId: id });
}

async function assertBuildingFloor(input: LocationInput) {
  if (input.floorId) {
    const [floor] = await db.select().from(campusFloors).where(eq(campusFloors.id, input.floorId)).limit(1);
    if (!floor) throw new ApiError(400, "Selected floor does not exist.", "FLOOR_INVALID");
    if (input.buildingId && floor.buildingId !== input.buildingId) {
      throw new ApiError(400, "Floor does not belong to the selected building.", "FLOOR_BUILDING_MISMATCH");
    }
  }
}

/** Public directory: published locations only, with building names. */
export async function listPublishedLocations(opts: { q?: string; buildingId?: string; limit?: number }) {
  const filters = [eq(campusLocations.published, true)];
  if (opts.buildingId) filters.push(eq(campusLocations.buildingId, opts.buildingId));
  if (opts.q) {
    const like = `%${opts.q}%`;
    const search = or(ilike(campusLocations.nameEn, like), ilike(campusLocations.nameAr, like), ilike(campusLocations.descriptionEn, like), ilike(campusLocations.descriptionAr, like));
    if (search) filters.push(search);
  }
  return db
    .select({
      id: campusLocations.id,
      key: campusLocations.key,
      nameEn: campusLocations.nameEn,
      nameAr: campusLocations.nameAr,
      descriptionEn: campusLocations.descriptionEn,
      descriptionAr: campusLocations.descriptionAr,
      room: campusLocations.room,
      navigable: campusLocations.navigable,
      imageUrl: campusLocations.imageUrl,
      accessibilityNotes: campusLocations.accessibilityNotes,
      buildingId: campusBuildings.id,
      buildingNameEn: campusBuildings.nameEn,
      buildingNameAr: campusBuildings.nameAr,
      buildingCode: campusBuildings.code,
    })
    .from(campusLocations)
    .leftJoin(campusBuildings, eq(campusLocations.buildingId, campusBuildings.id))
    .where(and(...filters))
    .orderBy(campusLocations.nameEn)
    .limit(opts.limit ?? 100);
}

/* ── Navigation destinations & predefined routes ────────────────────────────── */

export async function listNavigationDestinations() {
  const rows = await db
    .select({
      id: navigationDestinations.id,
      key: navigationDestinations.key,
      nameEn: navigationDestinations.nameEn,
      nameAr: navigationDestinations.nameAr,
      requiresConfirmation: navigationDestinations.requiresConfirmation,
      active: navigationDestinations.active,
      locationId: navigationDestinations.locationId,
      locationKey: campusLocations.key,
      locationNavigable: campusLocations.navigable,
      routeCount: sql<number>`(select count(*)::int from navigation_routes r where r.destination_id = ${navigationDestinations.id} and r.active = true)`,
    })
    .from(navigationDestinations)
    .leftJoin(campusLocations, eq(navigationDestinations.locationId, campusLocations.id))
    .orderBy(navigationDestinations.key);
  return rows;
}

export async function upsertNavigationDestination(input: NavigationDestinationInput, actorId: string) {
  const [existing] = await db.select().from(navigationDestinations).where(eq(navigationDestinations.key, input.key)).limit(1);
  if (existing) {
    await db
      .update(navigationDestinations)
      .set({ nameEn: input.nameEn, nameAr: input.nameAr, locationId: input.locationId || null, requiresConfirmation: input.requiresConfirmation, active: input.active, updatedAt: new Date() })
      .where(eq(navigationDestinations.id, existing.id));
    await audit({ actorUserId: actorId, actorLabel: "admin", action: "destination.updated", targetType: "destination", targetId: existing.id });
    return existing.id;
  }
  const id = crypto.randomUUID();
  await db.insert(navigationDestinations).values({
    id,
    key: input.key,
    locationId: input.locationId || null,
    nameEn: input.nameEn,
    nameAr: input.nameAr,
    requiresConfirmation: input.requiresConfirmation,
    active: input.active,
  });
  await audit({ actorUserId: actorId, actorLabel: "admin", action: "destination.created", targetType: "destination", targetId: id });
  return id;
}

export async function deleteNavigationDestination(id: string, actorId: string) {
  await db.delete(navigationDestinations).where(eq(navigationDestinations.id, id));
  await audit({ actorUserId: actorId, actorLabel: "admin", action: "destination.deleted", targetType: "destination", targetId: id });
}

export async function upsertNavigationRoute(input: RouteInput, actorId: string) {
  const [existing] = await db.select().from(navigationRoutes).where(eq(navigationRoutes.destinationId, input.destinationId)).limit(1);
  if (existing) {
    await db.update(navigationRoutes).set({ mode: input.mode, steps: input.steps, active: input.active, updatedAt: new Date() }).where(eq(navigationRoutes.id, existing.id));
    return existing.id;
  }
  const id = crypto.randomUUID();
  await db.insert(navigationRoutes).values({ id, destinationId: input.destinationId, mode: input.mode, steps: input.steps, active: input.active });
  await audit({ actorUserId: actorId, actorLabel: "admin", action: "route.saved", targetType: "destination", targetId: input.destinationId });
  return id;
}

export async function listNavigationRoutes() {
  return db
    .select({
      id: navigationRoutes.id,
      destinationId: navigationRoutes.destinationId,
      destinationKey: navigationDestinations.key,
      destinationNameEn: navigationDestinations.nameEn,
      destinationNameAr: navigationDestinations.nameAr,
      mode: navigationRoutes.mode,
      steps: navigationRoutes.steps,
      active: navigationRoutes.active,
      updatedAt: navigationRoutes.updatedAt,
    })
    .from(navigationRoutes)
    .innerJoin(navigationDestinations, eq(navigationRoutes.destinationId, navigationDestinations.id))
    .orderBy(navigationDestinations.key);
}

/* ── Assistant resolution ───────────────────────────────────────────────────── */

/** Exact/nickname resolution of a free-text question to a published destination. */
export async function resolveLocationMention(text: string, language: "ar" | "en"): Promise<LocationRecord | null> {
  const rows = await db.select().from(campusLocations).where(eq(campusLocations.published, true)).limit(200);
  const needle = text.trim().toLowerCase();
  if (!needle) return null;

  // 1. exact key match (e.g. "MAIN_LIBRARY")
  const direct = rows.find((r) => r.key.toLowerCase() === needle);
  if (direct) return direct;

  // 2. longest name match in the active language
  const names = rows
    .map((r) => ({ row: r, names: [r.nameEn, r.nameAr, r.key.replace(/_/g, " ")].filter(Boolean) }))
    .flatMap(({ row, names: ns }) => ns.map((n) => ({ row, name: n.toLowerCase() })))
    .filter((n) => n.name.length >= 3 && needle.includes(n.name))
    .sort((a, b) => b.name.length - a.name.length);
  if (names[0]) return names[0].row;

  // 3. single significant word overlap
  const words = needle.split(/[\s،,.؟?؟!]+/).filter((w) => w.length >= 4);
  if (words.length) {
    const scored = rows
      .map((r) => {
        const haystack = `${r.nameEn} ${r.nameAr} ${r.key.replace(/_/g, " ")}`.toLowerCase();
        const score = words.reduce((acc, w) => acc + (haystack.includes(w) ? w.length : 0), 0);
        return { row: r, score };
      })
      .sort((a, b) => b.score - a.score);
    if (scored[0] && scored[0].score > 0) return scored[0].row;
  }
  void language;
  return null;
}
