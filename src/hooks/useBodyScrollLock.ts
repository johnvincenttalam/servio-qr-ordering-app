import { useEffect } from "react";

/**
 * Lock document body scroll without visibly jumping the page. The
 * standard "position: fixed + negative top" trick — captures scrollY
 * at the moment the lock activates, freezes the body in place at that
 * offset, and restores both styles + scrollY on cleanup.
 *
 * Used by the customer-side bottom sheet to replace base-ui Dialog's
 * built-in scroll lock, which was causing a visible flash to the top
 * of the page when modals opened on a scrolled view.
 */
export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof window === "undefined") return;

    const scrollY = window.scrollY;
    const body = document.body;
    const original = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    };

    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";

    return () => {
      body.style.position = original.position;
      body.style.top = original.top;
      body.style.left = original.left;
      body.style.right = original.right;
      body.style.width = original.width;
      body.style.overflow = original.overflow;
      // Restore scroll without animation — the visual position is
      // unchanged so this is invisible to the user.
      window.scrollTo(0, scrollY);
    };
  }, [active]);
}
