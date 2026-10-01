import type { AppSettings, Playlist, Track } from '../types'
import { defaultSettings } from '../types'
import { requireSupabase } from './supabase'
import type { ParsedAudio } from './id3'

const MUSIC_BUCKET = 'group-music'
export const MAX_AUDIO_BYTES = 50 * 1024 * 1024

interface TrackRow {
  id: string
  group_id: string
  uploader_id: string
  title: string
  artist: string
  album: string
  duration: number
  year: number | null
  genre: string | null
  content_hash: string
  file_name: string
  audio_path: string
  artwork_path: string | null
  created_at: string
  updated_at: string
}

interface PlaylistRow {
  id: string
  group_id: string
  created_by: string
  name: string
  created_at: string
  updated_at: string
}

function mapTrack(row: TrackRow): Track {
  return {
    id: row.id,
    groupId: row.group_id,
    uploaderId: row.uploader_id,
    title: row.title,
    artist: row.artist,
    album: row.album,
    duration: row.duration,
    ...(row.year ? { year: row.year } : {}),
    ...(row.genre ? { genre: row.genre } : {}),
    contentHash: row.content_hash,
    fileName: row.file_name,
    audioPath: row.audio_path,
    ...(row.artwork_path ? { artworkPath: row.artwork_path } : {}),
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  }
}

export async function listTracks(groupId: string) {
  const { data, error } = await requireSupabase()
    .from('tracks')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as TrackRow[]).map(mapTrack)
}

export async function listPlaylists(groupId: string): Promise<Playlist[]> {
  const client = requireSupabase()
  const [{ data: playlistData, error: playlistError }, { data: membershipData, error: membershipError }] = await Promise.all([
    client.from('playlists').select('*').eq('group_id', groupId).order('updated_at', { ascending: false }),
    client.from('playlist_tracks').select('playlist_id, track_id, position').eq('group_id', groupId).order('position'),
  ])
  if (playlistError) throw playlistError
  if (membershipError) throw membershipError
  const idsByPlaylist = new Map<string, string[]>()
  for (const row of membershipData) {
    const ids = idsByPlaylist.get(row.playlist_id) ?? []
    ids.push(row.track_id)
    idsByPlaylist.set(row.playlist_id, ids)
  }
  return (playlistData as PlaylistRow[]).map((row) => ({
    id: row.id,
    groupId: row.group_id,
    createdBy: row.created_by,
    name: row.name,
    trackIds: idsByPlaylist.get(row.id) ?? [],
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  }))
}

export async function findDuplicateTrack(groupId: string, contentHash: string, fileName: string, duration: number) {
  const client = requireSupabase()
  const { data, error } = await client.from('tracks').select('*').eq('group_id', groupId).eq('content_hash', contentHash).maybeSingle()
  if (error) throw error
  if (data) return mapTrack(data as TrackRow)
  const { data: sameName, error: nameError } = await client.from('tracks').select('*').eq('group_id', groupId).eq('file_name', fileName)
  if (nameError) throw nameError
  const duplicate = (sameName as TrackRow[]).find((row) => Math.abs(row.duration - duration) <= 1)
  return duplicate ? mapTrack(duplicate) : null
}

function artworkExtension(blob: Blob) {
  const type = blob.type.toLowerCase()
  if (type === 'image/jpeg' || type === 'image/jpg') return { extension: 'jpg', contentType: 'image/jpeg' }
  if (type === 'image/png') return { extension: 'png', contentType: 'image/png' }
  if (type === 'image/webp') return { extension: 'webp', contentType: 'image/webp' }
  return null
}

export async function uploadTrack(groupId: string, userId: string, file: File, parsed: ParsedAudio, contentHash: string) {
  if (file.size > MAX_AUDIO_BYTES) throw new Error('This MP3 is larger than the 50 MB upload limit.')
  const client = requireSupabase()
  const id = crypto.randomUUID()
  const folder = `${groupId}/${userId}/${id}`
  const audioPath = `${folder}/audio.mp3`
  let artworkPath: string | undefined
  let audioUploaded = false

  const { error: audioError } = await client.storage.from(MUSIC_BUCKET).upload(audioPath, file, {
    contentType: 'audio/mpeg',
    upsert: false,
  })
  if (audioError) throw audioError
  audioUploaded = true

  try {
    const artworkFormat = parsed.artwork ? artworkExtension(parsed.artwork.blob) : null
    if (parsed.artwork && artworkFormat) {
      artworkPath = `${folder}/artwork.${artworkFormat.extension}`
      const { error } = await client.storage.from(MUSIC_BUCKET).upload(artworkPath, parsed.artwork.blob, {
        contentType: artworkFormat.contentType,
        upsert: false,
      })
      if (error) throw error
    }

    const now = new Date().toISOString()
    const row = {
      id,
      group_id: groupId,
      uploader_id: userId,
      title: parsed.track.title,
      artist: parsed.track.artist,
      album: parsed.track.album,
      duration: parsed.track.duration,
      year: parsed.track.year ?? null,
      genre: parsed.track.genre ?? null,
      content_hash: contentHash,
      file_name: file.name,
      audio_path: audioPath,
      artwork_path: artworkPath ?? null,
      created_at: now,
      updated_at: now,
    }
    const { data, error } = await client.from('tracks').insert(row).select('*').single()
    if (error) throw error
    return mapTrack(data as TrackRow)
  } catch (error) {
    await client.storage.from(MUSIC_BUCKET).remove([audioPath, ...(artworkPath ? [artworkPath] : [])])
    throw error
  } finally {
    if (!audioUploaded) await client.storage.from(MUSIC_BUCKET).remove([audioPath])
  }
}

export async function loadTrackAudio(track: Track) {
  if (!track.audioPath) throw new Error('This track has not been uploaded to the group library.')
  const { data, error } = await requireSupabase().storage.from(MUSIC_BUCKET).download(track.audioPath)
  if (error) throw error
  return data
}

export async function loadTrackArtwork(track: Track) {
  if (!track.artworkPath) return null
  const { data, error } = await requireSupabase().storage.from(MUSIC_BUCKET).download(track.artworkPath)
  if (error) throw error
  return data
}

export async function createPlaylist(groupId: string, userId: string, name: string, trackIds: string[]) {
  const client = requireSupabase()
  const { data, error } = await client.from('playlists').insert({ group_id: groupId, created_by: userId, name: name.trim() }).select('id').single()
  if (error) throw error
  try {
    await setPlaylistTracks(groupId, data.id, trackIds)
  } catch (reason) {
    await client.from('playlists').delete().eq('group_id', groupId).eq('id', data.id)
    throw reason
  }
  return data.id as string
}

export async function updatePlaylistName(groupId: string, playlistId: string, name: string) {
  const { error } = await requireSupabase().from('playlists').update({ name: name.trim(), updated_at: new Date().toISOString() }).eq('group_id', groupId).eq('id', playlistId)
  if (error) throw error
}

export async function setPlaylistTracks(groupId: string, playlistId: string, trackIds: string[]) {
  const { error } = await requireSupabase().rpc('set_playlist_tracks', {
    p_group_id: groupId,
    p_playlist_id: playlistId,
    p_track_ids: trackIds,
  })
  if (error) throw error
}

export async function deletePlaylist(groupId: string, playlistId: string) {
  const { error } = await requireSupabase().from('playlists').delete().eq('group_id', groupId).eq('id', playlistId)
  if (error) throw error
}

export async function getUserSettings(userId: string): Promise<AppSettings | undefined> {
  const { data, error } = await requireSupabase().from('user_preferences').select('*').eq('user_id', userId).maybeSingle()
  if (error) throw error
  if (!data) return undefined
  return {
    theme: data.theme,
    repeat: data.repeat_mode,
    shuffle: data.shuffle,
    queue: data.queue_track_ids ?? [],
    currentIndex: data.current_index ?? -1,
    ...(data.last_track_id ? { lastTrackId: data.last_track_id } : {}),
    lastPosition: data.last_position ?? 0,
  }
}

export async function saveUserSettings(userId: string, settings: AppSettings) {
  const { error } = await requireSupabase().from('user_preferences').upsert({
    user_id: userId,
    theme: settings.theme,
    repeat_mode: settings.repeat,
    shuffle: settings.shuffle,
    queue_track_ids: settings.queue,
    current_index: settings.currentIndex,
    last_track_id: settings.lastTrackId ?? null,
    last_position: Math.max(0, settings.lastPosition),
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}

export function getDefaultUserSettings() {
  return { ...defaultSettings }
}

export async function getTrack(groupId: string, trackId: string) {
  const { data, error } = await requireSupabase()
    .from('tracks')
    .select('*')
    .eq('group_id', groupId)
    .eq('id', trackId)
    .maybeSingle()
  if (error) throw error
  return data ? mapTrack(data as TrackRow) : null
}