import { db } from "@/server/db/client";
import { applicationSettings } from "@/server/db/schema";
import type { SettingsInput } from "@/lib/validation/admin";

/** Defaults used until an administrator saves settings. Never contains secrets. */
export const DEFAULT_SETTINGS: SettingsInput = {
  appName: "Inno Robot",
  taglineEn: "Your intelligent university assistant",
  taglineAr: "مساعدك الذكي داخل الجامعة",
  defaultLocale: "ar",
  defaultTheme: "system",
  assistantEnabled: true,
  guestModeEnabled: true,
  conversationRetentionDays: 90,
  voiceEnabled: true,
  requireNavigationConfirmation: true,
  emergencyStopEnabled: true,
};

export async function getSettings(): Promise<SettingsInput> {
  try {
    const rows = await db.select({ key: applicationSettings.key, value: applicationSettings.value }).from(applicationSettings);
    const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
    for (const row of rows) {
      if (row.key in DEFAULT_SETTINGS) merged[row.key] = row.value;
    }
    return merged as SettingsInput;
  } catch {
    // Before the first migration the platform still renders with defaults.
    return { ...DEFAULT_SETTINGS };
  }
}

export async function updateSettings(input: SettingsInput, updatedById: string | null): Promise<void> {
  await db.transaction(async (tx) => {
    for (const [key, value] of Object.entries(input)) {
      await tx
        .insert(applicationSettings)
        .values({ key, value, updatedById })
        .onConflictDoUpdate({ target: applicationSettings.key, set: { value, updatedById, updatedAt: new Date() } });
    }
  });
}

export async function getSettingValue<T>(key: keyof SettingsInput): Promise<T> {
  const settings = await getSettings();
  return settings[key] as T;
}
