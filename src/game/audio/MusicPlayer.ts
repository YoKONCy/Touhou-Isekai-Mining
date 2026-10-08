/** 流媒体音乐组件：缓存音源连接，显式区分续播与复位，不拥有 AudioContext。 */
export interface MusicTrack { src: string; nameKey: string; resume?: boolean }
export class MusicPlayer {
  private entries = new Map<string, { audio: HTMLAudioElement; source: MediaElementAudioSourceNode }>()
  private current: MusicTrack | null = null
  private playlist: readonly MusicTrack[] = []
  private playlistIndex = 0
  constructor(private output: () => { context: AudioContext; bus: GainNode } | null) {}
  select(track: MusicTrack | null): void {
    this.playlist = []
    this.playlistIndex = 0
    this.selectTrack(track)
  }

  /** 从指定曲目开始顺序轮播；重复选择同一歌单保持当前曲目与播放进度。 */
  selectPlaylist(tracks: readonly MusicTrack[], startIndex = 0): void {
    if (tracks.length === 0) { this.select(null); return }
    if (this.playlist === tracks && this.current) { this.sync(); return }
    this.playlist = tracks
    this.playlistIndex = Number.isFinite(startIndex)
      ? ((Math.floor(startIndex) % tracks.length) + tracks.length) % tracks.length : 0
    this.selectTrack(tracks[this.playlistIndex])
  }

  private selectTrack(track: MusicTrack | null): void {
    if (this.current?.src !== track?.src) {
      if (this.current) this.stopTrack(this.current)
    }
    this.current = track
    // 所有非当前曲目都强制暂停，包含尚未完成的异步播放请求。
    for (const [src, entry] of this.entries) if (src !== track?.src) entry.audio.pause()
    this.sync()
  }
  private stopTrack(track: MusicTrack): void {
    const entry = this.entries.get(track.src)
    if (!entry) return
    entry.audio.pause()
    if (!track.resume) entry.audio.currentTime = 0
  }
  sync(): void {
    const output = this.output(), track = this.current
    if (!output || !track) return
    let entry = this.entries.get(track.src)
    if (!entry) {
      const audio = new Audio(`${import.meta.env.BASE_URL}${track.src}`)
      audio.preload = 'metadata'
      const source = output.context.createMediaElementSource(audio)
      source.connect(output.bus)
      audio.addEventListener('error', () => console.error(`[音频] 音乐加载失败：${track.src}`))
      audio.addEventListener('ended', () => {
        // 旧场景或已释放音源的迟到事件不得推进当前歌单。
        if (!audio.ended || this.current?.src !== track.src || this.entries.get(track.src)?.audio !== audio || this.playlist.length === 0) return
        this.playlistIndex = (this.playlistIndex + 1) % this.playlist.length
        const next = this.playlist[this.playlistIndex]
        const cached = this.entries.get(next.src)
        if (cached) cached.audio.currentTime = 0
        this.selectTrack(next)
      })
      entry = { audio, source }; this.entries.set(track.src, entry)
    }
    // 单曲场景保持原有循环；歌单由结束事件切到下一首。
    entry.audio.loop = this.playlist.length === 0
    if (entry.audio.paused) {
      const audio = entry.audio
      void audio.play().then(() => {
        // 切场或销毁后，旧请求即使迟到成功也不能重新开始播放。
        if (this.current?.src !== track.src || this.entries.get(track.src)?.audio !== audio) audio.pause()
      }).catch(() => {})
    }
  }
  restart(): void {
    if (this.current) {
      const entry = this.entries.get(this.current.src)
      if (entry) entry.audio.currentTime = 0
    }
    this.sync()
  }
  dispose(): void {
    this.current = null
    this.playlist = []
    this.playlistIndex = 0
    for (const entry of this.entries.values()) { entry.audio.pause(); entry.source.disconnect() }
    this.entries.clear()
  }
}

/** 场景曲目定义与播放器分离，新增曲目无需修改播放实现。 */
export const MUSIC_TRACKS = {
  title: { src: 'audio/title/DeepDarkLabyrinth.mp3', nameKey: 'title.music', resume: false },
  cave: [
    { src: 'audio/cave/Cave1.mp3', nameKey: 'cave.music.track1' },
    { src: 'audio/cave/Cave2.mp3', nameKey: 'cave.music.track2' },
    { src: 'audio/cave/Cave3.mp3', nameKey: 'cave.music.track3' },
    { src: 'audio/cave/Cave4.mp3', nameKey: 'cave.music.track4' }
  ],
  trial: { src: 'audio/boss/Trial1.mp3', nameKey: 'trial.music' },
  kedama: { src: 'audio/boss/KedamaEvolution.mp3', nameKey: 'story.fourth.music' },
  base: [{ src: 'audio/base/Base1.mp3', nameKey: 'base.radio.track1', resume: false }]
} satisfies { title: MusicTrack; cave: MusicTrack[]; trial: MusicTrack; kedama: MusicTrack; base: MusicTrack[] }
