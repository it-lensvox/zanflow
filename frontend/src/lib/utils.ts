import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(date);
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function plainTextToHtml(text: string): string {
  // Already HTML — don't double-process
  if (/<[a-z][\s\S]*>/i.test(text)) return text;

  const applyInline = (s: string) =>
    s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  const result: string[] = [];
  let inUl = false;
  let inOl = false;

  const closeOpenLists = () => {
    if (inUl) { result.push('</ul>'); inUl = false; }
    if (inOl) { result.push('</ol>'); inOl = false; }
  };

  // Split on explicit newlines first
  const lines = text.split('\n');

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (line.trim() === '') {
      closeOpenLists();
      result.push('<p style="margin:0 0 8px"></p>');
      continue;
    }

    // Bullet list
    const bulletMatch = line.match(/^(\s*)([-•*])\s+(.+)/);
    if (bulletMatch) {
      if (inOl) { result.push('</ol>'); inOl = false; }
      if (!inUl) { result.push('<ul style="margin:0 0 8px;padding-left:20px">'); inUl = true; }
      result.push(`<li>${applyInline(bulletMatch[3])}</li>`);
      continue;
    }

    // Numbered list
    const numberedMatch = line.match(/^(\s*)\d+[.)]\s+(.+)/);
    if (numberedMatch) {
      if (inUl) { result.push('</ul>'); inUl = false; }
      if (!inOl) { result.push('<ol style="margin:0 0 8px;padding-left:20px">'); inOl = true; }
      result.push(`<li>${applyInline(numberedMatch[2])}</li>`);
      continue;
    }

    // Long prose paragraph — split at sentence boundaries into readable chunks.
    // Heuristic: ". " followed by a capital letter = new sentence.
    // Group every 2 sentences into one paragraph for readability.
    closeOpenLists();

    const trimmed = line.trim();
    const sentences = trimmed
      .split(/(?<=[.!?])\s+(?=[A-Z])/)
      .map(s => s.trim())
      .filter(Boolean);

    if (sentences.length <= 2) {
      // Short enough — one paragraph
      result.push(`<p style="margin:0 0 8px">${applyInline(trimmed)}</p>`);
    } else {
      // Group into paragraphs of 2 sentences each
      for (let i = 0; i < sentences.length; i += 2) {
        const chunk = sentences.slice(i, i + 2).join(' ');
        result.push(`<p style="margin:0 0 8px">${applyInline(chunk)}</p>`);
      }
    }
  }

  closeOpenLists();
  return result.join('');
}

// Strips HTML tags from a string and returns clean, readable plain text.
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s{2,}/g, ' ') 
    .trim();
}

// getProjectTypeColor moved to src/config/projectTypeConfig.ts
export { getProjectTypeColor } from '@/config/projectTypeConfig';