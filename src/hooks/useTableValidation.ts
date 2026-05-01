import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAppStore } from "@/store/useAppStore";
import { supabase } from "@/lib/supabase";

interface UseTableValidationReturn {
  isValid: boolean;
  isChecking: boolean;
  error: string | null;
}

export function useTableValidation(): UseTableValidationReturn {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setTableId = useAppStore((s) => s.setTableId);
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

    (async () => {
      // RLS allows anonymous SELECT only for non-archived tables, so a
      // missing row covers both "doesn't exist" and "was archived".
      const { data, error: queryError } = await supabase
        .from("tables")
        .select("id")
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

      setTableId(tableParam);
      setIsValid(true);
      setIsChecking(false);
      navigate("/menu", { replace: true });
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, setTableId, navigate]);

  return { isValid, isChecking, error };
}
