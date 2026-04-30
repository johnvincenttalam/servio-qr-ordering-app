import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

export interface AdminBanner {
  id: string;
  image: string;
  title: string | null;
  subtitle: string | null;
  position: number;
  active: boolean;
}

export interface BannerDraft {
  image: string;
  title: string | null;
  subtitle: string | null;
  active: boolean;
}

interface BannerRow {
  id: string;
  image: string;
  title: string | null;
  subtitle: string | null;
  position: number;
  active: boolean;
}

function generateId(): string {
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 5);
  return `banner-${stamp}-${rand}`;
}

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
    const { data, error: queryError } = await supabase
      .from("banners")
      .select("id, image, title, subtitle, position, active")
      .order("position", { ascending: true });

    if (queryError) {
      console.error("[admin/banners] fetch failed:", queryError);
      setError(queryError.message);
      return;
    }

    setError(null);
    setItems((data ?? []) as BannerRow[]);
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
    async (id: string, active: boolean) => {
      setItems((prev) =>
        prev.map((b) => (b.id === id ? { ...b, active } : b))
      );

      const { error: updateError } = await supabase
        .from("banners")
        .update({ active })
        .eq("id", id);

      if (updateError) {
        console.error("[admin/banners] toggle active failed:", updateError);
        toast.error("Couldn't update banner");
        await refetch();
      }
    },
    [refetch]
  );

  const draftToRow = (draft: BannerDraft) => ({
    image: draft.image,
    title: draft.title,
    subtitle: draft.subtitle,
    active: draft.active,
  });

  const save = useCallback(
    async (id: string, draft: BannerDraft) => {
      const { error: updateError } = await supabase
        .from("banners")
        .update(draftToRow(draft))
        .eq("id", id);
      if (updateError) {
        console.error("[admin/banners] save failed:", updateError);
        throw updateError;
      }
      await refetch();
    },
    [refetch]
  );

  const create = useCallback(
    async (draft: BannerDraft) => {
      const id = generateId();
      const maxPosition = items.reduce(
        (max, b) => (b.position > max ? b.position : max),
        0
      );
      const { error: insertError } = await supabase.from("banners").insert({
        id,
        ...draftToRow(draft),
        position: maxPosition + 10,
      });
      if (insertError) {
        console.error("[admin/banners] create failed:", insertError);
        throw insertError;
      }
      await refetch();
    },
    [items, refetch]
  );

  const remove = useCallback(
    async (id: string) => {
      const { error: deleteError } = await supabase
        .from("banners")
        .delete()
        .eq("id", id);
      if (deleteError) {
        console.error("[admin/banners] delete failed:", deleteError);
        throw deleteError;
      }
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

      const [r1, r2] = await Promise.all([
        supabase
          .from("banners")
          .update({ position: neighbor.position })
          .eq("id", current.id),
        supabase
          .from("banners")
          .update({ position: current.position })
          .eq("id", neighbor.id),
      ]);

      if (r1.error || r2.error) {
        console.error(
          "[admin/banners] reorder failed:",
          r1.error || r2.error
        );
        toast.error("Couldn't reorder");
        await refetch();
      }
    },
    [items, refetch]
  );

  return { items, isLoading, error, refetch, setActive, save, create, remove, move };
}
