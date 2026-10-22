import common from "./common";
import publicSite from "./public";
import assistantDict from "./assistant";
import adminCommon from "./admin/common";
import adminStudents from "./admin/students";
import adminSystem from "./admin/system";
import adminRobots from "./admin/robots";
import adminContent from "./admin/content";
import type { Dictionary } from "../en";
import type { DeepPartial } from "../shared";

/**
 * Arabic dictionary. Typed as a deep partial of the English contract: any key that is
 * missing falls back to English at runtime (and the translation-parity test flags it).
 */
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
} as unknown as DeepPartial<Dictionary>;

export default dictionary;
