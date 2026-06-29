import { db } from '../db.js';

/** Level playable if owned, demo, public, or favorited by user */
export function canPlayLevel(levelId: string, userId: string): boolean {
  const row = db
    .prepare(
      `SELECT l.id FROM levels l
       LEFT JOIN level_favorites f ON f.level_id = l.id AND f.user_id = ?
       WHERE l.id = ?
         AND (l.user_id = ? OR l.is_demo = 1 OR l.is_public = 1 OR f.user_id IS NOT NULL)`
    )
    .get(userId, levelId, userId);
  return !!row;
}
