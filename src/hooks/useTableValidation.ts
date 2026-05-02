import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAppStore } from "@/store/useAppStore";
import { supabase } from "@/lib/supabase";
import { getDeviceId } from "@/lib/deviceId";
import {
  startCustomerSession,
  SESSION_ERROR_COPY,
} from "@/services/sessions";

interface UseTableValidationReturn {
  isValid: boolean;
  isChecking: boolean;
  error: string | null;
}

export function useTableValidation(): UseTableValidationReturn {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setTableId = useAppStore((s) => s.setTableId);
  const setCustomerSession = useAppStore((s) => s.setCustomerSession);
  const clearCustomerSession = useAppStore((s) => s.clearCustomerSession);
  const [error, setError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const tableParam = searchParams.get("t");

    if (!tableParam) {
      setError("No table ID provided. Please scan a valid QR code.");
      setIsChecking(false);
      return;
    }

    let cancelled = false;
    setIsChecking(true);
    setError(null);

    // Clear any previously-stored tableId so the header / cart chrome
    // doesn't flash the OLD table while we validate the new one. If the
    // new QR is valid we'll set it from the success branch; if invalid
    // we want it cleared anyway so the customer sees a fresh state.
    setTableId(null);
    clearCustomerSession();

    (async () => {
      // RLS allows anonymous SELECT only for non-archived tables, so a
      // missing row covers both "doesn't exist" and "was archived".
      const { data, error: queryError } = await supabase
        .from("tables")
        .select("id, qr_token")
        .eq("id", tableParam)
        .is("archived_at", null)
        .maybeSingle();

      if (cancelled) return;

      if (queryError) {
        console.error("[useTableValidation] lookup failed:", queryError);
        setError("Couldn't verify the table. Check your connection and rescan.");
        setIsChecking(false);
        return;
      }

      if (!data) {
        setError(`Invalid table "${tableParam}". Please scan a valid QR code.`);
        setIsChecking(false);
        return;
      }

      // Token check: backwards compatible. A null qr_token means this
      // table was set up before tokens existed — accept any (or no) k
      // until the owner generates a token. Once a token is set, the URL
      // must carry the matching k.
      const k = searchParams.get("k");
      if (data.qr_token) {
        if (!k || k !== data.qr_token) {
          setError(
            "This QR code is no longer valid. Ask the staff for an updated sticker."
          );
          setIsChecking(false);
          return;
        }
      }

      // Start (or reuse) a customer session. The RPC handles the reuse
      // logic server-side, so a refresh of this page returns the same
      // session id rather than burning a fresh row each time. We only
      // call it when there's a token to send — pre-token tables fall
      // through to the legacy "no session" path that check_order_abuse
      // still allows.
      if (data.qr_token && k) {
        const sessionResult = await startCustomerSession(
          tableParam,
          k,
          getDeviceId()
        );
        if (cancelled) return;

        if (!sessionResult.ok) {
          setError(SESSION_ERROR_COPY[sessionResult.error]);
          setIsChecking(false);
          return;
        }

        setCustomerSession(
          sessionResult.session.sessionId,
          sessionResult.session.expiresAt
        );
      }

      setTableId(tableParam);
      setIsValid(true);
      setIsChecking(false);
      navigate("/menu", { replace: true });
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, setTableId, setCustomerSession, clearCustomerSession, navigate]);

  return { isValid, isChecking, error };
}
