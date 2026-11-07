import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/** Community ratings (RatingSection previously stored these per-device only). */
export const ratings = pgTable("ratings", {
  id: serial("id").primaryKey(),
  rating: integer("rating").notNull(),
  comment: text("comment").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/**
 * Community-verified proxy/DNS endpoints. Successful live evidence
 * (PROXY_CONNECT_OK / TCP_SYN_ACK / WORKING) reported by users' scans,
 * so rare confirmed endpoints are discovered once and shared by all.
 */
export const proxyEvidence = pgTable(
  "proxy_evidence",
  {
    id: serial("id").primaryKey(),
    host: text("host").notNull(),
    port: integer("port").notNull(),
    status: text("status").notNull(),
    evidence: text("evidence").notNull(),
    source: text("source").notNull(),
    connectMs: real("connect_ms"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    // Serves the 24h dedupe query: (host, port) lookup filtered by created_at.
    index("idx_evidence_host_port_created").on(table.host, table.port, table.createdAt),
  ],
);

/** Cloud-synced saved sensitivity profiles (mirrors the localStorage shape). */
export const savedProfiles = pgTable(
  "saved_profiles",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    device: text("device").notNull(),
    weapon: text("weapon").notNull(),
    aiScore: integer("ai_score").notNull(),
    savedAt: bigint("saved_at", { mode: "number" }).notNull(),
    /** Full sensitivity snapshot + fine-tune settings (enables compare). */
    payload: jsonb("payload"),
  },
  (table) => [
    // Serves the "latest 12 profiles" listing ordered by saved_at desc.
    index("idx_profiles_saved_at").on(table.savedAt),
  ],
);
