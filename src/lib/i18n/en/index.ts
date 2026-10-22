import common from "./common";
import publicSite from "./public";
import assistantDict from "./assistant";
import adminCommon from "./admin/common";
import adminStudents from "./admin/students";
import adminSystem from "./admin/system";
import adminRobots from "./admin/robots";
import adminContent from "./admin/content";

const dictionary = {
  common: common.common,
  public: publicSite.public,
  assistant: assistantDict.assistant,
  control: assistantDict.control,
  admin: {
    ...adminCommon.admin,
    students: adminStudents,
    system: adminSystem,
    robots: adminRobots,
    content: adminContent,
  },
};

export default dictionary;

/** Complete English dictionary — the type contract every locale must satisfy. */
export type Dictionary = typeof dictionary;

/** Dot-path lookup over the merged dictionary, with `{variable}` interpolation. */
export function translate(dict: Dictionary, key: string, vars?: Record<string, string | number>): string {
  const parts = key.split(".");
  let node: unknown = dict;
  for (const part of parts) {
    if (typeof node !== "object" || node === null) {
      node = undefined;
      break;
    }
    node = (node as Record<string, unknown>)[part];
  }
  let value: string | undefined;
  if (Array.isArray(node)) value = undefined;
  else if (typeof node === "string") value = node;
  if (value === undefined) {
    if (process.env.NODE_ENV !== "production") console.warn(`[i18n] missing key: ${key}`);
    return key;
  }
  if (!vars) return value;
  return value.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}
