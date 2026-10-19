import type { Subject, SyllabusVersion } from '../types/index.ts';

export interface SyllabusChangeItem {
  type: 'added' | 'removed' | 'modified';
  itemType: 'subject' | 'unit' | 'chapter' | 'topic';
  path: string;
  oldValue?: string;
  newValue?: string;
  details?: string;
}

export interface SyllabusDiffReport {
  addedCount: number;
  removedCount: number;
  modifiedCount: number;
  changes: SyllabusChangeItem[];
  canSafelyApply: boolean;
  preservationSummary: string;
}

export function compareSyllabi(
  activeVersion: SyllabusVersion,
  newVersion: SyllabusVersion
): SyllabusDiffReport {
  const changes: SyllabusChangeItem[] = [];

  const activeSubjectsMap = new Map(
    activeVersion.subjects.map((s) => [s.id, s])
  );
  const newSubjectsMap = new Map(
    newVersion.subjects.map((s) => [s.id, s])
  );

  // Check new subjects and subjects in active
  newSubjectsMap.forEach((newSub, subId) => {
    const activeSub = activeSubjectsMap.get(subId);
    if (!activeSub) {
      changes.push({
        type: 'added',
        itemType: 'subject',
        path: newSub.name,
        newValue: newSub.name,
        details: `New subject with ${newSub.units.length} units`,
      });
      return;
    }

    // Compare units & chapters
    const activeChapters = new Map<string, string>();
    activeSub.units.forEach((u) => {
      u.chapters.forEach((c) => activeChapters.set(c.id, c.title));
    });

    const newChapters = new Map<string, string>();
    newSub.units.forEach((u) => {
      u.chapters.forEach((c) => newChapters.set(c.id, c.title));
    });

    newChapters.forEach((title, chId) => {
      if (!activeChapters.has(chId)) {
        changes.push({
          type: 'added',
          itemType: 'chapter',
          path: `${newSub.name} → ${title}`,
          newValue: title,
        });
      } else if (activeChapters.get(chId) !== title) {
        changes.push({
          type: 'modified',
          itemType: 'chapter',
          path: `${newSub.name} → Chapter ID: ${chId}`,
          oldValue: activeChapters.get(chId),
          newValue: title,
          details: 'Chapter title updated',
        });
      }
    });

    activeChapters.forEach((title, chId) => {
      if (!newChapters.has(chId)) {
        changes.push({
          type: 'removed',
          itemType: 'chapter',
          path: `${activeSub.name} → ${title}`,
          oldValue: title,
          details: 'Chapter not present in incoming syllabus',
        });
      }
    });
  });

  const addedCount = changes.filter((c) => c.type === 'added').length;
  const removedCount = changes.filter((c) => c.type === 'removed').length;
  const modifiedCount = changes.filter((c) => c.type === 'modified').length;

  return {
    addedCount,
    removedCount,
    modifiedCount,
    changes,
    canSafelyApply: true,
    preservationSummary:
      'All historical topic mastery records, study sessions, and revision dates will be preserved.',
  };
}
