import type { Scene } from '@/types/scene';
import type { PassType, ItemStatus, RevisionItem, RevisionPass } from '@/types/revision';

const REVISION_KEY = (storyId: string) => `story-${storyId}-revision`;
const MAX_PASSES_PER_STORY = 10;

export function getPasses(storyId: string): RevisionPass[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(REVISION_KEY(storyId));
    return raw ? (JSON.parse(raw) as RevisionPass[]) : [];
  } catch {
    return [];
  }
}

function savePasses(storyId: string, passes: RevisionPass[]): void {
  localStorage.setItem(REVISION_KEY(storyId), JSON.stringify(passes));
}

export function getActivePass(storyId: string, type: PassType): RevisionPass | null {
  const passes = getPasses(storyId);
  const ofType = passes.filter((p) => p.type === type && !p.completedAt);
  return ofType.length > 0 ? ofType[ofType.length - 1] : null;
}

export function getLatestCompletedPass(storyId: string, type: PassType): RevisionPass | null {
  const passes = getPasses(storyId);
  const completed = passes.filter((p) => p.type === type && !!p.completedAt);
  return completed.length > 0 ? completed[completed.length - 1] : null;
}

// --- Item generators ---

function generateArcConsistencyItems(scenes: Scene[]): Omit<RevisionItem, 'id' | 'passId'>[] {
  const items: Omit<RevisionItem, 'id' | 'passId'>[] = scenes.map((scene) => ({
    sceneId: scene.id,
    chapter: scene.chapter,
    sceneTitle: scene.title,
    prompt: `Does '${scene.title}' directly serve the story's central arc? Does the scene outcome move the protagonist forward or backward?`,
    status: 'open' as ItemStatus,
    rationale: '',
  }));
  items.push({
    sceneId: null,
    chapter: 'Story',
    sceneTitle: 'Overall Arc',
    prompt: "Does the overall story arc have a clear escalation from Act 1 to Act 3?",
    status: 'open',
    rationale: '',
  });
  return items;
}

function generatePromisePayoffItems(scenes: Scene[]): Omit<RevisionItem, 'id' | 'passId'>[] {
  const items: Omit<RevisionItem, 'id' | 'passId'>[] = scenes.map((scene) => ({
    sceneId: scene.id,
    chapter: scene.chapter,
    sceneTitle: scene.title,
    prompt: `Does '${scene.title}' plant a setup that pays off later, or deliver a payoff for an earlier promise?`,
    status: 'open' as ItemStatus,
    rationale: '',
  }));
  const chapters = Array.from(new Set(scenes.map((s) => s.chapter)));
  for (const chapter of chapters) {
    items.push({
      sceneId: null,
      chapter,
      sceneTitle: `${chapter} — Chapter Review`,
      prompt: `Are all setups in ${chapter} paid off by the final chapter?`,
      status: 'open',
      rationale: '',
    });
  }
  return items;
}

function generateVoiceDriftItems(scenes: Scene[]): Omit<RevisionItem, 'id' | 'passId'>[] {
  return scenes.map((scene) => {
    if (scene.pov) {
      return {
        sceneId: scene.id,
        chapter: scene.chapter,
        sceneTitle: scene.title,
        prompt: `Does '${scene.title}' maintain consistent voice and POV for ${scene.pov}?`,
        status: 'open' as ItemStatus,
        rationale: '',
      };
    }
    return {
      sceneId: scene.id,
      chapter: scene.chapter,
      sceneTitle: scene.title,
      prompt: `Who is the POV character in '${scene.title}'? Is the voice consistent with surrounding scenes?`,
      status: 'open' as ItemStatus,
      rationale: '',
    };
  });
}

export function createPass(storyId: string, type: PassType, scenes: Scene[]): RevisionPass {
  const passId = crypto.randomUUID();
  const rawItems = (() => {
    switch (type) {
      case 'arc-consistency': return generateArcConsistencyItems(scenes);
      case 'promise-payoff': return generatePromisePayoffItems(scenes);
      case 'voice-drift': return generateVoiceDriftItems(scenes);
    }
  })();
  const items: RevisionItem[] = rawItems.map((item) => ({
    ...item,
    id: crypto.randomUUID(),
    passId,
  }));
  const pass: RevisionPass = {
    id: passId,
    storyId,
    type,
    startedAt: Date.now(),
    items,
  };
  let passes = getPasses(storyId);
  passes.push(pass);
  // Trim oldest if over limit
  if (passes.length > MAX_PASSES_PER_STORY) {
    passes = passes.slice(passes.length - MAX_PASSES_PER_STORY);
  }
  savePasses(storyId, passes);
  return pass;
}

export function updateItem(
  storyId: string,
  passId: string,
  itemId: string,
  updates: Partial<Pick<RevisionItem, 'status' | 'rationale'>>
): void {
  const passes = getPasses(storyId);
  const pass = passes.find((p) => p.id === passId);
  if (!pass) return;
  const item = pass.items.find((i) => i.id === itemId);
  if (!item) return;
  Object.assign(item, updates);
  savePasses(storyId, passes);
}

export function completePass(storyId: string, passId: string): void {
  const passes = getPasses(storyId);
  const pass = passes.find((p) => p.id === passId);
  if (!pass) return;
  pass.completedAt = Date.now();
  savePasses(storyId, passes);
}

export function exportPassReport(pass: RevisionPass, storyTitle: string): string {
  const passLabels: Record<PassType, string> = {
    'arc-consistency': 'Arc Consistency',
    'promise-payoff': 'Promise/Payoff',
    'voice-drift': 'Voice Drift',
  };
  const label = passLabels[pass.type];
  const startedDate = new Date(pass.startedAt).toLocaleDateString();
  const resolved = pass.items.filter((i) => i.status !== 'open').length;
  const total = pass.items.length;
  const pct = total > 0 ? Math.round((resolved / total) * 100) : 0;

  const chapters = Array.from(new Set(pass.items.map((i) => i.chapter)));
  const sections = chapters.map((chapter) => {
    const chapterItems = pass.items.filter((i) => i.chapter === chapter);
    const itemLines = chapterItems.map((item) => {
      const statusLabel = item.status.charAt(0).toUpperCase() + item.status.slice(1);
      const rationaleText = item.rationale ? ` | Rationale: ${item.rationale}` : '';
      return `  ${item.sceneTitle} — ${item.prompt}\n  Status: ${statusLabel}${rationaleText}`;
    });
    return `=== ${chapter} ===\n${itemLines.join('\n\n')}`;
  });

  const unresolvedCount = pass.items.filter((i) => i.status === 'open').length;

  return [
    `${label} Pass Report — ${storyTitle}`,
    `Started: ${startedDate}`,
    `Completion: ${pct}%`,
    '',
    sections.join('\n\n'),
    '',
    `Unresolved: ${unresolvedCount}`,
  ].join('\n');
}
