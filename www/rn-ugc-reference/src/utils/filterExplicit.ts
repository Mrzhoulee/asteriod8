/** Song shape minimal for filtering — align with your CMS / Firestore document */
export type SongWithExplicit = {
  id: string;
  title: string;
  isExplicit?: boolean;
  uploaderId?: string;
};

/**
 * Apply user preference: when hideExplicit is true, drop tracks with isExplicit === true.
 * Also removes songs from blockedUserIds (instant feed hygiene).
 */
export function filterFeedSongs(
  songs: SongWithExplicit[],
  opts: { hideExplicit: boolean; blockedUserIds: Set<string> }
): SongWithExplicit[] {
  return songs.filter((s) => {
    if (s.uploaderId && opts.blockedUserIds.has(s.uploaderId)) return false;
    if (opts.hideExplicit && s.isExplicit === true) return false;
    return true;
  });
}
