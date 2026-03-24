'use client';

import { useRouter, usePathname } from 'next/navigation';

export interface Command {
  id: string;
  label: string;
  group: 'Navigation' | 'Story' | 'View' | 'Panels' | 'Actions' | 'Help';
  shortcut?: string;
  action: () => void;
  keywords?: string[];
  storyOnly?: boolean;
}

function dispatchStoryCommand(detail: Record<string, unknown>) {
  window.dispatchEvent(new CustomEvent('story:palette-command', { detail }));
}

export function filterCommands(commands: Command[], query: string): Command[] {
  if (!query.trim()) return commands;
  const q = query.toLowerCase();
  return commands.filter(cmd => {
    const haystack = [cmd.label, ...(cmd.keywords ?? [])].join(' ').toLowerCase();
    return q.split(' ').every(word => haystack.includes(word));
  });
}

export function useCommands(onClose: () => void, onOpenHelp: () => void): Command[] {
  const router = useRouter();
  const pathname = usePathname();

  const storyId = pathname.startsWith('/story/')
    ? pathname.split('/')[2]
    : null;

  const navigationCommands: Command[] = [
    {
      id: 'nav-home',
      label: 'Go to Home',
      group: 'Navigation',
      keywords: ['home', 'start', 'main'],
      action: () => { router.push('/'); onClose(); },
    },
    {
      id: 'nav-stories',
      label: 'Go to Stories',
      group: 'Navigation',
      keywords: ['stories', 'library', 'list'],
      action: () => { router.push('/stories'); onClose(); },
    },
    {
      id: 'nav-series',
      label: 'Go to Series',
      group: 'Navigation',
      keywords: ['series', 'collection'],
      action: () => { router.push('/series'); onClose(); },
    },
    {
      id: 'nav-settings',
      label: 'Go to Settings',
      group: 'Navigation',
      keywords: ['settings', 'preferences', 'config'],
      action: () => { router.push('/settings'); onClose(); },
    },
  ];

  const storyViewCommands: Command[] = storyId ? [
    {
      id: 'view-editor',
      label: 'Switch to Editor',
      group: 'Story',
      keywords: ['editor', 'write', 'draft', 'text'],
      storyOnly: true,
      action: () => { dispatchStoryCommand({ action: 'set-view', view: 'editor' }); onClose(); },
    },
    {
      id: 'view-corkboard',
      label: 'Switch to Corkboard',
      group: 'Story',
      keywords: ['corkboard', 'scenes', 'cards', 'board'],
      storyOnly: true,
      action: () => { dispatchStoryCommand({ action: 'set-view', view: 'corkboard' }); onClose(); },
    },
    {
      id: 'view-submissions',
      label: 'Switch to Submissions',
      group: 'Story',
      keywords: ['submissions', 'submit', 'query', 'send'],
      storyOnly: true,
      action: () => { dispatchStoryCommand({ action: 'set-view', view: 'submissions' }); onClose(); },
    },
    {
      id: 'view-pacing',
      label: 'Switch to Pacing',
      group: 'Story',
      keywords: ['pacing', 'pace', 'rhythm', 'flow'],
      storyOnly: true,
      action: () => { dispatchStoryCommand({ action: 'set-view', view: 'pacing' }); onClose(); },
    },
    {
      id: 'view-diagnostics',
      label: 'Switch to Diagnostics',
      group: 'Story',
      keywords: ['diagnostics', 'stats', 'analysis', 'word count'],
      storyOnly: true,
      action: () => { dispatchStoryCommand({ action: 'set-view', view: 'diagnostics' }); onClose(); },
    },
  ] : [];

  const panelCommands: Command[] = storyId ? [
    {
      id: 'panel-notes',
      label: 'Open Notes',
      group: 'Panels',
      keywords: ['notes', 'note', 'jot'],
      storyOnly: true,
      action: () => { dispatchStoryCommand({ action: 'set-panel', panel: 'notes' }); onClose(); },
    },
    {
      id: 'panel-revision',
      label: 'Open Revision',
      group: 'Panels',
      keywords: ['revision', 'revise', 'pass', 'edit'],
      storyOnly: true,
      action: () => { dispatchStoryCommand({ action: 'set-panel', panel: 'revision' }); onClose(); },
    },
    {
      id: 'panel-collab',
      label: 'Open Collaboration',
      group: 'Panels',
      keywords: ['collaboration', 'collab', 'share', 'co-write'],
      storyOnly: true,
      action: () => { dispatchStoryCommand({ action: 'set-panel', panel: 'collab' }); onClose(); },
    },
    {
      id: 'panel-feedback',
      label: 'Open Feedback',
      group: 'Panels',
      keywords: ['feedback', 'comments', 'review'],
      storyOnly: true,
      action: () => { dispatchStoryCommand({ action: 'set-panel', panel: 'feedback' }); onClose(); },
    },
    {
      id: 'panel-close',
      label: 'Close Panel',
      group: 'Panels',
      keywords: ['close', 'hide', 'dismiss', 'panel'],
      storyOnly: true,
      action: () => { dispatchStoryCommand({ action: 'set-panel', panel: null }); onClose(); },
    },
  ] : [];

  const actionCommands: Command[] = storyId ? [
    {
      id: 'action-focus',
      label: 'Enter Focus Mode',
      group: 'Actions',
      keywords: ['focus', 'distraction free', 'zen'],
      storyOnly: true,
      action: () => { dispatchStoryCommand({ action: 'toggle-focus' }); onClose(); },
    },
    {
      id: 'action-share',
      label: 'Share / Preview',
      group: 'Actions',
      keywords: ['share', 'preview', 'link', 'publish'],
      storyOnly: true,
      action: () => { dispatchStoryCommand({ action: 'open-share' }); onClose(); },
    },
    {
      id: 'action-add-scene',
      label: 'Add Scene',
      group: 'Actions',
      keywords: ['add scene', 'new scene', 'create scene', 'chapter'],
      storyOnly: true,
      action: () => { dispatchStoryCommand({ action: 'add-scene' }); onClose(); },
    },
  ] : [];

  const helpCommands: Command[] = [
    {
      id: 'help-shortcuts',
      label: 'Keyboard Shortcuts',
      group: 'Help',
      shortcut: '?',
      keywords: ['shortcuts', 'keyboard', 'help', 'keys', 'hotkeys'],
      action: () => { onClose(); onOpenHelp(); },
    },
  ];

  return [
    ...navigationCommands,
    ...storyViewCommands,
    ...panelCommands,
    ...actionCommands,
    ...helpCommands,
  ];
}
