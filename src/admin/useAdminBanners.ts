import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { optimisticUpdate } from "@/lib/optimistic";
import {
  createBanner,
  deleteBanner,
  fetchBanners,
  saveBanner,
  setBannerActive,
  swapBannerPositions,
  type AdminBanner,
  type BannerDraft,
} from "@/services/banners";

export type { AdminBanner, BannerDraft };

interface UseAdminBannersReturn {
  items: AdminBanner[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  setActive: (id: string, active: boolean) => Promise<void>;
  save: (id: string, draft: BannerDraft) => Promise<void>;
  create: (draft: BannerDraft) => Promise<void>;
  remove: (id: string) => Promise<void>;
  move: (id: string, direction: "up" | "down") => Promise<void>;
}

export function useAdminBanners(): UseAdminBannersReturn {
  const [items, setItems] = useState<AdminBanner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const result = await fetchBanners();
    if (result.error) {
      setError(result.error);
      return;
    }
    setError(null);
    setItems(result.items);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refetch();
      if (!cancelled) setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refetch]);

  const setActive = useCallback(
    async (id: string, active: boolean) =>
      optimisticUpdate({
        apply: () =>
          setItems((prev) =>
            prev.map((b) => (b.id === id ? { ...b, active } : b))
          ),
        request: () => setBannerActive(id, active),
        refetch,
        errorMessage: "Couldn't update banner",
        successMessage: null,
        logTag: "[admin/banners] toggle active",
      }),
    [refetch]
  );

  const save = useCallback(
    async (id: string, draft: BannerDraft) => {
      await saveBanner(id, draft);
      await refetch();
    },
    [refetch]
  );

  const create = useCallback(
    async (draft: BannerDraft) => {
      const maxPosition = items.reduce(
        (max, b) => (b.position > max ? b.position : max),
        0
      );
      await createBanner(draft, maxPosition);
      await refetch();
    },
    [items, refetch]
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteBanner(id);
      await refetch();
    },
    [refetch]
  );

  const move = useCallback(
    async (id: string, direction: "up" | "down") => {
      // Items in state are already sorted ascending by position from the
      // initial fetch. Find the row and its neighbor in that order.
      const sorted = [...items].sort((a, b) => a.position - b.position);
      const index = sorted.findIndex((b) => b.id === id);
      if (index < 0) return;
      const neighborIndex = direction === "up" ? index - 1 : index + 1;
      if (neighborIndex < 0 || neighborIndex >= sorted.length) return;

      const current = sorted[index];
      const neighbor = sorted[neighborIndex];

      // Optimistic: swap positions AND re-sort the array so the row visually
      // moves up/down immediately. Wrapped in startViewTransition so the
      // browser smoothly morphs each row from old to new position.
      const performSwap = () => {
        setItems((prev) => {
          const next = prev.map((b) => {
            if (b.id === current.id)
              return { ...b, position: neighbor.position };
            if (b.id === neighbor.id)
              return { ...b, position: current.position };
            return b;
          });
          return next.sort((a, b) => a.position - b.position);
        });
      };

      const docVT = document as Document & {
        startViewTransition?: (cb: () => void) => unknown;
      };
      if (typeof docVT.startViewTransition === "function") {
        docVT.startViewTransition(performSwap);
      } else {
        performSwap();
      }

      const { error: swapError } = await swapBannerPositions(current, neighbor);
      if (swapError) {
        toast.error("Couldn't reorder");
        await refetch();
      }
    },
    [items, refetch]
  );

  return { items, isLoading, error, refetch, setActive, save, create, remove, move };
}
