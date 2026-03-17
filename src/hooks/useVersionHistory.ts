'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  getVersions,
  addAutoCheckpoint,
  addNamedVersion,
  restoreVersion,
  type VersionEntry,
} from '@/lib/versions';

interface UseVersionHistoryOptions {
  storyId: string;
  content: string;
  onRestore: (content: string, version: VersionEntry) => void;
}

interface UseVersionHistoryResult {
  versions: VersionEntry[];
  hasVersions: boolean;
  saveNamedDraft: (label: string) => void;
  restoreToVersion: (versionId: string) => void;
  refreshVersions: () => void;
}

export function useVersionHistory({
  storyId,
  content,
  onRestore,
}: UseVersionHistoryOptions): UseVersionHistoryResult {
  const [versions, setVersions] = useState<VersionEntry[]>(() => getVersions(storyId));

  const contentRef = useRef(content);
  contentRef.current = content;

  const lastCheckpointContentRef = useRef<string>('');
  const checkpointTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    checkpointTimerRef.current = setInterval(() => {
      const currentContent = contentRef.current;
      if (currentContent !== lastCheckpointContentRef.current && currentContent.trim() !== '') {
        try {
          addAutoCheckpoint(storyId, currentContent);
          lastCheckpointContentRef.current = currentContent;
          setVersions(getVersions(storyId));
        } catch {
          // Silently fail — editing must continue
        }
      }
    }, 5 * 60 * 1000);

    return () => {
      if (checkpointTimerRef.current) clearInterval(checkpointTimerRef.current);
    };
  }, [storyId]);

  const saveNamedDraft = useCallback(
    (label: string) => {
      if (!label.trim()) return;
      addNamedVersion(storyId, contentRef.current, label);
      setVersions(getVersions(storyId));
    },
    [storyId]
  );

  const restoreToVersion = useCallback(
    (versionId: string) => {
      const entry = restoreVersion(storyId, versionId, contentRef.current);
      if (entry) {
        setVersions(getVersions(storyId));
        onRestore(entry.content, entry);
      }
    },
    [storyId, onRestore]
  );

  const refreshVersions = useCallback(() => {
    setVersions(getVersions(storyId));
  }, [storyId]);

  return {
    versions,
    hasVersions: versions.length > 0,
    saveNamedDraft,
    restoreToVersion,
    refreshVersions,
  };
}
