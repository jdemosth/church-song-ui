import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import './App.css'
import {
  loadBackgroundImage,
  saveBackgroundImage,
} from './backgroundStorage'

const PROJECTOR_CHANNEL_NAME =
  'church-song-projector'
const PROJECTOR_STATE_KEY =
  'church-song-projector-state'
const PROJECTOR_SETTINGS_KEY =
  'church-song-projector-settings'
const PROJECTOR_SYNC_MESSAGE =
  'sync-projector-state'
const PROJECTOR_REQUEST_MESSAGE =
  'request-projector-state'
const PROJECTOR_COMMAND_MESSAGE =
  'run-projector-command'
const DEFAULT_BACKGROUND_VARIANT =
  'sky-field'
const DEFAULT_BACKGROUND_TYPE =
  'preset'
const DEFAULT_PROJECTION_SETTINGS = {
  defaultBackgroundVariant:
    DEFAULT_BACKGROUND_VARIANT,
  showSongTitle: true,
  lyricsAlignment: 'center',
  lyricsSizePreference: 'AUTO_FIT',
}

const BACKGROUND_OPTIONS = [
  {
    id: 'sky-field',
    name: 'Sky Field',
    swatchClassName:
      'background-swatch background-swatch-sky-field',
  },
  {
    id: 'sunrise',
    name: 'Sunrise',
    swatchClassName:
      'background-swatch background-swatch-sunrise',
  },
  {
    id: 'deep-blue',
    name: 'Deep Blue',
    swatchClassName:
      'background-swatch background-swatch-deep-blue',
  },
]

const LANGUAGE_LABELS = {
  ENGLISH: 'English',
  HAITIAN_CREOLE: 'Kreyòl',
  SPANISH: 'Español',
  FRENCH: 'Français',
  UNKNOWN: 'Unknown',
}

const SUPPORTED_SONG_LANGUAGES = [
  'ENGLISH',
  'HAITIAN_CREOLE',
  'SPANISH',
  'FRENCH',
]

const LANGUAGE_DISPLAY_ORDER = [
  ...SUPPORTED_SONG_LANGUAGES,
  'UNKNOWN',
]

const SONG_LANGUAGE_OPTIONS = [
  {
    value: 'ENGLISH',
    label: 'English',
  },
  {
    value: 'HAITIAN_CREOLE',
    label: 'Kreyòl',
  },
  {
    value: 'SPANISH',
    label: 'Español',
  },
  {
    value: 'FRENCH',
    label: 'Français',
  },
]

function normalizeLanguage(value) {
  const normalized = String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[-\s]+/g, '_')

  switch (normalized) {
    case 'EN':
    case 'ENGLISH':
      return 'ENGLISH'

    case 'CREOLE':
    case 'KREYOL':
    case 'KREYÒL':
    case 'HAITIAN_CREOLE':
    case 'HAITIANCREOLE':
      return 'HAITIAN_CREOLE'

    case 'ES':
    case 'SPANISH':
    case 'ESPANOL':
    case 'ESPAÑOL':
      return 'SPANISH'

    case 'FR':
    case 'FRENCH':
    case 'FRANCAIS':
    case 'FRANÇAIS':
      return 'FRENCH'

    default:
      return normalized
  }
}

const PLAYLIST_SERVICE_TYPE_OPTIONS = [
  'Tuesday Evening',
  'Thursday Evening',
  'Sunday Morning',
  'Prayer/Fasting Service',
  'Youth Service',
  'Fellowship Service',
  'Other',
]

function createSavedPlaylistForm(
  overrides = {}
) {
  return {
    serviceType: 'Sunday Morning',
    customServiceType: '',
    serviceDate: getTodayDateValue(),
    theme: '',
    legacyName: '',
    ...overrides,
  }
}

function resolvePlaylistServiceType(
  serviceType,
  customServiceType = ''
) {
  const normalizedServiceType =
    serviceType?.trim() || ''

  if (!normalizedServiceType) {
    return ''
  }

  if (normalizedServiceType !== 'Other') {
    return normalizedServiceType
  }

  return customServiceType.trim()
}

function inferPlaylistServiceFields(
  playlist
) {
  const metadataServiceType =
    playlist?.serviceType?.trim() || ''

  if (metadataServiceType) {
    const isKnownOption =
      PLAYLIST_SERVICE_TYPE_OPTIONS.includes(
        metadataServiceType
      )

    return {
      serviceType: isKnownOption
        ? metadataServiceType
        : 'Other',
      customServiceType:
        isKnownOption ? '' : metadataServiceType,
      effectiveServiceType: isKnownOption
        ? metadataServiceType
        : metadataServiceType,
    }
  }

  const playlistName =
    playlist?.name?.trim() || ''
  const legacyPrefixMatch =
    playlistName.match(
      /^(.*?)\s[-–—]\s[A-Za-z]{3}\s+\d{1,2},\s+\d{4}$/
    )
  const inferredPrefix =
    legacyPrefixMatch?.[1]?.trim() || ''

  if (!inferredPrefix) {
    return {
      serviceType: '',
      customServiceType: '',
      effectiveServiceType: '',
    }
  }

  const isKnownOption =
    PLAYLIST_SERVICE_TYPE_OPTIONS.includes(
      inferredPrefix
    )

  return {
    serviceType: isKnownOption
      ? inferredPrefix
      : 'Other',
    customServiceType:
      isKnownOption ? '' : inferredPrefix,
    effectiveServiceType: inferredPrefix,
  }
}

function createPlaylistFormFromPlaylist(
  playlist
) {
  const inferredFields =
    inferPlaylistServiceFields(playlist)

  return createSavedPlaylistForm({
    serviceType:
      inferredFields.serviceType,
    customServiceType:
      inferredFields.customServiceType,
    serviceDate: playlist?.serviceDate || '',
    theme: playlist?.theme || '',
    legacyName: playlist?.name || '',
  })
}

function createBlankSongForm() {
  return {
    title: '',
    author: '',
    lyrics: '',
    songType: 'SLOW',
    familyId: null,
    language: 'ENGLISH',
    sectionStructure: null,
    sectionsConfirmed: false,
  }
}

function createSongFormFromSong(song) {
  if (!song) {
    return createBlankSongForm()
  }

  return {
    title: song.title || '',
    author: song.author || '',
    lyrics: song.lyrics || '',
    songType: song.songType || 'SLOW',
    familyId: song.familyId ?? null,
    language: song.language || 'UNKNOWN',
    sectionStructure:
      song.sectionStructure || null,
    sectionsConfirmed:
      song.sectionsConfirmed === true,
  }
}

function sortServicePlans(servicePlans) {
  return [...servicePlans].sort((left, right) => {
    const leftDateTime = `${left.serviceDate || ''}T${left.serviceTime || '99:99'}`
    const rightDateTime = `${right.serviceDate || ''}T${right.serviceTime || '99:99'}`

    return leftDateTime.localeCompare(rightDateTime)
  })
}

function isCompletedServicePlan(
  servicePlan
) {
  return servicePlan?.status === 'COMPLETED'
}

function sortCompletedServicePlans(
  servicePlans
) {
  return [...servicePlans].sort((left, right) => {
    const rightCompletedAt =
      right?.completedAt || ''
    const leftCompletedAt =
      left?.completedAt || ''

    if (rightCompletedAt !== leftCompletedAt) {
      return rightCompletedAt.localeCompare(
        leftCompletedAt
      )
    }

    const rightDateTime = `${right?.serviceDate || ''}T${right?.serviceTime || '99:99'}`
    const leftDateTime = `${left?.serviceDate || ''}T${left?.serviceTime || '99:99'}`

    return rightDateTime.localeCompare(
      leftDateTime
    )
  })
}

function createReuseServicePlanForm(
  servicePlan
) {
  return {
    serviceName:
      servicePlan?.serviceName || '',
    serviceDate: getTodayDateValue(),
    serviceTime: '',
  }
}

function resolveSongFromCollection(
  song,
  songs
) {
  if (!song) {
    return null
  }

  if (!Array.isArray(songs)) {
    return song
  }

  if (!song.id) {
    return song
  }

  return (
    songs.find(
      (candidate) =>
        candidate.id === song.id
    ) || song
  )
}

function formatServiceDate(serviceDate) {
  if (!serviceDate) {
    return 'No date'
  }

  const [year, month, day] =
    serviceDate.split('-')

  if (!year || !month || !day) {
    return serviceDate
  }

  return `${month}/${day}/${year.slice(2)}`
}

function formatServiceTime(serviceTime) {
  if (!serviceTime) {
    return ''
  }

  const [hoursText, minutesText] =
    serviceTime.split(':')
  const hours = Number(hoursText)
  const minutes = Number(minutesText)

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes)
  ) {
    return serviceTime
  }

  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours =
    hours % 12 === 0 ? 12 : hours % 12

  return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`
}

function formatServiceSchedule(servicePlan) {
  if (!servicePlan) {
    return ''
  }

  const dateLabel = formatServiceDate(
    servicePlan.serviceDate
  )
  const timeLabel = formatServiceTime(
    servicePlan.serviceTime
  )

  return timeLabel
    ? `${dateLabel} at ${timeLabel}`
    : dateLabel
}

function getTodayDateValue() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(
    now.getMonth() + 1
  ).padStart(2, '0')
  const day = String(now.getDate()).padStart(
    2,
    '0'
  )

  return `${year}-${month}-${day}`
}

function buildTodayServiceName(
  serviceDate = getTodayDateValue()
) {
  const [year, month, day] =
    serviceDate.split('-').map(Number)

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return serviceDate
  }

  const weekdayNames = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ]
  const date = new Date(
    year,
    month - 1,
    day
  )
  const weekday =
    weekdayNames[date.getDay()] || 'Service'

  return `${weekday} — ${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year}`
}

function buildStructuredPlaylistName(
  serviceType,
  serviceDate,
  fallbackName = ''
) {
  const effectiveServiceType =
    serviceType?.trim() || ''

  if (!effectiveServiceType || !serviceDate) {
    return fallbackName
  }

  const [year, month, day] =
    serviceDate.split('-').map(Number)

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return fallbackName || serviceDate
  }

  const date = new Date(
    year,
    month - 1,
    day
  )

  return `${effectiveServiceType} – ${date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`
}

function formatFullDateLabel(serviceDate) {
  if (!serviceDate) {
    return 'No date'
  }

  const [year, month, day] =
    serviceDate.split('-').map(Number)

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return serviceDate
  }

  const date = new Date(
    year,
    month - 1,
    day
  )

  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatCompletionTimestamp(
  completedAt
) {
  if (!completedAt) {
    return 'Completion time unavailable'
  }

  const date = new Date(completedAt)

  if (Number.isNaN(date.getTime())) {
    return completedAt
  }

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatServiceOccurrenceName(
  servicePlan
) {
  if (!servicePlan) {
    return ''
  }

  const serviceName =
    servicePlan.serviceName?.trim() || ''
  const shortDate = formatShortDateLabel(
    servicePlan.serviceDate
  )

  if (!serviceName) {
    return shortDate
  }

  const normalizedName =
    serviceName.replace(/\s+/g, ' ').trim()
  const loweredName =
    normalizedName.toLowerCase()
  const loweredShortDate =
    shortDate.toLowerCase()
  const isoDate =
    servicePlan.serviceDate || ''

  if (
    loweredName.includes(loweredShortDate) ||
    (isoDate &&
      loweredName.includes(
        isoDate.toLowerCase()
      ))
  ) {
    return normalizedName
  }

  return `${normalizedName} — ${shortDate}`
}

function formatShortDateLabel(serviceDate) {
  if (!serviceDate) {
    return 'No date'
  }

  const [year, month, day] =
    serviceDate.split('-').map(Number)

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return serviceDate
  }

  const date = new Date(
    year,
    month - 1,
    day
  )

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatPlaylistDisplayName(playlist) {
  if (!playlist) {
    return ''
  }

  const inferredFields =
    inferPlaylistServiceFields(playlist)
  const generatedName =
    buildStructuredPlaylistName(
      inferredFields.effectiveServiceType,
      playlist.serviceDate,
      playlist.name || ''
    )

  return generatedName || playlist.name || ''
}

function formatConsoleServiceLabel(
  activePlaylist,
  loadedServicePlan
) {
  const serviceName =
    loadedServicePlan?.serviceName?.trim() ||
    inferPlaylistServiceFields(activePlaylist)
      .effectiveServiceType ||
    ''

  if (!serviceName) {
    return 'WORSHIP SERVICE'
  }

  const normalizedServiceName =
    serviceName.replace(/\s+/g, ' ').trim()
  const withSuffix = /service$/i.test(
    normalizedServiceName
  )
    ? normalizedServiceName
    : `${normalizedServiceName} Service`

  return withSuffix.toUpperCase()
}

function getLanguageLabel(language) {
  const canonicalLanguage =
    normalizeLanguage(language)

  return (
    LANGUAGE_LABELS[canonicalLanguage] ||
    LANGUAGE_LABELS.UNKNOWN
  )
}

function getLanguageUnavailableTitle(
  language
) {
  return `${getLanguageLabel(language)} translation not available`
}

function compareSongLanguages(
  leftLanguage,
  rightLanguage
) {
  return (
    LANGUAGE_DISPLAY_ORDER.indexOf(
      leftLanguage
    ) -
    LANGUAGE_DISPLAY_ORDER.indexOf(
      rightLanguage
    )
  )
}

function createEmptyLanguageVersions() {
  return Object.fromEntries(
    SUPPORTED_SONG_LANGUAGES.map(
      (language) => [language, null]
    )
  )
}

function buildLanguageVersionsFromSongs(
  familySongs = []
) {
  const versions =
    createEmptyLanguageVersions()

  for (const familySong of familySongs) {
    const canonicalLanguage =
      normalizeLanguage(
        familySong?.language
      )

    if (
      !familySong ||
      !SUPPORTED_SONG_LANGUAGES.includes(
        canonicalLanguage
      )
    ) {
      continue
    }

    versions[canonicalLanguage] =
      familySong
  }

  return versions
}

function getValidSongFamilyId(song) {
  const familyId = song?.familyId

  return Number.isInteger(familyId) && familyId > 0
    ? familyId
    : null
}

function resolveLanguageVersionsForSong(
  song,
  songs,
  familyVersionsByFamilyId
) {
  if (!song) {
    return createEmptyLanguageVersions()
  }

  const currentSongLanguage =
    normalizeLanguage(song.language)
  const familyId = getValidSongFamilyId(song)

  if (familyId) {
    const cachedVersions =
      familyVersionsByFamilyId[
        familyId
      ]?.versions

    if (cachedVersions) {
      const versions =
        createEmptyLanguageVersions()

      Object.entries(cachedVersions).forEach(
        ([language, familySong]) => {
          const canonicalLanguage =
            normalizeLanguage(language)

          if (
            !familySong ||
            !SUPPORTED_SONG_LANGUAGES.includes(
              canonicalLanguage
            )
          ) {
            return
          }

          const matchingSong = songs.find(
            (candidate) =>
              candidate.id === familySong.id
          )

          versions[canonicalLanguage] =
            matchingSong || familySong
        }
      )

      if (
        SUPPORTED_SONG_LANGUAGES.includes(
          currentSongLanguage
        ) &&
        !versions[currentSongLanguage]
      ) {
        versions[currentSongLanguage] = song
      }

      return versions
    }

    const versions =
      buildLanguageVersionsFromSongs(
        songs.filter(
          (candidate) =>
            candidate.familyId === familyId
        )
      )

    if (
      SUPPORTED_SONG_LANGUAGES.includes(
        currentSongLanguage
      ) &&
      !versions[currentSongLanguage]
    ) {
      versions[currentSongLanguage] = song
    }

    return versions
  }

  const versions =
    createEmptyLanguageVersions()

  if (
    SUPPORTED_SONG_LANGUAGES.includes(
      currentSongLanguage
    )
  ) {
    versions[currentSongLanguage] = song
  }

  return versions
}

function createAddTranslationForm(
  language = 'ENGLISH',
  sourceSong = null
) {
  return {
    language,
    title: '',
    author: sourceSong?.author || '',
    lyrics: '',
  }
}

function createSectionEditorRowsFromSong(song) {
  const parsedSections =
    parseLyricsSections(song)
  const legacySections =
    buildLegacySections(song?.lyrics)
  const storedAssignments =
    parseStoredSectionStructure(
      song?.sectionStructure
    )
  const canUseConfirmedAssignments =
    song?.sectionsConfirmed === true &&
    storedAssignments.length > 0 &&
    storedAssignments.length ===
      legacySections.length

  if (canUseConfirmedAssignments) {
    return legacySections.map(
      (section, index) => {
        const assignment =
          storedAssignments[index] ||
          createSectionAssignment()

        return {
          blockIndex: section.blockIndex,
          type:
            normalizeSectionType(
              assignment.type
            ) || 'UNASSIGNED',
          verseNumber:
            assignment.verseNumber || '',
          customLabel:
            assignment.customLabel || '',
          lyrics:
            section.lines.join('\n') || '',
          sourceLyrics:
            section.lines.join('\n') || '',
        }
      }
    )
  }

  return parsedSections.map((section) => ({
    blockIndex: section.blockIndex,
    type:
      normalizeSectionType(section.type) ||
      'UNASSIGNED',
    verseNumber: section.verseNumber || '',
    customLabel: section.customLabel || '',
    lyrics: section.lyrics || '',
    sourceLyrics:
      section.sourceLyrics || '',
  }))
}

function serializeSectionStructure(
  sectionEditorRows
) {
  return JSON.stringify(
    sectionEditorRows.map((row) => {
      const assignment =
        createSectionAssignment({
          type: row.type,
          verseNumber: row.verseNumber,
          customLabel: row.customLabel,
        })

      return {
        type: assignment.type,
        verseNumber:
          assignment.verseNumber || null,
        customLabel:
          assignment.customLabel || '',
        name: assignment.name,
      }
    })
  )
}

function findMatchingSectionIndex(
  currentSong,
  nextSong,
  currentIndex
) {
  const currentSections =
    parseLyricsSections(currentSong)
  const nextSections =
    parseLyricsSections(nextSong)

  if (nextSections.length === 0) {
    return 0
  }

  const currentSection =
    currentSections[currentIndex] ||
    currentSections[0]

  if (!currentSection?.name) {
    return 0
  }

  const matchingIndex =
    nextSections.findIndex(
      (section) =>
        section.name?.trim().toLowerCase() ===
        currentSection.name
          ?.trim()
          .toLowerCase()
    )

  return matchingIndex >= 0
    ? matchingIndex
    : 0
}

function getSongTypeBadge(songType) {
  if (!songType) {
    return null
  }

  return {
    className:
      songType === 'FAST'
        ? 'type-label fast'
        : 'type-label slow',
    label: songType,
  }
}

function getSongTypeLabel(songType) {
  return songType || 'Unclassified'
}

function sortSongsByLanguageAndTitle(
  left,
  right
) {
  const languageOrder =
    compareSongLanguages(
      left.language,
      right.language
    )

  if (languageOrder !== 0) {
    return languageOrder
  }

  return (left.title || '').localeCompare(
    right.title || ''
  )
}

function getProjectorWindowState() {
  if (typeof window === 'undefined') {
    return false
  }

  const searchParams = new URLSearchParams(
    window.location.search
  )

  return searchParams.get('projector') === '1'
}

function readStoredProjectorState() {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const rawState = window.localStorage.getItem(
      PROJECTOR_STATE_KEY
    )

    return rawState ? JSON.parse(rawState) : null
  } catch {
    return null
  }
}

function readStoredProjectorSettings() {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const rawSettings =
      window.localStorage.getItem(
        PROJECTOR_SETTINGS_KEY
      )

    return rawSettings
      ? JSON.parse(rawSettings)
      : null
  } catch {
    return null
  }
}

function persistProjectorState(state) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(
    PROJECTOR_STATE_KEY,
    JSON.stringify(state)
  )
}

function persistProjectorSettings(settings) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(
    PROJECTOR_SETTINGS_KEY,
    JSON.stringify(settings)
  )
}

function normalizeProjectionSettings(
  settings
) {
  return {
    defaultBackgroundVariant:
      settings?.defaultBackgroundVariant ||
      DEFAULT_PROJECTION_SETTINGS.defaultBackgroundVariant,
    showSongTitle:
      settings?.showSongTitle ??
      DEFAULT_PROJECTION_SETTINGS.showSongTitle,
    lyricsAlignment:
      settings?.lyricsAlignment ||
      DEFAULT_PROJECTION_SETTINGS.lyricsAlignment,
    lyricsSizePreference:
      settings?.lyricsSizePreference ||
      DEFAULT_PROJECTION_SETTINGS.lyricsSizePreference,
  }
}

function createProjectorState({
  song,
  sectionIndex,
  projectionMode,
  backgroundType = DEFAULT_BACKGROUND_TYPE,
  backgroundVariant = DEFAULT_BACKGROUND_VARIANT,
  customBackgroundId = null,
  customBackgroundName = '',
  projectionSettings = DEFAULT_PROJECTION_SETTINGS,
}) {
  return {
    projectionSong: song || null,
    sectionIndex,
    projectionMode,
    backgroundType,
    backgroundVariant,
    customBackgroundId,
    customBackgroundName,
    projectionSettings:
      normalizeProjectionSettings(
        projectionSettings
      ),
  }
}

function createProjectorSyncMessage(state) {
  return {
    type: PROJECTOR_SYNC_MESSAGE,
    payload: state,
  }
}

function createProjectorCommandMessage(command) {
  return {
    type: PROJECTOR_COMMAND_MESSAGE,
    command,
  }
}

function getProjectionShortcutCommand(event) {
  if (
    event.key === 'ArrowRight' ||
    event.key === ' '
  ) {
    return 'NEXT'
  }

  if (event.key === 'ArrowLeft') {
    return 'PREVIOUS'
  }

  if (
    event.key === 'b' ||
    event.key === 'B'
  ) {
    return 'BLACK'
  }

  if (
    event.key === 'c' ||
    event.key === 'C'
  ) {
    return 'CLEAR'
  }

  return null
}

function shouldIgnoreProjectionShortcut(event) {
  if (
    event.metaKey ||
    event.ctrlKey ||
    event.altKey
  ) {
    return true
  }

  const target = event.target

  if (!(target instanceof HTMLElement)) {
    return false
  }

  if (target.isContentEditable) {
    return true
  }

  return Boolean(
    target.closest(
      'input, textarea, select, [contenteditable="true"], .modal, .modal-overlay'
    )
  )
}

async function readErrorMessage(response) {
  try {
    const data = await response.json()

    return (
      data?.message ||
      data?.detail ||
      data?.error ||
      ''
    )
  } catch {
    return ''
  }
}

function getDownloadFileName(
  response,
  fallbackFileName
) {
  const contentDisposition =
    response.headers.get(
      'content-disposition'
    ) || ''
  const utfMatch =
    contentDisposition.match(
      /filename\*=UTF-8''([^;]+)/
    )

  if (utfMatch?.[1]) {
    return decodeURIComponent(
      utfMatch[1]
    )
  }

  const simpleMatch =
    contentDisposition.match(
      /filename="([^"]+)"/
    )

  if (simpleMatch?.[1]) {
    return simpleMatch[1]
  }

  return fallbackFileName
}

function getNavigationProjectionMode(
  currentMode
) {
  if (currentMode === 'BLACK') {
    return 'BLACK'
  }

  if (currentMode === 'CLEAR') {
    return 'CLEAR'
  }

  return 'LIVE'
}

const SECTION_TYPE_OPTIONS = [
  'VERSE',
  'CHORUS',
  'BRIDGE',
  'PRE_CHORUS',
  'REFRAIN',
  'INTRO',
  'OUTRO',
  'OTHER',
]

function normalizeSectionType(type) {
  const normalizedType = String(type || '')
    .trim()
    .toUpperCase()
    .replace(/[-\s]+/g, '_')

  if (
    SECTION_TYPE_OPTIONS.includes(
      normalizedType
    )
  ) {
    return normalizedType
  }

  if (normalizedType === 'UNASSIGNED') {
    return 'UNASSIGNED'
  }

  return ''
}

function formatSectionName(
  type,
  verseNumber = '',
  customLabel = ''
) {
  const normalizedType =
    normalizeSectionType(type)
  const normalizedCustomLabel =
    String(customLabel || '').trim()
  const normalizedVerseNumber = String(
    verseNumber || ''
  ).trim()

  switch (normalizedType) {
    case 'VERSE':
      return normalizedVerseNumber
        ? `Verse ${normalizedVerseNumber}`
        : 'Verse'
    case 'CHORUS':
      return 'Chorus'
    case 'BRIDGE':
      return 'Bridge'
    case 'PRE_CHORUS':
      return 'Pre-Chorus'
    case 'REFRAIN':
      return 'Refrain'
    case 'INTRO':
      return 'Intro'
    case 'OUTRO':
      return 'Outro'
    case 'OTHER':
      return normalizedCustomLabel || 'Other'
    default:
      return normalizedCustomLabel || ''
  }
}

function createSectionAssignment({
  type = '',
  verseNumber = '',
  customLabel = '',
  fallbackName = '',
} = {}) {
  const normalizedType =
    normalizeSectionType(type)
  const normalizedVerseNumber = String(
    verseNumber || ''
  ).trim()
  const normalizedCustomLabel = String(
    customLabel || ''
  ).trim()

  return {
    type: normalizedType,
    verseNumber:
      normalizedType === 'VERSE' &&
      normalizedVerseNumber
        ? normalizedVerseNumber
        : '',
    customLabel:
      normalizedType === 'OTHER'
        ? normalizedCustomLabel
        : '',
    name:
      formatSectionName(
        normalizedType,
        normalizedVerseNumber,
        normalizedCustomLabel
      ) || fallbackName,
  }
}

function buildLegacySections(lyrics) {
  if (!lyrics) {
    return []
  }

  const lines = lyrics.split('\n')
  const sections = []
  let currentSection = {
    name: 'Verse 1',
    lines: [],
    isExplicit: false,
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()

    if (!line) {
      continue
    }

    const match = line.match(/^\[(.+)]$/)

    if (match) {
      if (currentSection.lines.length > 0) {
        sections.push(currentSection)
      }

      currentSection = {
        name: match[1].trim(),
        lines: [],
        isExplicit: true,
      }
      continue
    }

    currentSection.lines.push(line)
  }

  if (currentSection.lines.length > 0) {
    sections.push(currentSection)
  }

  return sections.map((section, index) => ({
    ...section,
    blockIndex: index,
  }))
}

function createAssignmentFromName(name) {
  const normalizedName = String(name || '').trim()

  if (!normalizedName) {
    return createSectionAssignment()
  }

  const verseMatch =
    normalizedName.match(/^verse\s+(\d+)$/i)

  if (verseMatch) {
    return createSectionAssignment({
      type: 'VERSE',
      verseNumber: verseMatch[1],
    })
  }

  const typeByLabel = {
    chorus: 'CHORUS',
    bridge: 'BRIDGE',
    'pre-chorus': 'PRE_CHORUS',
    'pre chorus': 'PRE_CHORUS',
    refrain: 'REFRAIN',
    intro: 'INTRO',
    outro: 'OUTRO',
  }

  const matchedType =
    typeByLabel[
      normalizedName.toLowerCase()
    ]

  if (matchedType) {
    return createSectionAssignment({
      type: matchedType,
    })
  }

  return createSectionAssignment({
    type: 'OTHER',
    customLabel: normalizedName,
  })
}

function normalizeLegacySectionNames(
  sections
) {
  let verseCounter = 0

  return sections.map((section) => {
    const assignment =
      createAssignmentFromName(section.name)

    if (assignment.type === 'VERSE') {
      verseCounter += 1

      return {
        ...section,
        ...createSectionAssignment({
          type: 'VERSE',
          verseNumber: verseCounter,
        }),
      }
    }

    return {
      ...section,
      ...assignment,
    }
  })
}

function parseStoredSectionStructure(
  sectionStructure
) {
  if (!sectionStructure) {
    return []
  }

  try {
    const parsed = JSON.parse(sectionStructure)

    if (!Array.isArray(parsed)) {
      return []
    }

    const assignments = parsed.map((item) =>
      ({
        ...createSectionAssignment({
        type: item?.type,
        verseNumber: item?.verseNumber,
        customLabel:
          item?.customLabel || item?.name,
        }),
        rawName: String(item?.name || '').trim(),
      })
    )

    const hasArtificialBlocks =
      assignments.some(
        (assignment) =>
          assignment.type ===
            'UNASSIGNED' ||
          /^Block\s+\d+$/i.test(
            assignment.rawName
          )
      )

    return hasArtificialBlocks
      ? []
      : assignments
  } catch {
    return []
  }
}

function parseLyricsSections(songOrLyrics) {
  const song =
    typeof songOrLyrics === 'string'
      ? { lyrics: songOrLyrics }
      : songOrLyrics || {}
  const legacySections =
    normalizeLegacySectionNames(
      buildLegacySections(song.lyrics)
    )

  if (legacySections.length === 0) {
    return []
  }

  const storedAssignments =
    parseStoredSectionStructure(
      song.sectionStructure
    )
  const canUseStoredAssignments =
    storedAssignments.length ===
    legacySections.length

  let resolvedAssignments
  let sectionsConfirmed = false
  let needsSectionReview = false

  if (canUseStoredAssignments) {
    resolvedAssignments = storedAssignments
    sectionsConfirmed = Boolean(
      song.sectionsConfirmed
    )
  } else if (legacySections.length === 1) {
    const singleSection =
      legacySections[0]
    const singleAssignment =
      createAssignmentFromName(
        singleSection.name
      )

    resolvedAssignments = [
      singleAssignment.type
        ? singleAssignment
        : createSectionAssignment({
            type: 'CHORUS',
          }),
    ]
    sectionsConfirmed = true
  } else {
    resolvedAssignments = legacySections.map(
      (section) =>
        createAssignmentFromName(
          section.name
        )
    )
    sectionsConfirmed = false
    needsSectionReview = true
  }

  return legacySections.map(
    (section, index) => {
      const assignment =
        resolvedAssignments[index] ||
        createSectionAssignment({
          type: 'VERSE',
          verseNumber: index + 1,
        })

      return {
        blockIndex: section.blockIndex,
        type: assignment.type,
        verseNumber: assignment.verseNumber,
        customLabel: assignment.customLabel,
        name:
          assignment.name ||
          section.name ||
          `Verse ${index + 1}`,
        lyrics: section.lines.join('\n'),
        lines: section.lines,
        sourceLyrics: section.lines.join('\n'),
        isExplicit: section.isExplicit,
        isStored: canUseStoredAssignments,
        sectionsConfirmed,
        needsSectionReview,
      }
    }
  )
}

function AutoFitLyrics({
  text,
  maxFontSize = 40,
  minFontSize = 16,
  containerClassName = '',
  textClassName = '',
  textAlign = 'center',
}) {
  const containerRef = useRef(null)
  const textRef = useRef(null)

  const [fontSize, setFontSize] =
    useState(maxFontSize)

  useLayoutEffect(() => {
    const container = containerRef.current
    const textElement = textRef.current

    if (!container || !textElement) {
      return
    }

    const fitText = () => {
      let size = maxFontSize

      textElement.style.fontSize = `${size}px`

      while (
        size > minFontSize &&
        (
          textElement.scrollHeight >
            container.clientHeight ||
          textElement.scrollWidth >
            container.clientWidth
        )
      ) {
        size -= 1
        textElement.style.fontSize = `${size}px`
      }

      setFontSize(size)
    }

    fitText()

    const resizeObserver =
      new ResizeObserver(fitText)

    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
    }
  }, [text])

  return (
    <div
      ref={containerRef}
      className={[
        'lyrics-fit-container',
        containerClassName,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div
        ref={textRef}
        className={[
          'screen-lyrics',
          textClassName,
        ]
          .filter(Boolean)
          .join(' ')}
        style={{
          fontSize: `${fontSize}px`,
          textAlign,
        }}
      >
        {text}
      </div>
    </div>
  )
}

function ProjectorDisplay({
  song,
  sectionIndex,
  projectionMode,
  backgroundType = DEFAULT_BACKGROUND_TYPE,
  backgroundVariant = DEFAULT_BACKGROUND_VARIANT,
  customBackgroundUrl = '',
  projectionSettings = DEFAULT_PROJECTION_SETTINGS,
  showFullscreenControl = false,
}) {
  const [isFullscreen, setIsFullscreen] =
    useState(() =>
      typeof document !== 'undefined' &&
      Boolean(document.fullscreenElement)
    )

  const sections = useMemo(() => {
    if (!song) {
      return []
    }

    return parseLyricsSections(song)
  }, [song])

  const currentSection =
    sections[sectionIndex] || sections[0]
  const normalizedProjectionSettings =
    normalizeProjectionSettings(
      projectionSettings
    )

  useEffect(() => {
    if (!showFullscreenControl) {
      return
    }

    const handleFullscreenChange = () => {
      setIsFullscreen(
        Boolean(document.fullscreenElement)
      )
    }

    document.addEventListener(
      'fullscreenchange',
      handleFullscreenChange
    )

    return () => {
      document.removeEventListener(
        'fullscreenchange',
        handleFullscreenChange
      )
    }
  }, [showFullscreenControl])

  async function enterFullscreen() {
    const element = document.documentElement

    if (!element.requestFullscreen) {
      return
    }

    try {
      await element.requestFullscreen()
    } catch {
      // Some browsers may block fullscreen
      // unless triggered directly by user action.
    }
  }

  const customBackgroundStyle =
    backgroundType === 'custom' &&
    customBackgroundUrl &&
    projectionMode !== 'BLACK'
      ? {
          backgroundImage: `linear-gradient(rgba(8, 15, 29, 0.28), rgba(8, 15, 29, 0.42)), radial-gradient(circle at 50% 18%, rgba(255, 255, 255, 0.1), transparent 28%), url("${customBackgroundUrl}")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }
      : undefined

  const lyricsSizePreference =
    normalizedProjectionSettings.lyricsSizePreference

  const projectorSizingByPreference = {
    AUTO_FIT: {
      maxFontSize: showFullscreenControl
        ? 92
        : 40,
      minFontSize: showFullscreenControl
        ? 22
        : 16,
    },
    SMALL: {
      maxFontSize: showFullscreenControl
        ? 56
        : 28,
      minFontSize: showFullscreenControl
        ? 20
        : 14,
    },
    MEDIUM: {
      maxFontSize: showFullscreenControl
        ? 72
        : 34,
      minFontSize: showFullscreenControl
        ? 22
        : 16,
    },
    LARGE: {
      maxFontSize: showFullscreenControl
        ? 92
        : 40,
      minFontSize: showFullscreenControl
        ? 24
        : 18,
    },
  }

  const lyricsSizing =
    projectorSizingByPreference[
      lyricsSizePreference
    ] ||
    projectorSizingByPreference.AUTO_FIT

  return (
    <div
      className={
        showFullscreenControl
          ? 'projector-window-shell'
          : 'projector-preview-shell'
      }
    >
      <div className="projector-stage">
        {showFullscreenControl &&
          !isFullscreen && (
            <button
              className="fullscreen-button"
              onClick={enterFullscreen}
              type="button"
            >
              Full Screen
            </button>
          )}

        <div
          className={[
            'projector-screen',
            backgroundType === 'preset'
              ? `projector-screen-${backgroundVariant}`
              : 'projector-screen-custom',
            projectionMode === 'BLACK'
              ? 'black'
              : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={customBackgroundStyle}
        >
          {projectionMode === 'LIVE' &&
            song && (
              <div className="screen-content">
                <AutoFitLyrics
                  text={
                    currentSection?.lines.join(
                      '\n'
                    ) ||
                    song.lyrics ||
                    ''
                  }
                  maxFontSize={
                    lyricsSizing.maxFontSize
                  }
                  minFontSize={
                    lyricsSizing.minFontSize
                  }
                  containerClassName={
                    showFullscreenControl
                      ? 'lyrics-fit-container-projector'
                      : ''
                  }
                  textClassName={
                    showFullscreenControl
                      ? 'screen-lyrics-projector'
                      : ''
                  }
                  textAlign={
                    normalizedProjectionSettings.lyricsAlignment
                  }
                />

                {normalizedProjectionSettings.showSongTitle && (
                  <div className="screen-title">
                    {song.title}
                  </div>
                )}
              </div>
            )}
        </div>
      </div>
    </div>
  )
}

function App() {
  const isProjectorWindow =
    getProjectorWindowState()

  const [activeView, setActiveView] =
    useState('operator')

  const [songs, setSongs] = useState([])
  const [playlists, setPlaylists] =
    useState([])
  const [servicePlans, setServicePlans] =
    useState([])
  const [
    familyVersionsByFamilyId,
    setFamilyVersionsByFamilyId,
  ] = useState({})
  const [
    familyVersionsLoadingByFamilyId,
    setFamilyVersionsLoadingByFamilyId,
  ] = useState({})
  const [
    familyVersionsErrorByFamilyId,
    setFamilyVersionsErrorByFamilyId,
  ] = useState({})
  const [
    currentSongLanguageNotice,
    setCurrentSongLanguageNotice,
  ] = useState('')

  const [selectedSong, setSelectedSong] =
    useState(null)
  const [currentSong, setCurrentSong] =
    useState(null)
  const [
    pendingSongsScrollId,
    setPendingSongsScrollId,
  ] = useState(null)
  const [
    currentSongSourceId,
    setCurrentSongSourceId,
  ] = useState(null)

  const [
    selectedPlaylist,
    setSelectedPlaylist,
  ] = useState(null)
  const [
    openedPlaylistId,
    setOpenedPlaylistId,
  ] = useState(null)
  const [
    openedServicePlanId,
    setOpenedServicePlanId,
  ] = useState(null)
  const [
    selectedHistoryServicePlanId,
    setSelectedHistoryServicePlanId,
  ] = useState(null)
  const [
    loadedServicePlanId,
    setLoadedServicePlanId,
  ] = useState(null)

  const [search, setSearch] = useState('')
  const [
    playlistSearch,
    setPlaylistSearch,
  ] = useState('')
  const [typeFilter, setTypeFilter] =
    useState('ALL')

  const [
    projectionSong,
    setProjectionSong,
  ] = useState(null)

  const [sectionIndex, setSectionIndex] =
    useState(0)

  const [
    projectionMode,
    setProjectionMode,
  ] = useState('LIVE')

  const [
    showNewSongModal,
    setShowNewSongModal,
  ] = useState(false)

  const [
    showEditSongModal,
    setShowEditSongModal,
  ] = useState(false)
  const [
    showEditSectionsModal,
    setShowEditSectionsModal,
  ] = useState(false)
  const [
    showAddTranslationModal,
    setShowAddTranslationModal,
  ] = useState(false)
  const [
    editingSongId,
    setEditingSongId,
  ] = useState(null)
  const [
    editingSectionsSongId,
    setEditingSectionsSongId,
  ] = useState(null)
  const [
    addTranslationSourceSongId,
    setAddTranslationSourceSongId,
  ] = useState(null)
  const [
    showDeleteBlockedModal,
    setShowDeleteBlockedModal,
  ] = useState(false)
  const [
    showSaveServiceModal,
    setShowSaveServiceModal,
  ] = useState(false)
  const [
    showReuseServiceModal,
    setShowReuseServiceModal,
  ] = useState(false)
  const [
    showUseForTodayModal,
    setShowUseForTodayModal,
  ] = useState(false)
  const [
    showSavedPlaylistModal,
    setShowSavedPlaylistModal,
  ] = useState(false)
  const [
    isCreatingDatabaseBackup,
    setIsCreatingDatabaseBackup,
  ] = useState(false)
  const [
    lastBackupCreatedAt,
    setLastBackupCreatedAt,
  ] = useState('')

  const [
    draggedSongIndex,
    setDraggedSongIndex,
  ] = useState(null)

  const [
    dragOverSongIndex,
    setDragOverSongIndex,
  ] = useState(null)

  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] =
    useState('')
  const projectorChannelRef = useRef(null)
  const projectorWindowRef = useRef(null)
  const backgroundInputRef = useRef(null)
  const previousVisibleModeRef = useRef('LIVE')
  const latestProjectorStateRef = useRef(
    createProjectorState({
      song: null,
      sectionIndex: 0,
      projectionMode: 'CLEAR',
      backgroundType:
        DEFAULT_BACKGROUND_TYPE,
      backgroundVariant:
        DEFAULT_BACKGROUND_VARIANT,
      customBackgroundId: null,
      customBackgroundName: '',
    })
  )

  const [
    projectorWindowState,
    setProjectorWindowState,
  ] = useState(() => {
    const storedState = readStoredProjectorState()
    const storedSettings =
      readStoredProjectorSettings()

    return {
      projectionSong:
        storedState?.projectionSong || null,
      sectionIndex:
        storedState?.sectionIndex || 0,
      projectionMode:
        storedState?.projectionMode || 'CLEAR',
      backgroundType:
        storedState?.backgroundType ||
        DEFAULT_BACKGROUND_TYPE,
      backgroundVariant:
        storedState?.backgroundVariant ||
        DEFAULT_BACKGROUND_VARIANT,
      customBackgroundId:
        storedState?.customBackgroundId || null,
      customBackgroundName:
        storedState?.customBackgroundName || '',
      projectionSettings:
        normalizeProjectionSettings(
          storedState?.projectionSettings ||
            storedSettings
        ),
    }
  })

  const [newSong, setNewSong] = useState(
    createBlankSongForm
  )

  const [editSong, setEditSong] = useState(
    createBlankSongForm
  )
  const [
    sectionEditorRows,
    setSectionEditorRows,
  ] = useState([])
  const [
    addTranslationForm,
    setAddTranslationForm,
  ] = useState(() =>
    createAddTranslationForm()
  )
  const [
    backgroundType,
    setBackgroundType,
  ] = useState(() => {
    const storedState = readStoredProjectorState()

    return (
      storedState?.backgroundType ||
      DEFAULT_BACKGROUND_TYPE
    )
  })
  const [
    backgroundVariant,
    setBackgroundVariant,
  ] = useState(() => {
    const storedState = readStoredProjectorState()

    return (
      storedState?.backgroundVariant ||
      DEFAULT_BACKGROUND_VARIANT
    )
  })
  const [
    customBackgroundId,
    setCustomBackgroundId,
  ] = useState(() => {
    const storedState = readStoredProjectorState()

    return (
      storedState?.customBackgroundId || null
    )
  })
  const [
    customBackgroundName,
    setCustomBackgroundName,
  ] = useState(() => {
    const storedState = readStoredProjectorState()

    return (
      storedState?.customBackgroundName || ''
    )
  })
  const [
    customBackgroundUrl,
    setCustomBackgroundUrl,
  ] = useState('')
  const [
    projectionSettings,
    setProjectionSettings,
  ] = useState(() =>
    normalizeProjectionSettings(
      readStoredProjectorSettings()
    )
  )
  const manageSongItemRefs = useRef(
    new Map()
  )
  const [
    settingsForm,
    setSettingsForm,
  ] = useState(() =>
    normalizeProjectionSettings(
      readStoredProjectorSettings()
    )
  )
  const [
    managedPlaylistId,
    setManagedPlaylistId,
  ] = useState(null)
  const [
    prioritizedManagedPlaylistId,
    setPrioritizedManagedPlaylistId,
  ] = useState(null)
  const [
    savedPlaylistCreationMode,
    setSavedPlaylistCreationMode,
  ] = useState('NEW')
  const [
    savedPlaylistSourceId,
    setSavedPlaylistSourceId,
  ] = useState('')
  const [
    savedPlaylistForm,
    setSavedPlaylistForm,
  ] = useState(() =>
    createSavedPlaylistForm()
  )
  const [
    savedPlaylistMetadataForm,
    setSavedPlaylistMetadataForm,
  ] = useState(() =>
    createSavedPlaylistForm({
      serviceType: '',
      serviceDate: '',
    })
  )
  const [
    useForTodaySourcePlaylistId,
    setUseForTodaySourcePlaylistId,
  ] = useState(null)
  const [
    useForTodayForm,
    setUseForTodayForm,
  ] = useState({
    name: buildTodayServiceName(),
    serviceDate: getTodayDateValue(),
  })
  const [
    servicePlanSourcePlaylistId,
    setServicePlanSourcePlaylistId,
  ] = useState(null)
  const [
    servicePlanForm,
    setServicePlanForm,
  ] = useState({
    serviceName: '',
    serviceDate: getTodayDateValue(),
    serviceTime: '',
  })
  const [
    reuseServicePlanForm,
    setReuseServicePlanForm,
  ] = useState(() =>
    createReuseServicePlanForm()
  )
  const [
    reusedServiceSourceById,
    setReusedServiceSourceById,
  ] = useState({})

  function handleSettingsChange(event) {
    const { name, value, type, checked } =
      event.target

    setSettingsForm((current) => ({
      ...current,
      [name]:
        type === 'checkbox'
          ? checked
          : value,
    }))
  }

  function saveProjectionSettings() {
    const nextSettings =
      normalizeProjectionSettings(
        settingsForm
      )

    setProjectionSettings(nextSettings)
    setSettingsForm(nextSettings)
    persistProjectorSettings(nextSettings)
    setBackgroundType('preset')
    setBackgroundVariant(
      nextSettings.defaultBackgroundVariant
    )
    setError('')
  }

  function restoreDefaultProjectionSettings() {
    const nextSettings =
      normalizeProjectionSettings(
        DEFAULT_PROJECTION_SETTINGS
      )

    setProjectionSettings(nextSettings)
    setSettingsForm(nextSettings)
    persistProjectorSettings(nextSettings)
    setBackgroundType('preset')
    setBackgroundVariant(
      nextSettings.defaultBackgroundVariant
    )
    setError('')
  }

  async function downloadDatabaseBackup() {
    try {
      setIsCreatingDatabaseBackup(true)
      setError('')
      setSuccessMessage('')

      const response = await fetch(
        'http://localhost:8080/admin/backup/database'
      )

      if (!response.ok) {
        const message =
          await readErrorMessage(response)

        throw new Error(
          message ||
            'Could not create database backup.'
        )
      }

      const backupBlob =
        await response.blob()

      if (backupBlob.size <= 0) {
        throw new Error(
          'Could not create database backup.'
        )
      }

      const fileName =
        getDownloadFileName(
          response,
          'churchsongs-backup.db'
        )
      const downloadUrl =
        window.URL.createObjectURL(
          backupBlob
        )
      const link =
        document.createElement('a')

      link.href = downloadUrl
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(
        downloadUrl
      )

      setLastBackupCreatedAt(
        new Date().toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })
      )
      setSuccessMessage(
        'Database backup created successfully.'
      )
    } catch (err) {
      setError(
        err.message ||
          'Could not create database backup.'
      )
      setSuccessMessage('')
    } finally {
      setIsCreatingDatabaseBackup(false)
    }
  }

  const runProjectionCommand = useEffectEvent(
    (command) => {
      if (command === 'NEXT') {
        nextSection()
        return
      }

      if (command === 'PREVIOUS') {
        previousSection()
        return
      }

      if (command === 'BLACK') {
        toggleBlackScreen()
        return
      }

      if (command === 'CLEAR') {
        toggleClearLyrics()
      }
    }
  )

  useEffect(() => {
    if (isProjectorWindow) {
      return
    }

    loadSongs()
    loadPlaylists()
    loadServicePlans()
  }, [isProjectorWindow])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    if ('BroadcastChannel' in window) {
      projectorChannelRef.current =
        new BroadcastChannel(
          PROJECTOR_CHANNEL_NAME
        )

      projectorChannelRef.current.addEventListener(
        'message',
        (event) => {
          if (
            !isProjectorWindow &&
            event.data?.type ===
              PROJECTOR_COMMAND_MESSAGE
          ) {
            runProjectionCommand(
              event.data.command
            )
            return
          }

          if (
            isProjectorWindow ||
            event.data?.type !==
              PROJECTOR_REQUEST_MESSAGE
          ) {
            return
          }

          projectorChannelRef.current?.postMessage(
            createProjectorSyncMessage(
              latestProjectorStateRef.current
            )
          )
        }
      )
    }

    return () => {
      projectorChannelRef.current?.close()
      projectorChannelRef.current = null
    }
  }, [isProjectorWindow])

  useEffect(() => {
    if (!isProjectorWindow) {
      return undefined
    }

    let channel = null

    const applyProjectorState = (state) => {
      if (!state) {
        return
      }

      setProjectorWindowState({
        projectionSong:
          state.projectionSong || null,
        sectionIndex: state.sectionIndex || 0,
        projectionMode:
          state.projectionMode || 'CLEAR',
        backgroundType:
          state.backgroundType ||
          DEFAULT_BACKGROUND_TYPE,
        backgroundVariant:
          state.backgroundVariant ||
          DEFAULT_BACKGROUND_VARIANT,
        customBackgroundId:
          state.customBackgroundId || null,
        customBackgroundName:
          state.customBackgroundName || '',
        projectionSettings:
          normalizeProjectionSettings(
            state.projectionSettings ||
              readStoredProjectorSettings()
          ),
      })
    }

    if ('BroadcastChannel' in window) {
      channel = new BroadcastChannel(
        PROJECTOR_CHANNEL_NAME
      )

      channel.addEventListener(
        'message',
        (event) => {
          if (
            event.data?.type !==
            PROJECTOR_SYNC_MESSAGE
          ) {
            return
          }

          applyProjectorState(
            event.data.payload
          )
        }
      )

      channel.postMessage({
        type: PROJECTOR_REQUEST_MESSAGE,
      })
    }

    const handleStorage = (event) => {
      if (event.key !== PROJECTOR_STATE_KEY) {
        return
      }

      try {
        applyProjectorState(
          event.newValue
            ? JSON.parse(event.newValue)
            : null
        )
      } catch {
        // Ignore malformed fallback state.
      }
    }

    const handleProjectorKeyDown = (event) => {
      if (shouldIgnoreProjectionShortcut(event)) {
        return
      }

      const command =
        getProjectionShortcutCommand(event)

      if (!command || !channel) {
        return
      }

      event.preventDefault()
      channel.postMessage(
        createProjectorCommandMessage(command)
      )
    }

    window.addEventListener(
      'storage',
      handleStorage
    )
    document.addEventListener(
      'keydown',
      handleProjectorKeyDown,
      true
    )

    applyProjectorState(
      readStoredProjectorState()
    )

    const requestTimer = window.setTimeout(
      () => {
        channel?.postMessage({
          type: PROJECTOR_REQUEST_MESSAGE,
        })
      },
      300
    )

    return () => {
      window.clearTimeout(requestTimer)
      channel?.close()
      window.removeEventListener(
        'storage',
        handleStorage
      )
      document.removeEventListener(
        'keydown',
        handleProjectorKeyDown,
        true
      )
    }
  }, [isProjectorWindow])

  useEffect(() => {
    let active = true
    let objectUrl = ''

    const nextCustomBackgroundId =
      isProjectorWindow
        ? projectorWindowState.customBackgroundId
        : customBackgroundId

    if (!nextCustomBackgroundId) {
      setCustomBackgroundUrl('')
      return undefined
    }

    loadBackgroundImage(nextCustomBackgroundId)
      .then((record) => {
        if (!active || !record?.file) {
          return
        }

        objectUrl = URL.createObjectURL(
          record.file
        )
        setCustomBackgroundUrl(objectUrl)
      })
      .catch(() => {
        if (active) {
          setCustomBackgroundUrl('')
        }
      })

    return () => {
      active = false

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [
    customBackgroundId,
    isProjectorWindow,
    projectorWindowState.customBackgroundId,
  ])

  useEffect(() => {
    if (readStoredProjectorState()) {
      return
    }

    setBackgroundType('preset')
    setBackgroundVariant(
      projectionSettings.defaultBackgroundVariant
    )
  }, [projectionSettings.defaultBackgroundVariant])

  async function loadSongs() {
    try {
      const response = await fetch(
        'http://localhost:8080/songs'
      )

      if (!response.ok) {
        throw new Error(
          'Failed to load songs'
        )
      }

      const data = await response.json()

      setSongs(data)

      setSelectedSong((current) => {
        if (!current) {
          return data[0] || null
        }

        return (
          data.find(
            (song) => song.id === current.id
          ) ||
          data[0] ||
          null
        )
      })
    } catch (err) {
      if (
        err instanceof TypeError &&
        err.message === 'Failed to fetch'
      ) {
        setError(
          'Could not reach the backend rename endpoint. Restart the church-song-api server and try again.'
        )
        return
      }

      setError(err.message)
    }
  }

  async function loadPlaylists() {
    try {
      const response = await fetch(
        'http://localhost:8080/playlists'
      )

      if (!response.ok) {
        throw new Error(
          'Failed to load playlists'
        )
      }

      const data = await response.json()
      const reusablePlaylistList = data.filter(
        (playlist) => playlist.reusable !== false
      )
      const savedPlaylistList = data.filter(
        (playlist) => playlist.reusable === false
      )
      const defaultPlaylist =
        reusablePlaylistList[0] || data[0] || null

      setPlaylists(data)

      setSelectedPlaylist((current) => {
        if (!current) {
          return defaultPlaylist
        }

        return (
          data.find(
            (playlist) =>
              playlist.id === current.id
          ) ||
          defaultPlaylist
        )
      })

      setOpenedPlaylistId((current) => {
        if (current == null) {
          return (
            reusablePlaylistList[0]?.id || null
          )
        }

        return reusablePlaylistList.some(
          (playlist) => playlist.id === current
        )
          ? current
          : reusablePlaylistList[0]?.id || null
      })

      setManagedPlaylistId((current) => {
        const defaultPlaylist =
          reusablePlaylistList[0] ||
          savedPlaylistList[0] ||
          null

        if (current == null) {
          return defaultPlaylist?.id || null
        }

        return data.some(
          (playlist) => playlist.id === current
        )
          ? current
          : defaultPlaylist?.id || null
      })

    } catch (err) {
      setError(err.message)
    }
  }

  async function loadServicePlans() {
    try {
      const response = await fetch(
        'http://localhost:8080/service-plans'
      )

      if (!response.ok) {
        throw new Error(
          'Failed to load service plans'
        )
      }

      const data = await response.json()
      const sortedPlans =
        sortServicePlans(data)
      const sortedHistory =
        sortCompletedServicePlans(
          data.filter((servicePlan) =>
            isCompletedServicePlan(
              servicePlan
            )
          )
        )

      setServicePlans(sortedPlans)

      setOpenedServicePlanId((current) => {
        const activePlans = sortedPlans.filter(
          (servicePlan) =>
            !isCompletedServicePlan(
              servicePlan
            )
        )

        if (current == null) {
          return activePlans[0]?.id || null
        }

        return activePlans.some(
          (servicePlan) =>
            servicePlan.id === current
        )
          ? current
          : activePlans[0]?.id || null
      })

      setLoadedServicePlanId((current) => {
        if (current == null) {
          return null
        }

        return sortedPlans.some(
          (servicePlan) =>
            servicePlan.id === current
        )
          ? current
          : null
      })
      setSelectedHistoryServicePlanId(
        (current) => {
          if (sortedHistory.length === 0) {
            return null
          }

          if (
            current != null &&
            sortedHistory.some(
              (servicePlan) =>
                servicePlan.id === current
            )
          ) {
            return current
          }

          return sortedHistory[0].id
        }
      )
    } catch (err) {
      setError(err.message)
    }
  }

  const filteredSongs = useMemo(() => {
    const text = search.toLowerCase()

    return songs.filter((song) => {
      const matchesText =
        song.title
          .toLowerCase()
          .includes(text) ||
        (
          song.author &&
          song.author
            .toLowerCase()
            .includes(text)
        )

      const matchesType =
        typeFilter === 'ALL' ||
        song.songType === typeFilter

      return matchesText && matchesType
    })
  }, [songs, search, typeFilter])

  const reusablePlaylists = useMemo(
    () =>
      playlists.filter(
        (playlist) => playlist.reusable !== false
      ),
    [playlists]
  )
  const savedServicePlaylists = useMemo(
    () =>
      playlists
        .filter(
          (playlist) => playlist.reusable === false
        )
        .sort((left, right) =>
          (right.serviceDate || '').localeCompare(
            left.serviceDate || ''
          ) || left.name.localeCompare(right.name)
        ),
    [playlists]
  )
  const managedPlaylists = useMemo(
    () => {
      const orderedPlaylists = [
        ...reusablePlaylists,
        ...savedServicePlaylists,
      ]

      if (prioritizedManagedPlaylistId == null) {
        return orderedPlaylists
      }

      const prioritizedIndex =
        orderedPlaylists.findIndex(
          (playlist) =>
            playlist.id ===
            prioritizedManagedPlaylistId
        )

      if (prioritizedIndex <= 0) {
        return orderedPlaylists
      }

      const prioritizedPlaylist =
        orderedPlaylists[prioritizedIndex]

      return [
        prioritizedPlaylist,
        ...orderedPlaylists.filter(
          (playlist) =>
            playlist.id !==
            prioritizedManagedPlaylistId
        ),
      ]
    },
    [
      reusablePlaylists,
      savedServicePlaylists,
      prioritizedManagedPlaylistId,
    ]
  )
  const filteredManagedPlaylists = useMemo(() => {
    const text =
      playlistSearch.trim().toLowerCase()

    if (!text) {
      return managedPlaylists
    }

    return managedPlaylists.filter((playlist) => {
      const searchableValues = [
        playlist.name || '',
        playlist.serviceType || '',
        playlist.theme || '',
        playlist.serviceDate || '',
        formatShortDateLabel(
          playlist.serviceDate
        ),
        formatFullDateLabel(
          playlist.serviceDate
        ),
        formatServiceDate(
          playlist.serviceDate
        ),
      ]

      return searchableValues.some((value) =>
        String(value)
          .toLowerCase()
          .includes(text)
      )
    })
  }, [managedPlaylists, playlistSearch])
  const selectedSongWorkingPlaylists = useMemo(() => {
    if (!selectedSong) {
      return []
    }

    return playlists.filter(
      (playlist) =>
        playlist.reusable === false &&
        (playlist.songs || []).some(
          (song) => song?.id === selectedSong.id
        )
    )
  }, [playlists, selectedSong])
  const todayWorkingPlaylist = useMemo(
    () =>
      playlists.find(
        (playlist) =>
          playlist.reusable === false &&
          playlist.serviceDate ===
            getTodayDateValue()
      ) || null,
    [playlists]
  )

  const playlistSongs =
    (
      (
        servicePlans.find(
          (servicePlan) =>
            servicePlan.id === loadedServicePlanId
        )?.songs ||
        selectedPlaylist?.songs ||
        []
      )
    ).filter((song) => song != null)

  const openedPlaylist =
    reusablePlaylists.find(
      (playlist) => playlist.id === openedPlaylistId
    ) || null
  const managedPlaylist =
    managedPlaylists.find(
      (playlist) =>
        playlist.id === managedPlaylistId
    ) || null
  const managedPlaylistIsSaved =
    managedPlaylist?.reusable === false
  const savedPlaylistPreviewName =
    buildStructuredPlaylistName(
      resolvePlaylistServiceType(
        savedPlaylistForm.serviceType,
        savedPlaylistForm.customServiceType
      ),
      savedPlaylistForm.serviceDate
    )
  const managedPlaylistPreviewName =
    buildStructuredPlaylistName(
      resolvePlaylistServiceType(
        savedPlaylistMetadataForm.serviceType,
        savedPlaylistMetadataForm.customServiceType
      ),
      savedPlaylistMetadataForm.serviceDate,
      savedPlaylistMetadataForm.legacyName
    )
  const activeServicePlans = useMemo(
    () =>
      servicePlans.filter(
        (servicePlan) =>
          !isCompletedServicePlan(
            servicePlan
          )
      ),
    [servicePlans]
  )
  const completedServiceHistory = useMemo(
    () =>
      sortCompletedServicePlans(
        servicePlans.filter(
          (servicePlan) =>
            isCompletedServicePlan(
              servicePlan
            )
        )
      ),
    [servicePlans]
  )
  const openedServicePlan =
    activeServicePlans.find(
      (servicePlan) =>
        servicePlan.id === openedServicePlanId
    ) || null
  const loadedServicePlan =
    servicePlans.find(
      (servicePlan) =>
        servicePlan.id === loadedServicePlanId
    ) || null

  const openedPlaylistSongs =
    (
      openedPlaylist?.songs || []
    ).filter((song) => song != null)
  const managedPlaylistSongs =
    (
      managedPlaylist?.songs || []
    ).filter((song) => song != null)
  const savedPlaylistSource =
    playlists.find(
      (playlist) =>
        playlist.id ===
        Number(savedPlaylistSourceId)
    ) || null
  const savedPlaylistSourceSongs =
    (
      savedPlaylistSource?.songs || []
    ).filter((song) => song != null)
  const openedServicePlanSongs =
    (
      openedServicePlan?.songs || []
    ).filter((song) => song != null)
  const servicePlanSourcePlaylist =
    reusablePlaylists.find(
      (playlist) =>
        playlist.id ===
        servicePlanSourcePlaylistId
    ) || null
  const useForTodaySourcePlaylist =
    reusablePlaylists.find(
      (playlist) =>
        playlist.id ===
        useForTodaySourcePlaylistId
    ) || null
  const useForTodaySourceSongs =
    (
      useForTodaySourcePlaylist?.songs || []
    ).filter((song) => song != null)
  const servicePlanSourceSongs =
    (
      servicePlanSourcePlaylist?.songs || []
    ).filter((song) => song != null)
  const upcomingServicePlans =
    activeServicePlans.filter(
      (servicePlan) =>
        (servicePlan.serviceDate || '') >=
        getTodayDateValue()
    )
  const selectedHistoryServicePlan =
    completedServiceHistory.find(
      (servicePlan) =>
        servicePlan.id ===
        selectedHistoryServicePlanId
    ) ||
    completedServiceHistory[0] ||
    null
  const loadedServicePlanReuseSource =
    loadedServicePlan == null
      ? null
      : completedServiceHistory.find(
          (servicePlan) =>
            servicePlan.id ===
            reusedServiceSourceById[
              loadedServicePlan.id
            ]
        ) || null
  const usingLoadedServicePlan =
    loadedServicePlan != null
  const consoleCollectionLabel =
    usingLoadedServicePlan
      ? formatServiceOccurrenceName(
          loadedServicePlan
        )
      : selectedPlaylist?.name
  const consoleServiceHeaderLabel =
    formatConsoleServiceLabel(
      selectedPlaylist,
      loadedServicePlan
    )
  const consoleCollectionTypeLabel =
    usingLoadedServicePlan
      ? 'Working Service'
      : 'Service Playlist'
  const completableServiceTarget =
    getCompletableServiceTarget()

  const selectedSongPlaylistCount =
    selectedSong == null
      ? 0
      : playlists.filter((playlist) =>
          (playlist.songs || []).some(
            (song) =>
              song?.id === selectedSong.id
          )
        ).length

  const selectedSongPlaylistNames =
    selectedSong == null
      ? []
      : playlists
          .filter((playlist) =>
            (playlist.songs || []).some(
              (song) =>
                song?.id === selectedSong.id
            )
          )
          .map((playlist) => playlist.name)
  const selectedSongServicePlanNames =
    selectedSong == null
      ? []
      : activeServicePlans
          .filter((servicePlan) =>
            (servicePlan.songs || []).some(
              (song) =>
                song?.id === selectedSong.id
            )
          )
          .map(
            (servicePlan) =>
              servicePlan.serviceName
          )
  const selectedSongUsageCount =
    selectedSongPlaylistCount +
    selectedSongServicePlanNames.length
  const selectedSongResolved = useMemo(
    () =>
      resolveSongFromCollection(
        selectedSong,
        songs
      ),
    [selectedSong, songs]
  )
  const currentSongResolved = useMemo(
    () =>
      resolveSongFromCollection(
        currentSong,
        songs
      ),
    [currentSong, songs]
  )
  const projectionSongResolved = useMemo(
    () =>
      resolveSongFromCollection(
        projectionSong,
        songs
      ),
    [projectionSong, songs]
  )

  function openSongsAdministration() {
    const targetSongId =
      currentSongResolved?.id ??
      selectedSongResolved?.id ??
      null

    if (targetSongId != null) {
      const resolvedSong =
        songs.find(
          (song) =>
            song.id === targetSongId
        ) || null

      setSelectedSong(resolvedSong)
      setPendingSongsScrollId(
        resolvedSong?.id ?? null
      )
      setSearch('')
      setTypeFilter('ALL')
    } else {
      setPendingSongsScrollId(null)
    }

    setActiveView('songs')
  }

  const previewSong =
    projectionSongResolved ||
    currentSongResolved
  const previewSections = useMemo(() => {
    if (!previewSong) {
      return []
    }

    return parseLyricsSections(previewSong)
  }, [previewSong])
  const currentSection =
    previewSections[sectionIndex] ||
    previewSections[0]
  const canGoToPreviousProjection =
    sectionIndex > 0
  const canGoToNextProjection =
    sectionIndex <
      previewSections.length - 1
  const currentSongSelectionId =
    currentSongSourceId ??
    currentSongResolved?.id ??
    null
  const selectedSongFamilyId =
    getValidSongFamilyId(selectedSongResolved)
  const currentSongFamilyId =
    getValidSongFamilyId(currentSongResolved)
  const selectedSongLanguageVersions =
    useMemo(
      () =>
        resolveLanguageVersionsForSong(
          selectedSongResolved,
          songs,
          familyVersionsByFamilyId
        ),
      [
        selectedSongResolved,
        songs,
        familyVersionsByFamilyId,
      ]
    )
  const selectedSongSections = useMemo(
    () =>
      parseLyricsSections(
        selectedSongResolved
      ),
    [selectedSongResolved]
  )
  const currentSongLanguageVersions =
    useMemo(
      () =>
        resolveLanguageVersionsForSong(
          currentSongResolved,
          songs,
          familyVersionsByFamilyId
        ),
      [
        currentSongResolved,
        songs,
        familyVersionsByFamilyId,
      ]
    )
  const showCurrentSongLanguageSelector =
    Boolean(currentSongResolved)
  const selectedSongNeedsSectionReview =
    selectedSongSections.some(
      (section) => section.needsSectionReview
    )
  const selectedSongSectionsConfirmed =
    selectedSongSections.length > 0 &&
    selectedSongSections.every(
      (section) => section.sectionsConfirmed
    )

  useEffect(() => {
    setSavedPlaylistMetadataForm(
      createPlaylistFormFromPlaylist(
        managedPlaylist
      )
    )
  }, [
    managedPlaylist?.id,
    managedPlaylist?.name,
    managedPlaylist?.serviceType,
    managedPlaylist?.serviceDate,
    managedPlaylist?.theme,
  ])

  useEffect(() => {
    setCurrentSongLanguageNotice('')
  }, [currentSongResolved?.id])

  useEffect(() => {
    setServicePlanForm({
      serviceName:
        openedServicePlan?.serviceName ||
        selectedPlaylist?.name ||
        '',
      serviceDate:
        openedServicePlan?.serviceDate ||
        getTodayDateValue(),
      serviceTime:
        openedServicePlan?.serviceTime || '',
    })
  }, [
    openedServicePlan?.id,
    openedServicePlan?.serviceName,
    openedServicePlan?.serviceDate,
    openedServicePlan?.serviceTime,
    selectedPlaylist?.name,
  ])

  useEffect(() => {
    if (projectionMode !== 'BLACK') {
      previousVisibleModeRef.current =
        projectionMode
    }
  }, [projectionMode])

  useEffect(() => {
    let cancelled = false
    const familyIdsToLoad = [
      selectedSongFamilyId,
      currentSongFamilyId,
    ].filter(
      (familyId, index, values) =>
        familyId != null &&
        values.indexOf(familyId) === index
    )

    async function loadSongFamilyMembers(
      familyId
    ) {
      try {
        setFamilyVersionsLoadingByFamilyId(
          (current) => ({
            ...current,
            [familyId]: true,
          })
        )
        setFamilyVersionsErrorByFamilyId(
          (current) => ({
            ...current,
            [familyId]: '',
          })
        )

        const response = await fetch(
          `http://localhost:8080/song-families/${familyId}/versions`
        )

        if (!response.ok) {
          throw new Error(
            'Failed to load language versions'
          )
        }

        const data = await response.json()

        if (cancelled) {
          return
        }

        setFamilyVersionsByFamilyId(
          (current) => ({
            ...current,
            [familyId]: data,
          })
        )
      } catch (err) {
        if (cancelled) {
          return
        }

        console.error(
          'Could not load translation information.',
          {
            method: 'GET',
            url: `http://localhost:8080/song-families/${familyId}/versions`,
            error: err,
          }
        )
        setFamilyVersionsErrorByFamilyId(
          (current) => ({
            ...current,
            [familyId]:
              'Could not load translation information.',
          })
        )
      } finally {
        if (cancelled) {
          return
        }

        setFamilyVersionsLoadingByFamilyId(
          (current) => ({
            ...current,
            [familyId]: false,
          })
        )
      }
    }

    familyIdsToLoad.forEach((familyId) => {
      if (
        familyVersionsByFamilyId[familyId] ||
        familyVersionsLoadingByFamilyId[familyId]
      ) {
        return
      }

      loadSongFamilyMembers(familyId)
    })

    return () => {
      cancelled = true
    }
  }, [
    selectedSongFamilyId,
    currentSongFamilyId,
    familyVersionsByFamilyId,
    familyVersionsLoadingByFamilyId,
  ])

  useEffect(() => {
    if (
      activeView !== 'songs' ||
      pendingSongsScrollId == null
    ) {
      return
    }

    const targetNode =
      manageSongItemRefs.current.get(
        pendingSongsScrollId
      )

    if (!targetNode) {
      return
    }

    targetNode.scrollIntoView({
      block: 'center',
      behavior: 'smooth',
    })
    setPendingSongsScrollId(null)
  }, [
    activeView,
    filteredSongs,
    pendingSongsScrollId,
  ])

  useEffect(() => {
    if (isProjectorWindow) {
      return
    }

    const nextProjectorState =
      createProjectorState({
        song: previewSong,
        sectionIndex,
        projectionMode,
        backgroundType,
        backgroundVariant,
        customBackgroundId,
        customBackgroundName,
        projectionSettings,
      })

    latestProjectorStateRef.current =
      nextProjectorState

    persistProjectorState(nextProjectorState)
    projectorChannelRef.current?.postMessage(
      createProjectorSyncMessage(
        nextProjectorState
      )
    )
  }, [
    isProjectorWindow,
    backgroundType,
    backgroundVariant,
    customBackgroundId,
    customBackgroundName,
    projectionSettings,
    projectionMode,
    previewSong,
    sectionIndex,
  ])

  function handleNewSongChange(event) {
    const { name, value } = event.target

    setNewSong((current) => ({
      ...current,
      [name]: value,
    }))
  }

  function handleEditSongChange(event) {
    const { name, value } = event.target

    setEditSong((current) => ({
      ...current,
      [name]: value,
    }))
  }

  function handleAddTranslationChange(
    event
  ) {
    const { name, value } = event.target

    setAddTranslationForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  function closeNewSongModal() {
    setShowNewSongModal(false)
    setNewSong(createBlankSongForm())
  }

  function closeEditSongModal() {
    setShowEditSongModal(false)
    setEditingSongId(null)
    setEditSong(createBlankSongForm())
  }

  function closeEditSectionsModal() {
    setShowEditSectionsModal(false)
    setEditingSectionsSongId(null)
    setSectionEditorRows([])
  }

  function closeAddTranslationModal() {
    setShowAddTranslationModal(false)
    setAddTranslationSourceSongId(null)
    setAddTranslationForm(
      createAddTranslationForm()
    )
  }

  async function createSong() {
    try {
      setError('')

      const response = await fetch(
        'http://localhost:8080/songs',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify(newSong),
        }
      )

      if (!response.ok) {
        throw new Error(
          'Failed to create song'
        )
      }

      const createdSong =
        await response.json()

      setSongs((current) => [
        ...current,
        createdSong,
      ])

      setSelectedSong(createdSong)
      setSectionIndex(0)
      closeNewSongModal()
    } catch (err) {
      setError(err.message)
    }
  }

  function openEditSongModal(
    song = selectedSong
  ) {
    const resolvedSong =
      songs.find(
        (candidate) =>
          candidate.id === song?.id
      ) || song

    if (!resolvedSong) {
      return
    }

    setSelectedSong(resolvedSong)
    setEditingSongId(resolvedSong.id)
    setEditSong(
      createSongFormFromSong(resolvedSong)
    )
    setShowEditSongModal(true)
  }

  function openEditSectionsModal(
    song = selectedSongResolved
  ) {
    const resolvedSong =
      songs.find(
        (candidate) =>
          candidate.id === song?.id
      ) || song

    if (!resolvedSong) {
      return
    }

    setSelectedSong(resolvedSong)
    setEditingSectionsSongId(
      resolvedSong.id
    )
    setSectionEditorRows(
      createSectionEditorRowsFromSong(
        resolvedSong
      )
    )
    setShowEditSectionsModal(true)
  }

  function handleSectionEditorRowChange(
    rowIndex,
    updates
  ) {
    setSectionEditorRows((current) =>
      current.map((row, index) => {
        if (index !== rowIndex) {
          return row
        }

        const nextType =
          updates.type != null
            ? normalizeSectionType(
                updates.type
              ) || 'UNASSIGNED'
            : row.type

        return {
          ...row,
          ...updates,
          type: nextType,
          verseNumber:
            nextType === 'VERSE'
              ? String(
                  updates.verseNumber ??
                    row.verseNumber ??
                    ''
                )
              : '',
          customLabel:
            nextType === 'OTHER'
              ? String(
                  updates.customLabel ??
                    row.customLabel ??
                    ''
                )
              : '',
        }
      })
    )
  }

  function openAddTranslationModal(
    language,
    song = selectedSongResolved
  ) {
    const resolvedSong =
      songs.find(
        (candidate) =>
          candidate.id === song?.id
      ) || song

    if (!resolvedSong) {
      return
    }

    setSelectedSong(resolvedSong)
    setAddTranslationSourceSongId(
      resolvedSong.id
    )
    setAddTranslationForm(
      createAddTranslationForm(
        language,
        resolvedSong
      )
    )
    setShowAddTranslationModal(true)
  }

  async function updateSong() {
    if (!editingSongId) {
      return
    }

    try {
      setError('')

      const response = await fetch(
        `http://localhost:8080/songs/${editingSongId}`,
        {
          method: 'PUT',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify(editSong),
        }
      )

      if (!response.ok) {
        const message =
          await readErrorMessage(response)

        throw new Error(
          message ||
            'Failed to update song'
        )
      }

      const updatedSong =
        await response.json()

      setSongs((current) =>
        current.map((song) =>
          song.id === updatedSong.id
            ? updatedSong
            : song
        )
      )

      setPlaylists((current) =>
        current.map((playlist) => ({
          ...playlist,

          songs: (
            playlist.songs || []
          )
            .filter((song) => song != null)
            .map((song) =>
              song.id === updatedSong.id
                ? updatedSong
                : song
            ),
        }))
      )

      setServicePlans((current) =>
        sortServicePlans(
          current.map((servicePlan) => ({
            ...servicePlan,
            songs: (
              servicePlan.songs || []
            )
              .filter((song) => song != null)
              .map((song) =>
                song.id === updatedSong.id
                  ? updatedSong
                  : song
              ),
          }))
        )
      )

      setSelectedPlaylist(
        (current) => {
          if (!current) {
            return current
          }

          return {
            ...current,

            songs: (
              current.songs || []
            )
              .filter(
                (song) => song != null
              )
              .map((song) =>
                song.id === updatedSong.id
                  ? updatedSong
                  : song
              ),
          }
        }
      )

      setSelectedSong(updatedSong)
      setSectionIndex(0)

      if (currentSong?.id === updatedSong.id) {
        setCurrentSong(updatedSong)
      }

      if (
        projectionSong?.id ===
        updatedSong.id
      ) {
        setProjectionSong(updatedSong)
      }

      closeEditSongModal()
    } catch (err) {
      setError(err.message)
    }
  }

  async function createTranslation() {
    if (!addTranslationSourceSongId) {
      return
    }

    try {
      setError('')

      const response = await fetch(
        `http://localhost:8080/songs/${addTranslationSourceSongId}/translations`,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify(
            addTranslationForm
          ),
        }
      )

      if (!response.ok) {
        const message =
          await readErrorMessage(response)

        throw new Error(
          message ||
            'Failed to add translation'
        )
      }

      const data = await response.json()
      const nextFamilyVersions =
        data.versions
      const nextFamilyId =
        nextFamilyVersions?.familyId ??
        data.sourceSong?.familyId ??
        null
      const updatedSongs = [
        data.sourceSong,
        data.translationSong,
        ...Object.values(
          nextFamilyVersions?.versions || {}
        ),
      ].filter(Boolean)

      setSongs((current) => {
        const byId = new Map(
          current.map((song) => [
            song.id,
            song,
          ])
        )

        updatedSongs.forEach((song) => {
          byId.set(song.id, song)
        })

        return Array.from(byId.values())
      })

      if (nextFamilyId) {
        setFamilyVersionsByFamilyId(
          (current) => ({
            ...current,
            [nextFamilyId]:
              nextFamilyVersions,
          })
        )
        setFamilyVersionsErrorByFamilyId(
          (current) => ({
            ...current,
            [nextFamilyId]: '',
          })
        )
        setFamilyVersionsLoadingByFamilyId(
          (current) => ({
            ...current,
            [nextFamilyId]: false,
          })
        )
      }

      setSelectedSong(data.sourceSong)

      if (
        currentSong?.id ===
        data.sourceSong?.id
      ) {
        setCurrentSong(data.sourceSong)
      }

      if (
        projectionSong?.id ===
        data.sourceSong?.id
      ) {
        setProjectionSong(data.sourceSong)
      }

      setSuccessMessage(
        `Added ${getLanguageLabel(addTranslationForm.language)} translation for "${data.sourceSong.title}".`
      )
      closeAddTranslationModal()
    } catch (err) {
      setError(err.message)
    }
  }

  async function saveSectionAssignments() {
    if (!editingSectionsSongId) {
      return
    }

    const hasUnassignedRows =
      sectionEditorRows.some((row) => {
        if (
          normalizeSectionType(row.type) ===
          'UNASSIGNED'
        ) {
          return true
        }

        if (
          normalizeSectionType(row.type) ===
            'VERSE' &&
          !String(
            row.verseNumber || ''
          ).trim()
        ) {
          return true
        }

        if (
          normalizeSectionType(row.type) ===
            'OTHER' &&
          !String(
            row.customLabel || ''
          ).trim()
        ) {
          return true
        }

        return false
      })

    if (hasUnassignedRows) {
      setError(
        'Assign a valid label to every existing section before saving.'
      )
      return
    }

    const sourceSong =
      songs.find(
        (song) =>
          song.id === editingSectionsSongId
      ) || selectedSongResolved

    if (!sourceSong) {
      return
    }

    try {
      setError('')

      const response = await fetch(
        `http://localhost:8080/songs/${editingSectionsSongId}/sections`,
        {
          method: 'PUT',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            sections: sectionEditorRows.map(
              (row) => ({
                type: row.type,
                verseNumber:
                  row.type === 'VERSE'
                    ? Number(
                        row.verseNumber
                      )
                    : null,
                customLabel:
                  row.type === 'OTHER'
                    ? row.customLabel
                    : '',
              })
            ),
            sectionsConfirmed: true,
          }),
        }
      )

      if (!response.ok) {
        const message =
          await readErrorMessage(response)

        throw new Error(
          message ||
            'Could not save section assignments.'
        )
      }

      const updatedSong =
        await response.json()

      setSongs((current) =>
        current.map((song) =>
          song.id === updatedSong.id
            ? updatedSong
            : song
        )
      )

      setPlaylists((current) =>
        current.map((playlist) => ({
          ...playlist,
          songs: (
            playlist.songs || []
          ).map((song) =>
            song?.id === updatedSong.id
              ? updatedSong
              : song
          ),
        }))
      )

      setServicePlans((current) =>
        sortServicePlans(
          current.map((servicePlan) => ({
            ...servicePlan,
            songs: (
              servicePlan.songs || []
            ).map((song) =>
              song?.id === updatedSong.id
                ? updatedSong
                : song
            ),
          }))
        )
      )

      setSelectedSong(updatedSong)

      if (currentSong?.id === updatedSong.id) {
        setCurrentSong(updatedSong)
      }

      if (
        projectionSong?.id ===
        updatedSong.id
      ) {
        setProjectionSong(updatedSong)
      }

      setSuccessMessage(
        'Section assignments saved.'
      )
      closeEditSectionsModal()
    } catch (err) {
      setError(err.message)
    }
  }

  async function addSongToPlaylist(
    playlist,
    song = selectedSong
  ) {
    if (!song || !playlist) {
      return
    }

    try {
      setError('')

      const response = await fetch(
        `http://localhost:8080/playlists/id/${playlist.id}/songs/${song.id}`,
        {
          method: 'POST',
        }
      )

      if (!response.ok) {
        const message =
          await readErrorMessage(response)

        throw new Error(
          message ||
            'Failed to add song to playlist'
        )
      }

      const updatedPlaylist =
        await response.json()

      if (selectedPlaylist?.id === updatedPlaylist.id) {
        setSelectedPlaylist(
          updatedPlaylist
        )
      }

      if (openedPlaylistId === updatedPlaylist.id) {
        setOpenedPlaylistId(updatedPlaylist.id)
      }

      setPlaylists((current) =>
        current.map((playlist) =>
          playlist.id ===
          updatedPlaylist.id
            ? updatedPlaylist
            : playlist
        )
      )
    } catch (err) {
      setError(err.message)
    }
  }

  async function addSongToServicePlan(
    servicePlan,
    song = selectedSong
  ) {
    if (!song || !servicePlan) {
      return
    }

    try {
      setError('')

      const response = await fetch(
        `http://localhost:8080/service-plans/${servicePlan.id}/songs/${song.id}`,
        {
          method: 'POST',
        }
      )

      if (!response.ok) {
        const message =
          await readErrorMessage(response)

        throw new Error(
          message ||
            'Failed to add song to service plan'
        )
      }

      const updatedServicePlan =
        await response.json()

      setServicePlans((current) =>
        sortServicePlans(
          current.map((servicePlanItem) =>
            servicePlanItem.id ===
            updatedServicePlan.id
              ? updatedServicePlan
              : servicePlanItem
          )
        )
      )
    } catch (err) {
      setError(err.message)
    }
  }

  async function addSelectedSongToConsoleCollection() {
    if (loadedServicePlan) {
      await addSongToServicePlan(
        loadedServicePlan
      )
      return
    }

    await addSongToPlaylist(selectedPlaylist)
  }

  async function deleteSelectedSong() {
    if (!selectedSong) {
      return
    }

    if (selectedSongUsageCount > 0) {
      setShowDeleteBlockedModal(true)
      return
    }

    const confirmed = window.confirm(
      `Delete "${selectedSong.title}"? This cannot be undone.`
    )

    if (!confirmed) {
      return
    }

    try {
      setError('')

      const response = await fetch(
        `http://localhost:8080/songs/${selectedSong.id}`,
        {
          method: 'DELETE',
        }
      )

      if (!response.ok) {
        const message =
          await readErrorMessage(response)

        throw new Error(
          message ||
            'Failed to delete song'
        )
      }

      const deletedSongId = selectedSong.id
      const nextSongs = songs.filter(
        (song) => song.id !== deletedSongId
      )

      setSongs(nextSongs)
      if (editingSongId === deletedSongId) {
        closeEditSongModal()
      }
      setSelectedSong(nextSongs[0] || null)
      setSectionIndex(0)

      if (projectionSong?.id === deletedSongId) {
        setProjectionSong(null)
      }

      if (
        currentSong?.id === deletedSongId ||
        currentSongSelectionId ===
          deletedSongId
      ) {
        setCurrentSong(null)
        setCurrentSongSourceId(null)
      }
    } catch (err) {
      if (selectedSongUsageCount > 0) {
        setShowDeleteBlockedModal(true)
      }
      setError(err.message)
    }
  }

  function handleServicePlanFormChange(
    event
  ) {
    const { name, value } = event.target

    setServicePlanForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  function handleReuseServicePlanFormChange(
    event
  ) {
    const { name, value } = event.target

    setReuseServicePlanForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  function openSaveServiceModal(
    sourcePlaylist = selectedPlaylist
  ) {
    if (!sourcePlaylist) {
      setError(
        'Choose a regular playlist before saving a service plan'
      )
      setSuccessMessage('')
      return
    }

    const sourcePlaylistSongs = (
      sourcePlaylist.songs || []
    ).filter((song) => song != null)

    if (sourcePlaylistSongs.length === 0) {
      setError(
        'Add songs to the selected regular playlist before saving a service plan'
      )
      setSuccessMessage('')
      return
    }

    setError('')
    setSuccessMessage('')
    setServicePlanSourcePlaylistId(
      sourcePlaylist.id
    )
    setServicePlanForm({
      serviceName: sourcePlaylist.name,
      serviceDate: getTodayDateValue(),
      serviceTime: '',
    })
    setShowSaveServiceModal(true)
  }

  async function saveServicePlan() {
    const trimmedServiceName =
      servicePlanForm.serviceName.trim()
    const serviceDate =
      servicePlanForm.serviceDate.trim()
    const serviceTime =
      servicePlanForm.serviceTime.trim()
    const sourcePlaylistSongs = (
      servicePlanSourcePlaylist?.songs || []
    ).filter((song) => song != null)

    if (!servicePlanSourcePlaylist) {
      setError(
        'Choose a regular playlist before saving a service plan'
      )
      setSuccessMessage('')
      return
    }

    if (!trimmedServiceName || !serviceDate) {
      setError(
        'Service name and date are required'
      )
      setSuccessMessage('')
      return
    }

    try {
      setError('')
      setSuccessMessage('')

      const response = await fetch(
        'http://localhost:8080/service-plans',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            serviceName: trimmedServiceName,
            serviceDate,
            serviceTime,
            serviceType:
              servicePlanSourcePlaylist?.serviceType ||
              null,
            theme:
              servicePlanSourcePlaylist?.theme ||
              null,
            sourcePlaylistId:
              servicePlanSourcePlaylist?.id ||
              null,
            songIds: sourcePlaylistSongs.map(
              (song) => song.id
            ),
          }),
        }
      )

      if (!response.ok) {
        const message =
          await readErrorMessage(response)

        throw new Error(
          message ||
            'Failed to save service plan'
        )
      }

      const createdServicePlan =
        await response.json()

      setServicePlans((current) =>
        sortServicePlans([
          ...current,
          createdServicePlan,
        ])
      )
      setOpenedServicePlanId(
        createdServicePlan.id
      )
      setSuccessMessage(
        `Saved service plan "${createdServicePlan.serviceName}" from playlist "${servicePlanSourcePlaylist.name}".`
      )
      setShowSaveServiceModal(false)
      setServicePlanSourcePlaylistId(null)
    } catch (err) {
      setError(err.message)
      setSuccessMessage('')
    }
  }

  async function updateOpenedServicePlan() {
    if (!openedServicePlan) {
      return
    }

    const trimmedServiceName =
      servicePlanForm.serviceName.trim()
    const serviceDate =
      servicePlanForm.serviceDate.trim()

    if (!trimmedServiceName || !serviceDate) {
      setError(
        'Service name and date are required'
      )
      return
    }

    try {
      setError('')

      const response = await fetch(
        `http://localhost:8080/service-plans/${openedServicePlan.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            serviceName: trimmedServiceName,
            serviceDate,
            serviceTime:
              servicePlanForm.serviceTime.trim(),
            serviceType:
              openedServicePlan.serviceType ||
              null,
            theme:
              openedServicePlan.theme || null,
          }),
        }
      )

      if (!response.ok) {
        const message =
          await readErrorMessage(response)

        throw new Error(
          message ||
            'Failed to update service plan'
        )
      }

      const updatedServicePlan =
        await response.json()

      setServicePlans((current) =>
        sortServicePlans(
          current.map((servicePlan) =>
            servicePlan.id ===
            updatedServicePlan.id
              ? updatedServicePlan
              : servicePlan
          )
        )
      )
      setOpenedServicePlanId(
        updatedServicePlan.id
      )
    } catch (err) {
      setError(err.message)
    }
  }

  async function duplicateOpenedServicePlan() {
    if (!openedServicePlan) {
      return
    }

    try {
      setError('')

      const response = await fetch(
        `http://localhost:8080/service-plans/${openedServicePlan.id}/duplicate`,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            serviceName: `${openedServicePlan.serviceName} Copy`,
            serviceDate:
              openedServicePlan.serviceDate,
            serviceTime:
              openedServicePlan.serviceTime ||
              '',
          }),
        }
      )

      if (!response.ok) {
        const message =
          await readErrorMessage(response)

        throw new Error(
          message ||
            'Failed to duplicate service plan'
        )
      }

      const duplicatedServicePlan =
        await response.json()

      setServicePlans((current) =>
        sortServicePlans([
          ...current,
          duplicatedServicePlan,
        ])
      )
      setOpenedServicePlanId(
        duplicatedServicePlan.id
      )
    } catch (err) {
      setError(err.message)
    }
  }

  async function deleteOpenedServicePlan() {
    if (!openedServicePlan) {
      return
    }

    const confirmed = window.confirm(
      `Delete service "${openedServicePlan.serviceName}" on ${formatServiceSchedule(openedServicePlan)}?`
    )

    if (!confirmed) {
      return
    }

    try {
      setError('')

      const response = await fetch(
        `http://localhost:8080/service-plans/${openedServicePlan.id}`,
        {
          method: 'DELETE',
        }
      )

      if (!response.ok) {
        const message =
          await readErrorMessage(response)

        throw new Error(
          message ||
            'Failed to delete service plan'
        )
      }

      const remainingServicePlans =
        servicePlans.filter(
          (servicePlan) =>
            servicePlan.id !==
            openedServicePlan.id
        )

      setServicePlans(remainingServicePlans)
      setOpenedServicePlanId(
        remainingServicePlans[0]?.id || null
      )

      if (
        loadedServicePlanId ===
        openedServicePlan.id
      ) {
        setLoadedServicePlanId(null)
      }
    } catch (err) {
      setError(err.message)
    }
  }

  async function deleteCompletedHistoryService(
    servicePlanToDelete
  ) {
    if (!servicePlanToDelete) {
      return
    }

    const confirmed = window.confirm(
      `Delete ${formatServiceOccurrenceName(servicePlanToDelete)}?\n\nThis completed service will be permanently removed from Service History.\n\nThis action cannot be undone.`
    )

    if (!confirmed) {
      return
    }

    try {
      setError('')
      setSuccessMessage('')

      const response = await fetch(
        `http://localhost:8080/service-plans/history/${servicePlanToDelete.id}`,
        {
          method: 'DELETE',
        }
      )

      if (!response.ok) {
        const message =
          await readErrorMessage(response)

        throw new Error(
          message ||
            'Failed to delete service history record'
        )
      }

      const remainingServicePlans =
        servicePlans.filter(
          (servicePlan) =>
            servicePlan.id !==
            servicePlanToDelete.id
        )
      const remainingHistory =
        sortCompletedServicePlans(
          remainingServicePlans.filter(
            (servicePlan) =>
              isCompletedServicePlan(
                servicePlan
              )
          )
        )

      setServicePlans(remainingServicePlans)
      setSelectedHistoryServicePlanId(
        remainingHistory[0]?.id || null
      )
      setReusedServiceSourceById(
        (current) =>
          Object.fromEntries(
            Object.entries(current).filter(
              ([key]) =>
                Number(key) !==
                servicePlanToDelete.id
            )
          )
      )
      setSuccessMessage(
        'Service history record deleted.'
      )
    } catch (err) {
      setError(err.message)
      setSuccessMessage('')
    }
  }

  function getCompletableServiceTarget() {
    if (
      loadedServicePlan &&
      !isCompletedServicePlan(
        loadedServicePlan
      )
    ) {
      return {
        type: 'service-plan',
        servicePlan: loadedServicePlan,
      }
    }

    if (
      selectedPlaylist?.reusable === false &&
      selectedPlaylist?.serviceDate
    ) {
      return {
        type: 'playlist',
        playlist: selectedPlaylist,
      }
    }

    return null
  }

  async function completeActiveService() {
    const target =
      getCompletableServiceTarget()

    if (!target) {
      setError(
        'Load a dated active service before completing it'
      )
      setSuccessMessage('')
      return
    }

    const serviceName =
      target.type === 'service-plan'
        ? formatServiceOccurrenceName(
            target.servicePlan
          )
        : formatPlaylistDisplayName(
            target.playlist
          )
    const confirmed = window.confirm(
      `Complete ${serviceName}?\n\nThe current final song order will be saved to Service History.`
    )

    if (!confirmed) {
      return
    }

    try {
      setError('')
      setSuccessMessage('')

      const response = await fetch(
        target.type === 'service-plan'
          ? `http://localhost:8080/service-plans/${target.servicePlan.id}/complete`
          : `http://localhost:8080/playlists/${target.playlist.id}/complete-service`,
        {
          method: 'POST',
        }
      )

      if (!response.ok) {
        const message =
          await readErrorMessage(response)

        throw new Error(
          message ||
            'Failed to complete service'
        )
      }

      const completedService =
        await response.json()
      const nextServicePlans =
        sortServicePlans(
          target.type === 'service-plan'
            ? servicePlans.map(
                (servicePlan) =>
                  servicePlan.id ===
                  completedService.id
                    ? completedService
                    : servicePlan
              )
            : [
                ...servicePlans,
                completedService,
              ]
        )
      const nextActivePlans =
        nextServicePlans.filter(
          (servicePlan) =>
            !isCompletedServicePlan(
              servicePlan
            )
        )

      setServicePlans(nextServicePlans)
      setSelectedHistoryServicePlanId(
        completedService.id
      )
      setLoadedServicePlanId(null)
      setOpenedServicePlanId((current) =>
        current != null &&
        nextActivePlans.some(
          (servicePlan) =>
            servicePlan.id === current
        )
          ? current
          : nextActivePlans[0]?.id || null
      )

      if (target.type === 'playlist') {
        const nextPlaylist =
          reusablePlaylists[0] ||
          playlists.find(
            (playlist) =>
              playlist.id !==
              target.playlist.id
          ) ||
          null

        setSelectedPlaylist(nextPlaylist)
      }

      setCurrentSong(null)
      setProjectionSong(null)
      setCurrentSongSourceId(null)
      setSectionIndex(0)
      setSuccessMessage(
        `Completed "${completedService.serviceName}" and saved it to Service History.`
      )
    } catch (err) {
      setError(err.message)
      setSuccessMessage('')
    }
  }

  function openReuseServiceModal(
    servicePlan
  ) {
    if (!servicePlan) {
      return
    }

    setSelectedHistoryServicePlanId(
      servicePlan.id
    )
    setReuseServicePlanForm(
      createReuseServicePlanForm(
        servicePlan
      )
    )
    setShowReuseServiceModal(true)
    setError('')
    setSuccessMessage('')
  }

  function closeReuseServiceModal() {
    setShowReuseServiceModal(false)
    setReuseServicePlanForm(
      createReuseServicePlanForm()
    )
  }

  async function reuseSelectedHistoryService() {
    if (!selectedHistoryServicePlan) {
      return
    }

    const trimmedServiceName =
      reuseServicePlanForm.serviceName.trim()
    const trimmedServiceDate =
      reuseServicePlanForm.serviceDate.trim()

    if (
      !trimmedServiceName ||
      !trimmedServiceDate
    ) {
      setError(
        'Service name and date are required'
      )
      setSuccessMessage('')
      return
    }

    try {
      setError('')
      setSuccessMessage('')

      const response = await fetch(
        `http://localhost:8080/service-plans/${selectedHistoryServicePlan.id}/reuse`,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            serviceName: trimmedServiceName,
            serviceType: trimmedServiceName,
            serviceDate: trimmedServiceDate,
            serviceTime:
              reuseServicePlanForm.serviceTime.trim(),
          }),
        }
      )

      if (!response.ok) {
        const message =
          await readErrorMessage(response)

        throw new Error(
          message ||
            'Failed to reuse service'
        )
      }

      const reusedServicePlan =
        await response.json()
      const nextServicePlans =
        sortServicePlans([
          ...servicePlans,
          reusedServicePlan,
        ])

      setServicePlans(nextServicePlans)
      setOpenedServicePlanId(
        reusedServicePlan.id
      )
      setLoadedServicePlanId(
        reusedServicePlan.id
      )
      setSelectedPlaylist(null)
      setReusedServiceSourceById(
        (current) => ({
          ...current,
          [reusedServicePlan.id]:
            selectedHistoryServicePlan.id,
        })
      )
      setShowReuseServiceModal(false)
      setActiveView('operator')
      setSuccessMessage(
        `Created a new working service from "${selectedHistoryServicePlan.serviceName}" for ${formatFullDateLabel(reusedServicePlan.serviceDate)}.`
      )
    } catch (err) {
      setError(err.message)
      setSuccessMessage('')
    }
  }

  function openServicePlanInConsole(
    servicePlan
  ) {
    if (!servicePlan) {
      return
    }

    setLoadedServicePlanId(servicePlan.id)
    setOpenedServicePlanId(servicePlan.id)
    setActiveView('operator')
  }

  function openNewSavedPlaylistModal() {
    setError('')
    setSuccessMessage('')
    setSavedPlaylistCreationMode('NEW')
    setSavedPlaylistSourceId('')
    setSavedPlaylistForm(
      createSavedPlaylistForm()
    )
    setShowSavedPlaylistModal(true)
  }

  function openCopySavedPlaylistModal(
    sourcePlaylist =
      managedPlaylist ||
      openedPlaylist ||
      selectedPlaylist
  ) {
    setError('')
    setSuccessMessage('')
    setSavedPlaylistCreationMode('COPY')
    setSavedPlaylistSourceId(
      sourcePlaylist?.id ? String(sourcePlaylist.id) : ''
    )
    setSavedPlaylistForm(
      createSavedPlaylistForm({
        theme: sourcePlaylist?.theme || '',
      })
    )
    setShowSavedPlaylistModal(true)
  }

  function closeSavedPlaylistModal() {
    setShowSavedPlaylistModal(false)
    setSavedPlaylistSourceId('')
  }

  function handleSavedPlaylistFormChange(event) {
    const { name, value } = event.target

    setSavedPlaylistForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  function handleSavedPlaylistSourceChange(event) {
    const nextSourceId = event.target.value
    const nextSourcePlaylist =
      playlists.find(
        (playlist) =>
          String(playlist.id) === nextSourceId
      ) || null

    setSavedPlaylistSourceId(nextSourceId)
    setSavedPlaylistForm((current) => ({
      ...current,
      theme: nextSourcePlaylist?.theme || '',
    }))
  }

  function handleSavedPlaylistMetadataChange(event) {
    const { name, value } = event.target

    setSavedPlaylistMetadataForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  async function createSavedPlaylist() {
    const serviceType =
      savedPlaylistForm.serviceType.trim()
    const customServiceType =
      savedPlaylistForm.customServiceType.trim()
    const effectiveServiceType =
      resolvePlaylistServiceType(
        serviceType,
        customServiceType
      )
    const serviceDate =
      savedPlaylistForm.serviceDate.trim()
    const theme = savedPlaylistForm.theme.trim()
    const copyingPlaylist =
      savedPlaylistCreationMode === 'COPY'

    if (!serviceType || !serviceDate) {
      setError(
        'Service type and date are required'
      )
      return
    }

    if (
      serviceType === 'Other' &&
      !customServiceType
    ) {
      setError(
        'Custom service name is required'
      )
      return
    }

    if (copyingPlaylist && !savedPlaylistSource) {
      setError('Choose a source playlist to copy')
      return
    }

    try {
      setError('')
      setSuccessMessage('')

      const endpoint = copyingPlaylist
        ? `http://localhost:8080/playlists/${savedPlaylistSource.id}/copy`
        : 'http://localhost:8080/playlists/saved-service'
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serviceType,
          customServiceType,
          serviceDate,
          theme,
        }),
      })

      if (!response.ok) {
        const message = await readErrorMessage(response)

        throw new Error(
          message || 'Failed to create saved playlist'
        )
      }

      const createdPlaylist = await response.json()
      const refreshedResponse = await fetch(
        'http://localhost:8080/playlists'
      )

      if (!refreshedResponse.ok) {
        throw new Error(
          'Failed to refresh playlists after creating playlist'
        )
      }

      const refreshedPlaylists =
        await refreshedResponse.json()

      setPlaylists(refreshedPlaylists)
      setManagedPlaylistId(createdPlaylist.id)
      setPrioritizedManagedPlaylistId(
        createdPlaylist.id
      )
      closeSavedPlaylistModal()
      setSuccessMessage(
        copyingPlaylist
          ? `Created saved playlist "${createdPlaylist.name}" from "${savedPlaylistSource.name}".`
          : `Created playlist "${buildStructuredPlaylistName(effectiveServiceType, serviceDate, createdPlaylist.name)}".`
      )
    } catch (err) {
      setError(err.message)
      setSuccessMessage('')
    }
  }

  async function persistManagedPlaylistMetadata() {
    if (!managedPlaylist) {
      return null
    }

    const serviceType =
      savedPlaylistMetadataForm.serviceType.trim()
    const customServiceType =
      savedPlaylistMetadataForm.customServiceType.trim()
    const serviceDate =
      savedPlaylistMetadataForm.serviceDate.trim()
    const theme = savedPlaylistMetadataForm.theme.trim()

    if (
      managedPlaylistIsSaved &&
      !serviceType &&
      !savedPlaylistMetadataForm.legacyName.trim()
    ) {
      setError('Service type is required')
      return null
    }

    if (managedPlaylistIsSaved && !serviceDate) {
      setError('Service date is required')
      return null
    }

    if (
      serviceType === 'Other' &&
      !customServiceType
    ) {
      setError(
        'Custom service name is required'
      )
      return null
    }

    try {
      setError('')

      const response = await fetch(
        `http://localhost:8080/playlists/${managedPlaylist.id}/metadata`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            serviceType,
            customServiceType,
            name:
              managedPlaylistIsSaved &&
              !resolvePlaylistServiceType(
                serviceType,
                customServiceType
              )
                ? savedPlaylistMetadataForm.legacyName.trim()
                : undefined,
            serviceDate,
            theme,
          }),
        }
      )

      if (!response.ok) {
        const message = await readErrorMessage(response)

        throw new Error(
          message || 'Failed to update playlist'
        )
      }

      const updatedPlaylist = await response.json()

      setPlaylists((current) =>
        current.map((playlist) =>
          playlist.id === updatedPlaylist.id
            ? updatedPlaylist
            : playlist
        )
      )

      if (selectedPlaylist?.id === updatedPlaylist.id) {
        setSelectedPlaylist(updatedPlaylist)
      }

      setManagedPlaylistId(updatedPlaylist.id)
      return updatedPlaylist
    } catch (err) {
      setError(err.message)
      setSuccessMessage('')
      return null
    }
  }

  async function saveManagedPlaylistMetadata() {
    const updatedPlaylist =
      await persistManagedPlaylistMetadata()

    if (!updatedPlaylist) {
      return
    }

    setSuccessMessage(
      `Updated playlist "${updatedPlaylist.name}".`
    )
  }

  async function makePlaylistActiveAndReturnToConsole(
    playlist = managedPlaylist
  ) {
    if (!playlist) {
      return
    }

    let playlistToActivate = playlist

    if (
      managedPlaylistIsSaved &&
      playlist.id === managedPlaylist?.id
    ) {
      const updatedPlaylist =
        await persistManagedPlaylistMetadata()

      if (!updatedPlaylist) {
        return
      }

      playlistToActivate = updatedPlaylist
    }

    setManagedPlaylistId(
      playlistToActivate.id
    )
    setSelectedPlaylist(playlistToActivate)
    setLoadedServicePlanId(null)
    setSelectedSong(null)
    setCurrentSong(null)
    setCurrentSongSourceId(null)
    setProjectionSong(null)
    setSectionIndex(0)
    setActiveView('operator')
    setSuccessMessage(
      `Made playlist "${playlistToActivate.name}" active in the Worship Console.`
    )
  }

  async function deleteManagedPlaylist() {
    if (!managedPlaylist) {
      return
    }

    const confirmed = window.confirm(
      `Delete playlist "${managedPlaylist.name}"?`
    )

    if (!confirmed) {
      return
    }

    try {
      setError('')

      const response = await fetch(
        `http://localhost:8080/playlists/${managedPlaylist.id}`,
        {
          method: 'DELETE',
        }
      )

      if (!response.ok) {
        const message =
          await readErrorMessage(response)

        throw new Error(
          message ||
            'Failed to delete playlist'
        )
      }

      const remainingPlaylists = playlists.filter(
        (playlist) =>
          playlist.id !== managedPlaylist.id
      )
      const remainingReusablePlaylists =
        remainingPlaylists.filter(
          (playlist) =>
            playlist.reusable !== false
        )
      const remainingSavedPlaylists =
        remainingPlaylists.filter(
          (playlist) =>
            playlist.reusable === false
        )
      const defaultManagedPlaylist =
        remainingReusablePlaylists[0] ||
        remainingSavedPlaylists[0] ||
        null

      setPlaylists(remainingPlaylists)

      if (selectedPlaylist?.id === managedPlaylist.id) {
        setSelectedPlaylist(null)
      }

      setManagedPlaylistId(null)
      if (openedPlaylistId === managedPlaylist.id) {
        setOpenedPlaylistId(null)
      }
      if (prioritizedManagedPlaylistId === managedPlaylist.id) {
        setPrioritizedManagedPlaylistId(null)
      }
    } catch (err) {
      setError(err.message)
    }
  }

  function openUseForTodayModal(
    sourcePlaylist = managedPlaylist
  ) {
    if (
      !sourcePlaylist ||
      sourcePlaylist.reusable === false
    ) {
      return
    }

    setError('')
    setSuccessMessage('')
    setUseForTodaySourcePlaylistId(
      sourcePlaylist.id
    )
    setUseForTodayForm({
      name: buildTodayServiceName(
        getTodayDateValue()
      ),
      serviceDate: getTodayDateValue(),
    })
    setShowUseForTodayModal(true)
  }

  function handleUseForTodayFormChange(
    event
  ) {
    const { value } = event.target

    setUseForTodayForm((current) => ({
      ...current,
      name: value,
    }))
  }

  function continueExistingTodayService() {
    if (!todayWorkingPlaylist) {
      return
    }

    setSelectedPlaylist(todayWorkingPlaylist)
    setLoadedServicePlanId(null)
    setShowUseForTodayModal(false)
    setUseForTodaySourcePlaylistId(null)
    setSuccessMessage(
      `Continued existing working playlist "${todayWorkingPlaylist.name}" for ${formatFullDateLabel(todayWorkingPlaylist.serviceDate)}.`
    )
  }

  async function createTodayServicePlaylist(
    replaceExisting = false
  ) {
    if (!useForTodaySourcePlaylist) {
      return
    }

    try {
      setError('')
      setSuccessMessage('')

      const response = await fetch(
        `http://localhost:8080/playlists/${useForTodaySourcePlaylist.id}/use-for-today-service`,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            name: useForTodayForm.name.trim(),
            serviceDate:
              useForTodayForm.serviceDate,
            replaceExisting,
          }),
        }
      )

      if (!response.ok) {
        const message =
          await readErrorMessage(response)

        throw new Error(
          message ||
            'Failed to create today’s working service playlist'
        )
      }

      const workingPlaylist =
        await response.json()

      const refreshedResponse = await fetch(
        'http://localhost:8080/playlists'
      )

      if (!refreshedResponse.ok) {
        throw new Error(
          'Failed to refresh playlists after creating today’s service playlist'
        )
      }

      const refreshedPlaylists =
        await refreshedResponse.json()
      const refreshedReusablePlaylists =
        refreshedPlaylists.filter(
          (playlist) =>
            playlist.reusable !== false
        )

      setPlaylists(refreshedPlaylists)
      setSelectedPlaylist(workingPlaylist)
      setOpenedPlaylistId(
        refreshedReusablePlaylists.find(
          (playlist) =>
            playlist.id ===
            useForTodaySourcePlaylist.id
        )?.id ||
          refreshedReusablePlaylists[0]?.id ||
          null
      )
      setLoadedServicePlanId(null)
      setShowUseForTodayModal(false)
      setUseForTodaySourcePlaylistId(null)
      setSuccessMessage(
        `Created working playlist "${workingPlaylist.name}" for ${formatFullDateLabel(workingPlaylist.serviceDate)} from "${useForTodaySourcePlaylist.name}".`
      )
    } catch (err) {
      setError(err.message)
      setSuccessMessage('')
    }
  }

  async function removeSongFromPlaylist(
    song,
    playlist = selectedPlaylist
  ) {
    if (!song || !playlist) {
      return
    }

    try {
      setError('')

      const response = await fetch(
        `http://localhost:8080/playlists/id/${playlist.id}/songs/${song.id}`,
        {
          method: 'DELETE',
        }
      )

      if (!response.ok) {
        throw new Error(
          'Failed to remove song from playlist'
        )
      }

      const updatedPlaylist =
        await response.json()

      if (selectedPlaylist?.id === updatedPlaylist.id) {
        setSelectedPlaylist(
          updatedPlaylist
        )
      }

      if (
        currentSong?.id === song.id ||
        currentSongSelectionId === song.id
      ) {
        setSelectedSong((current) =>
          current?.id === song.id
            ? null
            : current
        )
        setCurrentSong(null)
        setCurrentSongSourceId(null)
        setProjectionSong(null)
        setSectionIndex(0)
      }

      setPlaylists((current) =>
        current.map((playlist) =>
          playlist.id ===
          updatedPlaylist.id
            ? updatedPlaylist
            : playlist
        )
      )
    } catch (err) {
      setError(err.message)
    }
  }

  async function removeSongFromServicePlan(
    song,
    servicePlan = loadedServicePlan
  ) {
    if (!song || !servicePlan) {
      return
    }

    try {
      setError('')

      const response = await fetch(
        `http://localhost:8080/service-plans/${servicePlan.id}/songs/${song.id}`,
        {
          method: 'DELETE',
        }
      )

      if (!response.ok) {
        const message =
          await readErrorMessage(response)

        throw new Error(
          message ||
            'Failed to remove song from service plan'
        )
      }

      const updatedServicePlan =
        await response.json()

      setServicePlans((current) =>
        sortServicePlans(
          current.map((servicePlanItem) =>
            servicePlanItem.id ===
            updatedServicePlan.id
              ? updatedServicePlan
              : servicePlanItem
          )
        )
      )
    } catch (err) {
      setError(err.message)
    }
  }

  async function moveSongInPlaylist(
    fromIndex,
    toIndex,
    playlist = selectedPlaylist
  ) {
    if (!playlist) {
      return
    }

    const playlistSongs =
      (
        playlist.songs || []
      ).filter((song) => song != null)

    if (
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= playlistSongs.length ||
      toIndex >= playlistSongs.length ||
      fromIndex === toIndex
    ) {
      return
    }

    try {
      setError('')

      const response = await fetch(
        `http://localhost:8080/playlists/id/${playlist.id}/songs/reorder?fromIndex=${fromIndex}&toIndex=${toIndex}`,
        {
          method: 'PUT',
        }
      )

      if (!response.ok) {
        throw new Error(
          'Failed to reorder playlist'
        )
      }

      const updatedPlaylist =
        await response.json()

      if (selectedPlaylist?.id === updatedPlaylist.id) {
        setSelectedPlaylist(
          updatedPlaylist
        )
      }

      setPlaylists((current) =>
        current.map((playlist) =>
          playlist.id ===
          updatedPlaylist.id
            ? updatedPlaylist
            : playlist
        )
      )
    } catch (err) {
      setError(err.message)
    }
  }

  async function moveSongInServicePlan(
    fromIndex,
    toIndex,
    servicePlan = loadedServicePlan
  ) {
    if (!servicePlan) {
      return
    }

    const servicePlanSongs =
      (
        servicePlan.songs || []
      ).filter((song) => song != null)

    if (
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= servicePlanSongs.length ||
      toIndex >= servicePlanSongs.length ||
      fromIndex === toIndex
    ) {
      return
    }

    try {
      setError('')

      const response = await fetch(
        `http://localhost:8080/service-plans/${servicePlan.id}/songs/reorder?fromIndex=${fromIndex}&toIndex=${toIndex}`,
        {
          method: 'PUT',
        }
      )

      if (!response.ok) {
        const message =
          await readErrorMessage(response)

        throw new Error(
          message ||
            'Failed to reorder service plan'
        )
      }

      const updatedServicePlan =
        await response.json()

      setServicePlans((current) =>
        sortServicePlans(
          current.map((servicePlanItem) =>
            servicePlanItem.id ===
            updatedServicePlan.id
              ? updatedServicePlan
              : servicePlanItem
          )
        )
      )
    } catch (err) {
      setError(err.message)
    }
  }

  function projectSong(
    song = currentSong
  ) {
    if (!song) {
      return
    }

    setCurrentSongLanguageNotice('')
    setCurrentSong(song)
    setProjectionSong(song)
    setSectionIndex(0)
    setProjectionMode('LIVE')
  }

  function selectPlaylistSong(song) {
    if (!song) {
      return
    }

    const resolvedSong =
      songs.find(
        (candidate) =>
          candidate.id === song.id
      ) || song

    setCurrentSongLanguageNotice('')
    setSelectedSong(resolvedSong)
    setCurrentSong(resolvedSong)
    setCurrentSongSourceId(resolvedSong.id)
    setProjectionSong(resolvedSong)
    setSectionIndex(0)
    setProjectionMode('LIVE')
  }

  function switchCurrentSongLanguage(
    language
  ) {
    if (!currentSongResolved) {
      return
    }

    const nextSong =
      currentSongLanguageVersions[language]

    if (!nextSong) {
      setCurrentSongLanguageNotice(
        `No ${getLanguageLabel(language)} version available yet.`
      )
      return
    }

    const resolvedSong =
      songs.find(
        (candidate) =>
          candidate.id === nextSong.id
      ) || nextSong

    const nextSectionIndex =
      findMatchingSectionIndex(
        currentSongResolved,
        resolvedSong,
        sectionIndex
      )

    setCurrentSongLanguageNotice('')
    setSelectedSong(resolvedSong)
    setCurrentSong(resolvedSong)
    setCurrentSongSourceId(
      resolvedSong.id
    )
    setProjectionSong(resolvedSong)
    setSectionIndex(nextSectionIndex)
  }

  function showLyrics() {
    setProjectionMode('LIVE')
  }

  function toggleClearLyrics() {
    if (projectionMode === 'BLACK') {
      previousVisibleModeRef.current =
        previousVisibleModeRef.current ===
        'CLEAR'
          ? 'LIVE'
          : 'CLEAR'
      return
    }

    setProjectionMode((currentMode) =>
      currentMode === 'CLEAR'
        ? 'LIVE'
        : 'CLEAR'
    )
  }

  function toggleBlackScreen() {
    if (projectionMode === 'BLACK') {
      if (currentSong) {
        setSelectedSong(currentSong)
      }

      setProjectionMode(
        previousVisibleModeRef.current
      )
      return
    }

    previousVisibleModeRef.current =
      projectionMode
    setProjectionMode('BLACK')
  }

  function previousSection() {
    if (sectionIndex > 0) {
      setSectionIndex(
        (current) => current - 1
      )

      setProjectionMode((currentMode) =>
        getNavigationProjectionMode(
          currentMode
        )
      )
      return
    }
  }

  function nextSection() {
    if (
      sectionIndex <
      previewSections.length - 1
    ) {
      setSectionIndex(
        (current) => current + 1
      )

      setProjectionMode((currentMode) =>
        getNavigationProjectionMode(
          currentMode
        )
      )
      return
    }
  }

  function openProjectorWindow() {
    if (typeof window === 'undefined') {
      return
    }

    const nextProjectorState =
      createProjectorState({
        song: previewSong,
        sectionIndex,
        projectionMode,
        backgroundType,
        backgroundVariant,
        customBackgroundId,
        customBackgroundName,
        projectionSettings,
      })

    latestProjectorStateRef.current =
      nextProjectorState

    persistProjectorState(nextProjectorState)
    projectorChannelRef.current?.postMessage(
      createProjectorSyncMessage(
        nextProjectorState
      )
    )

    const projectorUrl = new URL(
      window.location.href
    )

    projectorUrl.searchParams.set(
      'projector',
      '1'
    )

    projectorWindowRef.current =
      window.open(
        projectorUrl.toString(),
        'church-song-projector-window',
        'popup=yes,width=1280,height=720'
      )

    projectorWindowRef.current?.focus()
  }

  function selectPresetBackground(
    variantId
  ) {
    setBackgroundType('preset')
    setBackgroundVariant(variantId)
  }

  async function handleBackgroundUpload(
    event
  ) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    try {
      setError('')

      const uploadId =
        typeof crypto !== 'undefined' &&
        crypto.randomUUID
          ? crypto.randomUUID()
          : `background-${Date.now()}`

      const savedBackground =
        await saveBackgroundImage({
          id: uploadId,
          file,
        })

      setCustomBackgroundId(
        savedBackground.id
      )
      setCustomBackgroundName(
        savedBackground.fileName
      )
      setBackgroundType('custom')
    } catch (err) {
      setError(
        'Failed to store background image'
      )
    } finally {
      event.target.value = ''
    }
  }

  useLayoutEffect(() => {
    if (
      isProjectorWindow ||
      typeof window === 'undefined'
    ) {
      return undefined
    }

    const handleKeyDown = (event) => {
      if (shouldIgnoreProjectionShortcut(event)) {
        return
      }

      const command =
        getProjectionShortcutCommand(event)

      if (!command) {
        return
      }

      event.preventDefault()
      runProjectionCommand(command)
    }

    document.addEventListener(
      'keydown',
      handleKeyDown,
      true
    )

    return () => {
      document.removeEventListener(
        'keydown',
        handleKeyDown,
        true
      )
    }
  }, [isProjectorWindow])

  if (isProjectorWindow) {
    return (
      <ProjectorDisplay
        song={
          projectorWindowState.projectionSong
        }
        sectionIndex={
          projectorWindowState.sectionIndex
        }
        projectionMode={
          projectorWindowState.projectionMode
        }
        backgroundType={
          projectorWindowState.backgroundType
        }
        backgroundVariant={
          projectorWindowState.backgroundVariant
        }
        customBackgroundUrl={
          customBackgroundUrl
        }
        projectionSettings={
          projectorWindowState.projectionSettings
        }
        showFullscreenControl
      />
    )
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">
            HMGA
          </div>

          <div className="brand-copy">
            <h1>
              Humility & Mercy
            </h1>

            <p>
              Gospel Assembly
            </p>
          </div>
        </div>

        <nav className="side-nav">
          <button
            className={
              activeView === 'operator'
                ? 'side-link active'
                : 'side-link'
            }
            onClick={() =>
              setActiveView('operator')
            }
          >
            <span className="nav-icon">
              ⌂
            </span>

            Worship Console
          </button>

          <button
            className={
              activeView === 'songs'
                ? 'side-link active'
                : 'side-link'
            }
            onClick={openSongsAdministration}
          >
            <span className="nav-icon">
              ♫
            </span>

            Songs
          </button>

          <button
            className={
              activeView === 'playlists'
                ? 'side-link active'
                : 'side-link'
            }
            onClick={() =>
              setActiveView('playlists')
            }
          >
            <span className="nav-icon">
              ☷
            </span>

            Playlists
          </button>

          <button
            className={
              activeView ===
              'serviceHistory'
                ? 'side-link active'
                : 'side-link'
            }
            onClick={() =>
              setActiveView(
                'serviceHistory'
              )
            }
          >
            <span className="nav-icon">
              ☰
            </span>

            Service History
          </button>

          <button
            className={
              activeView ===
              'backupExport'
                ? 'side-link active'
                : 'side-link'
            }
            onClick={() =>
              setActiveView(
                'backupExport'
              )
            }
          >
            <span className="nav-icon">
              ⤓
            </span>

            Backup & Export
          </button>

          <button
            className={
              activeView === 'settings'
                ? 'side-link active'
                : 'side-link'
            }
            onClick={() =>
              setActiveView('settings')
            }
          >
            <span className="nav-icon">
              ⚙
            </span>

            Settings
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="connected-line">
            <span className="green-dot" />

            Projector connected
          </div>

          <p>
            Ready for worship
          </p>
        </div>
      </aside>

      <main className="main-area">
        {successMessage && (
          <div className="success-message">
            {successMessage}
          </div>
        )}

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {activeView === 'operator' && (
          <div className="operator-view">
            <header className="service-header">
              <div>
                <p className="page-kicker">
                  {consoleServiceHeaderLabel}
                </p>

                <h2>
                  Worship Projection
                </h2>

                <p className="header-description">
                  Prepare songs, organize the
                  service, and control the
                  projector.
                </p>
              </div>

              <div className="header-right">
                <div className="connected-badge">
                  <span className="green-dot" />

                  Projector Connected
                </div>

                <button
                  className="button button-primary"
                  onClick={() => {
                    setError('')
                    setNewSong(
                      createBlankSongForm()
                    )
                    setShowNewSongModal(
                      true
                    )
                  }}
                >
                  + New Song
                </button>
              </div>
            </header>

            <div className="console-grid">
              <section className="console-card library-card">
                <div className="card-header">
                  <div>
                    <p className="card-kicker">
                      Song Library
                    </p>

                    <h3>
                      Choose a Song
                    </h3>
                  </div>

                  <span className="number-pill">
                    {songs.length}
                  </span>
                </div>

                <div className="search-wrapper">
                  <span>
                    ⌕
                  </span>

                  <input
                    type="text"
                    placeholder="Search title or author..."
                    value={search}
                    onChange={(event) =>
                      setSearch(
                        event.target.value
                      )
                    }
                  />
                </div>

                <div className="filter-tabs">
                  {[
                    'ALL',
                    'SLOW',
                    'FAST',
                  ].map((type) => (
                    <button
                      key={type}
                      className={
                        typeFilter === type
                          ? 'filter-tab active'
                          : 'filter-tab'
                      }
                      onClick={() =>
                        setTypeFilter(type)
                      }
                    >
                      {type === 'ALL'
                        ? 'All'
                        : type === 'SLOW'
                          ? 'Slow'
                          : 'Fast'}
                    </button>
                  ))}
                </div>

                <div className="song-list">
                  {filteredSongs.map(
                    (song) => (
                      <button
                        key={song.id}
                        ref={(node) => {
                          if (node) {
                            manageSongItemRefs.current.set(
                              song.id,
                              node
                            )
                            return
                          }

                          manageSongItemRefs.current.delete(
                            song.id
                          )
                        }}
                        className={
                          selectedSong?.id ===
                          song.id
                            ? 'song-item selected'
                            : 'song-item'
                        }
                        onClick={() => {
                          setSelectedSong(
                            song
                          )
                        }}
                      >
                        <div className="song-copy">
                          <strong>
                            {song.title}
                          </strong>

                          <span>
                            {song.author ||
                              'Unknown author'}
                          </span>
                        </div>

                        {getSongTypeBadge(
                          song.songType
                        ) && (
                          <span
                            className={
                              getSongTypeBadge(
                                song.songType
                              ).className
                            }
                          >
                            {
                              getSongTypeBadge(
                                song.songType
                              ).label
                            }
                          </span>
                        )}
                      </button>
                    )
                  )}
                </div>
              </section>

              <section className="console-card service-card">
                <div className="card-header">
                  <div>
                    <p className="card-kicker">
                      {consoleCollectionTypeLabel}
                    </p>

                    <h3>
                      {consoleCollectionLabel ||
                        'No Playlist'}
                    </h3>

                    {loadedServicePlan && (
                      <p className="author">
                        {formatServiceSchedule(
                          loadedServicePlan
                        )}
                      </p>
                    )}
                  </div>

                  <div className="card-header-actions">
                    <button
                      className="text-button"
                      onClick={() =>
                        setActiveView(
                          'playlists'
                        )
                      }
                    >
                      Manage
                    </button>
                  </div>
                </div>

                {!loadedServicePlan &&
                  playlists.length > 0 && (
                  <div className="service-card-playlist-picker">
                    <select
                      className="playlist-select"
                      value={
                        selectedPlaylist?.id ||
                        ''
                      }
                      onChange={(event) => {
                        const playlist =
                          playlists.find(
                            (item) =>
                              item.id ===
                              Number(
                                event.target
                                  .value
                              )
                          )

                        setSelectedPlaylist(
                          playlist
                        )
                      }}
                    >
                      {playlists.map(
                        (playlist) => (
                          <option
                            key={playlist.id}
                            value={
                              playlist.id
                            }
                          >
                            {formatPlaylistDisplayName(
                              playlist
                            )}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                )}

                {loadedServicePlanReuseSource && (
                  <div className="inline-note">
                    Reused from:{' '}
                    <strong>
                      {formatServiceOccurrenceName(
                        loadedServicePlanReuseSource
                      )}
                    </strong>
                  </div>
                )}

                <div className="playlist-library-actions service-plan-console-actions">
                  <button
                    className="button button-secondary inline-button"
                    onClick={
                      completeActiveService
                    }
                    disabled={
                      completableServiceTarget ==
                      null
                    }
                  >
                    Complete Service
                  </button>
                </div>

                <div className="service-song-list">
                  {playlistSongs.map(
                    (song, index) => (
                      <div
                        key={song.id}
                        className={[
                          'service-song',
                          currentSongSelectionId ===
                          song.id
                            ? 'selected'
                            : '',
                          dragOverSongIndex ===
                          index
                            ? 'drag-over'
                            : '',
                          draggedSongIndex ===
                          index
                            ? 'dragging'
                            : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        role="button"
                        tabIndex="0"
                        onClick={() => {
                          selectPlaylistSong(song)
                        }}
                        onKeyDown={(event) => {
                          if (
                            event.key ===
                              'Enter' ||
                            event.key === ' '
                          ) {
                            event.preventDefault()
                            selectPlaylistSong(song)
                          }
                        }}
                        onDragOver={(event) => {
                          event.preventDefault()

                          event.dataTransfer.dropEffect =
                            'move'

                          if (
                            draggedSongIndex !==
                              null &&
                            draggedSongIndex !==
                              index
                          ) {
                            setDragOverSongIndex(
                              index
                            )
                          }
                        }}
                        onDrop={(event) => {
                          event.preventDefault()

                          const sourceIndex =
                            draggedSongIndex !==
                            null
                              ? draggedSongIndex
                              : Number(
                                  event.dataTransfer.getData(
                                    'text/plain'
                                  )
                                )

                          if (
                            Number.isInteger(
                              sourceIndex
                            ) &&
                            sourceIndex !==
                              index
                          ) {
                            if (
                              loadedServicePlan
                            ) {
                              moveSongInServicePlan(
                                sourceIndex,
                                index
                              )
                            } else {
                              moveSongInPlaylist(
                                sourceIndex,
                                index
                              )
                            }
                          }

                          setDraggedSongIndex(
                            null
                          )

                          setDragOverSongIndex(
                            null
                          )
                        }}
                      >
                        <span className="song-order">
                          {index + 1}
                        </span>

                        <div className="service-song-copy">
                          <strong>
                            {song.title}
                          </strong>

                          <span>
                            {song.author ||
                              'Unknown author'}
                          </span>
                        </div>

                        <div className="playlist-row-actions">
                          <span
                            className="reorder-icon drag-handle"
                            draggable="true"
                            title="Drag to reorder"
                            onClick={(event) => {
                              event.stopPropagation()
                            }}
                            onDragStart={(
                              event
                            ) => {
                              event.stopPropagation()

                              setDraggedSongIndex(
                                index
                              )

                              setDragOverSongIndex(
                                null
                              )

                              event.dataTransfer.effectAllowed =
                                'move'

                              event.dataTransfer.setData(
                                'text/plain',
                                String(index)
                              )
                            }}
                            onDragEnd={() => {
                              setDraggedSongIndex(
                                null
                              )

                              setDragOverSongIndex(
                                null
                              )
                            }}
                          >
                            ⋮⋮
                          </span>

                          <button
                            className="move-song-button"
                            disabled={
                              index === 0
                            }
                            onClick={(event) => {
                              event.stopPropagation()

                              if (
                                loadedServicePlan
                              ) {
                                moveSongInServicePlan(
                                  index,
                                  index - 1
                                )
                              } else {
                                moveSongInPlaylist(
                                  index,
                                  index - 1
                                )
                              }
                            }}
                            title="Move song up"
                          >
                            ↑
                          </button>

                          <button
                            className="move-song-button"
                            disabled={
                              index ===
                              playlistSongs.length -
                                1
                            }
                            onClick={(event) => {
                              event.stopPropagation()

                              if (
                                loadedServicePlan
                              ) {
                                moveSongInServicePlan(
                                  index,
                                  index + 1
                                )
                              } else {
                                moveSongInPlaylist(
                                  index,
                                  index + 1
                                )
                              }
                            }}
                            title="Move song down"
                          >
                            ↓
                          </button>

                          <button
                            className="remove-song-button"
                            onClick={(event) => {
                              event.stopPropagation()

                              if (
                                loadedServicePlan
                              ) {
                                removeSongFromServicePlan(
                                  song
                                )
                              } else {
                                removeSongFromPlaylist(
                                  song
                                )
                              }
                            }}
                            title={
                              loadedServicePlan
                                ? 'Remove from service plan'
                                : 'Remove from playlist'
                            }
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    )
                  )}
                </div>

                <button
                  className="add-song-button"
                  onClick={
                    addSelectedSongToConsoleCollection
                  }
                >
                  {loadedServicePlan
                    ? '+ Add Selected Song to Service'
                    : '+ Add Selected Song'}
                </button>
              </section>

              <section className="right-console">
                <div className="console-card current-song-card">
                  <div className="current-heading">
                    <div>
                      <p className="card-kicker">
                        Current Song
                      </p>

                      <h3>
                        {currentSong?.title ||
                          'Select a song'}
                      </h3>

                      {currentSong && (
                        <p className="author">
                          {currentSong.author ||
                            'Unknown author'}
                        </p>
                      )}
                    </div>

                    {getSongTypeBadge(
                      currentSong?.songType
                    ) && (
                      <span
                        className={
                          getSongTypeBadge(
                            currentSong.songType
                          ).className
                        }
                      >
                        {
                          getSongTypeBadge(
                            currentSong.songType
                          ).label
                        }
                      </span>
                    )}
                  </div>

                  {currentSong && (
                    <>
                      <div className="current-song-controls">
                        {showCurrentSongLanguageSelector && (
                          <div className="song-language-control-area">
                            <p className="small-title">
                              Language
                            </p>

                            <div className="song-language-pills">
                              {SUPPORTED_SONG_LANGUAGES.map(
                                (language) => {
                                  const familySong =
                                    currentSongLanguageVersions[
                                      language
                                    ]
                                  const activeLanguage =
                                    normalizeLanguage(
                                      currentSongResolved?.language
                                    )
                                  const isActive =
                                    activeLanguage ===
                                    language
                                  const isAvailable =
                                    Boolean(familySong)

                                  return (
                                    <button
                                      key={language}
                                      type="button"
                                      className={[
                                        'song-language-pill',
                                        isActive
                                          ? 'active'
                                          : '',
                                        !isAvailable
                                          ? 'unavailable'
                                          : '',
                                      ]
                                        .filter(Boolean)
                                        .join(' ')}
                                      disabled={
                                        !isAvailable
                                      }
                                      title={
                                        isAvailable
                                          ? getLanguageLabel(
                                              language
                                            )
                                          : getLanguageUnavailableTitle(
                                              language
                                            )
                                      }
                                      aria-pressed={
                                        isActive
                                      }
                                      onClick={() => {
                                        if (
                                          !isAvailable
                                        ) {
                                          return
                                        }

                                        switchCurrentSongLanguage(
                                          language
                                        )
                                      }}
                                    >
                                      {getLanguageLabel(
                                        language
                                      )}
                                    </button>
                                  )
                                }
                              )}
                            </div>

                            {currentSongLanguageNotice && (
                              <p className="language-availability-note">
                                {
                                  currentSongLanguageNotice
                                }
                              </p>
                            )}
                          </div>
                        )}

                        <div className="section-control-area">
                          <p className="small-title">
                            Sections
                          </p>

                            <div className="section-pills">
                            {parseLyricsSections(
                              currentSong
                            ).map(
                              (
                                section,
                                index
                              ) => (
                                <button
                                  key={`${section.name}-${index}`}
                                  className={
                                    sectionIndex ===
                                    index
                                      ? 'section-pill active'
                                      : 'section-pill'
                                  }
                                  onClick={() => {
                                    setProjectionSong(
                                      currentSong
                                    )

                                    setSectionIndex(
                                      index
                                    )

                                    setProjectionMode(
                                      (
                                        currentMode
                                      ) =>
                                        getNavigationProjectionMode(
                                          currentMode
                                        )
                                    )
                                  }}
                                >
                                  {
                                    section.name
                                  }
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      </div>

                    </>
                  )}
                </div>

                <div className="preview-title-row">
                  <div>
                    <p className="card-kicker">
                      Projector Preview
                    </p>

                    <strong>
                      {currentSection?.name ||
                        'Ready'}
                    </strong>
                  </div>

                  <div className="preview-header-actions">
                    {currentSong && (
                      <div className="current-actions">
                        <button
                          className="button button-secondary"
                          onClick={
                            () =>
                              openEditSongModal(
                                currentSong
                              )
                          }
                        >
                          Edit
                        </button>

                        <button
                          className="button button-primary"
                          onClick={() =>
                            projectSong(
                              currentSong
                            )
                          }
                        >
                          Send to Projector
                        </button>
                      </div>
                    )}

                    <div className="live-indicator">
                      <span className="green-dot" />

                      {projectionMode}
                    </div>
                  </div>
                </div>

                <ProjectorDisplay
                  song={previewSong}
                  sectionIndex={sectionIndex}
                  projectionMode={projectionMode}
                  backgroundType={backgroundType}
                  backgroundVariant={
                    backgroundVariant
                  }
                  customBackgroundUrl={
                    customBackgroundUrl
                  }
                  projectionSettings={
                    projectionSettings
                  }
                />

                <div className="background-selector">
                  <span className="background-selector-label">
                    Background
                  </span>

                  <div className="background-option-list">
                    <div className="background-options">
                      {BACKGROUND_OPTIONS.map(
                        (option) => (
                          <button
                            key={option.id}
                            type="button"
                            className={[
                              'background-option',
                              backgroundVariant ===
                              option.id
                                ? 'active'
                                : '',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                            onClick={() =>
                              selectPresetBackground(
                                option.id
                              )
                            }
                          >
                            <span
                              className={
                                option.swatchClassName
                              }
                            />

                            <span className="background-option-name">
                              {option.name}
                            </span>
                          </button>
                        )
                      )}

                      {customBackgroundId && (
                        <button
                          type="button"
                          className={[
                            'background-option',
                            backgroundType ===
                            'custom'
                              ? 'active'
                              : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          onClick={() =>
                            setBackgroundType(
                              'custom'
                            )
                          }
                        >
                          <span className="background-swatch background-swatch-custom">
                            {customBackgroundUrl && (
                              <span
                                className="background-swatch-image"
                                style={{
                                  backgroundImage: `url("${customBackgroundUrl}")`,
                                }}
                              />
                            )}
                          </span>

                          <span className="background-option-name">
                            Custom
                          </span>
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      className="background-option upload-background-button"
                      onClick={() =>
                        backgroundInputRef.current?.click()
                      }
                    >
                      <span className="background-swatch background-swatch-upload">
                        +
                      </span>

                      <span className="background-option-name">
                        Upload Background
                      </span>
                    </button>
                  </div>
                </div>

                <input
                  ref={backgroundInputRef}
                  className="background-upload-input"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleBackgroundUpload}
                />

                {backgroundType === 'custom' &&
                  customBackgroundName && (
                    <p className="custom-background-label">
                      Using custom background: {customBackgroundName}
                    </p>
                  )}

                <div className="projection-controls">
                  <button
                    className="button button-secondary"
                    onClick={
                      previousSection
                    }
                    disabled={
                      !canGoToPreviousProjection
                    }
                  >
                    ← Previous
                  </button>

                  <button
                    className="button button-secondary"
                    onClick={() =>
                      toggleClearLyrics()
                    }
                  >
                    {projectionMode ===
                    'CLEAR'
                      ? 'Show Lyrics'
                      : 'Clear Lyrics'}
                  </button>

                  <button
                    className="button button-secondary"
                    onClick={toggleBlackScreen}
                  >
                    {projectionMode ===
                    'BLACK'
                      ? 'Show Screen'
                      : 'Black'}
                  </button>

                  {projectionMode ===
                    'CLEAR' && (
                    <button
                      className="button button-secondary"
                      onClick={showLyrics}
                    >
                      Resume Lyrics
                    </button>
                  )}

                  <button
                    className="button button-primary"
                    onClick={openProjectorWindow}
                  >
                    Open Projector
                  </button>

                  <button
                    className="button button-primary"
                    onClick={nextSection}
                    disabled={
                      !canGoToNextProjection
                    }
                  >
                    Next →
                  </button>
                </div>

                <p className="projection-shortcuts-hint">
                  Shortcuts: `←` previous, `→` or `Space` next, `B` black, `C` clear lyrics.
                </p>
              </section>
            </div>
          </div>
        )}

        {activeView === 'songs' && (
          <div className="admin-view">
            <header className="service-header">
              <div>
                <p className="page-kicker">
                  Song Administration
                </p>

                <h2>Manage Songs</h2>

                <p className="header-description">
                  Review, search, create, edit,
                  and safely delete songs from
                  the library.
                </p>
              </div>

              <div className="header-right">
                <button
                  className="button button-secondary"
                  onClick={() =>
                    setActiveView(
                      'serviceHistory'
                    )
                  }
                >
                  Service History
                </button>

                <button
                  className="button button-secondary"
                  onClick={() =>
                    setActiveView('operator')
                  }
                >
                  Worship Console
                </button>

                <button
                  className="button button-primary"
                  onClick={() => {
                    setError('')
                    setNewSong(
                      createBlankSongForm()
                    )
                    setShowNewSongModal(true)
                  }}
                >
                  + New Song
                </button>
              </div>
            </header>

            <div className="songs-management-grid">
              <section className="console-card song-library-card">
                <div className="card-header">
                  <div>
                    <p className="card-kicker">
                      Library
                    </p>

                    <h3>All Songs</h3>
                  </div>

                  <span className="number-pill">
                    {filteredSongs.length}
                  </span>
                </div>

                <div className="search-wrapper">
                  <span>⌕</span>

                  <input
                    type="text"
                    placeholder="Search title or author..."
                    value={search}
                    onChange={(event) =>
                      setSearch(
                        event.target.value
                      )
                    }
                  />
                </div>

                <div className="filter-tabs">
                  {[
                    'ALL',
                    'SLOW',
                    'FAST',
                  ].map((type) => (
                    <button
                      key={type}
                      className={
                        typeFilter === type
                          ? 'filter-tab active'
                          : 'filter-tab'
                      }
                      onClick={() =>
                        setTypeFilter(type)
                      }
                    >
                      {type === 'ALL'
                        ? 'All'
                        : type === 'SLOW'
                          ? 'Slow'
                          : 'Fast'}
                    </button>
                  ))}
                </div>

                <div className="song-list">
                  {filteredSongs.map((song) => (
                    <button
                      key={song.id}
                      ref={(node) => {
                        if (node) {
                          manageSongItemRefs.current.set(
                            song.id,
                            node
                          )
                          return
                        }

                        manageSongItemRefs.current.delete(
                          song.id
                        )
                      }}
                      className={
                        selectedSong?.id ===
                        song.id
                          ? 'song-item selected'
                          : 'song-item'
                      }
                      onClick={() =>
                        setSelectedSong(song)
                      }
                    >
                      <div className="song-copy">
                        <strong>
                          {song.title}
                        </strong>

                        <span>
                          {song.author ||
                            'Unknown author'}
                        </span>
                      </div>

                      {getSongTypeBadge(
                        song.songType
                      ) && (
                        <span
                          className={
                            getSongTypeBadge(
                              song.songType
                            ).className
                          }
                        >
                          {
                            getSongTypeBadge(
                              song.songType
                            ).label
                          }
                        </span>
                      )}
                    </button>
                  ))}

                  {filteredSongs.length === 0 && (
                    <div className="empty-state">
                      No songs match this search.
                    </div>
                  )}
                </div>
              </section>

              <section className="console-card song-detail-card">
                <div className="card-header">
                  <div>
                    <p className="card-kicker">
                      Details
                    </p>

                    <h3>
                      {selectedSong?.title ||
                        'Select a Song'}
                    </h3>
                  </div>

                  {getSongTypeBadge(
                    selectedSong?.songType
                  ) && (
                    <span
                      className={
                        getSongTypeBadge(
                          selectedSong.songType
                        ).className
                      }
                    >
                      {
                        getSongTypeBadge(
                          selectedSong.songType
                        ).label
                      }
                    </span>
                  )}
                </div>

                <div className="song-detail-body">
                {selectedSong ? (
                  <>
                    <div className="song-detail-meta">
                      <p>
                        <strong>Author:</strong>{' '}
                        {selectedSongResolved.author ||
                          'Unknown author'}
                      </p>

                      <p>
                        <strong>Type:</strong>{' '}
                        {getSongTypeLabel(
                          selectedSongResolved.songType
                        )}
                      </p>

                      <p>
                        <strong>Language:</strong>{' '}
                        {getLanguageLabel(
                          selectedSongResolved.language
                        )}
                      </p>

                      <p>
                        <strong>Usage:</strong>{' '}
                        {
                          selectedSongUsageCount
                        }
                      </p>

                      <div className="section-status-row">
                        <p>
                          <strong>Section Status:</strong>{' '}
                          {selectedSongNeedsSectionReview
                            ? 'Needs Section Review'
                            : selectedSongSectionsConfirmed
                              ? 'Sections Confirmed ✓'
                              : selectedSongSections.length ===
                                    1 &&
                                  selectedSongSections[0]
                                    ?.name ===
                                    'Chorus'
                                ? 'Chorus established'
                                : 'No saved section structure'}
                        </p>

                        <button
                          type="button"
                          className="button button-secondary button-compact"
                          onClick={() =>
                            openEditSectionsModal()
                          }
                          disabled={!selectedSong}
                        >
                          Edit Sections
                        </button>
                      </div>
                    </div>

                    {selectedSongUsageCount >
                      0 && (
                      <div className="inline-note">
                        Remove this song from its
                        playlists and service
                        plans before deleting
                        it.
                      </div>
                    )}

                    <div className="translation-availability-card">
                      <div className="translation-availability-header">
                        <strong>
                          Translation Availability
                        </strong>

                        {selectedSongFamilyId ? (
                          <span>
                            Family{' '}
                            {selectedSongFamilyId}
                          </span>
                        ) : (
                          <span>
                            Standalone song
                          </span>
                        )}
                      </div>

                      {selectedSongFamilyId &&
                        familyVersionsErrorByFamilyId[
                          selectedSongFamilyId
                        ] && (
                          <div className="inline-note">
                            {
                              familyVersionsErrorByFamilyId[
                                selectedSongFamilyId
                              ]
                            }
                          </div>
                        )}

                      <div className="translation-availability-list">
                        {SUPPORTED_SONG_LANGUAGES.map(
                          (language) => {
                            const languageSong =
                              selectedSongLanguageVersions[
                                language
                              ]
                            const isActive =
                              normalizeLanguage(
                                selectedSongResolved.language
                              ) === language
                            const isAvailable =
                              Boolean(
                                languageSong
                              )

                            return (
                              <div
                                key={`translation-availability-${language}`}
                                className="translation-availability-row"
                              >
                                <div className="translation-availability-copy">
                                  <strong>
                                    {getLanguageLabel(
                                      language
                                    )}
                                  </strong>

                                  <span>
                                    {isActive
                                      ? 'Active'
                                      : isAvailable
                                        ? 'Available'
                                        : 'Missing'}
                                  </span>
                                </div>

                                {!isAvailable && (
                                  <button
                                    type="button"
                                    className="text-button"
                                    onClick={() =>
                                      openAddTranslationModal(
                                        language,
                                        selectedSongResolved
                                      )
                                    }
                                  >
                                    Add Translation
                                  </button>
                                )}
                              </div>
                            )
                          }
                        )}
                      </div>
                    </div>

                    <div className="song-lyrics-preview">
                      {selectedSongResolved.lyrics ||
                        'No lyrics added yet.'}
                    </div>

                    <div className="detail-actions">
                      <button
                        className="button button-secondary"
                        onClick={() =>
                          openEditSongModal()
                        }
                        disabled={!selectedSong}
                      >
                        Edit Song
                      </button>

                      <button
                        className="button button-danger"
                        onClick={
                          deleteSelectedSong
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="empty-state">
                      Choose a song to edit or
                      delete it.
                    </div>

                    <div className="detail-actions">
                      <button
                        className="button button-secondary"
                        disabled
                      >
                        Edit Song
                      </button>

                      <button
                        className="button button-danger"
                        disabled
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
                </div>
              </section>
            </div>
          </div>
        )}

        {activeView === 'playlists' && (
          <div className="admin-view">
            <header className="service-header">
              <div>
                <p className="page-kicker">
                  Playlist Administration
                </p>

                <h2>Manage Playlists</h2>

                <p className="header-description">
                  Create playlists, organize
                  songs, and choose the active
                  playlist for worship.
                </p>
              </div>

              <div className="header-right">
                <button
                  className="button button-secondary"
                  onClick={() =>
                    setActiveView('operator')
                  }
                >
                  Worship Console
                </button>
              </div>
            </header>

            <div className="playlists-management-grid">
              <section className="console-card playlist-list-card">
                <div className="card-header">
                  <div>
                    <p className="card-kicker">
                      Manage Playlist
                    </p>

                    <h3>All Playlists</h3>
                  </div>

                  <span className="number-pill">
                    {playlistSearch.trim()
                      ? `${filteredManagedPlaylists.length} of ${managedPlaylists.length}`
                      : managedPlaylists.length}
                  </span>
                </div>

                <div className="search-wrapper">
                  <span>⌕</span>

                  <input
                    type="text"
                    placeholder="Search playlists..."
                    value={playlistSearch}
                    onChange={(event) =>
                      setPlaylistSearch(
                        event.target.value
                      )
                    }
                  />
                </div>

                <div className="playlist-create-row">
                  <button
                    className="button button-primary"
                    onClick={openNewSavedPlaylistModal}
                  >
                    Create New Playlist
                  </button>

                  <button
                    className="button button-secondary"
                    onClick={() =>
                      openCopySavedPlaylistModal(
                        managedPlaylist ||
                          selectedPlaylist
                      )
                    }
                  >
                    Duplicate Playlist
                  </button>
                </div>

                <div className="playlist-management-list">
                  {filteredManagedPlaylists.map(
                    (playlist) => (
                    <button
                      key={playlist.id}
                      className={
                        managedPlaylistId ===
                        playlist.id
                          ? 'playlist-management-item active'
                          : 'playlist-management-item'
                      }
                      onClick={() => {
                        setManagedPlaylistId(
                          playlist.id
                        )
                        if (
                          playlist.reusable ===
                          false
                        ) {
                          return
                        }

                        setOpenedPlaylistId(
                          playlist.id
                        )
                      }}
                    >
                      <div className="playlist-management-copy">
                        <strong>
                          {formatPlaylistDisplayName(
                            playlist
                          )}
                        </strong>

                        <span>
                          {playlist.reusable === false
                            ? `${playlist.theme || 'No theme'} • ${(playlist.songs || []).filter((song) => song != null).length} songs`
                            : `Reusable playlist • ${(playlist.songs || []).filter((song) => song != null).length} songs`}
                        </span>
                      </div>

                      {selectedPlaylist?.id ===
                        playlist.id && (
                        <span className="active-playlist-badge">
                          Active
                        </span>
                      )}
                    </button>
                    )
                  )}

                  {filteredManagedPlaylists.length ===
                    0 && (
                    <div className="empty-state">
                      No playlists match this
                      search.
                    </div>
                  )}
                </div>
              </section>

              <section className="console-card playlist-detail-card">
                <div className="card-header">
                  <div>
                    <p className="card-kicker">
                      Playlist Details
                    </p>

                    <h3>
                      {formatPlaylistDisplayName(
                        managedPlaylist
                      ) ||
                        'Select a Playlist'}
                    </h3>
                  </div>
                </div>

                <div className="playlist-detail-body">
                {managedPlaylist ? (
                  <>
                    <div className="playlist-detail-top">
                      <div className="playlist-meta-row">
                        <label className="playlist-metadata-field">
                          <span>Service Type</span>
                          <select
                            name="serviceType"
                            value={
                              savedPlaylistMetadataForm.serviceType
                            }
                            onChange={
                              handleSavedPlaylistMetadataChange
                            }
                            disabled={
                              managedPlaylist?.reusable !==
                              false
                            }
                          >
                            <option value="">
                              {managedPlaylist?.serviceType
                                ? 'Choose a service type'
                                : 'Keep existing name'}
                            </option>

                            {PLAYLIST_SERVICE_TYPE_OPTIONS.map(
                              (option) => (
                                <option
                                  key={option}
                                  value={option}
                                >
                                  {option}
                                </option>
                              )
                            )}
                          </select>
                        </label>

                        <label className="playlist-metadata-field">
                          <span>Service Date</span>
                          <input
                            type="date"
                            name="serviceDate"
                            value={
                              savedPlaylistMetadataForm.serviceDate
                            }
                            onChange={
                              handleSavedPlaylistMetadataChange
                            }
                            disabled={
                              managedPlaylist?.reusable !==
                              false
                            }
                          />
                        </label>

                        <label className="playlist-metadata-field">
                          <span>Theme</span>
                          <input
                            type="text"
                            name="theme"
                            placeholder="Optional"
                            value={
                              savedPlaylistMetadataForm.theme
                            }
                            onChange={
                              handleSavedPlaylistMetadataChange
                            }
                          />
                        </label>

                        <label
                          className={
                            savedPlaylistMetadataForm.serviceType ===
                            'Other'
                              ? 'playlist-metadata-field'
                              : 'playlist-metadata-field playlist-metadata-field--hidden playlist-metadata-field--hidden-mobile-collapse'
                          }
                          aria-hidden={
                            savedPlaylistMetadataForm.serviceType !==
                            'Other'
                          }
                        >
                          <span>
                            Service Type
                          </span>
                          <input
                            type="text"
                            name="customServiceType"
                            value={
                              savedPlaylistMetadataForm.customServiceType
                            }
                            onChange={
                              handleSavedPlaylistMetadataChange
                            }
                            disabled={
                              managedPlaylist?.reusable !==
                                false ||
                              savedPlaylistMetadataForm.serviceType !==
                                'Other'
                            }
                            tabIndex={
                              savedPlaylistMetadataForm.serviceType ===
                              'Other'
                                ? 0
                                : -1
                            }
                            required={
                              savedPlaylistMetadataForm.serviceType ===
                              'Other'
                            }
                          />
                        </label>
                      </div>

                    {managedPlaylistIsSaved && (
                      <p className="playlist-generated-name-preview">
                        Playlist: {' '}
                        {managedPlaylistPreviewName ||
                          managedPlaylist?.name ||
                          'Select a service type and date'}
                      </p>
                    )}

                    <div className="playlist-action-row">
                      <div className="playlist-primary-actions">
                        <button
                          className="button button-secondary"
                          onClick={
                            saveManagedPlaylistMetadata
                          }
                        >
                          Save
                        </button>

                        <button
                          className="button button-primary"
                          onClick={() =>
                            makePlaylistActiveAndReturnToConsole(
                              managedPlaylist
                            )
                          }
                        >
                          Make Active & Return to Console
                        </button>
                      </div>

                      <button
                        className="button button-danger"
                        onClick={
                          deleteManagedPlaylist
                        }
                      >
                        Delete
                      </button>
                    </div>
                    </div>

                    <div className="playlist-library-layout playlist-song-workspace">
                      <div className="playlist-songs-panel">
                        <p className="small-title">
                          Playlist Songs
                        </p>

                        <div className="service-song-list playlist-songs-list">
                          {managedPlaylistSongs.map(
                            (song, index) => (
                              <div
                                key={`${managedPlaylist.id}-${song.id}-${index}`}
                                className="service-song selected"
                              >
                                <span className="song-order">
                                  {index + 1}
                                </span>

                                <div className="service-song-copy">
                                  <strong>
                                    {song.title}
                                  </strong>

                                  <span>
                                    {song.author ||
                                      'Unknown author'}
                                  </span>
                                </div>

                                <div className="playlist-row-actions">
                                  <button
                                    className="move-song-button"
                                    disabled={
                                      index === 0
                                    }
                                    onClick={() =>
                                      moveSongInPlaylist(
                                        index,
                                        index - 1,
                                        managedPlaylist
                                      )
                                    }
                                    title="Move song up"
                                  >
                                    ↑
                                  </button>

                                  <button
                                    className="move-song-button"
                                    disabled={
                                      index ===
                                      managedPlaylistSongs.length -
                                        1
                                    }
                                    onClick={() =>
                                      moveSongInPlaylist(
                                        index,
                                        index + 1,
                                        managedPlaylist
                                      )
                                    }
                                    title="Move song down"
                                  >
                                    ↓
                                  </button>

                                  <button
                                    className="remove-song-button"
                                    onClick={() =>
                                      removeSongFromPlaylist(
                                        song,
                                        managedPlaylist
                                      )
                                    }
                                    title="Remove from playlist"
                                  >
                                    ×
                                  </button>
                                </div>
                              </div>
                            )
                          )}

                          {managedPlaylistSongs.length ===
                            0 && (
                            <div className="empty-state">
                              This playlist is
                              empty.
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="playlist-library-panel">
                        <p className="small-title">
                          Song Library
                        </p>

                        <div className="search-wrapper">
                          <span>⌕</span>

                          <input
                            type="text"
                            placeholder="Search title or author..."
                            value={search}
                            onChange={(event) =>
                              setSearch(
                                event.target.value
                              )
                            }
                          />
                        </div>

                        <div className="filter-tabs">
                          {[
                            'ALL',
                            'SLOW',
                            'FAST',
                          ].map((type) => (
                            <button
                              key={type}
                              className={
                                typeFilter === type
                                  ? 'filter-tab active'
                                  : 'filter-tab'
                              }
                              onClick={() =>
                                setTypeFilter(
                                  type
                                )
                              }
                            >
                              {type === 'ALL'
                                ? 'All'
                                : type === 'SLOW'
                                  ? 'Slow'
                                  : 'Fast'}
                            </button>
                          ))}
                        </div>

                        <div className="song-list playlist-library-song-list">
                          {filteredSongs.map(
                            (song) => {
                              const alreadyInPlaylist =
                                managedPlaylistSongs.some(
                                  (
                                    playlistSong
                                  ) =>
                                    playlistSong.id ===
                                    song.id
                                )

                              return (
                                <div
                                  key={`${managedPlaylist.id}-library-${song.id}`}
                                  className={
                                    selectedSong?.id ===
                                    song.id
                                      ? 'song-item selected'
                                      : 'song-item'
                                  }
                                  role="button"
                                  tabIndex="0"
                                  onClick={() =>
                                    setSelectedSong(song)
                                  }
                                  onKeyDown={(event) => {
                                    if (
                                      event.key ===
                                        'Enter' ||
                                      event.key === ' '
                                    ) {
                                      event.preventDefault()
                                      setSelectedSong(song)
                                    }
                                  }}
                                >
                                  <div className="song-copy">
                                    <strong>
                                      {song.title}
                                    </strong>

                                    <span>
                                      {song.author ||
                                        'Unknown author'}
                                    </span>
                                  </div>

                                  <div className="playlist-library-actions">
                                    <span
                                      className={
                                        song.songType ===
                                        'FAST'
                                          ? 'type-label fast'
                                          : 'type-label slow'
                                      }
                                    >
                                      {
                                        song.songType
                                      }
                                    </span>

                                    <button
                                      className="button button-secondary inline-button"
                                      disabled={
                                        alreadyInPlaylist
                                      }
                                      onClick={(
                                        event
                                      ) => {
                                        event.stopPropagation()
                                        addSongToPlaylist(
                                          managedPlaylist,
                                          song
                                        )
                                      }}
                                    >
                                      {alreadyInPlaylist
                                        ? 'Added'
                                        : 'Add'}
                                    </button>
                                  </div>
                                </div>
                              )
                            }
                          )}

                          {filteredSongs.length ===
                            0 && (
                            <div className="empty-state">
                              No songs match this
                              search.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="empty-state">
                    Choose a playlist to edit its
                    metadata, manage songs, or
                    load it into service.
                  </div>
                )}
                </div>
              </section>
            </div>

          </div>
        )}

        {activeView === 'serviceHistory' && (
          <div className="admin-view">
            <header className="service-header">
              <div>
                <p className="page-kicker">
                  Service Records
                </p>

                <h2>Service History</h2>

                <p className="header-description">
                  Review completed services,
                  inspect their final song
                  order, and reuse them as new
                  working services.
                </p>
              </div>

              <div className="header-right">
                <button
                  className="button button-secondary"
                  onClick={() =>
                    setActiveView('playlists')
                  }
                >
                  Manage Playlists
                </button>

                <button
                  className="button button-secondary"
                  onClick={() =>
                    setActiveView('operator')
                  }
                >
                  Worship Console
                </button>
              </div>
            </header>

            <div className="playlists-management-grid">
              <section className="console-card playlist-list-card">
                <div className="card-header">
                  <div>
                    <p className="card-kicker">
                      Completed Services
                    </p>

                    <h3>History</h3>
                  </div>

                  <span className="number-pill">
                    {
                      completedServiceHistory.length
                    }
                  </span>
                </div>

                <div className="playlist-management-list service-history-list">
                  {completedServiceHistory.map(
                    (servicePlan) => (
                      <div
                        key={servicePlan.id}
                        className={
                          selectedHistoryServicePlan?.id ===
                          servicePlan.id
                            ? 'playlist-management-item active'
                            : 'playlist-management-item'
                        }
                        role="button"
                        tabIndex="0"
                        onClick={() =>
                          setSelectedHistoryServicePlanId(
                            servicePlan.id
                          )
                        }
                        onKeyDown={(
                          event
                        ) => {
                          if (
                            event.key ===
                              'Enter' ||
                            event.key === ' '
                          ) {
                            event.preventDefault()
                            setSelectedHistoryServicePlanId(
                              servicePlan.id
                            )
                          }
                        }}
                      >
                        <div className="playlist-management-copy">
                          <strong>
                            {servicePlan.serviceName}
                          </strong>

                          <span>
                            {formatShortDateLabel(
                              servicePlan.serviceDate
                            )}{' '}
                            •{' '}
                            {(
                              servicePlan.songs ||
                              []
                            ).filter(
                              (song) =>
                                song != null
                            ).length}{' '}
                            songs
                          </span>

                          {servicePlan.theme && (
                            <span>
                              Theme:{' '}
                              {servicePlan.theme}
                            </span>
                          )}
                        </div>

                        <div className="service-history-actions">
                          <button
                            className="button button-secondary inline-button"
                            onClick={(
                              event
                            ) => {
                              event.stopPropagation()
                              setSelectedHistoryServicePlanId(
                                servicePlan.id
                              )
                            }}
                          >
                            View
                          </button>

                          <button
                            className="button button-primary inline-button"
                            onClick={(
                              event
                            ) => {
                              event.stopPropagation()
                              openReuseServiceModal(
                                servicePlan
                              )
                            }}
                          >
                            Reuse
                          </button>

                          <button
                            className="button button-danger inline-button"
                            onClick={(
                              event
                            ) => {
                              event.stopPropagation()
                              deleteCompletedHistoryService(
                                servicePlan
                              )
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )
                  )}

                  {completedServiceHistory.length ===
                    0 && (
                    <div className="empty-state">
                      No completed services
                      yet. Finish a service in
                      the Worship Console to
                      save it here.
                    </div>
                  )}
                </div>
              </section>

              <section className="console-card playlist-detail-card">
                <div className="card-header">
                  <div>
                    <p className="card-kicker">
                      Historical Snapshot
                    </p>

                    <h3>
                      {selectedHistoryServicePlan
                        ?.serviceName ||
                        'Select a Completed Service'}
                    </h3>
                  </div>
                </div>

                <div className="playlist-detail-body">
                  {selectedHistoryServicePlan ? (
                    <div className="history-service-detail">
                      <div className="history-service-summary">
                        <div className="history-service-meta-grid">
                          <div className="history-service-meta-item">
                            <span>
                              Service Date
                            </span>
                            <strong>
                              {formatFullDateLabel(
                                selectedHistoryServicePlan.serviceDate
                              )}
                            </strong>
                          </div>

                          <div className="history-service-meta-item">
                            <span>
                              Completed
                            </span>
                            <strong>
                              {formatCompletionTimestamp(
                                selectedHistoryServicePlan.completedAt
                              )}
                            </strong>
                          </div>

                          <div className="history-service-meta-item">
                            <span>
                              Service Type
                            </span>
                            <strong>
                              {selectedHistoryServicePlan.serviceType ||
                                'Not specified'}
                            </strong>
                          </div>

                          <div className="history-service-meta-item">
                            <span>
                              Theme
                            </span>
                            <strong>
                              {selectedHistoryServicePlan.theme ||
                                'No theme'}
                            </strong>
                          </div>
                        </div>
                      </div>

                      <div className="playlist-action-row service-history-detail-actions">
                        <div className="playlist-primary-actions">
                          <button
                            className="button button-primary"
                            onClick={() =>
                              openReuseServiceModal(
                                selectedHistoryServicePlan
                              )
                            }
                          >
                            Reuse This Service
                          </button>
                        </div>

                        <button
                          className="button button-danger"
                          onClick={() =>
                            deleteCompletedHistoryService(
                              selectedHistoryServicePlan
                            )
                          }
                        >
                          Delete
                        </button>
                      </div>

                      <div className="playlist-songs-panel">
                        <p className="small-title">
                          Songs Used
                        </p>

                        <div className="service-song-list playlist-songs-list">
                          {(
                            selectedHistoryServicePlan.songs ||
                            []
                          )
                            .filter(
                              (song) =>
                                song != null
                            )
                            .map(
                              (
                                song,
                                index
                              ) => (
                                <div
                                  key={`history-song-${selectedHistoryServicePlan.id}-${song.id}-${index}`}
                                  className="service-song selected"
                                >
                                  <span className="song-order">
                                    {index + 1}
                                  </span>

                                  <div className="service-song-copy">
                                    <strong>
                                      {song.title}
                                    </strong>

                                    <span>
                                      {song.author ||
                                        'Unknown author'}
                                    </span>
                                  </div>
                                </div>
                              )
                            )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="empty-state">
                      Choose a completed
                      service to view its
                      historical snapshot.
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        )}

        {activeView === 'settings' && (
          <>
            <header className="service-header">
              <div>
                <p className="page-kicker">
                  Application Preferences
                </p>

                <h2>Settings</h2>

                <p className="header-description">
                  Set the default projection
                  look while keeping manual
                  service controls available in
                  the Worship Console.
                </p>
              </div>

              <div className="header-right">
                <button
                  className="button button-secondary"
                  onClick={() =>
                    setActiveView('operator')
                  }
                >
                  Worship Console
                </button>
              </div>
            </header>

            <div className="settings-grid">
              <section className="console-card">
                <div className="card-header">
                  <div>
                    <p className="card-kicker">
                      Projection Settings
                    </p>

                    <h3>
                      Default Projection
                    </h3>
                  </div>
                </div>

                <div className="settings-form">
                  <label className="settings-field">
                    <span className="settings-label">
                      Default projector
                      background
                    </span>

                    <select
                      name="defaultBackgroundVariant"
                      value={
                        settingsForm.defaultBackgroundVariant
                      }
                      onChange={
                        handleSettingsChange
                      }
                    >
                      {BACKGROUND_OPTIONS.map(
                        (option) => (
                          <option
                            key={option.id}
                            value={option.id}
                          >
                            {option.name}
                          </option>
                        )
                      )}
                    </select>
                  </label>

                  <div className="settings-field">
                    <span className="settings-label">
                      Background preview
                    </span>

                    <div className="settings-background-list">
                      {BACKGROUND_OPTIONS.map(
                        (option) => (
                          <label
                            key={option.id}
                            className={[
                              'settings-background-option',
                              settingsForm.defaultBackgroundVariant ===
                              option.id
                                ? 'active'
                                : '',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                          >
                            <input
                              type="radio"
                              name="defaultBackgroundVariant"
                              value={option.id}
                              checked={
                                settingsForm.defaultBackgroundVariant ===
                                option.id
                              }
                              onChange={
                                handleSettingsChange
                              }
                            />

                            <span
                              className={
                                option.swatchClassName
                              }
                            />

                            <span className="settings-background-copy">
                              {option.name}
                            </span>
                          </label>
                        )
                      )}
                    </div>
                  </div>

                  <label className="settings-checkbox">
                    <input
                      type="checkbox"
                      name="showSongTitle"
                      checked={
                        settingsForm.showSongTitle
                      }
                      onChange={
                        handleSettingsChange
                      }
                    />

                    <span>
                      Show song title at the
                      bottom of the projection
                    </span>
                  </label>

                  <label className="settings-field">
                    <span className="settings-label">
                      Default lyrics alignment
                    </span>

                    <select
                      name="lyricsAlignment"
                      value={
                        settingsForm.lyricsAlignment
                      }
                      onChange={
                        handleSettingsChange
                      }
                    >
                      <option value="left">
                        Left
                      </option>
                      <option value="center">
                        Center
                      </option>
                      <option value="right">
                        Right
                      </option>
                    </select>
                  </label>

                  <label className="settings-field">
                    <span className="settings-label">
                      Lyrics size preference
                    </span>

                    <select
                      name="lyricsSizePreference"
                      value={
                        settingsForm.lyricsSizePreference
                      }
                      onChange={
                        handleSettingsChange
                      }
                    >
                      <option value="AUTO_FIT">
                        Auto Fit
                      </option>
                      <option value="SMALL">
                        Small
                      </option>
                      <option value="MEDIUM">
                        Medium
                      </option>
                      <option value="LARGE">
                        Large
                      </option>
                    </select>
                  </label>

                  <p className="settings-note">
                    Saving applies these
                    projection preferences to
                    the dashboard preview and
                    projector window. During a
                    service, the Worship Console
                    background buttons can still
                    temporarily override the
                    default background.
                  </p>

                  <div className="settings-actions">
                    <button
                      className="button button-primary"
                      onClick={
                        saveProjectionSettings
                      }
                      type="button"
                    >
                      Save Settings
                    </button>

                    <button
                      className="button button-secondary"
                      onClick={
                        restoreDefaultProjectionSettings
                      }
                      type="button"
                    >
                      Restore Defaults
                    </button>
                  </div>
                </div>
              </section>

              <section className="console-card">
                <div className="card-header">
                  <div>
                    <p className="card-kicker">
                      Live Preview
                    </p>

                    <h3>
                      Current Projection
                    </h3>
                  </div>

                  <span className="number-pill">
                    {projectionMode}
                  </span>
                </div>

                <p className="settings-preview-copy">
                  This preview reflects the
                  saved projection settings
                  together with the current
                  song, section, and projection
                  mode.
                </p>

                <ProjectorDisplay
                  song={previewSong}
                  sectionIndex={sectionIndex}
                  projectionMode={projectionMode}
                  backgroundType={backgroundType}
                  backgroundVariant={
                    backgroundVariant
                  }
                  customBackgroundUrl={
                    customBackgroundUrl
                  }
                  projectionSettings={
                    projectionSettings
                  }
                />
              </section>
            </div>
          </>
        )}

        {activeView ===
          'backupExport' && (
          <>
            <header className="service-header">
              <div>
                <p className="page-kicker">
                  Administrative Tools
                </p>

                <h2>
                  Backup & Export
                </h2>

                <p className="header-description">
                  Protect your Church Song
                  data by creating a full
                  database backup.
                </p>
              </div>

              <div className="header-right">
                <button
                  className="button button-secondary"
                  onClick={() =>
                    setActiveView('operator')
                  }
                >
                  Worship Console
                </button>
              </div>
            </header>

            <div className="settings-grid">
              <section className="console-card">
                <div className="card-header">
                  <div>
                    <p className="card-kicker">
                      Full Database Backup
                    </p>

                    <h3>
                      Download Backup
                    </h3>
                  </div>
                </div>

                <div className="settings-form">
                  <p className="settings-preview-copy">
                    Includes songs,
                    translations, playlists,
                    section corrections,
                    service plans, and service
                    history.
                  </p>

                  <div className="backup-export-actions">
                    <button
                      className="button button-primary"
                      onClick={
                        downloadDatabaseBackup
                      }
                      disabled={
                        isCreatingDatabaseBackup
                      }
                      type="button"
                    >
                      {isCreatingDatabaseBackup
                        ? 'Creating Backup...'
                        : 'Download Database Backup'}
                    </button>
                  </div>

                  <div className="backup-session-status">
                    <span className="settings-label">
                      Last backup created
                    </span>

                    <strong>
                      {lastBackupCreatedAt ||
                        'Not created during this session'}
                    </strong>
                  </div>
                </div>
              </section>
            </div>
          </>
        )}
      </main>

      {showNewSongModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-heading">
              <div>
                <p className="card-kicker">
                  Song Library
                </p>

                <h2>
                  Add New Song
                </h2>
              </div>

              <button
                className="modal-close"
                onClick={closeNewSongModal}
              >
                ×
              </button>
            </div>

            <label>
              Title

              <input
                name="title"
                value={newSong.title}
                onChange={
                  handleNewSongChange
                }
              />
            </label>

            <label>
              Author

              <input
                name="author"
                value={newSong.author}
                onChange={
                  handleNewSongChange
                }
              />
            </label>

            <label>
              Song Type

              <select
                name="songType"
                value={
                  newSong.songType
                }
                onChange={
                  handleNewSongChange
                }
              >
                <option value="SLOW">
                  Slow
                </option>

                <option value="FAST">
                  Fast
                </option>
              </select>
            </label>

            <label>
              Language

              <select
                name="language"
                value={newSong.language}
                onChange={
                  handleNewSongChange
                }
              >
                {SONG_LANGUAGE_OPTIONS.map(
                  (option) => (
                    <option
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </option>
                  )
                )}
              </select>
            </label>

            <label>
              Lyrics

              <textarea
                name="lyrics"
                rows="10"
                value={newSong.lyrics}
                onChange={
                  handleNewSongChange
                }
                placeholder={`[Verse 1]
First line
Second line

[Chorus]
First line
Second line`}
              />
            </label>

            <div className="modal-buttons">
              <button
                className="button button-secondary"
                onClick={closeNewSongModal}
              >
                Cancel
              </button>

              <button
                className="button button-primary"
                onClick={createSong}
              >
                Add Song
              </button>
            </div>
          </div>
        </div>
      )}

      {showSavedPlaylistModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-heading">
              <div>
                <p className="card-kicker">
                  Manage Playlist
                </p>

                <h2>
                  {savedPlaylistCreationMode ===
                  'COPY'
                    ? 'Duplicate Playlist'
                    : 'Create New Playlist'}
                </h2>
              </div>

              <button
                className="modal-close"
                onClick={closeSavedPlaylistModal}
              >
                ×
              </button>
            </div>

            {savedPlaylistCreationMode ===
              'COPY' && (
              <label>
                Playlist to Duplicate

                <select
                  value={savedPlaylistSourceId}
                  onChange={
                    handleSavedPlaylistSourceChange
                  }
                >
                  <option value="">
                    Choose a playlist
                  </option>

                  {playlists.map((playlist) => (
                    <option
                      key={playlist.id}
                      value={playlist.id}
                    >
                      {playlist.reusable === false
                        ? formatPlaylistDisplayName(
                            playlist
                          )
                        : `Reusable: ${playlist.name}`}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {savedPlaylistCreationMode ===
              'COPY' && savedPlaylistSource && (
              <div className="service-plan-source-summary">
                <div className="service-plan-source-header">
                  <strong>
                    Copying Playlist
                  </strong>

                  <span>
                    {savedPlaylistSourceSongs.length}{' '}
                    songs
                  </span>
                </div>

                <div className="service-plan-source-name">
                  {formatPlaylistDisplayName(
                    savedPlaylistSource
                  )}
                </div>

                <div className="service-plan-source-list">
                  {savedPlaylistSourceSongs.map(
                    (song, index) => (
                      <div
                        key={`saved-playlist-source-${song.id}-${index}`}
                        className="service-plan-source-item"
                      >
                        <span className="song-order">
                          {index + 1}
                        </span>

                        <div className="service-song-copy">
                          <strong>
                            {song.title}
                          </strong>

                          <span>
                            {song.author ||
                              'Unknown author'}
                          </span>
                        </div>
                      </div>
                    )
                  )}

                  {savedPlaylistSourceSongs.length ===
                    0 && (
                    <div className="empty-state">
                      This source playlist is empty.
                    </div>
                  )}
                </div>
              </div>
            )}

            <label>
              Service Type *

              <select
                name="serviceType"
                value={savedPlaylistForm.serviceType}
                onChange={handleSavedPlaylistFormChange}
              >
                {PLAYLIST_SERVICE_TYPE_OPTIONS.map(
                  (option) => (
                    <option
                      key={option}
                      value={option}
                    >
                      {option}
                    </option>
                  )
                )}
              </select>
            </label>

            {savedPlaylistForm.serviceType ===
              'Other' && (
              <label>
                Custom Service Name *

                <input
                  name="customServiceType"
                  value={
                    savedPlaylistForm.customServiceType
                  }
                  onChange={
                    handleSavedPlaylistFormChange
                  }
                />
              </label>
            )}

            <label>
              Service Date *

              <input
                type="date"
                name="serviceDate"
                value={savedPlaylistForm.serviceDate}
                onChange={handleSavedPlaylistFormChange}
              />
            </label>

            <label>
              Theme

              <input
                name="theme"
                placeholder="Optional"
                value={savedPlaylistForm.theme}
                onChange={handleSavedPlaylistFormChange}
              />
            </label>

            <p className="playlist-generated-name-preview">
              Playlist: {' '}
              {savedPlaylistPreviewName ||
                'Select a service type and date'}
            </p>

            <div className="modal-buttons">
              <button
                className="button button-secondary"
                onClick={closeSavedPlaylistModal}
              >
                Cancel
              </button>

              <button
                className="button button-primary"
                onClick={createSavedPlaylist}
              >
                {savedPlaylistCreationMode ===
                'COPY'
                  ? 'Duplicate Playlist'
                  : 'Create Playlist'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showUseForTodayModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-heading">
              <div>
                <p className="card-kicker">
                  Today’s Service Workflow
                </p>

                <h2>
                  Use for Today’s Service
                </h2>
              </div>

              <button
                className="modal-close"
                onClick={() => {
                  setShowUseForTodayModal(
                    false
                  )
                  setUseForTodaySourcePlaylistId(
                    null
                  )
                }}
              >
                ×
              </button>
            </div>

            {todayWorkingPlaylist && (
              <div className="inline-note">
                A working playlist already
                exists for today, Friday,
                August 14, 2026:{' '}
                <strong>
                  {todayWorkingPlaylist.name}
                </strong>
                . You can continue it or
                replace it with a new copy
                from this reusable playlist.
              </div>
            )}

            <p className="settings-preview-copy">
              This creates a separate working
              playlist for today from the
              selected reusable playlist. The
              original reusable playlist stays
              unchanged.
            </p>

            <div className="service-plan-source-summary">
              <div className="service-plan-source-header">
                <strong>
                  Source Playlist
                </strong>

                <span>
                  {useForTodaySourceSongs.length}{' '}
                  songs
                </span>
              </div>

              <div className="service-plan-source-name">
                {useForTodaySourcePlaylist?.name ||
                  'No playlist selected'}
              </div>

              <div className="service-plan-source-list">
                {useForTodaySourceSongs.map(
                  (song, index) => (
                    <div
                      key={`today-service-source-${song.id}-${index}`}
                      className="service-plan-source-item"
                    >
                      <span className="song-order">
                        {index + 1}
                      </span>

                      <div className="service-song-copy">
                        <strong>
                          {song.title}
                        </strong>

                        <span>
                          {song.author ||
                            'Unknown author'}
                        </span>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>

            <label>
              Working Playlist Name

              <input
                name="name"
                value={useForTodayForm.name}
                onChange={
                  handleUseForTodayFormChange
                }
              />
            </label>

            <div className="service-date-preview">
              <span className="settings-label">
                Service Date
              </span>

              <strong>
                {formatFullDateLabel(
                  useForTodayForm.serviceDate
                )}
              </strong>
            </div>

            <div className="modal-buttons">
              <button
                className="button button-secondary"
                onClick={() => {
                  setShowUseForTodayModal(
                    false
                  )
                  setUseForTodaySourcePlaylistId(
                    null
                  )
                }}
              >
                Cancel
              </button>

              {todayWorkingPlaylist && (
                <button
                  className="button button-secondary"
                  onClick={
                    continueExistingTodayService
                  }
                >
                  Continue Existing
                </button>
              )}

              <button
                className="button button-primary"
                onClick={() =>
                  createTodayServicePlaylist(
                    todayWorkingPlaylist !=
                      null
                  )
                }
              >
                {todayWorkingPlaylist
                  ? 'Replace with New Copy'
                  : 'Create Working Playlist'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSaveServiceModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-heading">
              <div>
                <p className="card-kicker">
                  Service Planning
                </p>

                <h2>
                  Save as Service Plan
                </h2>
              </div>

              <button
                className="modal-close"
                onClick={() => {
                  setShowSaveServiceModal(
                    false
                  )
                  setServicePlanSourcePlaylistId(
                    null
                  )
                }}
              >
                ×
              </button>
            </div>

            <p className="settings-preview-copy">
              This saves a dated service plan
              from this regular playlist:{' '}
              <strong>
                {servicePlanSourcePlaylist?.name ||
                  'No playlist selected'}
              </strong>
              .
            </p>

            <div className="service-plan-source-summary">
              <div className="service-plan-source-header">
                <strong>
                  Source Playlist
                </strong>

                <span>
                  {servicePlanSourceSongs.length}{' '}
                  songs
                </span>
              </div>

              <div className="service-plan-source-name">
                {servicePlanSourcePlaylist?.name ||
                  'No playlist selected'}
              </div>

              <div className="service-plan-source-list">
                {servicePlanSourceSongs.map(
                  (song, index) => (
                    <div
                      key={`service-plan-source-${song.id}-${index}`}
                      className="service-plan-source-item"
                    >
                      <span className="song-order">
                        {index + 1}
                      </span>

                      <div className="service-song-copy">
                        <strong>
                          {song.title}
                        </strong>

                        <span>
                          {song.author ||
                            'Unknown author'}
                        </span>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>

            <label>
              Service Name

              <input
                name="serviceName"
                value={
                  servicePlanForm.serviceName
                }
                onChange={
                  handleServicePlanFormChange
                }
              />
            </label>

            <label>
              Service Date

              <input
                type="date"
                name="serviceDate"
                value={
                  servicePlanForm.serviceDate
                }
                onChange={
                  handleServicePlanFormChange
                }
              />
            </label>

            <label>
              Service Time

              <input
                type="time"
                name="serviceTime"
                value={
                  servicePlanForm.serviceTime
                }
                onChange={
                  handleServicePlanFormChange
                }
              />
            </label>

            <div className="modal-buttons">
              <button
                className="button button-secondary"
                onClick={() =>
                  {
                    setShowSaveServiceModal(
                      false
                    )
                    setServicePlanSourcePlaylistId(
                      null
                    )
                  }
                }
              >
                Cancel
              </button>

              <button
                className="button button-primary"
                onClick={saveServicePlan}
              >
                Save Service
              </button>
            </div>
          </div>
        </div>
      )}

      {showReuseServiceModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-heading">
              <div>
                <p className="card-kicker">
                  Service History
                </p>

                <h2>
                  Reuse Historical Service
                </h2>
              </div>

              <button
                className="modal-close"
                onClick={
                  closeReuseServiceModal
                }
              >
                ×
              </button>
            </div>

            <p className="settings-preview-copy">
              This creates a new active
              service from the completed
              history record for{' '}
              <strong>
                {selectedHistoryServicePlan?.serviceName ||
                  'the selected service'}
              </strong>
              . The historical snapshot stays
              unchanged.
            </p>

            <label>
              Service Name

              <input
                name="serviceName"
                value={
                  reuseServicePlanForm.serviceName
                }
                onChange={
                  handleReuseServicePlanFormChange
                }
              />
            </label>

            <label>
              New Service Date

              <input
                type="date"
                name="serviceDate"
                value={
                  reuseServicePlanForm.serviceDate
                }
                onChange={
                  handleReuseServicePlanFormChange
                }
              />
            </label>

            <label>
              Service Time

              <input
                type="time"
                name="serviceTime"
                value={
                  reuseServicePlanForm.serviceTime
                }
                onChange={
                  handleReuseServicePlanFormChange
                }
              />
            </label>

            <div className="modal-buttons">
              <button
                className="button button-secondary"
                onClick={
                  closeReuseServiceModal
                }
              >
                Cancel
              </button>

              <button
                className="button button-primary"
                onClick={
                  reuseSelectedHistoryService
                }
              >
                Create Working Service
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditSongModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-heading">
              <div>
                <p className="card-kicker">
                  Song Library
                </p>

                <h2>
                  Edit Song
                </h2>
              </div>

              <button
                className="modal-close"
                onClick={closeEditSongModal}
              >
                ×
              </button>
            </div>

            <label>
              Title

              <input
                name="title"
                value={editSong.title}
                onChange={
                  handleEditSongChange
                }
              />
            </label>

            <label>
              Author

              <input
                name="author"
                value={editSong.author}
                onChange={
                  handleEditSongChange
                }
              />
            </label>

            <label>
              Song Type

              <select
                name="songType"
                value={
                  editSong.songType
                }
                onChange={
                  handleEditSongChange
                }
              >
                <option value="SLOW">
                  Slow
                </option>

                <option value="FAST">
                  Fast
                </option>
              </select>
            </label>

            <label>
              Language

              <select
                name="language"
                value={editSong.language}
                onChange={
                  handleEditSongChange
                }
              >
                {editSong.language ===
                  'UNKNOWN' && (
                  <option value="UNKNOWN">
                    Unknown (Legacy)
                  </option>
                )}

                {SONG_LANGUAGE_OPTIONS.map(
                  (option) => (
                    <option
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </option>
                  )
                )}
              </select>
            </label>

            <label>
              Lyrics

              <textarea
                name="lyrics"
                rows="10"
                value={editSong.lyrics}
                onChange={
                  handleEditSongChange
                }
              />
            </label>

            <div className="modal-buttons">
              <button
                className="button button-secondary"
                onClick={closeEditSongModal}
              >
                Cancel
              </button>

              <button
                className="button button-primary"
                onClick={updateSong}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddTranslationModal && (
        <div className="modal-overlay">
          <div className="modal modal-wide">
            <div className="modal-heading">
              <div>
                <p className="card-kicker">
                  Song Translation
                </p>

                <h2>
                  Add Translation
                </h2>
              </div>

              <button
                className="modal-close"
                onClick={
                  closeAddTranslationModal
                }
              >
                ×
              </button>
            </div>

            <div className="translation-editor-grid">
              <section className="translation-source-panel">
                <p className="translation-panel-kicker">
                  SOURCE —{' '}
                  {getLanguageLabel(
                    selectedSongResolved?.language
                  )}
                </p>

                <div className="translation-source-block">
                  <span>Title</span>
                  <strong>
                    {selectedSongResolved?.title ||
                      'No title'}
                  </strong>
                </div>

                <div className="translation-source-block">
                  <span>Lyrics</span>
                  <div className="translation-source-lyrics">
                    {selectedSongResolved?.lyrics ||
                      'No lyrics added yet.'}
                  </div>
                </div>
              </section>

              <section className="translation-form-panel">
                <p className="translation-panel-kicker">
                  TRANSLATION —{' '}
                  {getLanguageLabel(
                    addTranslationForm.language
                  )}
                </p>

                <label>
                  Translation Language

                  <select
                    name="language"
                    value={
                      addTranslationForm.language
                    }
                    disabled
                  >
                    {SONG_LANGUAGE_OPTIONS.map(
                      (option) => (
                        <option
                          key={option.value}
                          value={option.value}
                        >
                          {option.label}
                        </option>
                      )
                    )}
                  </select>
                </label>

                <label>
                  Title

                  <input
                    name="title"
                    value={
                      addTranslationForm.title
                    }
                    onChange={
                      handleAddTranslationChange
                    }
                  />
                </label>

                <label>
                  Author

                  <input
                    name="author"
                    value={
                      addTranslationForm.author
                    }
                    onChange={
                      handleAddTranslationChange
                    }
                  />
                </label>

                <label>
                  Lyrics

                  <textarea
                    name="lyrics"
                    rows="12"
                    value={
                      addTranslationForm.lyrics
                    }
                    onChange={
                      handleAddTranslationChange
                    }
                  />
                </label>
              </section>
            </div>

            <div className="modal-buttons">
              <button
                className="button button-secondary"
                onClick={
                  closeAddTranslationModal
                }
              >
                Cancel
              </button>

              <button
                className="button button-primary"
                onClick={createTranslation}
              >
                Save Translation
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditSectionsModal && (
        <div className="modal-overlay">
          <div className="modal modal-wide">
            <div className="modal-heading">
              <div>
                <p className="card-kicker">
                  Song Structure
                </p>

                <h2>
                  Edit Sections
                </h2>
              </div>

              <button
                className="modal-close"
                onClick={
                  closeEditSectionsModal
                }
              >
                ×
              </button>
            </div>

            <div className="section-review-status">
              {sectionEditorRows.length === 1 &&
              !selectedSongNeedsSectionReview
                ? 'Single lyric block defaults to Chorus until you choose otherwise.'
                : selectedSongNeedsSectionReview
                  ? 'Needs Section Review'
                  : 'Sections Confirmed ✓'}
            </div>

            <div className="section-editor-list">
              {sectionEditorRows.map(
                (row, rowIndex) => (
                <section
                  key={`section-editor-${row.blockIndex}-${rowIndex}`}
                  className="section-editor-card"
                >
                  <div className="section-editor-header">
                    <strong>
                      Existing Section{' '}
                      {row.blockIndex + 1}
                    </strong>

                    <span>
                      Current label:{' '}
                      {createSectionAssignment(
                        {
                          type: row.type,
                          verseNumber:
                            row.verseNumber,
                          customLabel:
                            row.customLabel,
                          fallbackName:
                            `Verse ${row.blockIndex + 1}`,
                        }
                      ).name}
                    </span>
                  </div>

                  <div className="section-editor-fields">
                    <label>
                      Type

                      <select
                        value={row.type}
                        onChange={(event) =>
                          handleSectionEditorRowChange(
                            rowIndex,
                            {
                              type:
                                event.target
                                  .value,
                            }
                          )
                        }
                      >
                        <option value="UNASSIGNED">
                          Choose section
                        </option>

                        {SECTION_TYPE_OPTIONS.map(
                          (option) => (
                            <option
                              key={option}
                              value={option}
                            >
                              {formatSectionName(
                                option
                              )}
                            </option>
                          )
                        )}
                      </select>
                    </label>

                    {row.type === 'VERSE' && (
                      <label>
                        Number

                        <input
                          type="number"
                          min="1"
                          value={
                            row.verseNumber
                          }
                          onChange={(event) =>
                            handleSectionEditorRowChange(
                              rowIndex,
                              {
                                verseNumber:
                                  event.target
                                    .value,
                              }
                            )
                          }
                        />
                      </label>
                    )}

                    {row.type === 'OTHER' && (
                      <label>
                        Label

                        <input
                          value={
                            row.customLabel
                          }
                          onChange={(event) =>
                            handleSectionEditorRowChange(
                              rowIndex,
                              {
                                customLabel:
                                  event.target
                                    .value,
                              }
                            )
                          }
                        />
                      </label>
                    )}
                  </div>

                  <div className="section-editor-preview">
                    <span>
                      Lyrics Preview
                    </span>

                    <div className="section-editor-lyrics">
                      {row.lyrics ||
                        'No lyrics in this block.'}
                    </div>
                  </div>
                </section>
              )
              )}
            </div>

            <div className="modal-buttons">
              <button
                className="button button-secondary"
                onClick={
                  closeEditSectionsModal
                }
              >
                Cancel
              </button>

              <button
                className="button button-primary"
                onClick={
                  saveSectionAssignments
                }
              >
                Save Sections
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteBlockedModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-heading">
              <div>
                <p className="page-kicker">
                  Delete Blocked
                </p>

                <h2>
                  Remove From Planning First
                </h2>
              </div>

              <button
                className="modal-close"
                onClick={() =>
                  setShowDeleteBlockedModal(
                    false
                  )
                }
              >
                ×
              </button>
            </div>

            <p className="blocked-delete-copy">
              {selectedSong?.title ||
                'This song'} is currently used in
              the following playlists and
              service plans:
            </p>

            <div className="blocked-playlist-list">
              {selectedSongPlaylistNames.map(
                (playlistName, index) => (
                  <div
                    className="blocked-playlist-item"
                    key={`playlist-${playlistName}-${index}`}
                  >
                    {playlistName}
                  </div>
                )
              )}

              {selectedSongServicePlanNames.map(
                (
                  servicePlanName,
                  index
                ) => (
                  <div
                    className="blocked-playlist-item"
                    key={`service-${servicePlanName}-${index}`}
                  >
                    {servicePlanName}
                  </div>
                )
              )}
            </div>

            <p className="blocked-delete-copy">
              Remove the song from these
              services, then try deleting it
              again.
            </p>

            <div className="modal-buttons">
              <button
                className="button button-secondary"
                onClick={() =>
                  setShowDeleteBlockedModal(
                    false
                  )
                }
              >
                Close
              </button>

              {selectedSongWorkingPlaylists.length >
                0 && (
                <button
                  className="button button-primary"
                  onClick={() => {
                    setSelectedPlaylist(
                      selectedSongWorkingPlaylists[0]
                    )
                    setLoadedServicePlanId(null)
                    setShowDeleteBlockedModal(
                      false
                    )
                    setActiveView('operator')
                    setSuccessMessage(
                      `Opened working service "${selectedSongWorkingPlaylists[0].name}". Remove the song there, then return to Songs to delete it.`
                    )
                  }}
                >
                  Open Working Service
                </button>
              )}

              <button
                className="button button-primary"
                onClick={() => {
                  setShowDeleteBlockedModal(
                    false
                  )
                  setActiveView('playlists')
                }}
              >
                Go to Planning
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
