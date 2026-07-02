import { useEffect, useRef } from "react";
import { useUIStore } from "@/store/uiStore";

/**
 * Uses IntersectionObserver to track which page is currently most visible
 * in the viewer scroll container, and updates uiStore.currentPage accordingly.
 */
export function useScrollSync(containerRef: React.RefObject<HTMLDivElement | null>) {
  const setCurrentPage = useUIStore((s) => s.setCurrentPage);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const pageEntries = useRef<Map<number, IntersectionObserverEntry>>(new Map());

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const idx = parseInt(
            (entry.target as HTMLElement).dataset.pageIndex ?? "0",
            10
          );
          pageEntries.current.set(idx, entry);
        }

        // Find the most visible page
        let maxRatio = 0;
        let currentIdx = 0;
        for (const [idx, entry] of pageEntries.current) {
          if (entry.intersectionRatio > maxRatio) {
            maxRatio = entry.intersectionRatio;
            currentIdx = idx;
          }
        }
        setCurrentPage(currentIdx);
      },
      {
        root: container,
        threshold: [0, 0.25, 0.5, 0.75, 1.0],
      }
    );

    // Observe all page elements
    const pageEls = container.querySelectorAll("[data-page-index]");
    pageEls.forEach((el) => observerRef.current?.observe(el));

    return () => {
      observerRef.current?.disconnect();
    };
  }, [containerRef, setCurrentPage]);

  return observerRef;
}
