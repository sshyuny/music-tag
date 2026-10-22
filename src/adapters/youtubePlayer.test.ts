import { YoutubePlayer, youtubeSearchUrl } from './youtubePlayer'

const song = { artistName: 'IU', originalTitle: 'Through the Night' }

it('youtubeSearchUrl encodes artist and original title', () => {
  expect(youtubeSearchUrl(song)).toBe('https://www.youtube.com/results?search_query=IU%20Through%20the%20Night')
})

it('play opens the search url in a new tab', () => {
  const open = vi.spyOn(window, 'open').mockReturnValue(null)
  new YoutubePlayer().play(song)
  expect(open).toHaveBeenCalledWith(youtubeSearchUrl(song), '_blank', 'noopener')
  open.mockRestore()
})
