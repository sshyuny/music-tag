import { Dexie } from 'dexie'
import { DexieSongRepository } from './dexieRepository'

/** 이전 개인용 DB는 이관하지 않는다. 새 DB는 재접속해도 유지한다. */
export async function initializeRepository({
  legacyDbName = 'music-tag',
  dbName = 'music-tag-v2',
}: { legacyDbName?: string; dbName?: string } = {}): Promise<DexieSongRepository> {
  if (legacyDbName === dbName) throw new Error('기존 DB와 새 DB의 이름은 달라야 합니다')
  await Dexie.delete(legacyDbName)
  const repo = new DexieSongRepository(dbName)
  await repo.listSongs()
  return repo
}
