export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("zh-CN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildLooseNamePattern(name: string) {
  const parts = name.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  if (parts.length === 0) {
    return escapeRegExp(name);
  }

  return parts.map(escapeRegExp).join("[\\s._-]*");
}

export function sanitizeRepositoryDescription(
  description: string,
  repository: { owner: string; name: string },
) {
  let sanitized = description.trim();
  const ownerPattern = escapeRegExp(repository.owner);
  const namePattern = escapeRegExp(repository.name);
  const repoIdentityPattern = `${ownerPattern}\\s*\\/\\s*${namePattern}`;

  sanitized = sanitized.replace(
    new RegExp(`^(?:(?:赞助(?:商)?|Star|明星)\\s*)+${repoIdentityPattern}\\s*`, "i"),
    "",
  );

  sanitized = sanitized.replace(new RegExp(`^${repoIdentityPattern}\\s*`, "i"), "");

  const looseNamePattern = buildLooseNamePattern(repository.name);
  sanitized = sanitized.replace(
    new RegExp(`^${looseNamePattern}(?:\\s*[：:：-]\\s*|\\s+)`, "i"),
    "",
  );

  return sanitized.trim();
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}
