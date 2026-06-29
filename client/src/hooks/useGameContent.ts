import { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';
import type { AssetSchema, SkillSchema, MusicSchema } from '../types';
import { mergeById } from '../utils/mergeContent';

export interface MusicTrackRef {
  id: string;
  name: string;
  data: MusicSchema;
}

export function useGameContent() {
  const [assets, setAssets] = useState<AssetSchema[]>([]);
  const [skills, setSkills] = useState<SkillSchema[]>([]);
  const [musicTracks, setMusicTracks] = useState<MusicTrackRef[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [ownAssets, pubAssets, ownSkills, pubSkills, ownMusic, pubMusic] =
      await Promise.all([
        api.assets.list(),
        api.assets.listPublic(),
        api.skills.list(),
        api.skills.listPublic(),
        api.music.list(),
        api.music.listPublic(),
      ]);

    const mergedAssets = mergeById(
      ownAssets.map((a) => a.data),
      pubAssets.map((a) => a.data)
    );
    const mergedSkills = mergeById(
      ownSkills.map((s) => s.data),
      pubSkills.map((s) => s.data)
    );
    const mergedMusic = mergeById(
      ownMusic.map((t) => ({ id: t.id, name: t.name, data: t.data })),
      pubMusic.map((t) => ({ id: t.id, name: t.name, data: t.data }))
    );

    setAssets(mergedAssets);
    setSkills(mergedSkills);
    setMusicTracks(mergedMusic);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { assets, skills, musicTracks, loading, reload };
}
