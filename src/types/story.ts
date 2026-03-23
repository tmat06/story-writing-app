export interface Story {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  isArchived: boolean;
  seriesId?: string;
  startMode?: 'blank' | 'starter';
}
