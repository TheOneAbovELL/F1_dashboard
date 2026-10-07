import { useCallback, useEffect, useRef, useState } from 'react';

interface DocumentPiP {
  requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
}

const getApi = (): DocumentPiP | null =>
  typeof window !== 'undefined' && 'documentPictureInPicture' in window
    ? (window as unknown as { documentPictureInPicture: DocumentPiP }).documentPictureInPicture
    : null;

function cloneStyles(target: Window): void {
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const rules = Array.from(sheet.cssRules)
        .map((rule) => rule.cssText)
        .join('\n');
      const style = target.document.createElement('style');
      style.textContent = rules;
      target.document.head.appendChild(style);
    } catch {
      if (sheet.href) {
        const link = target.document.createElement('link');
        link.rel = 'stylesheet';
        link.href = sheet.href;
        target.document.head.appendChild(link);
      }
    }
  }
  target.document.documentElement.classList.add('dark');
  target.document.body.style.margin = '0';
  target.document.body.style.background = '#06060B';
  target.document.body.style.colorScheme = 'dark';
}

export function useDocumentPiP() {
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const [supported] = useState(() => getApi() !== null);
  const closingRef = useRef(false);

  const open = useCallback(async ({ width = 408, height = 492 }: { width?: number; height?: number } = {}) => {
    const api = getApi();
    if (!api) return null;
    try {
      const win = await api.requestWindow({ width, height });
      cloneStyles(win);
      win.addEventListener('pagehide', () => {
        if (!closingRef.current) setPipWindow(null);
      });
      setPipWindow(win);
      return win;
    } catch {
      return null;
    }
  }, []);

  const close = useCallback(() => {
    closingRef.current = true;
    pipWindow?.close();
    setPipWindow(null);
    closingRef.current = false;
  }, [pipWindow]);

  useEffect(() => () => {
    pipWindow?.close();
  }, [pipWindow]);

  return { supported, pipWindow, open, close, active: pipWindow !== null };
}
