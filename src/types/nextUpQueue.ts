export type NextUpItemType = 'resume' | 'revision' | 'feedback';

export interface NextUpItem {
  id: string;           // stable React key: "resume-{storyId}", "revision-{passId}-{itemId}", "feedback-{storyId}"
  type: NextUpItemType;
  storyId: string;
  storyTitle: string;
  actionLabel: string;  // "Resume scene" | "Finish revision item" | "Review new feedback"
  contextLabel: string; // story title / checklist prompt (truncated) / reader count label
  updatedAt: number;    // source timestamp used for ordering
  href: string;         // "/story/{id}", "/story/{id}?panel=revision", "/story/{id}?panel=feedback"
  passId?: string;      // revision-only
  itemId?: string;      // revision-only
  feedbackIds?: string[]; // feedback-only
}
