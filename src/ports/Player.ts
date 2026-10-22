import type { Song } from '../domain/types'

export type PlayableSong = Pick<Song, 'artistName' | 'originalTitle'>

/** 곡을 실제로 듣는 곳과 연결한다. 듣는 곳이 정해지면 구현을 바꾼다 */
export interface Player {
  play(song: PlayableSong): void
}
