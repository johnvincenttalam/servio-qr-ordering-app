import { toast } from "sonner";

type DbResult = { error: unknown };

interface OptimisticUpdateOptions {
  /**
   * Apply the optimistic UI mutation immediately so the click feels
   * instant. Runs before the network request; called exactly once.
   */
  apply: () => void;
  /**
   * Reverse the optimistic mutation. Invoked when the operator hits
   * Undo on the success toast. Optional — when omitted (or together
   * with undoRequest), the success toast renders without an Undo
   * action.
   */
  undo?: () => void;
  /**
   * The DB write that persists the change. PromiseLike (not Promise)
   * so callers can return a Supabase query-builder directly without
   * awaiting it first — the builder is thenable but isn't a structural
   * Promise from TypeScript's perspective.
   */
  request: () => PromiseLike<DbResult>;
  /** The DB write that reverses the change on Undo. */
  undoRequest?: () => PromiseLike<DbResult>;
  /** Resync from source-of-truth on any failure path. */
  refetch: () => Promise<void>;
  /** Toast shown on a failed primary write. */
  errorMessage: string;
  /**
   * Toast shown on a successful primary write, with the Undo action
   * attached. Pass null to skip the toast (e.g. no-op writes that
   * shouldn't notify the operator).
   */
  successMessage: string | null;
  /** Toast shown if Undo itself fails. */
  undoErrorMessage?: string;
  /** Console.error prefix — eases tracing in dev tools. */
  logTag: string;
}

/**
 * Wraps the optimistic-update lifecycle: paint locally → write → toast
 * with Undo on success, or rollback + resync on failure. Centralises
 * the "apply / request / undo / undoRequest / messaging" plumbing
 * that was previously duplicated across the menu hook's setInStock,
 * setInStockBulk, and setPrice.
 *
 * Callers describe the four moving parts (apply, undo, request,
 * undoRequest) plus messaging; this helper handles the toasts,
 * console errors, and refetch on failure.
 */
export async function optimisticUpdate({
  apply,
  undo,
  request,
  undoRequest,
  refetch,
  errorMessage,
  successMessage,
  undoErrorMessage = "Couldn't undo — try again",
  logTag,
}: OptimisticUpdateOptions): Promise<void> {
  apply();

  const { error } = await request();
  if (error) {
    console.error(`${logTag} failed:`, error);
    toast.error(errorMessage);
    await refetch();
    return;
  }

  if (!successMessage) return;

  // No undo path wired — plain toast.
  if (!undo || !undoRequest) {
    toast(successMessage);
    return;
  }

  toast(successMessage, {
    action: {
      label: "Undo",
      onClick: async () => {
        undo();
        const { error: undoError } = await undoRequest();
        if (undoError) {
          console.error(`${logTag} undo failed:`, undoError);
          toast.error(undoErrorMessage);
          await refetch();
        }
      },
    },
    duration: 4000,
  });
}
