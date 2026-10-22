import type { PlayableSong, Player } from '../ports/Player'

export function youtubeSearchUrl(song: PlayableSong): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${song.artistName} ${song.originalTitle}`)}`
}

export class YoutubePlayer implements Player {
  play(song: PlayableSong): void {
    window.open(youtubeSearchUrl(song), '_blank', 'noopener')
  }
}
