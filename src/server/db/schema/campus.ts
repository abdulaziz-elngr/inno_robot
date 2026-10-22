import { boolean, doublePrecision, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import type { KNOWLEDGE_STATUSES} from "./common";
import { createdAtCol, idCol, updatedAtCol } from "./common";
import { users } from "./auth";

export const campusBuildings = pgTable(
  "campus_buildings",
  {
    id: idCol(),
    code: text("code").notNull(),
    nameEn: text("name_en").notNull(),
    nameAr: text("name_ar").notNull(),
    orderIndex: integer("order_index").notNull().default(0),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (t) => [uniqueIndex("campus_buildings_code_unique").on(t.code)],
);

export const campusFloors = pgTable(
  "campus_floors",
  {
    id: idCol(),
    buildingId: text("building_id")
      .notNull()
      .references(() => campusBuildings.id, { onDelete: "cascade" }),
    labelEn: text("label_en").notNull(),
    labelAr: text("label_ar").notNull(),
    orderIndex: integer("order_index").notNull().default(0),
    createdAt: createdAtCol(),
  },
  (t) => [index("campus_floors_building_idx").on(t.buildingId)],
);

/** A published, searchable destination inside the university. */
export const campusLocations = pgTable(
  "campus_locations",
  {
    id: idCol(),
    key: text("key").notNull(), // stable machine identifier, e.g. "MAIN_LIBRARY"
    nameEn: text("name_en").notNull(),
    nameAr: text("name_ar").notNull(),
    descriptionEn: text("description_en"),
    descriptionAr: text("description_ar"),
    buildingId: text("building_id").references(() => campusBuildings.id, { onDelete: "set null" }),
    floorId: text("floor_id").references(() => campusFloors.id, { onDelete: "set null" }),
    room: text("room"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    imageUrl: text("image_url"),
    accessibilityNotes: text("accessibility_notes"),
    directionsEn: text("directions_en"),
    directionsAr: text("directions_ar"),
    published: boolean("published").notNull().default(false),
    navigable: boolean("navigable").notNull().default(false),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (t) => [
    uniqueIndex("campus_locations_key_unique").on(t.key),
    index("campus_locations_published_idx").on(t.published),
    index("campus_locations_building_idx").on(t.buildingId),
  ],
);

export const knowledgeCategories = pgTable(
  "knowledge_categories",
  {
    id: idCol(),
    key: text("key").notNull(),
    nameEn: text("name_en").notNull(),
    nameAr: text("name_ar").notNull(),
    createdAt: createdAtCol(),
  },
  (t) => [uniqueIndex("knowledge_categories_key_unique").on(t.key)],
);

/** Approved university content. Only PUBLISHED rows are ever used to answer students. */
export const knowledgeArticles = pgTable(
  "knowledge_articles",
  {
    id: idCol(),
    categoryId: text("category_id").references(() => knowledgeCategories.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    content: text("content").notNull(),
    language: text("language").notNull().default("en"), // "ar" | "en" | "both"
    tags: text("tags").array(),
    status: text("status").$type<(typeof KNOWLEDGE_STATUSES)[number]>().notNull().default("DRAFT"),
    sourceDocument: text("source_document"),
    authorId: text("author_id").references(() => users.id, { onDelete: "set null" }),
    reviewAt: timestamp("review_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (t) => [index("knowledge_articles_status_idx").on(t.status), index("knowledge_articles_category_idx").on(t.categoryId)],
);

/** Predefined navigation destinations the assistant may request. */
export const navigationDestinations = pgTable(
  "navigation_destinations",
  {
    id: idCol(),
    key: text("key").notNull(),
    locationId: text("location_id").references(() => campusLocations.id, { onDelete: "cascade" }),
    nameEn: text("name_en").notNull(),
    nameAr: text("name_ar").notNull(),
    requiresConfirmation: boolean("requires_confirmation").notNull().default(true),
    active: boolean("active").notNull().default(true),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (t) => [uniqueIndex("navigation_destinations_key_unique").on(t.key), index("navigation_destinations_active_idx").on(t.active)],
);

/**
 * Predefined routes. `steps` is a JSON list of human-readable legs; the platform
 * treats this as "predefined route" navigation and does not claim autonomy.
 */
export const navigationRoutes = pgTable(
  "navigation_routes",
  {
    id: idCol(),
    destinationId: text("destination_id")
      .notNull()
      .references(() => navigationDestinations.id, { onDelete: "cascade" }),
    mode: text("mode").notNull().default("PREDEFINED"), // PREDEFINED | ESCORT | UNAVAILABLE
    steps: jsonb("steps").$type<Array<{ en: string; ar: string }>>().notNull().default([]),
    active: boolean("active").notNull().default(true),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (t) => [index("navigation_routes_destination_idx").on(t.destinationId)],
);
