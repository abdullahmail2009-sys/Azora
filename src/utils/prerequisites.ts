export interface PrerequisiteCheckResult {
  hasUnmetPrerequisites: boolean;
  unmetPrerequisiteIds: string[];
  warningMessage?: string;
}

/**
 * Checks whether all declared prerequisites for a topic are completed.
 */
export function checkPrerequisites(
  topicId: string,
  declaredPrerequisites: string[] = [],
  completedTopicIds: Set<string>,
  topicTitleLookup: Record<string, string> = {}
): PrerequisiteCheckResult {
  if (!declaredPrerequisites || declaredPrerequisites.length === 0) {
    return { hasUnmetPrerequisites: false, unmetPrerequisiteIds: [] };
  }

  const unmet = declaredPrerequisites.filter((prereqId) => !completedTopicIds.has(prereqId));

  if (unmet.length === 0) {
    return { hasUnmetPrerequisites: false, unmetPrerequisiteIds: [] };
  }

  const unmetNames = unmet.map((id) => topicTitleLookup[id] || id).join(', ');
  return {
    hasUnmetPrerequisites: true,
    unmetPrerequisiteIds: unmet,
    warningMessage: `Prerequisite recommendation: Complete ${unmetNames} before studying this topic for better conceptual continuity. (You can still proceed if you wish).`,
  };
}

/**
 * Checks if adding a new dependency (from child -> parent) would create a cycle.
 * graph is Record<topicId, list of prerequisite topicIds it depends on>
 */
export function wouldCreateCycle(
  graph: Record<string, string[]>,
  newTopicId: string,
  newPrereqId: string
): boolean {
  if (newTopicId === newPrereqId) return true;

  // DFS to see if newPrereqId already depends on newTopicId directly or indirectly
  const visited = new Set<string>();

  function dfs(curr: string): boolean {
    if (curr === newTopicId) return true;
    if (visited.has(curr)) return false;
    visited.add(curr);

    const neighbors = graph[curr] || [];
    for (const neighbor of neighbors) {
      if (dfs(neighbor)) return true;
    }
    return false;
  }

  return dfs(newPrereqId);
}
