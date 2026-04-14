import { useCallback, useEffect, useState } from "react";
import { acceptTerms, getTermsStatus } from "../api/client";

/**
 * Terms gate: load acceptance from API; block main app until `accepted`.
 * Add AsyncStorage cache in your app if you need offline gating.
 */
export function useTermsGate(userId: string | null) {
  const [ready, setReady] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      setAccepted(false);
      setLoading(false);
      setReady(true);
      return;
    }
    setLoading(true);
    try {
      const remote = await getTermsStatus(userId);
      setAccepted(!!remote.accepted);
    } catch {
      setAccepted(false);
    } finally {
      setLoading(false);
      setReady(true);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const agree = useCallback(async () => {
    if (!userId) return;
    await acceptTerms(userId);
    setAccepted(true);
  }, [userId]);

  return { ready, loading, accepted, agree, refresh };
}
