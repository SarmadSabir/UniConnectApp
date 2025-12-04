const PROMPT_STATES = new Set(["pending", "accepted", "declined"]);

const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const FIELD_MAPPINGS = [
  {
    field: "hard_filter_relaxed",
    sources: [
      "hard_filter_relaxed",
      "preferences.hard_filter_relaxed",
      "preference_relaxed",
      "preferences.preference_relaxed",
    ],
    normalize: (value) => {
      if (value === undefined || value === null) return undefined;
      return Boolean(value);
    },
  },
  {
    field: "hard_filter_relaxed_at",
    sources: [
      "hard_filter_relaxed_at",
      "preferences.hard_filter_relaxed_at",
      "relax_opt_in_at",
      "preferences.relax_opt_in_at",
    ],
    normalize: (value) => toDate(value),
  },
  {
    field: "hard_filter_prompt_state",
    sources: [
      "hard_filter_prompt_state",
      "preferences.hard_filter_prompt_state",
    ],
    normalize: (value) => {
      if (typeof value !== "string") return undefined;
      const trimmed = value.trim().toLowerCase();
      return PROMPT_STATES.has(trimmed) ? trimmed : undefined;
    },
  },
  {
    field: "hard_filter_prompted_at",
    sources: [
      "hard_filter_prompted_at",
      "preferences.hard_filter_prompted_at",
      "relax_prompted_at",
      "preferences.relax_prompted_at",
    ],
    normalize: (value) => toDate(value),
  },
  {
    field: "hard_filter_deferred_at",
    sources: [
      "hard_filter_deferred_at",
      "preferences.hard_filter_deferred_at",
    ],
    normalize: (value) => toDate(value),
  },
];

const hasPath = (obj, pathSegments) => {
  let cursor = obj;
  for (let i = 0; i < pathSegments.length; i += 1) {
    if (!cursor || typeof cursor !== "object") {
      return false;
    }
    if (!Object.prototype.hasOwnProperty.call(cursor, pathSegments[i])) {
      return false;
    }
    cursor = cursor[pathSegments[i]];
  }
  return true;
};

const getPathValue = (obj, pathSegments) => {
  let cursor = obj;
  for (let i = 0; i < pathSegments.length; i += 1) {
    if (!cursor || typeof cursor !== "object") {
      return undefined;
    }
    cursor = cursor[pathSegments[i]];
  }
  return cursor;
};

const buildPathString = (segments) => segments.join(".");

export const harmonizeHardFilterState = (entry) => {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const setOps = {};
  const unsetOps = {};
  let dirty = false;

  FIELD_MAPPINGS.forEach((config) => {
    const { field, sources, normalize } = config;
    const currentValue = entry[field];

    for (const source of sources) {
      const segments = source.split(".");
      if (!hasPath(entry, segments)) {
        continue;
      }

      const raw = getPathValue(entry, segments);
      const normalized = normalize ? normalize(raw) : raw;
      if (normalized === undefined) {
        continue;
      }

      if (!Object.is(currentValue, normalized)) {
        entry[field] = normalized;
        setOps[field] = normalized;
        dirty = true;
      }

      if (source !== field) {
        unsetOps[buildPathString(segments)] = "";
        dirty = true;
      }

      break;
    }
  });

  if (!dirty) {
    return null;
  }

  const update = {};
  if (Object.keys(setOps).length) {
    update.$set = setOps;
  }
  if (Object.keys(unsetOps).length) {
    update.$unset = unsetOps;
  }
  return Object.keys(update).length ? update : null;
};
