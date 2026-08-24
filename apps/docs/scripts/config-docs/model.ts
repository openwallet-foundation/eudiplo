import Joi from "joi";
import { extractConditionsFromKeyDesc, flattenMetas } from "./helpers";

type Presence = "required" | "optional" | "";

interface ConfigItem {
  key: string;
  type: string;
  defaultValue?: unknown;
  description: string;
  presence: Presence;
  group: string;
  order: number;
  secret: boolean;
  conditions: string[];
  meta: Record<string, any>;
}

interface ConfigGroup {
  name: string;
  order: number;
  items: ConfigItem[];
}

export interface ConfigModel {
  createdAt: string;
  groups: ConfigGroup[];
  all: ConfigItem[];
}

export function buildModelFromSchema(schema: Joi.ObjectSchema): ConfigModel {
  const described = schema.describe() as any;
  const descKeys: Record<string, any> = described.keys ?? {};
  const allKeys = Object.keys(descKeys);

  const items: ConfigItem[] = [];

  for (const key of allKeys) {
    const keyDesc = descKeys[key] ?? {};
    const flags = keyDesc.flags ?? {};
    const meta = flattenMetas(keyDesc);

    const group = meta.group ?? "Other";
    const order = Number.isFinite(meta.order) ? Number(meta.order) : 999;
    const secret = meta.secret === true;

    const description =
      flags.description ||
      (Array.isArray(keyDesc.notes) ? keyDesc.notes.join(" ") : "") ||
      "";

    const presence: Presence =
      flags.presence === "required"
        ? "required"
        : flags.presence === "optional"
        ? "optional"
        : "";

    const type =
      Array.isArray(keyDesc.type) ? keyDesc.type.join(" | ") : keyDesc.type ?? "unknown";

    const conditions = extractConditionsFromKeyDesc(keyDesc);

    items.push({
      key,
      type,
      defaultValue: Object.prototype.hasOwnProperty.call(flags, "default")
        ? flags.default
        : undefined,
      description,
      presence,
      group,
      order,
      secret,
      conditions,
      meta,
    });

    //check if some must be replaced
    if(key === "CONFIG_FOLDER") {
      items[items.length - 1].defaultValue = "/path/to/config/folder";
    }
  }

  // Group & sort
  const groupsMap = new Map<string, ConfigItem[]>();
  for (const it of items) {
    const arr = groupsMap.get(it.group) ?? [];
    arr.push(it);
    groupsMap.set(it.group, arr);
  }

  const groups: ConfigGroup[] = Array.from(groupsMap.entries())
    .map(([name, arr]) => {
      arr.sort((a, b) => a.order - b.order || a.key.localeCompare(b.key));
      const order = arr.reduce((m, r) => Math.min(m, r.order), 999);
      return { name, order, items: arr };
    })
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

  return {
    createdAt: new Date().toISOString(),
    groups,
    all: items,
  };
}
