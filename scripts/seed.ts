import fs from "node:fs";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { loadEnv } from "./lib/env";

loadEnv();

/**
 * Development seed.
 *  - Creates the roles/permissions baseline and a development SUPER_ADMIN.
 *  - Creates clearly-labelled sample faculties, students, cards, campus locations,
 *    knowledge articles, navigation destinations and simulated robot devices.
 *  - Every sample row is development data. It is never generated against production
 *    automatically; run `npm run db:seed` deliberately (documented in README.md).
 *
 * Default credentials (development only — change before deploying):
 *   admin@inno-robot.test  /  InnoRobot#2026   (SUPER_ADMIN)
 *   operator@inno-robot.test / InnoRobot#2026  (ROBOT_OPERATOR)
 */

const DEV_ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@inno-robot.test";
const DEV_ADMIN_NAME = process.env.ADMIN_NAME ?? "Inno Robot Admin";
const DEV_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "InnoRobot#2026";

async function main() {
  const { runMigrations } = await import("../src/server/db/migrate");
  await runMigrations();

  const { db } = await import("../src/server/db/client");
  const schema = await import("../src/server/db/schema");
  const { ensureSystemRoles } = await import("../src/server/services/admin-users");
  const { hashPassword, assertPasswordStrength } = await import("../src/server/auth/password");
  const { encryptDeviceSecret, fingerprintDeviceSecret } = await import("../src/server/auth/device-auth");
  const { hashCardUid, uidLast4 } = await import("../src/server/services/students");
  const { DEFAULT_SETTINGS } = await import("../src/server/services/settings");
  const { audit } = await import("../src/server/services/audit");

  const strengthError = assertPasswordStrength(DEV_ADMIN_PASSWORD);
  if (strengthError) throw new Error(`ADMIN_PASSWORD rejected: ${strengthError}`);

  await ensureSystemRoles();
  console.log("[seed] roles & permissions ensured");

  /* ── Administrators ─────────────────────────────────────────────────────── */
  const passwordHash = await hashPassword(DEV_ADMIN_PASSWORD);

  const { eq } = await import("drizzle-orm");

  async function ensureUser(email: string, name: string, roleKey: string): Promise<string> {
    const [existing] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
    const userId = existing?.id ?? randomUUID();
    if (!existing) {
      await db.insert(schema.users).values({ id: userId, email, name, passwordHash, locale: "ar", active: true });
    }
    await assignRole(userId, roleKey);
    return userId;
  }

  async function assignRole(userId: string, roleKey: string) {
    const [role] = await db.select().from(schema.roles).where(eq(schema.roles.key, roleKey)).limit(1);
    if (!role) return;
    const [already] = await db
      .select()
      .from(schema.userRoles)
      .where(eq(schema.userRoles.userId, userId))
      .limit(1);
    if (already?.roleId === role.id) return;
    if (already) {
      await db.update(schema.userRoles).set({ roleId: role.id }).where(eq(schema.userRoles.userId, userId));
      return;
    }
    await db.insert(schema.userRoles).values({ userId, roleId: role.id });
  }

  const adminId = await ensureUser(DEV_ADMIN_EMAIL, DEV_ADMIN_NAME, "SUPER_ADMIN");
  await ensureUser("operator@inno-robot.test", "Robot Operator", "ROBOT_OPERATOR");
  await ensureUser("content@inno-robot.test", "Content Manager", "CONTENT_MANAGER");
  console.log(`[seed] administrators ready (${DEV_ADMIN_EMAIL}, operator@inno-robot.test, content@inno-robot.test)`);

  /* ── Faculties & departments ────────────────────────────────────────────── */
  async function ensureFaculty(code: string, nameEn: string, nameAr: string): Promise<string> {
    const [existing] = await db.select().from(schema.faculties).where(eq(schema.faculties.code, code)).limit(1);
    if (existing) return existing.id;
    const id = randomUUID();
    await db.insert(schema.faculties).values({ id, code, nameEn, nameAr });
    return id;
  }
  async function ensureDepartment(facultyId: string, code: string, nameEn: string, nameAr: string): Promise<string> {
    const [existing] = await db.select().from(schema.departments).where(eq(schema.departments.code, code)).limit(1);
    if (existing) return existing.id;
    const id = randomUUID();
    await db.insert(schema.departments).values({ id, facultyId, code, nameEn, nameAr });
    return id;
  }

  const fCs = await ensureFaculty("CS", "Computer Science", "علوم الحاسب");
  const fEng = await ensureFaculty("ENG", "Engineering", "كلية الهندسة");
  const fBus = await ensureFaculty("BUS", "Business Administration", "إدارة الأعمال");
  const dSwe = await ensureDepartment(fCs, "SWE", "Software Engineering", "هندسة البرمجيات");
  const dAi = await ensureDepartment(fCs, "AI", "Artificial Intelligence", "الذكاء الاصطناعي");
  const dCiv = await ensureDepartment(fEng, "CIV", "Civil Engineering", "الهندسة المدنية");
  const dMkt = await ensureDepartment(fBus, "MKT", "Marketing", "التسويق");
  console.log("[seed] faculties & departments ready");

  /* ── Students & NFC cards ───────────────────────────────────────────────── */
  type SeedStudent = { uid: string; universityId: string; nameEn: string; nameAr: string; firstEn: string; firstAr: string; facultyId: string; departmentId: string; cardActive: boolean };
  const studentSeeds: SeedStudent[] = [
    { uid: "04A1B2C3D4E5F6", universityId: "20260001", nameEn: "Mariam Hassan", nameAr: "مريم حسن", firstEn: "Mariam", firstAr: "مريم", facultyId: fCs, departmentId: dSwe, cardActive: true },
    { uid: "04A1B2C3D4E5F7", universityId: "20260002", nameEn: "Omar Khaled", nameAr: "عمر خالد", firstEn: "Omar", firstAr: "عمر", facultyId: fCs, departmentId: dAi, cardActive: true },
    { uid: "04A1B2C3D4E5F8", universityId: "20260003", nameEn: "Sara Ali", nameAr: "سارة علي", firstEn: "Sara", firstAr: "سارة", facultyId: fEng, departmentId: dCiv, cardActive: true },
    { uid: "04A1B2C3D4E5F9", universityId: "20260004", nameEn: "Youssef Adel", nameAr: "يوسف عادل", firstEn: "Youssef", firstAr: "يوسف", facultyId: fBus, departmentId: dMkt, cardActive: false },
    { uid: "04A1B2C3D4E5FA", universityId: "20260005", nameEn: "Nour Mahmoud", nameAr: "نور محمود", firstEn: "Nour", firstAr: "نور", facultyId: fCs, departmentId: dSwe, cardActive: true },
  ];

  for (const seed of studentSeeds) {
    const [existingStudent] = await db.select().from(schema.students).where(eq(schema.students.universityId, seed.universityId)).limit(1);
    let studentId = existingStudent?.id;
    if (!studentId) {
      studentId = randomUUID();
      await db.insert(schema.students).values({
        id: studentId,
        universityId: seed.universityId,
        nameEn: seed.nameEn,
        nameAr: seed.nameAr,
        firstNameEn: seed.firstEn,
        firstNameAr: seed.firstAr,
        facultyId: seed.facultyId,
        departmentId: seed.departmentId,
        status: "ACTIVE",
      });
    }
    const uidHash = hashCardUid(seed.uid);
    const [existingCard] = await db.select().from(schema.studentCards).where(eq(schema.studentCards.uidHash, uidHash)).limit(1);
    if (!existingCard) {
      await db.insert(schema.studentCards).values({
        id: randomUUID(),
        studentId,
        uidHash,
        uidLast4: uidLast4(seed.uid),
        label: `Sample card ${seed.uid.slice(-4)}`,
        status: seed.cardActive ? "ACTIVE" : "REVOKED",
        revokedAt: seed.cardActive ? null : new Date(),
        revokedReason: seed.cardActive ? null : "Sample: reported lost by the student",
      });
    }
  }
  console.log(`[seed] ${studentSeeds.length} sample students with NFC cards ready`);

  /* ── Campus buildings, floors, locations ────────────────────────────────── */
  async function ensureBuilding(code: string, nameEn: string, nameAr: string): Promise<string> {
    const [existing] = await db.select().from(schema.campusBuildings).where(eq(schema.campusBuildings.code, code)).limit(1);
    if (existing) return existing.id;
    const id = randomUUID();
    await db.insert(schema.campusBuildings).values({ id, code, nameEn, nameAr });
    return id;
  }
  const bA = await ensureBuilding("A", "Building A", "المبنى أ");
  const bB = await ensureBuilding("B", "Building B", "المبنى ب");
  const bC = await ensureBuilding("C", "Building C", "المبنى ج");

  type SeedLocation = {
    key: string; nameEn: string; nameAr: string; buildingId: string; room?: string;
    directionsEn: string; directionsAr: string; navigable: boolean; published: boolean;
    descriptionEn?: string; descriptionAr?: string;
  };
  const locationSeeds: SeedLocation[] = [
    { key: "MAIN_LIBRARY", nameEn: "Main Library", nameAr: "المكتبة الرئيسية", buildingId: bA, room: "1F", directionsEn: "Enter Building A and turn right; the library is past the main staircase.", directionsAr: "ادخل المبنى أ والتفت يميناً؛ المكتبة بعد الدرج الرئيسي.", navigable: true, published: true, descriptionEn: "Quiet study halls, printing and lending desk.", descriptionAr: "قاعات دراسة هادئة، طباعة ومكتب إعارات." },
    { key: "STUDENT_AFFAIRS", nameEn: "Student Affairs", nameAr: "شئون الطلاب", buildingId: bA, room: "104", directionsEn: "From the main entrance, Student Affairs is the first office on the left.", directionsAr: "من المدخل الرئيسي، شئون الطلاب أول مكتب على اليسار.", navigable: true, published: true },
    { key: "REGISTRATION_OFFICE", nameEn: "Registration Office", nameAr: "مكتب القيد", buildingId: bA, room: "106", directionsEn: "Next to Student Affairs on the ground floor.", directionsAr: "بجوار شئون الطلاب في الدور الأرضي.", navigable: true, published: true },
    { key: "CAFETERIA", nameEn: "Campus Cafeteria", nameAr: "المطعم الجامعي", buildingId: bB, room: "GF", directionsEn: "Cross the courtyard; the cafeteria is at the east side of Building B.", directionsAr: "اعبر الفناء؛ المطعم في الجهة الشرقية من المبنى ب.", navigable: true, published: true },
    { key: "DEANERY_CS", nameEn: "Computer Science Deanery", nameAr: "عمادة كلية الحاسب", buildingId: bB, room: "210", directionsEn: "Second floor of Building B, follow the purple signs.", directionsAr: "الدور الثاني من المبنى ب، اتبع اللافتات البنفسجية.", navigable: true, published: true },
    { key: "LAB_301", nameEn: "Smart Systems Lab", nameAr: "معمل الأنظمة الذكية", buildingId: bB, room: "301", directionsEn: "Third floor of Building B, at the end of the corridor.", directionsAr: "الدور الثالث من المبنى ب، نهاية الممر.", navigable: false, published: true },
    { key: "MEDICAL_CENTER", nameEn: "Medical Center", nameAr: "المركز الطبي", buildingId: bC, room: "GF", directionsEn: "Ground floor of Building C near the north gate.", directionsAr: "الدور الأرضي من المبنى ج بوابة الشمال.", navigable: true, published: true },
    { key: "SPORTS_HALL", nameEn: "Sports Hall", nameAr: "الصالة الرياضية", buildingId: bC, room: "GF", directionsEn: "Behind Building C, follow the outdoor path.", directionsAr: "خلف المبنى ج، اتبع المسار الخارجي.", navigable: false, published: true },
    { key: "MOSQUE", nameEn: "Campus Mosque", nameAr: "مسجد الحرم الجامعي", buildingId: bC, room: "GF", directionsEn: "Beside the sports hall, west side.", directionsAr: "بجوار الصالة الرياضية، الجهة الغربية.", navigable: false, published: true },
    { key: "PARKING_NORTH", nameEn: "North Parking", nameAr: "موقف السيارات الشمالي", buildingId: bA, directionsEn: "Outside the north gate, 2 minutes walk from Building A.", directionsAr: "خارج بوابة الشمال، دقيقتان سيراً من المبنى أ.", navigable: true, published: true },
    { key: "ADMIN_BUILDING", nameEn: "Administration Building", nameAr: "مبنى الإدارة", buildingId: bC, directionsEn: "Administration offices — access via reception only.", directionsAr: "مكاتب الإدارة — الدخول من الاستقبال فقط.", navigable: false, published: false },
    { key: "ARCHIVE_ROOM", nameEn: "Records Archive", nameAr: "أرشيف السجلات", buildingId: bA, room: "B1", directionsEn: "Basement of Building A (staff only).", directionsAr: "بدروم المبنى أ (للموظفين فقط).", navigable: false, published: false },
  ];

  const locationIdByKey = new Map<string, string>();
  for (const seed of locationSeeds) {
    const [existing] = await db.select().from(schema.campusLocations).where(eq(schema.campusLocations.key, seed.key)).limit(1);
    if (existing) {
      locationIdByKey.set(seed.key, existing.id);
      continue;
    }
    const id = randomUUID();
    await db.insert(schema.campusLocations).values({
      id,
      key: seed.key,
      nameEn: seed.nameEn,
      nameAr: seed.nameAr,
      descriptionEn: seed.descriptionEn ?? null,
      descriptionAr: seed.descriptionAr ?? null,
      directionsEn: seed.directionsEn,
      directionsAr: seed.directionsAr,
      buildingId: seed.buildingId,
      room: seed.room ?? null,
      published: seed.published,
      navigable: seed.navigable,
      accessibilityNotes: seed.navigable ? "Step-free route available." : null,
    });
    locationIdByKey.set(seed.key, id);
  }
  console.log(`[seed] ${locationSeeds.length} sample campus locations ready`);

  /* ── Knowledge base ─────────────────────────────────────────────────────── */
  async function ensureCategory(key: string, nameEn: string, nameAr: string): Promise<string> {
    const [existing] = await db.select().from(schema.knowledgeCategories).where(eq(schema.knowledgeCategories.key, key)).limit(1);
    if (existing) return existing.id;
    const id = randomUUID();
    await db.insert(schema.knowledgeCategories).values({ id, key, nameEn, nameAr });
    return id;
  }
  const catFaq = await ensureCategory("FAQ", "Frequently asked questions", "الأسئلة الشائعة");
  const catHours = await ensureCategory("HOURS", "Office hours", "مواعيد المكاتب");
  const catServices = await ensureCategory("SERVICES", "Student services", "خدمات الطلاب");
  const catPolicies = await ensureCategory("POLICIES", "Policies", "السياسات");

  type SeedArticle = { title: string; content: string; language: "ar" | "en" | "both"; categoryId: string; status: "PUBLISHED" | "DRAFT"; source?: string };
  const articleSeeds: SeedArticle[] = [
    { title: "Library opening hours", content: "The Main Library is open Sunday–Thursday, 8:00–20:00, and Saturday 9:00–15:00. It is closed on Fridays and official holidays. Extended hours apply during exam periods.", language: "en", categoryId: catHours, status: "PUBLISHED", source: "Library regulations 2026.pdf" },
    { title: "مواعيد عمل المكتبة الرئيسية", content: "المكتبة الرئيسية مفتوحة من الأحد إلى الخميس، من 8:00 صباحاً حتى 8:00 مساءً، والسبت من 9:00 حتى 3:00 عصراً. المكتبة مغلقة أيام الجمعة والعطلات الرسمية، وتمتد المواعيد خلال فترة الامتحانات.", language: "ar", categoryId: catHours, status: "PUBLISHED", source: "لوائح المكتبة 2026.pdf" },
    { title: "How to get a student ID card", content: "Visit the Student Affairs office in Building A (room 104) with your registration receipt. Processing takes two working days. Lost cards are replaced within one working day after reporting the loss.", language: "both", categoryId: catServices, status: "PUBLISHED", source: "Student services guide" },
    { title: "كيفية استخراج كارت الطالب", content: "راجع مكتب شئون الطلاب في المبنى أ (غرفة 104) مع إيصال القيد. الاستخراج خلال يومي عمل، وتُعاد البطاقة المفقودة خلال يوم عمل واحد بعد الإبلاغ عن الفقدان.", language: "ar", categoryId: catServices, status: "PUBLISHED" },
    { title: "Course drop deadline", content: "Students may drop a course without academic penalty within the first two weeks of the semester. After that date, the request requires a faculty dean approval. (Draft — pending confirmation from the Registrar.)", language: "en", categoryId: catPolicies, status: "DRAFT" },
    { title: "Exam misconduct procedure", content: "Draft content: awaiting review by the quality assurance office before publication.", language: "en", categoryId: catPolicies, status: "DRAFT" },
    { title: "Wi-Fi access for students", content: "Connect to the network \"Campus-Student\" and sign in with your university e-mail and password. Support is available at the IT help desk in Building B, room 110.", language: "both", categoryId: catFaq, status: "PUBLISHED" },
    { title: "Where is the medical center?", content: "The Medical Center is on the ground floor of Building C near the north gate. It is open Saturday–Thursday, 8:30–16:00.", language: "both", categoryId: catFaq, status: "PUBLISHED" },
  ];
  for (const seed of articleSeeds) {
    const [existing] = await db.select().from(schema.knowledgeArticles).where(eq(schema.knowledgeArticles.title, seed.title)).limit(1);
    if (existing) continue;
    await db.insert(schema.knowledgeArticles).values({
      id: randomUUID(),
      categoryId: seed.categoryId,
      title: seed.title,
      content: seed.content,
      language: seed.language,
      status: seed.status,
      sourceDocument: seed.source ?? null,
      authorId: adminId,
      publishedAt: seed.status === "PUBLISHED" ? new Date() : null,
    });
  }
  console.log(`[seed] ${articleSeeds.length} sample knowledge articles ready`);

  /* ── Navigation destinations & predefined routes ────────────────────────── */
  for (const seed of locationSeeds.filter((l) => l.navigable && l.published)) {
    const [existing] = await db.select().from(schema.navigationDestinations).where(eq(schema.navigationDestinations.key, seed.key)).limit(1);
    if (existing) continue;
    await db.insert(schema.navigationDestinations).values({
      id: randomUUID(),
      key: seed.key,
      locationId: locationIdByKey.get(seed.key) ?? null,
      nameEn: seed.nameEn,
      nameAr: seed.nameAr,
      requiresConfirmation: true,
      active: true,
    });
  }
  const [libraryDestination] = await db
    .select()
    .from(schema.navigationDestinations)
    .where(eq(schema.navigationDestinations.key, "MAIN_LIBRARY"))
    .limit(1);
  if (libraryDestination) {
    const [existingRoute] = await db.select().from(schema.navigationRoutes).where(eq(schema.navigationRoutes.destinationId, libraryDestination.id)).limit(1);
    if (!existingRoute) {
      await db.insert(schema.navigationRoutes).values({
        id: randomUUID(),
        destinationId: libraryDestination.id,
        mode: "PREDEFINED",
        steps: [
          { en: "Leave the tablet station and face the main corridor.", ar: "اخرج من محطة التابلت واتجاه الممر الرئيسي." },
          { en: "Walk 15 m and turn right at the information desk.", ar: "امشِ 15 متراً والتفت يميناً عند مكتب المعلومات." },
          { en: "Cross the courtyard and enter Building A.", ar: "اعبر الفناء وادخل المبنى أ." },
          { en: "The Main Library entrance is on your right.", ar: "مدخل المكتبة الرئيسية على يمينك." },
        ],
        active: true,
      });
    }
  }
  console.log("[seed] navigation destinations & routes ready");

  /* ── Simulated robot devices ────────────────────────────────────────────── */
  const deviceSeeds = [
    { deviceId: "INNO-01", displayName: "Inno Robot — Lobby", status: "IDLE" as const, battery: 82, active: true },
    { deviceId: "INNO-02", displayName: "Inno Robot — Library", status: "OFFLINE" as const, battery: 34, active: true },
  ];
  const deviceSecrets: Record<string, string> = {};

  for (const seed of deviceSeeds) {
    const [existing] = await db.select().from(schema.robotDevices).where(eq(schema.robotDevices.deviceId, seed.deviceId)).limit(1);
    if (!existing) {
      const secret = randomBytes(24).toString("base64url");
      await db.transaction(async (tx) => {
        await tx.insert(schema.robotDevices).values({
          id: randomUUID(),
          deviceId: seed.deviceId,
          displayName: seed.displayName,
          status: seed.status,
          mode: "ASSISTANT",
          simulated: true,
          active: seed.active,
          batteryPercent: seed.battery,
          firmwareVersion: "1.0.0-sim",
          lastSeenAt: new Date(),
          maxSpeedPercent: 60,
          safetyTimeoutSeconds: 10,
        });
        await tx.insert(schema.deviceCredentials).values({
          id: randomUUID(),
          deviceId: seed.deviceId,
          secretEncrypted: encryptDeviceSecret(secret),
          secretFingerprint: fingerprintDeviceSecret(secret),
        });
      });
      deviceSecrets[seed.deviceId] = secret;
    }
  }

  // Persist the simulator credential locally (git-ignored) so `npm run sim:robot` works.
  if (Object.keys(deviceSecrets).length) {
    const dir = path.join(process.cwd(), ".data");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "sim-device.json"), JSON.stringify(deviceSecrets, null, 2), "utf8");
  }

  const [inno01] = await db.select().from(schema.robotDevices).where(eq(schema.robotDevices.deviceId, "INNO-01")).limit(1);
  if (inno01 && deviceSecrets["INNO-01"]) {
    // A little simulated telemetry history for the dashboard charts.
    for (let i = 6; i >= 0; i--) {
      await db.insert(schema.robotTelemetry).values({
        id: randomUUID(),
        deviceId: "INNO-01",
        batteryPercent: 78 + (6 - i),
        speedPercent: 0,
        obstacleDistanceCm: 120,
        mode: "ASSISTANT",
        simulated: true,
        recordedAt: new Date(Date.now() - i * 3_600_000),
      });
    }
    await db.insert(schema.deviceEvents).values({
      id: randomUUID(),
      deviceId: "INNO-01",
      type: "SIMULATOR_REGISTERED",
      payload: { note: "Simulated device registered by the seed script" },
      simulated: true,
    });
  }
  console.log(`[seed] simulated devices ready (${deviceSeeds.map((d) => d.deviceId).join(", ")})`);
  if (Object.keys(deviceSecrets).length) {
    console.log("[seed] simulator credentials written to .data/sim-device.json (git-ignored, development only)");
  }

  /* ── Sample conversation (clearly development data) ─────────────────────── */
  const [existingConversation] = await db.select().from(schema.conversations).limit(1);
  if (!existingConversation) {
    const conversationId = randomUUID();
    await db.insert(schema.conversations).values({
      id: conversationId,
      guestId: "seed-guest",
      language: "ar",
      messageCount: 2,
    });
    await db.insert(schema.conversationMessages).values([
      { id: randomUUID(), conversationId, role: "USER", content: "فين المكتبة؟", intent: "LOCATION_LOOKUP", origin: null },
      { id: randomUUID(), conversationId, role: "ASSISTANT", content: "المكتبة الرئيسية في المبنى أ، الدور الأول.", intent: "LOCATION_LOOKUP", origin: "knowledge-fallback" },
    ]);
  }

  /* ── Application settings ───────────────────────────────────────────────── */
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await db
      .insert(schema.applicationSettings)
      .values({ key, value, updatedById: adminId })
      .onConflictDoNothing();
  }

  await audit({ actorUserId: adminId, actorLabel: DEV_ADMIN_EMAIL, action: "system.seeded", metadata: { environment: "development" } });

  console.log(`
[seed] ═══════════════════════════════════════════════════════════
 Development data is ready. Admin credentials (DEV ONLY):
   ${DEV_ADMIN_EMAIL} / ${DEV_ADMIN_PASSWORD}
   operator@inno-robot.test / ${DEV_ADMIN_PASSWORD}
 Sample card UIDs for the simulator/demo:
   ${studentSeeds.filter((s) => s.cardActive).map((s) => s.uid).join(", ")}
 Deactivated sample card: ${studentSeeds.find((s) => !s.cardActive)?.uid}
 Never use these credentials or records in production.
═══════════════════════════════════════════════════════════════`);
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error("[seed] failed:", error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
