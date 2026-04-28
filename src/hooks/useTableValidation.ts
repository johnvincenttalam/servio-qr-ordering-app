import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAppStore } from "@/store/useAppStore";
import { isValidTableId } from "@/utils";

interface UseTableValidationReturn {
  isValid: boolean;
  error: string | null;
}

export function useTableValidation(): UseTableValidationReturn {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setTableId = useAppStore((s) => s.setTableId);
  const [error, setError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    const tableParam = searchParams.get("t");

    if (!tableParam) {
      setError("No table ID provided. Please scan a valid QR code.");
      return;
    }

    if (!isValidTableId(tableParam)) {
      setError(`Invalid table "${tableParam}". Please scan a valid QR code.`);
      return;
    }

    setTableId(tableParam);
    setIsValid(true);
    navigate("/menu", { replace: true });
  }, [searchParams, setTableId, navigate]);

  return { isValid, error };
}
