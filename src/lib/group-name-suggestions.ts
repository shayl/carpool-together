export type GroupSuggestion = {
  id: string;
  name: string;
  slug: string;
};

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim();
}

function editDistance(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] +
          (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[right.length];
}

function score(query: string, candidate: string) {
  if (!candidate) return Number.POSITIVE_INFINITY;
  const distance = editDistance(query, candidate);
  const normalizedDistance = distance / Math.max(query.length, candidate.length);
  return candidate.includes(query) || query.includes(candidate)
    ? normalizedDistance * 0.5
    : normalizedDistance;
}

export function nearestGroupSuggestions(
  identifier: string,
  groups: GroupSuggestion[],
  limit = 3,
) {
  const query = normalize(identifier);
  return groups
    .map((group) => ({
      group,
      score: Math.min(
        score(query, normalize(group.name)),
        score(query, normalize(group.slug)),
      ),
    }))
    .sort(
      (left, right) =>
        left.score - right.score ||
        left.group.name.localeCompare(right.group.name),
    )
    .slice(0, limit)
    .map(({ group }) => group);
}
