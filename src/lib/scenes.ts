import type { Scene, SceneStatus } from '@/types/scene';

/**
 * Mock scene data for development
 * TODO: Replace with backend API integration (GET /api/stories/:id/scenes)
 */
const MOCK_SCENES: Scene[] = [
  {
    id: 'scene-1',
    title: 'Opening Scene',
    chapter: 'Chapter 1',
    summary: 'The protagonist wakes up to discover an unexpected letter on their doorstep.',
    status: 'done',
    order: 1,
    intent: 'Establish stakes',
    pov: 'Alex',
  },
  {
    id: 'scene-2',
    title: 'The Decision',
    chapter: 'Chapter 1',
    summary: 'After reading the mysterious letter, the protagonist must decide whether to follow its cryptic instructions.',
    status: 'drafting',
    order: 2,
    intent: 'Force a choice',
    pov: 'Alex',
  },
  {
    id: 'scene-3',
    title: 'Journey Begins',
    chapter: 'Chapter 2',
    summary: 'The protagonist sets out on an unexpected journey, leaving behind everything familiar.',
    status: 'planned',
    order: 3,
    intent: 'Launch the journey',
    pov: 'Alex',
  },
  {
    id: 'scene-4',
    title: 'First Obstacle',
    chapter: 'Chapter 2',
    summary: 'An unexpected challenge tests the protagonist\'s resolve and resourcefulness.',
    status: 'planned',
    order: 4,
    intent: 'Test resolve',
    pov: 'Alex',
  },
  {
    id: 'scene-5',
    title: 'New Ally',
    chapter: 'Chapter 3',
    summary: 'The protagonist encounters a stranger who offers cryptic advice and unexpected help.',
    status: 'planned',
    order: 5,
    intent: 'Introduce ally',
    pov: 'Alex',
  },
];

/**
 * Get scenes for a story
 * Uses localStorage for v1 persistence
 *
 * @param storyId - The story identifier
 * @returns Array of scenes sorted by order
 *
 * TODO: Replace with API call to backend
 */
export function getScenes(storyId: string): Scene[] {
  if (typeof window === 'undefined') {
    return MOCK_SCENES;
  }

  const storageKey = `story-${storyId}-scenes`;
  const stored = localStorage.getItem(storageKey);

  if (stored) {
    try {
      const scenes = JSON.parse(stored) as Scene[];
      // Migrate: ensure intent/pov fields exist on stored scenes
      return scenes
        .map((s) => ({ intent: '', pov: '', characters: [], ...s }))
        .sort((a, b) => a.order - b.order);
    } catch (error) {
      console.error('Failed to parse stored scenes:', error);
    }
  }

  // Initialize with mock data on first load
  localStorage.setItem(storageKey, JSON.stringify(MOCK_SCENES));
  return MOCK_SCENES;
}

/**
 * Update scene order/position
 * Persists to localStorage for v1
 *
 * @param storyId - The story identifier
 * @param sceneId - The scene to reorder
 * @param newOrder - New order position
 *
 * TODO: Replace with API call (PATCH /api/stories/:storyId/scenes/:sceneId)
 */
export function updateSceneOrder(
  storyId: string,
  sceneId: string,
  newOrder: number
): void {
  if (typeof window === 'undefined') {
    return;
  }

  const scenes = getScenes(storyId);
  const sceneIndex = scenes.findIndex((s) => s.id === sceneId);

  if (sceneIndex === -1) {
    console.error(`Scene ${sceneId} not found`);
    return;
  }

  // Update the scene's order
  scenes[sceneIndex].order = newOrder;

  // Recompute order values to maintain sequence
  const sortedScenes = scenes.sort((a, b) => a.order - b.order);
  sortedScenes.forEach((scene, index) => {
    scene.order = index + 1;
  });

  const storageKey = `story-${storyId}-scenes`;
  localStorage.setItem(storageKey, JSON.stringify(sortedScenes));
}

/**
 * Add a new scene to a story
 * Persists to localStorage for v1
 *
 * @param storyId - The story identifier
 * @param scene - Scene data without id and order (auto-assigned)
 * @returns The created scene
 *
 * TODO: Replace with API call (POST /api/stories/:storyId/scenes)
 */
export function addScene(
  storyId: string,
  scene: Omit<Scene, 'id' | 'order'>
): Scene {
  if (typeof window === 'undefined') {
    throw new Error('addScene requires browser environment');
  }

  const scenes = getScenes(storyId);
  const maxOrder = scenes.reduce((max, s) => Math.max(max, s.order), 0);
  const newScene: Scene = {
    ...scene,
    id: crypto.randomUUID(),
    order: maxOrder + 1,
  };
  scenes.push(newScene);
  const storageKey = `story-${storyId}-scenes`;
  localStorage.setItem(storageKey, JSON.stringify(scenes));
  return newScene;
}

/**
 * Update scene fields (title, summary, intent, pov)
 * Persists to localStorage for v1
 *
 * @param storyId - The story identifier
 * @param sceneId - The scene to update
 * @param updates - Partial field updates
 *
 * TODO: Replace with API call (PATCH /api/stories/:storyId/scenes/:sceneId)
 */
export function updateSceneFields(
  storyId: string,
  sceneId: string,
  updates: Partial<Pick<Scene, 'title' | 'summary' | 'intent' | 'pov' | 'characters'>>
): void {
  if (typeof window === 'undefined') {
    return;
  }

  const scenes = getScenes(storyId);
  const scene = scenes.find((s) => s.id === sceneId);

  if (!scene) {
    console.error(`Scene ${sceneId} not found`);
    return;
  }

  Object.assign(scene, updates);

  const storageKey = `story-${storyId}-scenes`;
  localStorage.setItem(storageKey, JSON.stringify(scenes));
}

/**
 * Update scene status
 * Persists to localStorage for v1
 *
 * @param storyId - The story identifier
 * @param sceneId - The scene to update
 * @param status - New status value
 *
 * TODO: Replace with API call (PATCH /api/stories/:storyId/scenes/:sceneId)
 */
export function clearScenesData(storyId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(`story-${storyId}-scenes`);
}

export function updateSceneStatus(
  storyId: string,
  sceneId: string,
  status: SceneStatus
): void {
  if (typeof window === 'undefined') {
    return;
  }

  const scenes = getScenes(storyId);
  const scene = scenes.find((s) => s.id === sceneId);

  if (!scene) {
    console.error(`Scene ${sceneId} not found`);
    return;
  }

  scene.status = status;

  const storageKey = `story-${storyId}-scenes`;
  localStorage.setItem(storageKey, JSON.stringify(scenes));
}
