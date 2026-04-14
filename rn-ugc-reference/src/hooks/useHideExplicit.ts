import { useCallback, useEffect, useState } from "react";
import { getUserSettings, patchUserSettings } from "../api/client";

/** Syncs “Hide explicit content” with API (default ON when no doc). */
export function useHideExplicit(userId: string | null) {
  const [hideExplicit, setHideExplicit] = useState(true);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      setHideExplicit(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const s = await getUserSettings(userId);
      setHideExplicit(s.hideExplicit !== false);
    } catch {
      setHideExplicit(true);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setValue = useCallback(
    async (value: boolean) => {
      if (!userId) return;
      setHideExplicit(value);
      try {
        await patchUserSettings(userId, value);
      } catch {
        await refresh();
      }
    },
    [userId, refresh]
  );

  return { hideExplicit, setHideExplicit: setValue, loading, refresh };
}
