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
const DEFAULT_APP_SETTINGS = {
  churchName:
    'Humility & Mercy Gospel Assembly',
  churchAbbreviation: 'HMGA',
  defaultLanguage: 'ENGLISH',
  defaultBackground:
    DEFAULT_BACKGROUND_VARIANT,
  defaultServiceType: 'Sunday Morning',
}
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

const DEFAULT_BIBLE_SELECTION = {
  bookKey: 'JOHN',
  chapter: 3,
  startVerse: 16,
  endVerse: 18,
}

const BIBLE_TRANSLATION_CODES = {
  FRENCH: 'LSG1910',
  ENGLISH: 'KJV',
  SPANISH: 'RV1909',
}

const BIBLE_REFERENCE_TRANSLATION_ORDER = [
  BIBLE_TRANSLATION_CODES.FRENCH,
  BIBLE_TRANSLATION_CODES.ENGLISH,
  BIBLE_TRANSLATION_CODES.SPANISH,
]

const BIBLE_REFERENCE_TRANSLATION_LABELS = {
  LSG1910: 'Français',
  KJV: 'English',
  RV1909: 'Español',
}

const BIBLE_PROJECTION_MODES = {
  FRENCH: 'FRENCH',
  ENGLISH: 'ENGLISH',
  SPANISH: 'SPANISH',
  FRENCH_ENGLISH: 'FRENCH_ENGLISH',
}

const BIBLE_PROJECTION_LANGUAGE_OPTIONS = [
  {
    value: BIBLE_PROJECTION_MODES.FRENCH,
    label: 'Français',
  },
  {
    value: BIBLE_PROJECTION_MODES.ENGLISH,
    label: 'English',
  },
  {
    value: BIBLE_PROJECTION_MODES.SPANISH,
    label: 'Español',
  },
  {
    value:
      BIBLE_PROJECTION_MODES.FRENCH_ENGLISH,
    label: 'Français + English',
  },
]

const PROJECTION_CONTENT_TYPES = {
  SONG: 'SONG',
  BIBLE: 'BIBLE',
}

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

function clampNumber(
  value,
  minimum,
  maximum,
  fallback
) {
  const numericValue = Number(value)

  if (!Number.isInteger(numericValue)) {
    return fallback
  }

  return Math.min(
    maximum,
    Math.max(minimum, numericValue)
  )
}

function findBibleBook(
  bibleBooks,
  bookKey
) {
  return (
    bibleBooks.find(
      (book) => book.key === bookKey
    ) || null
  )
}

function normalizeBibleSelection(
  selection,
  bibleBooks
) {
  if (
    !Array.isArray(bibleBooks) ||
    bibleBooks.length === 0
  ) {
    return {
      ...DEFAULT_BIBLE_SELECTION,
    }
  }

  const selectedBook =
    findBibleBook(
      bibleBooks,
      selection?.bookKey
    ) ||
    findBibleBook(
      bibleBooks,
      DEFAULT_BIBLE_SELECTION.bookKey
    ) ||
    bibleBooks[0]
  const chapterCount = Math.max(
    selectedBook?.chapterCount || 0,
    1
  )
  const chapter = clampNumber(
    selection?.chapter,
    1,
    chapterCount,
    clampNumber(
      DEFAULT_BIBLE_SELECTION.chapter,
      1,
      chapterCount,
      1
    )
  )

  return {
    bookKey: selectedBook.key,
    chapter,
    startVerse:
      Number(selection?.startVerse) ||
      DEFAULT_BIBLE_SELECTION.startVerse,
    endVerse:
      Number(selection?.endVerse) ||
      DEFAULT_BIBLE_SELECTION.endVerse,
  }
}

function getContiguousBibleEndVerseOptions(
  availableVerseNumbers,
  startVerse
) {
  if (
    !Array.isArray(availableVerseNumbers) ||
    availableVerseNumbers.length === 0
  ) {
    return []
  }

  const startIndex =
    availableVerseNumbers.indexOf(startVerse)

  if (startIndex < 0) {
    return availableVerseNumbers
  }

  const endOptions = []

  for (
    let index = startIndex;
    index < availableVerseNumbers.length;
    index += 1
  ) {
    const verseNumber =
      availableVerseNumbers[index]

    if (index > startIndex) {
      const previousVerse =
        availableVerseNumbers[index - 1]

      if (verseNumber !== previousVerse + 1) {
        break
      }
    }

    endOptions.push(verseNumber)
  }

  return endOptions
}

function normalizeBibleProjectionMode(value) {
  return BIBLE_PROJECTION_LANGUAGE_OPTIONS.some(
    (option) => option.value === value
  )
    ? value
    : BIBLE_PROJECTION_MODES.FRENCH_ENGLISH
}

function normalizeBibleReferenceTranslationCode(
  value,
  availableTranslations = []
) {
  const normalized = String(value ?? '')
    .trim()
    .toUpperCase()

  const availableCodes =
    availableTranslations.map(
      (translation) => translation.code
    )

  if (
    availableCodes.includes(normalized)
  ) {
    return normalized
  }

  for (const code of BIBLE_REFERENCE_TRANSLATION_ORDER) {
    if (availableCodes.includes(code)) {
      return code
    }
  }

  return availableCodes[0] || ''
}

function getPreviewProjectionModeForTranslation(
  translationCode
) {
  if (
    translationCode ===
    BIBLE_TRANSLATION_CODES.ENGLISH
  ) {
    return BIBLE_PROJECTION_MODES.ENGLISH
  }

  if (
    translationCode ===
    BIBLE_TRANSLATION_CODES.SPANISH
  ) {
    return BIBLE_PROJECTION_MODES.SPANISH
  }

  return BIBLE_PROJECTION_MODES.FRENCH
}

function getBibleReferenceTranslationLabel(
  translation
) {
  if (!translation) {
    return ''
  }

  return (
    BIBLE_REFERENCE_TRANSLATION_LABELS[
      translation.code
    ] ||
    translation.language ||
    translation.name
  )
}

function getBibleBookDisplayName(
  bookKey,
  fallbackName = ''
) {
  return fallbackName || bookKey
}

function buildBibleReference(
  bookName,
  chapter,
  startVerse,
  endVerse
) {
  if (!bookName) {
    return ''
  }

  if (startVerse === endVerse) {
    return `${bookName} ${chapter}:${startVerse}`
  }

  return `${bookName} ${chapter}:${startVerse}–${endVerse}`
}

function getBiblePassageReference(
  passage
) {
  if (!passage) {
    return ''
  }

  const bookName = getBibleBookDisplayName(
    passage.bookKey,
    passage.bookName
  )

  return buildBibleReference(
    bookName,
    passage.chapter,
    passage.startVerse,
    passage.endVerse
  )
}

function getBibleVerseReference(
  passage,
  verseNumber
) {
  if (!passage || !verseNumber) {
    return ''
  }

  const bookName = getBibleBookDisplayName(
    passage.bookKey,
    passage.bookName
  )

  return buildBibleReference(
    bookName,
    passage.chapter,
    verseNumber,
    verseNumber
  )
}

function getLiveBibleReference(
  biblePassage,
  verseNumber
) {
  if (!biblePassage || !verseNumber) {
    return ''
  }

  if (
    biblePassage.projectionMode ===
    BIBLE_PROJECTION_MODES.FRENCH_ENGLISH
  ) {
    const frenchBookName =
      getBibleBookDisplayName(
        biblePassage.translations?.FRENCH
          ?.bookKey,
        biblePassage.translations?.FRENCH
          ?.bookName
      )
    const englishBookName =
      getBibleBookDisplayName(
        biblePassage.translations?.ENGLISH
          ?.bookKey,
        biblePassage.translations?.ENGLISH
          ?.bookName
      )

    if (frenchBookName && englishBookName) {
      return `${frenchBookName} / ${englishBookName} ${biblePassage.chapter}:${verseNumber}`
    }
  }

  if (
    biblePassage.projectionMode ===
    BIBLE_PROJECTION_MODES.ENGLISH
  ) {
    return getBibleVerseReference(
      biblePassage.translations?.ENGLISH ||
        biblePassage,
      verseNumber
    )
  }

  if (
    biblePassage.projectionMode ===
    BIBLE_PROJECTION_MODES.SPANISH
  ) {
    return getBibleVerseReference(
      biblePassage.translations?.SPANISH ||
        biblePassage,
      verseNumber
    )
  }

  return getBibleVerseReference(
    biblePassage.translations?.FRENCH ||
      biblePassage,
    verseNumber
  )
}

function createBiblePreviewPassage({
  mode,
  frenchPassage,
  englishPassage,
  spanishPassage,
}) {
  const hasFrench =
    frenchPassage?.verses?.length > 0
  const hasEnglish =
    englishPassage?.verses?.length > 0
  const hasSpanish =
    spanishPassage?.verses?.length > 0

  if (
    !hasFrench &&
    !hasEnglish &&
    !hasSpanish
  ) {
    return null
  }

  const effectiveMode =
    mode === BIBLE_PROJECTION_MODES.ENGLISH
      ? BIBLE_PROJECTION_MODES.ENGLISH
      : mode ===
            BIBLE_PROJECTION_MODES.SPANISH
        ? BIBLE_PROJECTION_MODES.SPANISH
      : mode === BIBLE_PROJECTION_MODES.FRENCH
        ? BIBLE_PROJECTION_MODES.FRENCH
        : BIBLE_PROJECTION_MODES.FRENCH_ENGLISH

  const sourcePassage =
    effectiveMode ===
    BIBLE_PROJECTION_MODES.ENGLISH
      ? englishPassage || frenchPassage
      : effectiveMode ===
            BIBLE_PROJECTION_MODES.SPANISH
        ? spanishPassage ||
          frenchPassage ||
          englishPassage
      : frenchPassage || englishPassage
  const verseNumbers = (
    sourcePassage?.verses || []
  ).map((verse) => verse.verseNumber)

  const englishVersesByNumber =
    Object.fromEntries(
      (englishPassage?.verses || []).map(
        (verse) => [verse.verseNumber, verse]
      )
    )
  const frenchVersesByNumber =
    Object.fromEntries(
      (frenchPassage?.verses || []).map(
        (verse) => [verse.verseNumber, verse]
      )
    )
  const spanishVersesByNumber =
    Object.fromEntries(
      (spanishPassage?.verses || []).map(
        (verse) => [verse.verseNumber, verse]
      )
    )

  const verses = verseNumbers.map(
    (verseNumber) => {
      const frenchVerse =
        frenchVersesByNumber[verseNumber] ||
        null
      const englishVerse =
        englishVersesByNumber[verseNumber] ||
        null

      if (
        effectiveMode ===
        BIBLE_PROJECTION_MODES.ENGLISH
      ) {
        return {
          verseNumber,
          text: englishVerse?.text || '',
        }
      }

      if (
        effectiveMode ===
        BIBLE_PROJECTION_MODES.FRENCH
      ) {
        return {
          verseNumber,
          text: frenchVerse?.text || '',
        }
      }

      if (
        effectiveMode ===
        BIBLE_PROJECTION_MODES.SPANISH
      ) {
        return {
          verseNumber,
          text:
            spanishVersesByNumber[
              verseNumber
            ]?.text || '',
        }
      }

      return {
        verseNumber,
        primaryText: frenchVerse?.text || '',
        secondaryText:
          englishVerse?.text || '',
      }
    }
  )

  const reference =
    effectiveMode ===
    BIBLE_PROJECTION_MODES.ENGLISH
      ? getBiblePassageReference(
          englishPassage || sourcePassage
        )
      : effectiveMode ===
            BIBLE_PROJECTION_MODES.SPANISH
        ? getBiblePassageReference(
            spanishPassage ||
              sourcePassage
          )
      : getBiblePassageReference(
          frenchPassage || sourcePassage
        )

  return {
    projectionMode: effectiveMode,
    bookKey: sourcePassage.bookKey,
    chapter: sourcePassage.chapter,
    startVerse: sourcePassage.startVerse,
    endVerse: sourcePassage.endVerse,
    canonicalReference: buildBibleReference(
      sourcePassage.bookKey,
      sourcePassage.chapter,
      sourcePassage.startVerse,
      sourcePassage.endVerse
    ),
    reference,
    translationCode:
      effectiveMode ===
      BIBLE_PROJECTION_MODES.FRENCH
        ? BIBLE_TRANSLATION_CODES.FRENCH
        : effectiveMode ===
            BIBLE_PROJECTION_MODES.ENGLISH
          ? BIBLE_TRANSLATION_CODES.ENGLISH
          : effectiveMode ===
                BIBLE_PROJECTION_MODES.SPANISH
            ? BIBLE_TRANSLATION_CODES.SPANISH
          : `${BIBLE_TRANSLATION_CODES.FRENCH}+${BIBLE_TRANSLATION_CODES.ENGLISH}`,
    translationName:
      effectiveMode ===
      BIBLE_PROJECTION_MODES.FRENCH
        ? 'Louis Segond 1910'
        : effectiveMode ===
            BIBLE_PROJECTION_MODES.ENGLISH
          ? 'King James Version'
          : effectiveMode ===
                BIBLE_PROJECTION_MODES.SPANISH
            ? 'Reina-Valera 1909'
          : 'Louis Segond 1910 + King James Version',
    translations: {
      FRENCH: hasFrench
        ? {
            ...frenchPassage,
            reference:
              getBiblePassageReference(
                frenchPassage
              ),
          }
        : null,
      ENGLISH: hasEnglish
        ? {
            ...englishPassage,
            reference:
              getBiblePassageReference(
                englishPassage
              ),
          }
        : null,
      SPANISH: hasSpanish
        ? {
            ...spanishPassage,
            reference:
              getBiblePassageReference(
                spanishPassage
              ),
          }
        : null,
    },
    verses,
  }
}

function getBibleProjectionText(
  biblePassage,
  verse
) {
  if (!biblePassage || !verse) {
    return ''
  }

  if (
    biblePassage.projectionMode ===
    BIBLE_PROJECTION_MODES.FRENCH_ENGLISH
  ) {
    return [
      String(verse.verseNumber),
      verse.primaryText || '',
      '',
      verse.secondaryText || '',
    ]
      .join('\n')
      .trim()
  }

  return `${verse.verseNumber} ${verse.text || ''}`.trim()
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
  overrides = {},
  defaultServiceType =
    DEFAULT_APP_SETTINGS.defaultServiceType
) {
  return {
    serviceType: defaultServiceType,
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

function normalizeAppSettings(
  settings
) {
  return {
    churchName:
      settings?.churchName?.trim() ||
      DEFAULT_APP_SETTINGS.churchName,
    churchAbbreviation:
      settings?.churchAbbreviation?.trim() ||
      DEFAULT_APP_SETTINGS.churchAbbreviation,
    defaultLanguage:
      SUPPORTED_SONG_LANGUAGES.includes(
        normalizeLanguage(
          settings?.defaultLanguage
        )
      )
        ? normalizeLanguage(
            settings?.defaultLanguage
          )
        : DEFAULT_APP_SETTINGS.defaultLanguage,
    defaultBackground:
      BACKGROUND_OPTIONS.some(
        (option) =>
          option.id ===
          settings?.defaultBackground
      )
        ? settings.defaultBackground
        : DEFAULT_APP_SETTINGS.defaultBackground,
    defaultServiceType:
      PLAYLIST_SERVICE_TYPE_OPTIONS.includes(
        settings?.defaultServiceType
      )
        ? settings.defaultServiceType
        : DEFAULT_APP_SETTINGS.defaultServiceType,
  }
}

function createSettingsForm(
  settings = DEFAULT_APP_SETTINGS
) {
  return normalizeAppSettings(settings)
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

function getMelodyReferenceAudioUrl(
  melodyReference
) {
  const audioPath =
    melodyReference?.audioUrl?.trim() || ''

  if (!audioPath) {
    return ''
  }

  return `http://localhost:8080${audioPath}`
}

function getMelodyReferenceSummary(
  melodyReference
) {
  if (!melodyReference) {
    return ''
  }

  if (
    melodyReference.ownerType === 'SONG_FAMILY'
  ) {
    return 'Family melody reference · Kreyòl primary'
  }

  if (
    melodyReference.resolutionType ===
    'SONG_FALLBACK'
  ) {
    return 'Standalone melody reference preserved after family link'
  }

  return 'Standalone song melody reference'
}

function formatAudioTime(seconds) {
  const safeSeconds = Math.max(
    0,
    Math.floor(Number(seconds) || 0)
  )
  const minutes = Math.floor(
    safeSeconds / 60
  )
  const remainingSeconds =
    safeSeconds % 60

  return `${minutes}:${String(
    remainingSeconds
  ).padStart(2, '0')}`
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

function shouldApplySessionDefaults(
  currentSongSourceId
) {
  return currentSongSourceId == null
}

function hasRestorableProjectorSession(
  projectorState
) {
  return Boolean(
    projectorState?.projectionSong ||
      projectorState?.projectedBiblePassage
  )
}

function getValidSongFamilyId(song) {
  const familyId = song?.familyId

  return Number.isInteger(familyId) && familyId > 0
    ? familyId
    : null
}

function isSameProjectionSong(leftSong, rightSong) {
  if (!leftSong || !rightSong) {
    return false
  }

  if (leftSong.id === rightSong.id) {
    return true
  }

  const leftFamilyId = getValidSongFamilyId(leftSong)
  const rightFamilyId = getValidSongFamilyId(rightSong)

  return (
    leftFamilyId != null &&
    leftFamilyId === rightFamilyId
  )
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

function resolvePreferredLanguageSong(
  song,
  preferredLanguage,
  songs,
  familyVersionsByFamilyId
) {
  if (!song) {
    return null
  }

  const versions =
    resolveLanguageVersionsForSong(
      song,
      songs,
      familyVersionsByFamilyId
    )
  const canonicalPreferredLanguage =
    normalizeLanguage(preferredLanguage)

  if (
    SUPPORTED_SONG_LANGUAGES.includes(
      canonicalPreferredLanguage
    ) &&
    versions[canonicalPreferredLanguage]
  ) {
    return (
      songs.find(
        (candidate) =>
          candidate.id ===
          versions[canonicalPreferredLanguage]
            .id
      ) ||
      versions[canonicalPreferredLanguage]
    )
  }

  return (
    songs.find(
      (candidate) => candidate.id === song.id
    ) || song
  )
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

function createLinkExistingSongForm(
  language = 'ENGLISH'
) {
  return {
    language,
    search: '',
  }
}

function mergeSongsById(
  existingSongs,
  updatedSongs
) {
  const byId = new Map(
    (existingSongs || []).map((song) => [
      song.id,
      song,
    ])
  )

  ;(updatedSongs || [])
    .filter(Boolean)
    .forEach((song) => {
      byId.set(song.id, song)
    })

  return Array.from(byId.values())
}

function getSongFamilyDisplayName(
  familyVersions,
  fallbackSong
) {
  for (const language of SUPPORTED_SONG_LANGUAGES) {
    const title =
      familyVersions?.[language]?.title?.trim()

    if (title) {
      return title
    }
  }

  return (
    fallbackSong?.title?.trim() || 'Song'
  )
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

function getInitialPlaylistSectionIndex(song) {
  const chorusIndex = parseLyricsSections(song)
    .findIndex(
      (section) =>
        normalizeSectionType(section.type) ===
        'CHORUS'
    )

  return chorusIndex >= 0 ? chorusIndex : 0
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
  projectionContentType = PROJECTION_CONTENT_TYPES.SONG,
  biblePassage = null,
  bibleVerseIndex = 0,
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
    projectionContentType,
    projectedBiblePassage:
      biblePassage || null,
    projectedBibleVerseIndex:
      bibleVerseIndex,
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
  }, [
    maxFontSize,
    minFontSize,
    text,
    textAlign,
  ])

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

function AppScrollArea({
  className = '',
  viewportClassName = '',
  scrollbarClassName = '',
  children,
  viewportRef = null,
  dependencyKey = '',
}) {
  const localViewportRef = useRef(null)
  const trackRef = useRef(null)
  const dragRef = useRef({
    startY: 0,
    startScrollTop: 0,
  })
  const [metrics, setMetrics] = useState({
    isScrollable: false,
    thumbHeight: 0,
    thumbOffset: 0,
  })
  const [isDragging, setIsDragging] =
    useState(false)

  function assignViewportRef(node) {
    localViewportRef.current = node

    if (typeof viewportRef === 'function') {
      viewportRef(node)
      return
    }

    if (
      viewportRef &&
      typeof viewportRef === 'object'
    ) {
      viewportRef.current = node
    }
  }

  function updateMetrics() {
    const scrollElement =
      localViewportRef.current

    if (!scrollElement) {
      setMetrics({
        isScrollable: false,
        thumbHeight: 0,
        thumbOffset: 0,
      })
      return
    }

    const { clientHeight, scrollHeight, scrollTop } =
      scrollElement

    if (
      clientHeight <= 0 ||
      scrollHeight <= clientHeight + 1
    ) {
      setMetrics({
        isScrollable: false,
        thumbHeight: 0,
        thumbOffset: 0,
      })
      return
    }

    const thumbHeight = Math.max(
      (clientHeight / scrollHeight) *
        clientHeight,
      40
    )
    const maxScrollTop = Math.max(
      scrollHeight - clientHeight,
      0
    )
    const maxThumbOffset = Math.max(
      clientHeight - thumbHeight,
      0
    )
    const thumbOffset =
      maxScrollTop === 0
        ? 0
        : (scrollTop / maxScrollTop) *
          maxThumbOffset

    setMetrics({
      isScrollable: true,
      thumbHeight,
      thumbOffset,
    })
  }

  useLayoutEffect(() => {
    const scrollElement =
      localViewportRef.current

    if (
      !scrollElement ||
      typeof window === 'undefined'
    ) {
      return
    }

    const handleMetricsChange = () => {
      updateMetrics()
    }

    handleMetricsChange()
    scrollElement.addEventListener(
      'scroll',
      handleMetricsChange
    )
    window.addEventListener(
      'resize',
      handleMetricsChange
    )

    let resizeObserver = null

    if (
      typeof ResizeObserver !==
      'undefined'
    ) {
      resizeObserver =
        new ResizeObserver(
          handleMetricsChange
        )
      resizeObserver.observe(scrollElement)
    }

    return () => {
      scrollElement.removeEventListener(
        'scroll',
        handleMetricsChange
      )
      window.removeEventListener(
        'resize',
        handleMetricsChange
      )
      resizeObserver?.disconnect()
    }
  }, [dependencyKey, children])

  useEffect(() => {
    if (
      !isDragging ||
      typeof window === 'undefined'
    ) {
      return
    }

    const handleMouseMove = (event) => {
      const scrollElement =
        localViewportRef.current

      if (!scrollElement) {
        return
      }

      const { startY, startScrollTop } =
        dragRef.current
      const {
        clientHeight,
        scrollHeight,
      } = scrollElement
      const maxScrollTop = Math.max(
        scrollHeight - clientHeight,
        0
      )
      const maxThumbOffset = Math.max(
        clientHeight -
          metrics.thumbHeight,
        0
      )

      if (
        maxScrollTop <= 0 ||
        maxThumbOffset <= 0
      ) {
        return
      }

      scrollElement.scrollTop = Math.min(
        maxScrollTop,
        Math.max(
          0,
          startScrollTop +
            ((event.clientY - startY) /
              maxThumbOffset) *
              maxScrollTop
        )
      )
      updateMetrics()
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    window.addEventListener(
      'mousemove',
      handleMouseMove
    )
    window.addEventListener(
      'mouseup',
      handleMouseUp
    )

    return () => {
      window.removeEventListener(
        'mousemove',
        handleMouseMove
      )
      window.removeEventListener(
        'mouseup',
        handleMouseUp
      )
    }
  }, [isDragging, metrics.thumbHeight])

  function handleTrackMouseDown(event) {
    const scrollElement =
      localViewportRef.current
    const trackElement = trackRef.current

    if (
      !scrollElement ||
      !trackElement ||
      !metrics.isScrollable
    ) {
      return
    }

    if (
      event.target instanceof HTMLElement &&
      event.target.closest(
        '.app-scrollbar-thumb'
      )
    ) {
      return
    }

    event.preventDefault()

    const trackRect =
      trackElement.getBoundingClientRect()
    const clickOffset =
      event.clientY - trackRect.top
    const maxScrollTop = Math.max(
      scrollElement.scrollHeight -
        scrollElement.clientHeight,
      0
    )
    const maxThumbOffset = Math.max(
      trackRect.height - metrics.thumbHeight,
      0
    )
    const nextThumbOffset = Math.min(
      maxThumbOffset,
      Math.max(
        0,
        clickOffset - metrics.thumbHeight / 2
      )
    )

    scrollElement.scrollTop =
      maxThumbOffset <= 0
        ? 0
        : (nextThumbOffset /
            maxThumbOffset) *
          maxScrollTop
    updateMetrics()
  }

  function handleThumbMouseDown(event) {
    const scrollElement =
      localViewportRef.current

    if (
      !scrollElement ||
      !metrics.isScrollable
    ) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    dragRef.current = {
      startY: event.clientY,
      startScrollTop:
        scrollElement.scrollTop,
    }
    setIsDragging(true)
  }

  return (
    <div
      className={[
        'app-scroll-shell',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div
        ref={assignViewportRef}
        className={[
          'app-scrollable',
          viewportClassName,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {children}
      </div>

      <div
        ref={trackRef}
        className={[
          'app-scrollbar',
          metrics.isScrollable
            ? 'visible'
            : '',
          scrollbarClassName,
        ]
          .filter(Boolean)
          .join(' ')}
        onMouseDown={handleTrackMouseDown}
        aria-hidden="true"
      >
        <div
          className={[
            'app-scrollbar-thumb',
            isDragging ? 'dragging' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={{
            height: metrics.thumbHeight,
            transform: `translateY(${metrics.thumbOffset}px)`,
          }}
          onMouseDown={handleThumbMouseDown}
        />
      </div>
    </div>
  )
}

function ProjectorDisplay({
  song,
  sectionIndex,
  projectionContentType = PROJECTION_CONTENT_TYPES.SONG,
  biblePassage = null,
  bibleVerseIndex = 0,
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
    if (
      !song ||
      projectionContentType !==
        PROJECTION_CONTENT_TYPES.SONG
    ) {
      return []
    }

    return parseLyricsSections(song)
  }, [projectionContentType, song])

  const currentSection =
    sections[sectionIndex] || sections[0]
  const currentBibleVerse =
    biblePassage?.verses?.[
      bibleVerseIndex
    ] ||
    biblePassage?.verses?.[0] ||
    null
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
            projectionContentType ===
              PROJECTION_CONTENT_TYPES.SONG &&
            song && (
              <div className="screen-content screen-content-song">
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

          {projectionMode === 'LIVE' &&
            projectionContentType ===
              PROJECTION_CONTENT_TYPES.BIBLE &&
            biblePassage &&
            currentBibleVerse && (
              <div className="screen-content screen-content-bible">
                <div className="screen-reference">
                  {biblePassage.reference}
                </div>

                <AutoFitLyrics
                  text={getBibleProjectionText(
                    biblePassage,
                    currentBibleVerse
                  )}
                  maxFontSize={
                    showFullscreenControl
                      ? lyricsSizing.maxFontSize
                      : Math.min(
                          lyricsSizing.maxFontSize,
                          34
                        )
                  }
                  minFontSize={
                    showFullscreenControl
                      ? lyricsSizing.minFontSize
                      : 10
                  }
                  containerClassName={
                    [
                      showFullscreenControl
                        ? 'lyrics-fit-container-projector'
                        : '',
                      'lyrics-fit-container-bible',
                    ]
                      .filter(Boolean)
                      .join(' ')
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

                <div className="screen-title">
                  {biblePassage.translationName}
                </div>
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
  const [appSettings, setAppSettings] =
    useState(() =>
      normalizeAppSettings(
        DEFAULT_APP_SETTINGS
      )
    )

  const [selectedSong, setSelectedSong] =
    useState(null)
  const [currentSong, setCurrentSong] =
    useState(null)
  const [
    currentSongSectionIndex,
    setCurrentSongSectionIndex,
  ] = useState(0)
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
  const [
    projectionContentType,
    setProjectionContentType,
  ] = useState(() => {
    const storedState = readStoredProjectorState()

    return (
      storedState?.projectionContentType ||
      PROJECTION_CONTENT_TYPES.SONG
    )
  })
  const [
    projectedBiblePassage,
    setProjectedBiblePassage,
  ] = useState(() => {
    const storedState = readStoredProjectorState()

    return (
      storedState?.projectedBiblePassage ||
      null
    )
  })
  const [
    projectedBibleVerseIndex,
    setProjectedBibleVerseIndex,
  ] = useState(() => {
    const storedState = readStoredProjectorState()

    return (
      storedState?.projectedBibleVerseIndex ||
      0
    )
  })

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
    showLinkExistingSongModal,
    setShowLinkExistingSongModal,
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
    linkExistingSongTargetFamilyId,
    setLinkExistingSongTargetFamilyId,
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
  const [
    isLearningModeEnabled,
    setIsLearningModeEnabled,
  ] = useState(false)
  const [
    currentSongLearningReference,
    setCurrentSongLearningReference,
  ] = useState(null)
  const [
    isLoadingCurrentSongLearningReference,
    setIsLoadingCurrentSongLearningReference,
  ] = useState(false)
  const [
    learningAudioCurrentTime,
    setLearningAudioCurrentTime,
  ] = useState(0)
  const [
    learningAudioDuration,
    setLearningAudioDuration,
  ] = useState(0)
  const [
    learningAudioVolume,
    setLearningAudioVolume,
  ] = useState(1)
  const [
    isLearningAudioPlaying,
    setIsLearningAudioPlaying,
  ] = useState(false)
  const [
    selectedSongMelodyReference,
    setSelectedSongMelodyReference,
  ] = useState(null)
  const [
    isLoadingSelectedSongMelodyReference,
    setIsLoadingSelectedSongMelodyReference,
  ] = useState(false)
  const [bibleBooks, setBibleBooks] = useState([])
  const [
    bibleTranslations,
    setBibleTranslations,
  ] = useState([])
  const [
    referenceBibleTranslationCode,
    setReferenceBibleTranslationCode,
  ] = useState(
    BIBLE_TRANSLATION_CODES.FRENCH
  )
  const [
    selectedBibleChapterMetadata,
    setSelectedBibleChapterMetadata,
  ] = useState(null)
  const [
    bibleProjectionMode,
    setBibleProjectionMode,
  ] = useState(
    BIBLE_PROJECTION_MODES.FRENCH_ENGLISH
  )
  const [
    bibleSelection,
    setBibleSelection,
  ] = useState(DEFAULT_BIBLE_SELECTION)
  const [
    previewBiblePassageData,
    setPreviewBiblePassageData,
  ] = useState(null)
  const projectorChannelRef = useRef(null)
  const projectorWindowRef = useRef(null)
  const operatorContentViewportRef = useRef(null)
  const playlistSelectorRef = useRef(null)
  const backgroundInputRef = useRef(null)
  const learningAudioRef = useRef(null)
  const melodyReferenceInputRef = useRef(null)
  const melodyReferenceAudioRef = useRef(null)
  const melodyReferenceRequestsRef = useRef(
    new Map()
  )
  const lastSongProjectionRef = useRef(null)
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
      projectionContentType:
        storedState?.projectionContentType ||
        PROJECTION_CONTENT_TYPES.SONG,
      projectedBiblePassage:
        storedState?.projectedBiblePassage ||
        null,
      projectedBibleVerseIndex:
        storedState?.projectedBibleVerseIndex ||
        0,
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
    linkExistingSongForm,
    setLinkExistingSongForm,
  ] = useState(() =>
    createLinkExistingSongForm()
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
    createSettingsForm(
      DEFAULT_APP_SETTINGS
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
    createSavedPlaylistForm(
      {},
      DEFAULT_APP_SETTINGS.defaultServiceType
    )
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

  function initializeFreshSessionDefaults() {
    setCurrentSongLanguageNotice('')
    setSelectedSong(null)
    setCurrentSong(null)
    setCurrentSongSectionIndex(0)
    setCurrentSongSourceId(null)
    setProjectionSong(null)
    setSectionIndex(0)
    setProjectionMode('LIVE')
    setBackgroundType('preset')
    setBackgroundVariant(
      appSettings.defaultBackground
    )
    setCustomBackgroundId(null)
    setCustomBackgroundName('')
  }

  function resolveOperatorPreviewSong(
    song,
    { applySessionDefaults = false } = {}
  ) {
    if (!song) {
      return null
    }

    const resolvedSong =
      songs.find(
        (candidate) =>
          candidate.id === song.id
      ) || song

    if (!applySessionDefaults) {
      return resolvedSong
    }

    return resolvePreferredLanguageSong(
      resolvedSong,
      appSettings.defaultLanguage,
      songs,
      familyVersionsByFamilyId
    )
  }

  function setOperatorPreviewSong(
    song,
    {
      currentSectionIndex = 0,
      sourceSongId = song?.id ?? null,
    } = {}
  ) {
    setCurrentSongLanguageNotice('')
    setSelectedSong(song)
    setCurrentSong(song)
    setCurrentSongSectionIndex(
      song ? currentSectionIndex : 0
    )
    setCurrentSongSourceId(sourceSongId)
  }

  function clearOperatorPlaylistContext() {
    setSelectedPlaylist(null)
    setOperatorPreviewSong(null)
  }

  function prepareOperatorPreviewForPlaylist(
    playlist
  ) {
    const playlistSongs =
      (playlist?.songs || []).filter(
        (song) => song != null
      )
    const firstPlaylistSong =
      playlistSongs[0] || null

    if (!firstPlaylistSong) {
      setOperatorPreviewSong(null)
      return
    }

    const nextSong = resolveOperatorPreviewSong(
      firstPlaylistSong,
      {
        applySessionDefaults:
          shouldApplySessionDefaults(
            currentSongSourceId
          ),
      }
    )

    setOperatorPreviewSong(nextSong, {
      currentSectionIndex:
        getInitialPlaylistSectionIndex(nextSong),
      sourceSongId: firstPlaylistSong.id,
    })
  }

  function clearLiveProjectionForPlaylistSwitch() {
    setProjectionContentType(
      PROJECTION_CONTENT_TYPES.SONG
    )
    setProjectionSong(null)
    setSectionIndex(0)
    setProjectedBiblePassage(null)
    setProjectedBibleVerseIndex(0)
    setProjectionMode('CLEAR')
    lastSongProjectionRef.current = null
  }

  function releasePlaylistSelectorFocus() {
    if (
      typeof document === 'undefined' ||
      document.activeElement !==
        playlistSelectorRef.current
    ) {
      return
    }

    playlistSelectorRef.current.blur()
  }

  function activatePlaylistInConsole(
    playlist
  ) {
    setSelectedPlaylist(playlist)
    setLoadedServicePlanId(null)
    prepareOperatorPreviewForPlaylist(playlist)
    clearLiveProjectionForPlaylistSwitch()
    releasePlaylistSelectorFocus()
  }

  async function saveApplicationSettings() {
    const nextSettings =
      createSettingsForm(settingsForm)

    if (
      !nextSettings.churchName ||
      !nextSettings.churchAbbreviation ||
      !nextSettings.defaultLanguage ||
      !nextSettings.defaultBackground ||
      !nextSettings.defaultServiceType
    ) {
      setError(
        'All settings fields are required.'
      )
      setSuccessMessage('')
      return
    }

    try {
      setError('')
      setSuccessMessage('')

      const response = await fetch(
        'http://localhost:8080/settings',
        {
          method: 'PUT',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify(nextSettings),
        }
      )

      if (!response.ok) {
        const message =
          await readErrorMessage(response)

        throw new Error(
          message ||
            'Could not save settings.'
        )
      }

      const savedSettings =
        createSettingsForm(
          await response.json()
        )

      setAppSettings(savedSettings)
      setSettingsForm(savedSettings)
      setSuccessMessage(
        'Settings saved successfully.'
      )
    } catch (err) {
      setError(
        err.message ||
          'Could not save settings.'
      )
      setSuccessMessage('')
    }
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

  const scrollOperatorContent = useEffectEvent(
    (direction) => {
      const viewport =
        operatorContentViewportRef.current

      if (
        activeView !== 'operator' ||
        !viewport
      ) {
        return false
      }

      const scrollAmount = Math.max(
        96,
        Math.min(viewport.clientHeight * 0.35, 240)
      )

      viewport.scrollBy({
        top: direction * scrollAmount,
        behavior: 'smooth',
      })

      return true
    }
  )

  useEffect(() => {
    if (isProjectorWindow) {
      return
    }

    loadSettings()
    loadBibleTranslations()
    loadSongs()
    loadPlaylists()
    loadServicePlans()
  }, [isProjectorWindow])

  useEffect(() => {
    if (isProjectorWindow) {
      return
    }

    loadBibleBooks(
      referenceBibleTranslationCode
    )
  }, [
    referenceBibleTranslationCode,
    isProjectorWindow,
  ])

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
        projectionContentType:
          state.projectionContentType ||
          PROJECTION_CONTENT_TYPES.SONG,
        projectedBiblePassage:
          state.projectedBiblePassage ||
          null,
        projectedBibleVerseIndex:
          state.projectedBibleVerseIndex ||
          0,
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
    const storedProjectorState =
      readStoredProjectorState()

    if (
      hasRestorableProjectorSession(
        storedProjectorState
      )
    ) {
      return
    }

    setBackgroundType('preset')
    setBackgroundVariant(
      appSettings.defaultBackground
    )
    setCustomBackgroundId(null)
    setCustomBackgroundName('')
  }, [appSettings.defaultBackground])

  async function loadSettings() {
    try {
      const response = await fetch(
        'http://localhost:8080/settings'
      )

      if (!response.ok) {
        throw new Error(
          'Failed to load settings'
        )
      }

      const data = await response.json()
      const normalizedSettings =
        createSettingsForm(data)

      setAppSettings(normalizedSettings)
      setSettingsForm(normalizedSettings)
    } catch (err) {
      setAppSettings(
        normalizeAppSettings(
          DEFAULT_APP_SETTINGS
        )
      )
      setSettingsForm(
        createSettingsForm(
          DEFAULT_APP_SETTINGS
        )
      )

      if (
        err instanceof TypeError &&
        err.message === 'Failed to fetch'
      ) {
        setError(
          'Could not load settings. Using built-in defaults.'
        )
        return
      }

      setError(
        err.message ||
          'Could not load settings. Using built-in defaults.'
      )
    }
  }

  async function loadBibleTranslations() {
    try {
      const response = await fetch(
        'http://localhost:8080/bible/translations'
      )

      if (!response.ok) {
        const message =
          await readErrorMessage(response)

        throw new Error(
          message ||
            'Could not load Bible translations.'
        )
      }

      const data = await response.json()

      if (!Array.isArray(data)) {
        throw new Error(
          'Received invalid Bible translations.'
        )
      }

      const prioritizedTranslations =
        data
          .filter((translation) =>
            BIBLE_REFERENCE_TRANSLATION_ORDER.includes(
              translation?.code
            )
          )
          .sort(
            (left, right) =>
              BIBLE_REFERENCE_TRANSLATION_ORDER.indexOf(
                left.code
              ) -
              BIBLE_REFERENCE_TRANSLATION_ORDER.indexOf(
                right.code
              )
          )

      setBibleTranslations(
        prioritizedTranslations
      )
      setReferenceBibleTranslationCode(
        (current) =>
          normalizeBibleReferenceTranslationCode(
            current,
            prioritizedTranslations
          )
      )
    } catch (err) {
      if (
        err instanceof TypeError &&
        err.message === 'Failed to fetch'
      ) {
        setError(
          'Could not load Bible translations. Restart the church-song-api server and try again.'
        )
        return
      }

      setError(
        err.message ||
          'Could not load Bible translations.'
      )
    }
  }

  async function loadBibleBooks(
    translationCode =
      referenceBibleTranslationCode
  ) {
    try {
      const query = new URLSearchParams({
        translation: translationCode,
      })
      const response = await fetch(
        `http://localhost:8080/bible/books?${query.toString()}`
      )

      if (!response.ok) {
        const message =
          await readErrorMessage(response)

        throw new Error(
          message ||
            'Could not load Bible metadata.'
        )
      }

      const data = await response.json()

      if (!Array.isArray(data)) {
        throw new Error(
          'Received invalid Bible metadata.'
        )
      }

      setBibleBooks(data)
      setBibleSelection((current) =>
        normalizeBibleSelection(
          current,
          data
        )
      )
    } catch (err) {
      if (
        err instanceof TypeError &&
        err.message === 'Failed to fetch'
      ) {
        setError(
          'Could not load Bible metadata. Restart the church-song-api server and try again.'
        )
        return
      }

      setError(
        err.message ||
          'Could not load Bible metadata.'
      )
    }
  }

  function stopMelodyReferencePlayback(
    {
      resetTime = false,
    } = {}
  ) {
    const audio =
      melodyReferenceAudioRef.current

    if (!audio) {
      return
    }

    audio.pause()

    if (resetTime) {
      audio.currentTime = 0
    }
  }

  function stopLearningAudio(
    { resetTime = false } = {}
  ) {
    const audio = learningAudioRef.current

    setIsLearningAudioPlaying(false)

    if (!audio) {
      if (resetTime) {
        setLearningAudioCurrentTime(0)
      }
      return
    }

    audio.pause()

    if (resetTime) {
      audio.currentTime = 0
      setLearningAudioCurrentTime(0)
    }
  }

  async function fetchMelodyReference(songId) {
    const existingRequest =
      melodyReferenceRequestsRef.current.get(songId)

    if (existingRequest) {
      return existingRequest
    }

    const request = fetch(
      `http://localhost:8080/songs/${songId}/melody-reference`
    )
      .then(async (response) => {
        if (response.status === 204) {
          return null
        }

        if (!response.ok) {
          const message = await readErrorMessage(response)
          throw new Error(
            message || 'Could not load the melody reference.'
          )
        }

        return response.json()
      })
      .catch((err) => {
        melodyReferenceRequestsRef.current.delete(songId)
        throw err
      })

    melodyReferenceRequestsRef.current.set(songId, request)
    return request
  }

  async function loadCurrentSongLearningReference(
    songId = currentSongResolved?.id
  ) {
    if (!songId) {
      setCurrentSongLearningReference(null)
      setIsLoadingCurrentSongLearningReference(false)
      return
    }

    try {
      setIsLoadingCurrentSongLearningReference(
        true
      )

      const data = await fetchMelodyReference(songId)
      setCurrentSongLearningReference(data)
    } catch (err) {
      setCurrentSongLearningReference(null)

      if (
        err instanceof TypeError &&
        err.message === 'Failed to fetch'
      ) {
        setError(
          'Could not load the reference audio. Restart the church-song-api server and try again.'
        )
        return
      }

      setError(
        err.message ||
          'Could not load the reference audio.'
      )
    } finally {
      setIsLoadingCurrentSongLearningReference(
        false
      )
    }
  }

  async function loadSelectedSongMelodyReference(
    songId = selectedSongResolved?.id
  ) {
    if (!songId) {
      setSelectedSongMelodyReference(null)
      setIsLoadingSelectedSongMelodyReference(
        false
      )
      return
    }

    try {
      setIsLoadingSelectedSongMelodyReference(
        true
      )

      const data = await fetchMelodyReference(songId)
      setSelectedSongMelodyReference(data)
    } catch (err) {
      setSelectedSongMelodyReference(null)

      if (
        err instanceof TypeError &&
        err.message === 'Failed to fetch'
      ) {
        setError(
          'Could not load the song melody reference. Restart the church-song-api server and try again.'
        )
        return
      }

      setError(
        err.message ||
          'Could not load the song melody reference.'
      )
    } finally {
      setIsLoadingSelectedSongMelodyReference(
        false
      )
    }
  }

  async function loadBibleChapterMetadata(
    {
      bookKey,
      chapter,
    } = bibleSelection,
    translationCode =
      referenceBibleTranslationCode
  ) {
    if (!bookKey || !chapter) {
      setSelectedBibleChapterMetadata(null)
      return
    }

    try {
      const response = await fetch(
        `http://localhost:8080/bible/books/${bookKey}/chapters/${chapter}/metadata?${new URLSearchParams({ translation: translationCode }).toString()}`
      )

      if (!response.ok) {
        const message =
          await readErrorMessage(response)

        throw new Error(
          message ||
            'Could not load Bible chapter metadata.'
        )
      }

      const data = await response.json()
      const availableVerseNumbers =
        Array.isArray(
          data.availableVerseNumbers
        )
          ? data.availableVerseNumbers
          : []

      setSelectedBibleChapterMetadata({
        ...data,
        availableVerseNumbers,
      })
      setBibleSelection((current) => {
        const firstVerse =
          availableVerseNumbers[0] || 1
        const nextStartVerse =
          availableVerseNumbers.includes(
            current.startVerse
          )
            ? current.startVerse
            : firstVerse
        const contiguousEndVerseOptions =
          getContiguousBibleEndVerseOptions(
            availableVerseNumbers,
            nextStartVerse
          )
        const nextEndVerse =
          contiguousEndVerseOptions.includes(
            current.endVerse
          )
            ? current.endVerse
            : contiguousEndVerseOptions[0] ||
              nextStartVerse

        return {
          ...current,
          startVerse: nextStartVerse,
          endVerse: nextEndVerse,
        }
      })
    } catch (err) {
      setSelectedBibleChapterMetadata(null)

      if (
        err instanceof TypeError &&
        err.message === 'Failed to fetch'
      ) {
        setError(
          'Could not load Bible chapter metadata. Restart the church-song-api server and try again.'
        )
        return
      }

      setError(
        err.message ||
          'Could not load Bible chapter metadata.'
      )
    }
  }

  function handleBibleBookChange(event) {
    const nextBookKey = event.target.value

    setPreviewBiblePassageData(null)
    setBibleSelection((current) =>
      normalizeBibleSelection(
        {
          ...current,
          bookKey: nextBookKey,
          chapter: 1,
          startVerse: 1,
          endVerse: 1,
        },
        bibleBooks
      )
    )
  }

  function handleReferenceBibleTranslationChange(
    translationCode
  ) {
    if (
      translationCode ===
      referenceBibleTranslationCode
    ) {
      return
    }

    setPreviewBiblePassageData(null)
    setSelectedBibleChapterMetadata(null)
    setReferenceBibleTranslationCode(
      translationCode
    )
  }

  function handleBibleChapterChange(event) {
    const nextChapter = Number(
      event.target.value
    )

    setPreviewBiblePassageData(null)
    setBibleSelection((current) =>
      normalizeBibleSelection(
        {
          ...current,
          chapter: nextChapter,
          startVerse: 1,
          endVerse: 1,
        },
        bibleBooks
      )
    )
  }

  function handleBibleStartVerseChange(event) {
    const nextStartVerse = Number(
      event.target.value
    )

    setPreviewBiblePassageData(null)
    setBibleSelection((current) =>
      normalizeBibleSelection(
        {
          ...current,
          startVerse: nextStartVerse,
          endVerse: Math.max(
            nextStartVerse,
            Number(current.endVerse) || 1
          ),
        },
        bibleBooks
      )
    )
  }

  function handleBibleEndVerseChange(event) {
    const nextEndVerse = Number(
      event.target.value
    )

    setPreviewBiblePassageData(null)
    setBibleSelection((current) =>
      normalizeBibleSelection(
        {
          ...current,
          endVerse: nextEndVerse,
        },
        bibleBooks
      )
    )
  }

  async function previewBiblePassageSelection() {
    if (!selectedBibleBook) {
      return
    }

    try {
      setError('')

      const query = new URLSearchParams({
        book: bibleSelection.bookKey,
        chapter: String(
          bibleSelection.chapter
        ),
        startVerse: String(
          bibleSelection.startVerse
        ),
        endVerse: String(
          bibleSelection.endVerse
        ),
        translation:
          referenceBibleTranslationCode,
      })
      const response = await fetch(
        `http://localhost:8080/bible/passage?${query.toString()}`
      )

      if (!response.ok) {
        const message =
          await readErrorMessage(response)

        throw new Error(
          message ||
            'Could not preview the selected Bible passage.'
        )
      }

      const referencePassage =
        await response.json()

      setPreviewBiblePassageData({
        translationCode:
          referenceBibleTranslationCode,
        referencePassage,
      })
    } catch (err) {
      if (
        err instanceof TypeError &&
        err.message === 'Failed to fetch'
      ) {
        setError(
          'Could not preview Bible passage. Restart the church-song-api server and try again.'
        )
        return
      }

      setError(
        err.message ||
          'Could not preview Bible passage.'
      )
    }
  }

  async function loadBiblePassageSet(
    startVerse,
    endVerse
  ) {
    const query = new URLSearchParams({
      book: bibleSelection.bookKey,
      chapter: String(
        bibleSelection.chapter
      ),
      startVerse: String(startVerse),
      endVerse: String(endVerse),
    })
    const [
      frenchResponse,
      englishResponse,
      spanishResponse,
    ] = await Promise.all([
      fetch(
        `http://localhost:8080/bible/passage?${new URLSearchParams({
          ...Object.fromEntries(
            query.entries()
          ),
          translation:
            BIBLE_TRANSLATION_CODES.FRENCH,
        }).toString()}`
      ),
      fetch(
        `http://localhost:8080/bible/passage?${new URLSearchParams({
          ...Object.fromEntries(
            query.entries()
          ),
          translation:
            BIBLE_TRANSLATION_CODES.ENGLISH,
        }).toString()}`
      ),
      fetch(
        `http://localhost:8080/bible/passage?${new URLSearchParams({
          ...Object.fromEntries(
            query.entries()
          ),
          translation:
            BIBLE_TRANSLATION_CODES.SPANISH,
        }).toString()}`
      ),
    ])

    if (!frenchResponse.ok) {
      const message =
        await readErrorMessage(
          frenchResponse
        )

      throw new Error(
        message ||
          'Could not load the French Bible passage.'
      )
    }

    if (!englishResponse.ok) {
      const message =
        await readErrorMessage(
          englishResponse
        )

      throw new Error(
        message ||
          'Could not load the English Bible passage.'
      )
    }

    if (!spanishResponse.ok) {
      const message =
        await readErrorMessage(
          spanishResponse
        )

      throw new Error(
        message ||
          'Could not load the Spanish Bible passage.'
      )
    }

    const [
      frenchPassage,
      englishPassage,
      spanishPassage,
    ] = await Promise.all([
      frenchResponse.json(),
      englishResponse.json(),
      spanishResponse.json(),
    ])

    return {
      frenchPassage,
      englishPassage,
      spanishPassage,
    }
  }

  async function projectBiblePassage() {
    if (
      !previewBiblePassage ||
      !previewBiblePassage.verses?.length
    ) {
      return
    }

    const availableVerseNumbers =
      selectedBibleChapterMetadata?.availableVerseNumbers ||
      []
    const chapterFirstVerse =
      availableVerseNumbers[0]
    const chapterLastVerse =
      availableVerseNumbers[
        availableVerseNumbers.length - 1
      ]

    if (
      !Number.isInteger(chapterFirstVerse) ||
      !Number.isInteger(chapterLastVerse)
    ) {
      setError(
        'Could not determine the available verses for this Bible chapter.'
      )
      return
    }

    try {
      setError('')

      const chapterPassageData =
        await loadBiblePassageSet(
          chapterFirstVerse,
          chapterLastVerse
        )
      const chapterBiblePassage =
        createBiblePreviewPassage({
          mode: bibleProjectionMode,
          frenchPassage:
            chapterPassageData.frenchPassage,
          englishPassage:
            chapterPassageData.englishPassage,
          spanishPassage:
            chapterPassageData.spanishPassage,
        })

      if (
        !chapterBiblePassage ||
        !chapterBiblePassage.verses?.length
      ) {
        throw new Error(
          'Could not load the selected Bible chapter for projection.'
        )
      }

      const targetVerseIndex =
        chapterBiblePassage.verses.findIndex(
          (verse) =>
            verse.verseNumber ===
            bibleSelection.startVerse
        )

      if (
        projectionContentType ===
        PROJECTION_CONTENT_TYPES.SONG
      ) {
        lastSongProjectionRef.current = {
          song:
            liveProjectionSong ||
            currentSongResolved ||
            null,
          sectionIndex,
        }
      } else if (
        lastSongProjectionRef.current == null &&
        currentSongResolved
      ) {
        lastSongProjectionRef.current = {
          song: currentSongResolved,
          sectionIndex,
        }
      }

      setProjectionContentType(
        PROJECTION_CONTENT_TYPES.BIBLE
      )
      setProjectedBiblePassage(
        chapterBiblePassage
      )
      setProjectedBibleVerseIndex(
        targetVerseIndex >= 0
          ? targetVerseIndex
          : 0
      )
      setProjectionMode('LIVE')
    } catch (err) {
      if (
        err instanceof TypeError &&
        err.message === 'Failed to fetch'
      ) {
        setError(
          'Could not send Bible passage to the projector. Restart the church-song-api server and try again.'
        )
        return
      }

      setError(
        err.message ||
          'Could not send Bible passage to the projector.'
      )
    }
  }

  function handleBibleProjectionModeChange(
    nextMode
  ) {
    setBibleProjectionMode(nextMode)

    if (
      !isBibleProjectionActive ||
      !projectedBiblePassage
    ) {
      return
    }

    const nextProjectedBiblePassage =
      createBiblePreviewPassage({
        mode: nextMode,
        frenchPassage:
          projectedBiblePassage.translations
            ?.FRENCH || null,
        englishPassage:
          projectedBiblePassage.translations
            ?.ENGLISH || null,
        spanishPassage:
          projectedBiblePassage.translations
            ?.SPANISH || null,
      })

    if (
      nextProjectedBiblePassage?.verses
        ?.length
    ) {
      setProjectedBiblePassage(
        nextProjectedBiblePassage
      )
    }
  }

  function returnToSongProjection() {
    const snapshot =
      lastSongProjectionRef.current

    if (snapshot?.song) {
      const resolvedSong =
        songs.find(
          (candidate) =>
            candidate.id ===
            snapshot.song.id
        ) || snapshot.song

      setProjectionContentType(
        PROJECTION_CONTENT_TYPES.SONG
      )
      setProjectedBiblePassage(null)
      setProjectedBibleVerseIndex(0)
      setProjectionSong(resolvedSong)
      setSectionIndex(
        snapshot.sectionIndex || 0
      )
      setProjectionMode('LIVE')
      lastSongProjectionRef.current = null
      return
    }

    if (currentSongResolved) {
      setProjectionContentType(
        PROJECTION_CONTENT_TYPES.SONG
      )
      setProjectedBiblePassage(null)
      setProjectedBibleVerseIndex(0)
      setProjectionSong(currentSongResolved)
      setSectionIndex(0)
      setProjectionMode('LIVE')
      return
    }

    setProjectionContentType(
      PROJECTION_CONTENT_TYPES.SONG
    )
    setProjectedBiblePassage(null)
    setProjectedBibleVerseIndex(0)
    setProjectionSong(null)
    setSectionIndex(0)
    setProjectionMode('CLEAR')
  }

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
      setCurrentSong((current) => {
        if (!current) {
          return null
        }

        return (
          data.find(
            (song) => song.id === current.id
          ) || current
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
      const currentSelectedPlaylistId =
        selectedPlaylist?.id || null
      const nextSelectedPlaylist =
        currentSelectedPlaylistId == null
          ? defaultPlaylist
          : data.find(
              (playlist) =>
                playlist.id ===
                currentSelectedPlaylistId
            ) || defaultPlaylist
      const selectedPlaylistChanged =
        nextSelectedPlaylist?.id !==
        currentSelectedPlaylistId
      const lastPlaylistWasRemoved =
        playlists.length > 0 && data.length === 0

      setPlaylists(data)

      setSelectedPlaylist(nextSelectedPlaylist)

      if (
        loadedServicePlanId == null &&
        data.length === 0
      ) {
        clearOperatorPlaylistContext()

        if (lastPlaylistWasRemoved) {
          clearLiveProjectionLyrics()
        }
      } else if (
        loadedServicePlanId == null &&
        selectedPlaylistChanged
      ) {
        prepareOperatorPreviewForPlaylist(
          nextSelectedPlaylist
        )
      }

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
  const consoleReuseSource =
    completedServiceHistory.find(
      (servicePlan) =>
        servicePlan.id ===
        (selectedPlaylist?.sourceServicePlanId ??
          (loadedServicePlan == null
            ? null
            : reusedServiceSourceById[
                loadedServicePlan.id
              ]))
    ) || null
  const usingLoadedServicePlan =
    loadedServicePlan != null
  const usingWorkingPlaylist =
    selectedPlaylist?.reusable === false
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
    usingLoadedServicePlan ||
    usingWorkingPlaylist
      ? 'Working Service'
      : 'Service Playlist'
  const completableServiceTarget =
    getCompletableServiceTarget()
  const selectedReferenceBibleTranslation =
    useMemo(
      () =>
        bibleTranslations.find(
          (translation) =>
            translation.code ===
            referenceBibleTranslationCode
        ) || null,
      [
        bibleTranslations,
        referenceBibleTranslationCode,
      ]
    )
  const selectedBibleBook = useMemo(
    () =>
      findBibleBook(
        bibleBooks,
        bibleSelection.bookKey
      ),
    [bibleBooks, bibleSelection.bookKey]
  )
  const selectedBibleChapterOptions =
    useMemo(() => {
      const chapterCount = Math.max(
        selectedBibleBook?.chapterCount || 0,
        0
      )

      return Array.from(
        { length: chapterCount },
        (_, index) => index + 1
      )
    }, [selectedBibleBook])
  const previewBiblePassage = useMemo(
    () =>
      createBiblePreviewPassage({
        mode:
          getPreviewProjectionModeForTranslation(
            previewBiblePassageData?.translationCode ||
              referenceBibleTranslationCode
          ),
        frenchPassage:
          (
            previewBiblePassageData?.translationCode ||
            referenceBibleTranslationCode
          ) ===
          BIBLE_TRANSLATION_CODES.FRENCH
            ? previewBiblePassageData?.referencePassage ||
              null
            : null,
        englishPassage:
          (
            previewBiblePassageData?.translationCode ||
            referenceBibleTranslationCode
          ) ===
          BIBLE_TRANSLATION_CODES.ENGLISH
            ? previewBiblePassageData?.referencePassage ||
              null
            : null,
        spanishPassage:
          (
            previewBiblePassageData?.translationCode ||
            referenceBibleTranslationCode
          ) ===
          BIBLE_TRANSLATION_CODES.SPANISH
            ? previewBiblePassageData?.referencePassage ||
              null
            : null,
      }),
    [
      previewBiblePassageData,
      referenceBibleTranslationCode,
    ]
  )
  const selectedBibleVerseOptions =
    selectedBibleChapterMetadata
      ?.availableVerseNumbers || []
  const selectedBibleContiguousEndVerseOptions =
    useMemo(
      () =>
        getContiguousBibleEndVerseOptions(
          selectedBibleVerseOptions,
          bibleSelection.startVerse
        ),
      [
        selectedBibleVerseOptions,
        bibleSelection.startVerse,
      ]
    )
  const selectedBibleVerseCount =
    selectedBibleVerseOptions.length
  const isBibleProjectionActive =
    projectionContentType ===
      PROJECTION_CONTENT_TYPES.BIBLE &&
    projectedBiblePassage?.verses?.length > 0
  const previewProjectionContentType =
    isBibleProjectionActive
      ? PROJECTION_CONTENT_TYPES.BIBLE
      : PROJECTION_CONTENT_TYPES.SONG

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
  const currentSongSections = useMemo(() => {
    if (!currentSongResolved) {
      return []
    }

    return parseLyricsSections(
      currentSongResolved
    )
  }, [currentSongResolved])
  const projectionSongResolved = useMemo(
    () =>
      resolveSongFromCollection(
        projectionSong,
        songs
      ),
    [projectionSong, songs]
  )
  const liveProjectionSong =
    previewProjectionContentType ===
    PROJECTION_CONTENT_TYPES.SONG
      ? projectionSongResolved
      : null
  const isCurrentSongLive =
    projectionContentType ===
      PROJECTION_CONTENT_TYPES.SONG &&
    isSameProjectionSong(
      liveProjectionSong,
      currentSongResolved
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

  const currentBibleVerse =
    isBibleProjectionActive
      ? projectedBiblePassage.verses[
          projectedBibleVerseIndex
        ] ||
        projectedBiblePassage.verses[0] ||
        null
      : null
  const stagedProjectorSong = currentSongResolved
  const stagedProjectorContentType =
    stagedProjectorSong
      ? PROJECTION_CONTENT_TYPES.SONG
      : previewProjectionContentType
  const stagedProjectorSectionIndex =
    currentSongSectionIndex
  const stagedProjectorPreviewMode =
    stagedProjectorSong ? 'LIVE' : projectionMode
  const projectorPreviewSections = useMemo(() => {
    if (!stagedProjectorSong) {
      return []
    }

    return parseLyricsSections(stagedProjectorSong)
  }, [stagedProjectorSong])
  const projectorPreviewSection =
    projectorPreviewSections[
      stagedProjectorSectionIndex
    ] ||
    projectorPreviewSections[0]
  const currentSongSelectionId =
    currentSongSourceId ??
    currentSongResolved?.id ??
    null
  const canGoToPreviousProjection =
    previewProjectionContentType ===
    PROJECTION_CONTENT_TYPES.BIBLE
      ? projectedBibleVerseIndex > 0
      : currentSongSectionIndex > 0
  const canGoToNextProjection =
    previewProjectionContentType ===
    PROJECTION_CONTENT_TYPES.BIBLE
      ? projectedBibleVerseIndex <
        (projectedBiblePassage?.verses
          ?.length || 0) -
          1
      : currentSongSectionIndex <
        currentSongSections.length - 1
  const liveBibleReference =
    isBibleProjectionActive &&
    currentBibleVerse
      ? getLiveBibleReference(
          projectedBiblePassage,
          currentBibleVerse.verseNumber
        )
      : previewBiblePassage
        ? getLiveBibleReference(
            previewBiblePassage,
            bibleSelection.startVerse
          )
        : ''

  useEffect(() => {
    if (!currentSongResolved) {
      setCurrentSongSectionIndex(0)
      return
    }

    setCurrentSongSectionIndex((current) =>
      current < currentSongSections.length
        ? current
        : 0
    )
  }, [
    currentSongResolved,
    currentSongSections.length,
  ])
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
  const selectedSongFamilyDisplayName =
    useMemo(() => {
      const cachedFamilyName =
        familyVersionsByFamilyId[
          selectedSongFamilyId
        ]?.displayName?.trim()

      if (cachedFamilyName) {
        return cachedFamilyName
      }

      return getSongFamilyDisplayName(
        selectedSongLanguageVersions,
        selectedSongResolved
      )
    }, [
      familyVersionsByFamilyId,
      selectedSongFamilyId,
      selectedSongLanguageVersions,
      selectedSongResolved,
    ])
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
  const selectedSongAvailableFamilyLanguages =
    useMemo(
      () =>
        SUPPORTED_SONG_LANGUAGES.filter(
          (language) =>
            Boolean(
              selectedSongLanguageVersions[
                language
              ]
            )
        ),
      [selectedSongLanguageVersions]
    )
  const selectedSongMissingFamilyLanguages =
    useMemo(
      () =>
        SUPPORTED_SONG_LANGUAGES.filter(
          (language) =>
            !selectedSongLanguageVersions[
              language
            ]
        ),
      [selectedSongLanguageVersions]
    )
  const linkExistingSongCandidates =
    useMemo(() => {
      if (
        !selectedSongFamilyId ||
        !showLinkExistingSongModal
      ) {
        return []
      }

      const searchValue =
        linkExistingSongForm.search
          .trim()
          .toLowerCase()
      const targetLanguage =
        linkExistingSongForm.language

      return songs
        .filter((song) => {
          const canonicalLanguage =
            normalizeLanguage(
              song.language
            )

          if (
            canonicalLanguage !==
            targetLanguage
          ) {
            return false
          }

          if (
            song.familyId ===
            selectedSongFamilyId
          ) {
            return false
          }

          if (!searchValue) {
            return true
          }

          const haystack = [
            song.title,
            song.author,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()

          return haystack.includes(
            searchValue
          )
        })
        .sort((left, right) => {
          const leftStandalone =
            getValidSongFamilyId(left) == null
          const rightStandalone =
            getValidSongFamilyId(right) ==
            null

          if (
            leftStandalone !==
            rightStandalone
          ) {
            return leftStandalone ? -1 : 1
          }

          return (
            left.title || ''
          ).localeCompare(
            right.title || ''
          )
        })
    }, [
      linkExistingSongForm.language,
      linkExistingSongForm.search,
      selectedSongFamilyId,
      showLinkExistingSongModal,
      songs,
    ])

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

        if (response.status === 404) {
          // A stale family link is optional metadata; keep the base song usable.
          return
        }

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
    loadSelectedSongMelodyReference(
      selectedSongResolved?.id
    )
  }, [
    selectedSongResolved?.id,
    selectedSongResolved?.familyId,
  ])

  useEffect(() => {
    if (activeView === 'songs') {
      return
    }

    stopMelodyReferencePlayback({
      resetTime: true,
    })
  }, [activeView])

  useEffect(() => {
    stopMelodyReferencePlayback({
      resetTime: true,
    })
  }, [selectedSongResolved?.id])

  useEffect(() => {
    stopLearningAudio({
      resetTime: true,
    })
    setLearningAudioDuration(0)

    if (
      !isLearningModeEnabled ||
      !currentSongResolved?.id
    ) {
      setCurrentSongLearningReference(null)
      setIsLoadingCurrentSongLearningReference(
        false
      )
      return
    }

    loadCurrentSongLearningReference(
      currentSongResolved.id
    )
  }, [
    isLearningModeEnabled,
    currentSongResolved?.id,
    currentSongResolved?.familyId,
  ])

  useEffect(() => {
    if (activeView === 'operator') {
      return
    }

    stopLearningAudio({
      resetTime: true,
    })
  }, [activeView])

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
    if (!selectedBibleBook) {
      setSelectedBibleChapterMetadata(
        null
      )
      return
    }

    loadBibleChapterMetadata(
      {
        bookKey: bibleSelection.bookKey,
        chapter: bibleSelection.chapter,
      },
      referenceBibleTranslationCode
    )
  }, [
    referenceBibleTranslationCode,
    bibleSelection.bookKey,
    bibleSelection.chapter,
    selectedBibleBook,
  ])

  useEffect(() => {
    if (isProjectorWindow) {
      return
    }

    const nextProjectorState =
      createProjectorState({
        song: liveProjectionSong,
        sectionIndex,
        projectionContentType,
        biblePassage:
          projectedBiblePassage,
        bibleVerseIndex:
          projectedBibleVerseIndex,
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
    projectionContentType,
    projectionSettings,
    projectionMode,
    projectedBiblePassage,
    projectedBibleVerseIndex,
    liveProjectionSong,
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

  function handleLinkExistingSongChange(
    event
  ) {
    const { name, value } = event.target

    setLinkExistingSongForm((current) => ({
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

  function closeLinkExistingSongModal() {
    setShowLinkExistingSongModal(false)
    setLinkExistingSongTargetFamilyId(null)
    setLinkExistingSongForm(
      createLinkExistingSongForm()
    )
  }

  function syncFamilyVersionsState(
    familyVersionsResponse
  ) {
    const familyId =
      familyVersionsResponse?.familyId

    if (!familyId) {
      return
    }

    setFamilyVersionsByFamilyId(
      (current) => ({
        ...current,
        [familyId]: familyVersionsResponse,
      })
    )
    setFamilyVersionsErrorByFamilyId(
      (current) => ({
        ...current,
        [familyId]: '',
      })
    )
    setFamilyVersionsLoadingByFamilyId(
      (current) => ({
        ...current,
        [familyId]: false,
      })
    )
  }

  function syncSongsAfterFamilyUpdate(
    updatedSongs,
    targetSelectedSongId = null
  ) {
    setSongs((current) =>
      mergeSongsById(current, updatedSongs)
    )

    if (targetSelectedSongId != null) {
      const nextSelectedSong =
        updatedSongs.find(
          (song) =>
            song?.id === targetSelectedSongId
        ) || null

      if (nextSelectedSong) {
        setSelectedSong(nextSelectedSong)
      }

      if (
        currentSong?.id ===
        targetSelectedSongId &&
        nextSelectedSong
      ) {
        setCurrentSong(nextSelectedSong)
      }

      if (
        projectionSong?.id ===
          targetSelectedSongId &&
        nextSelectedSong
      ) {
        setProjectionSong(nextSelectedSong)
      }
    }
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

  function openLinkedFamilySong(
    song
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
    setPendingSongsScrollId(
      resolvedSong.id
    )
  }

  function openLinkExistingSongModal() {
    if (!selectedSongFamilyId) {
      return
    }

    setLinkExistingSongTargetFamilyId(
      selectedSongFamilyId
    )
    setLinkExistingSongForm(
      createLinkExistingSongForm(
        selectedSongMissingFamilyLanguages[0] ||
          selectedSongAvailableFamilyLanguages[0] ||
          'ENGLISH'
      )
    )
    setShowLinkExistingSongModal(true)
  }

  async function createOrManageSongFamily() {
    if (!selectedSongResolved?.id) {
      return
    }

    try {
      setError('')

      const response = await fetch(
        `http://localhost:8080/song-families/from-song/${selectedSongResolved.id}`,
        {
          method: 'POST',
        }
      )

      if (!response.ok) {
        const message =
          await readErrorMessage(response)

        throw new Error(
          message ||
            'Failed to create song family'
        )
      }

      const familyVersions =
        await response.json()
      const updatedSongs = Object.values(
        familyVersions?.versions || {}
      ).filter(Boolean)

      syncFamilyVersionsState(
        familyVersions
      )
      syncSongsAfterFamilyUpdate(
        updatedSongs,
        selectedSongResolved.id
      )
      setSuccessMessage(
        'Song Family is ready to manage.'
      )
    } catch (err) {
      setError(err.message)
    }
  }

  async function linkExistingSongToFamily(
    song
  ) {
    if (
      !linkExistingSongTargetFamilyId ||
      !song?.id
    ) {
      return
    }

    try {
      setError('')

      const response = await fetch(
        `http://localhost:8080/song-families/${linkExistingSongTargetFamilyId}/songs/${song.id}`,
        {
          method: 'POST',
        }
      )

      if (!response.ok) {
        const message =
          await readErrorMessage(response)

        throw new Error(
          message ||
            'Failed to link song to family'
        )
      }

      const familyVersions =
        await response.json()
      const updatedSongs = Object.values(
        familyVersions?.versions || {}
      ).filter(Boolean)
      const selectedSongId =
        selectedSongResolved?.id ?? null

      syncFamilyVersionsState(
        familyVersions
      )
      syncSongsAfterFamilyUpdate(
        updatedSongs,
        selectedSongId
      )
      setSuccessMessage(
        `"${song.title}" linked to the Song Family.`
      )
      closeLinkExistingSongModal()
    } catch (err) {
      setError(err.message)
    }
  }

  async function unlinkSongFromFamily(
    song
  ) {
    const familyId =
      getValidSongFamilyId(song)

    if (!familyId || !song?.id) {
      return
    }

    const shouldUnlink = window.confirm(
      `Unlink "${song.title}" from this Song Family?\n\nThe song will remain in the Song Library as a standalone ${getLanguageLabel(song.language)} song.`
    )

    if (!shouldUnlink) {
      return
    }

    try {
      setError('')

      const response = await fetch(
        `http://localhost:8080/song-families/${familyId}/songs/${song.id}`,
        {
          method: 'DELETE',
        }
      )

      if (!response.ok) {
        const message =
          await readErrorMessage(response)

        throw new Error(
          message ||
            'Failed to unlink song from family'
        )
      }

      const familyVersions =
        await response.json()
      const updatedStandaloneSong = {
        ...song,
        familyId: null,
      }
      const updatedSongs = [
        ...Object.values(
          familyVersions?.versions || {}
        ),
        updatedStandaloneSong,
      ].filter(Boolean)
      const selectedSongId =
        selectedSongResolved?.id === song.id
          ? song.id
          : selectedSongResolved?.id ?? null

      syncFamilyVersionsState(
        familyVersions
      )
      syncSongsAfterFamilyUpdate(
        updatedSongs,
        selectedSongId
      )
      setSuccessMessage(
        `"${song.title}" is now a standalone song.`
      )
    } catch (err) {
      setError(err.message)
    }
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

      setSuccessMessage(
        `Updated "${updatedSong.title}".`
      )
      closeEditSongModal()
    } catch (err) {
      setError(err.message)
    }
  }

  function openMelodyReferenceFilePicker() {
    if (!selectedSongResolved?.id) {
      return
    }

    melodyReferenceInputRef.current?.click()
  }

  async function handleMelodyReferenceFileSelected(
    event
  ) {
    const file =
      event.target.files?.[0] || null

    if (!file || !selectedSongResolved?.id) {
      event.target.value = ''
      return
    }

    try {
      setError('')

      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(
        `http://localhost:8080/songs/${selectedSongResolved.id}/melody-reference`,
        {
          method: 'POST',
          body: formData,
        }
      )

      if (!response.ok) {
        const message =
          await readErrorMessage(response)

        throw new Error(
          message ||
            'Could not upload the melody reference.'
        )
      }

      const melodyReference =
        await response.json()

      stopMelodyReferencePlayback({
        resetTime: true,
      })
      melodyReferenceRequestsRef.current.clear()
      setSelectedSongMelodyReference(
        melodyReference
      )
      setSuccessMessage(
        selectedSongMelodyReference
          ? 'Melody reference replaced successfully.'
          : 'Melody reference uploaded successfully.'
      )
    } catch (err) {
      setError(err.message)
    } finally {
      event.target.value = ''
    }
  }

  async function deleteSelectedSongMelodyReference() {
    if (
      !selectedSongResolved?.id ||
      !selectedSongMelodyReference
    ) {
      return
    }

    const shouldDelete = window.confirm(
      'Delete this song melody reference?\n\nThis removes the reference recording but does not delete the song or Song Family.'
    )

    if (!shouldDelete) {
      return
    }

    try {
      setError('')

      const response = await fetch(
        `http://localhost:8080/songs/${selectedSongResolved.id}/melody-reference`,
        {
          method: 'DELETE',
        }
      )

      if (!response.ok) {
        const message =
          await readErrorMessage(response)

        throw new Error(
          message ||
            'Could not delete the melody reference.'
        )
      }

      stopMelodyReferencePlayback({
        resetTime: true,
      })
      melodyReferenceRequestsRef.current.clear()
      setSelectedSongMelodyReference(null)
      setSuccessMessage(
        'Melody reference deleted.'
      )
    } catch (err) {
      setError(err.message)
    }
  }

  async function playSelectedSongMelodyReference() {
    if (!selectedSongMelodyReference) {
      return
    }

    const audio =
      melodyReferenceAudioRef.current

    if (!audio) {
      return
    }

    try {
      setError('')
      audio.currentTime = 0
      await audio.play()
    } catch (err) {
      setError(
        'Could not play the song melody reference.'
      )
    }
  }

  async function toggleLearningAudioPlayback() {
    const audio = learningAudioRef.current

    if (
      !audio ||
      !currentSongLearningReference
    ) {
      return
    }

    try {
      setError('')

      if (audio.paused) {
        await audio.play()
        return
      }

      audio.pause()
    } catch (err) {
      setError(
        'Could not play the reference audio.'
      )
    }
  }

  async function restartLearningAudio() {
    const audio = learningAudioRef.current

    if (
      !audio ||
      !currentSongLearningReference
    ) {
      return
    }

    try {
      setError('')
      audio.currentTime = 0
      setLearningAudioCurrentTime(0)
      await audio.play()
    } catch (err) {
      setError(
        'Could not restart the reference audio.'
      )
    }
  }

  function handleLearningAudioSeek(event) {
    const nextTime = Number(
      event.target.value
    )
    const audio = learningAudioRef.current

    setLearningAudioCurrentTime(nextTime)

    if (!audio) {
      return
    }

    audio.currentTime = nextTime
  }

  function handleLearningAudioVolumeChange(
    event
  ) {
    const nextVolume = Number(
      event.target.value
    )
    const audio = learningAudioRef.current

    setLearningAudioVolume(nextVolume)

    if (!audio) {
      return
    }

    audio.volume = nextVolume
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
        const remainingPlaylists = playlists.filter(
          (playlist) =>
            playlist.id !== target.playlist.id
        )

        setPlaylists(remainingPlaylists)
        setOpenedPlaylistId((current) =>
          current === target.playlist.id
            ? null
            : current
        )
        setManagedPlaylistId((current) =>
          current === target.playlist.id
            ? null
            : current
        )
        setPrioritizedManagedPlaylistId(
          (current) =>
            current === target.playlist.id
              ? null
              : current
        )

        if (
          remainingPlaylists.length === 0 ||
          selectedPlaylist?.id === target.playlist.id
        ) {
          clearOperatorPlaylistContext()
        }

        if (remainingPlaylists.length === 0) {
          clearLiveProjectionLyrics()
        }
      } else {
        initializeFreshSessionDefaults()
      }
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

      const reusedWorkingPlaylist =
        await response.json()
      const playlistsResponse = await fetch(
        'http://localhost:8080/playlists'
      )

      if (!playlistsResponse.ok) {
        throw new Error(
          'Failed to refresh playlists after reusing service'
        )
      }

      const refreshedPlaylists =
        await playlistsResponse.json()
      const workingPlaylist =
        refreshedPlaylists.find(
          (playlist) =>
            playlist.id ===
            reusedWorkingPlaylist.id
        ) || reusedWorkingPlaylist

      setPlaylists(refreshedPlaylists)
      setManagedPlaylistId(workingPlaylist.id)
      setPrioritizedManagedPlaylistId(
        workingPlaylist.id
      )
      activatePlaylistInConsole(workingPlaylist)
      setShowReuseServiceModal(false)
      setActiveView('operator')
      setSuccessMessage(
        `Created a new working service from "${selectedHistoryServicePlan.serviceName}" for ${formatFullDateLabel(workingPlaylist.serviceDate)}.`
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
      createSavedPlaylistForm(
        {},
        appSettings.defaultServiceType
      )
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
      }, appSettings.defaultServiceType)
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
    activatePlaylistInConsole(
      playlistToActivate
    )
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

      if (
        remainingPlaylists.length === 0 ||
        selectedPlaylist?.id === managedPlaylist.id
      ) {
        clearOperatorPlaylistContext()
      }

      if (remainingPlaylists.length === 0) {
        clearLiveProjectionLyrics()
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

    activatePlaylistInConsole(
      todayWorkingPlaylist
    )
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
      const nextWorkingPlaylist =
        refreshedPlaylists.find(
          (playlist) =>
            playlist.id === workingPlaylist.id
        ) || workingPlaylist

      setPlaylists(refreshedPlaylists)
      activatePlaylistInConsole(
        nextWorkingPlaylist
      )
      setOpenedPlaylistId(
        refreshedReusablePlaylists.find(
          (playlist) =>
            playlist.id ===
            useForTodaySourcePlaylist.id
        )?.id ||
          refreshedReusablePlaylists[0]?.id ||
          null
      )
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
    const preparedSong =
      currentSongResolved || song

    setCurrentSong(preparedSong)
    setProjectionContentType(
      PROJECTION_CONTENT_TYPES.SONG
    )
    setProjectedBiblePassage(null)
    setProjectedBibleVerseIndex(0)
    setProjectionSong(preparedSong)
    setSectionIndex(
      currentSongSectionIndex
    )
    setProjectionMode('LIVE')
  }

  function selectPlaylistSong(song) {
    if (!song) {
      return
    }

    const nextSong =
      resolveOperatorPreviewSong(song, {
        applySessionDefaults:
          shouldApplySessionDefaults(
            currentSongSourceId
          ),
      })

    setOperatorPreviewSong(nextSong, {
      currentSectionIndex: 0,
      sourceSongId: song.id,
    })
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
        currentSongSectionIndex
      )

    setCurrentSongLanguageNotice('')
    setSelectedSong(resolvedSong)
    setCurrentSong(resolvedSong)
    setCurrentSongSectionIndex(
      nextSectionIndex
    )
    setCurrentSongSourceId(
      resolvedSong.id
    )
    setProjectionContentType(
      PROJECTION_CONTENT_TYPES.SONG
    )
    setProjectedBiblePassage(null)
    setProjectedBibleVerseIndex(0)
    setProjectionSong(resolvedSong)
    setSectionIndex(nextSectionIndex)
  }

  function showLyrics() {
    setProjectionMode('LIVE')
  }

  function clearLiveProjectionLyrics() {
    if (projectionMode === 'BLACK') {
      previousVisibleModeRef.current = 'CLEAR'
      return
    }

    setProjectionMode('CLEAR')
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

    if (projectionMode === 'CLEAR') {
      setProjectionMode('LIVE')
      return
    }

    clearLiveProjectionLyrics()
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
    if (
      previewProjectionContentType ===
      PROJECTION_CONTENT_TYPES.BIBLE
    ) {
      if (projectedBibleVerseIndex > 0) {
        setProjectedBibleVerseIndex(
          (current) => current - 1
        )
        setProjectionMode((currentMode) =>
          getNavigationProjectionMode(
            currentMode
          )
        )
      }

      return
    }

    moveOperatorPreviewSection(-1)
  }

  function nextSection() {
    if (
      previewProjectionContentType ===
      PROJECTION_CONTENT_TYPES.BIBLE
    ) {
      if (
        projectedBibleVerseIndex <
        (projectedBiblePassage?.verses
          ?.length || 0) -
          1
      ) {
        setProjectedBibleVerseIndex(
          (current) => current + 1
        )
        setProjectionMode((currentMode) =>
          getNavigationProjectionMode(
            currentMode
          )
        )
      }

      return
    }

    moveOperatorPreviewSection(1)
  }

  function moveOperatorPreviewSection(direction) {
    const nextSectionIndex =
      currentSongSectionIndex + direction

    if (
      nextSectionIndex >= 0 &&
      nextSectionIndex < currentSongSections.length
    ) {
      selectOperatorPreviewSection(nextSectionIndex)
    }
  }

  function selectOperatorPreviewSection(
    nextSectionIndex
  ) {
    setCurrentSongSectionIndex(nextSectionIndex)

    if (!isCurrentSongLive) {
      return
    }

    const liveSectionIndex =
      liveProjectionSong?.id ===
      currentSongResolved?.id
        ? nextSectionIndex
        : findMatchingSectionIndex(
            currentSongResolved,
            liveProjectionSong,
            nextSectionIndex
          )

    setSectionIndex(liveSectionIndex)
    setProjectionMode((currentMode) =>
      getNavigationProjectionMode(currentMode)
    )
  }

  function openProjectorWindow() {
    if (typeof window === 'undefined') {
      return
    }

    const nextProjectorState =
      createProjectorState({
        song: liveProjectionSong,
        sectionIndex,
        projectionContentType,
        biblePassage:
          projectedBiblePassage,
        bibleVerseIndex:
          projectedBibleVerseIndex,
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

      if (
        event.key === 'ArrowDown' ||
        event.key === 'ArrowUp'
      ) {
        const didScroll = scrollOperatorContent(
          event.key === 'ArrowDown' ? 1 : -1
        )

        if (didScroll) {
          event.preventDefault()
        }

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
        projectionContentType={
          projectorWindowState.projectionContentType
        }
        biblePassage={
          projectorWindowState.projectedBiblePassage
        }
        bibleVerseIndex={
          projectorWindowState.projectedBibleVerseIndex
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
            {appSettings.churchAbbreviation}
          </div>

          <div className="brand-copy">
            <h1>
              {appSettings.churchName}
            </h1>
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
              activeView === 'bible'
                ? 'side-link active'
                : 'side-link'
            }
            onClick={() =>
              setActiveView('bible')
            }
          >
            <span className="nav-icon">
              📖
            </span>

            Bible
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

                <AppScrollArea
                  className="song-list-shell"
                  viewportClassName="song-list"
                  dependencyKey={`${activeView}-${filteredSongs.length}-${typeFilter}-${search}`}
                >
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
                </AppScrollArea>
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
                      ref={playlistSelectorRef}
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

                        activatePlaylistInConsole(
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

                {consoleReuseSource && (
                  <div className="inline-note">
                    Reused from:{' '}
                    <strong>
                      {formatServiceOccurrenceName(
                        consoleReuseSource
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

                <AppScrollArea
                  className="service-song-list-shell"
                  viewportClassName="service-song-list"
                  dependencyKey={`${selectedPlaylist?.id || loadedServicePlan?.id || 'none'}-${playlistSongs.length}`}
                >
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
                </AppScrollArea>

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
                <AppScrollArea
                  className="song-detail-body-shell"
                  viewportClassName="song-detail-body"
                  viewportRef={
                    operatorContentViewportRef
                  }
                  dependencyKey={`operator-preview-${currentSongResolved?.id || 'none'}-${previewProjectionContentType}-${projectionMode}`}
                >
                <div className="console-card current-song-card">
                  <div className="current-heading">
                    <div>
                      <p className="card-kicker">
                        Current Song
                      </p>

                      <h3>
                        {currentSongResolved?.title ||
                          currentSong?.title ||
                          'Select a song'}
                      </h3>

                      {(currentSongResolved ||
                        currentSong) && (
                        <p className="author">
                          {currentSongResolved?.author ||
                            currentSong?.author ||
                            'Unknown author'}
                        </p>
                      )}
                    </div>

                    {getSongTypeBadge(
                      currentSongResolved?.songType ||
                        currentSong?.songType
                    ) && (
                      <span
                        className={
                          getSongTypeBadge(
                            currentSongResolved?.songType ||
                              currentSong?.songType
                          ).className
                        }
                      >
                        {
                          getSongTypeBadge(
                            currentSongResolved?.songType ||
                              currentSong?.songType
                          ).label
                        }
                      </span>
                    )}
                  </div>

                  <div className="learning-mode-panel">
                    <div className="learning-mode-header">
                      <div className="learning-mode-copy-wrap">
                        <p className="small-title">
                          Learning Mode
                        </p>
                        <p className="learning-mode-copy">
                          Play reference audio
                          locally while lyrics and
                          projection stay in their
                          normal worship flow.
                        </p>
                      </div>

                      <button
                        type="button"
                        className={`button ${
                          isLearningModeEnabled
                            ? 'button-primary'
                            : 'button-secondary'
                        } button-compact`}
                        onClick={() => {
                          setError('')
                          setIsLearningModeEnabled(
                            (current) => !current
                          )
                        }}
                        aria-pressed={
                          isLearningModeEnabled
                        }
                      >
                        {isLearningModeEnabled
                          ? 'Learning Mode On'
                          : 'Learning Mode Off'}
                      </button>
                    </div>

                    {isLearningModeEnabled && (
                      <>
                        {!currentSongResolved ? (
                          <div className="inline-note learning-mode-note">
                            Select a song to use
                            Learning Mode.
                          </div>
                        ) : isLoadingCurrentSongLearningReference ? (
                          <div className="inline-note learning-mode-note">
                            Loading reference
                            audio…
                          </div>
                        ) : currentSongLearningReference ? (
                          <div className="learning-audio-player">
                            <audio
                              ref={learningAudioRef}
                              className="learning-audio-element"
                              preload="metadata"
                              src={getMelodyReferenceAudioUrl(
                                currentSongLearningReference
                              )}
                              onLoadedMetadata={(
                                event
                              ) => {
                                event.currentTarget.volume =
                                  learningAudioVolume
                                setLearningAudioDuration(
                                  event.currentTarget
                                    .duration || 0
                                )
                                setLearningAudioCurrentTime(
                                  event.currentTarget
                                    .currentTime || 0
                                )
                              }}
                              onTimeUpdate={(
                                event
                              ) => {
                                setLearningAudioCurrentTime(
                                  event.currentTarget
                                    .currentTime || 0
                                )
                              }}
                              onPlay={() =>
                                setIsLearningAudioPlaying(
                                  true
                                )
                              }
                              onPause={() =>
                                setIsLearningAudioPlaying(
                                  false
                                )
                              }
                              onEnded={() => {
                                setIsLearningAudioPlaying(
                                  false
                                )
                                if (
                                  learningAudioRef.current
                                ) {
                                  learningAudioRef.current.currentTime =
                                    0
                                }
                                setLearningAudioCurrentTime(
                                  0
                                )
                              }}
                            />

                            <div className="learning-audio-actions">
                              <button
                                type="button"
                                className="button button-secondary button-compact"
                                onClick={
                                  toggleLearningAudioPlayback
                                }
                              >
                                {isLearningAudioPlaying
                                  ? 'Pause'
                                  : 'Play'}
                              </button>

                              <button
                                type="button"
                                className="button button-secondary button-compact"
                                onClick={
                                  restartLearningAudio
                                }
                              >
                                Restart
                              </button>
                            </div>

                            <div className="learning-audio-timeline">
                              <span>
                                {formatAudioTime(
                                  learningAudioCurrentTime
                                )}
                              </span>

                              <input
                                type="range"
                                min="0"
                                max={Math.max(
                                  learningAudioDuration,
                                  0
                                )}
                                step="0.1"
                                value={Math.min(
                                  learningAudioCurrentTime,
                                  learningAudioDuration ||
                                    0
                                )}
                                onChange={
                                  handleLearningAudioSeek
                                }
                              />

                              <span>
                                {formatAudioTime(
                                  learningAudioDuration
                                )}
                              </span>
                            </div>

                            <div className="learning-audio-volume">
                              <span>Volume</span>

                              <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.01"
                                value={
                                  learningAudioVolume
                                }
                                onChange={
                                  handleLearningAudioVolumeChange
                                }
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="inline-note learning-mode-note">
                            No reference audio
                            attached to this song.
                          </div>
                        )}
                      </>
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
                            {currentSongSections.map(
                              (
                                section,
                                index
                              ) => (
                                <button
                                  key={`${section.name}-${index}`}
                                  className={
                                    currentSongSectionIndex ===
                                    index
                                      ? 'section-pill active'
                                      : 'section-pill'
                                  }
                                  onClick={() => {
                                    selectOperatorPreviewSection(
                                      index
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
                      {stagedProjectorContentType ===
                      PROJECTION_CONTENT_TYPES.BIBLE
                        ? currentBibleVerse
                          ? `${projectedBiblePassage.reference} · Verse ${currentBibleVerse.verseNumber}`
                          : projectedBiblePassage?.reference ||
                            'Bible Passage'
                        : projectorPreviewSection?.name ||
                          'Ready'}
                    </strong>
                  </div>

                  <div className="preview-header-actions">
                    {stagedProjectorContentType ===
                    PROJECTION_CONTENT_TYPES.BIBLE ? (
                      <div className="current-actions">
                        <button
                          className="button button-secondary"
                          onClick={
                            returnToSongProjection
                          }
                        >
                          Return to Song
                        </button>
                      </div>
                    ) : (
                      currentSong && (
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
                      )
                    )}

                    <div className="live-indicator">
                      <span className="green-dot" />

                      {projectionMode}
                    </div>
                  </div>
                </div>

                <ProjectorDisplay
                  song={stagedProjectorSong}
                  sectionIndex={
                    stagedProjectorSectionIndex
                  }
                  projectionContentType={
                    stagedProjectorContentType
                  }
                  biblePassage={
                    projectedBiblePassage
                  }
                  bibleVerseIndex={
                    projectedBibleVerseIndex
                  }
                  projectionMode={
                    stagedProjectorPreviewMode
                  }
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
                    {previewProjectionContentType ===
                    PROJECTION_CONTENT_TYPES.BIBLE
                      ? '← Previous Verse'
                      : '← Previous'}
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
                    {previewProjectionContentType ===
                    PROJECTION_CONTENT_TYPES.BIBLE
                      ? 'Next Verse →'
                      : 'Next →'}
                  </button>
                </div>

                <p className="projection-shortcuts-hint">
                  Shortcuts: `←` previous, `→` or `Space` next, `B` black, `C` clear lyrics.
                </p>
                </AppScrollArea>
              </section>
            </div>
          </div>
        )}

        {activeView === 'bible' && (
          <div className="admin-view bible-view">
            <header className="service-header">
              <div>
                <p className="page-kicker">
                  Bible Projection
                </p>

                <h2>Bible</h2>

                <p className="header-description">
                  Select a passage, preview it,
                  and send it to the projector
                  without interrupting the
                  current service plan.
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

            <div className="bible-grid">
              <section className="console-card bible-selection-card">
                <div className="card-header">
                  <div>
                    <p className="card-kicker">
                      Passage Selection
                    </p>

                    <h3>Select Reference</h3>
                  </div>
                </div>

                <div className="bible-form-grid">
                  <div className="bible-form-field bible-reference-language-field">
                    <span>Bible Language</span>

                    <div className="bible-reference-language-pills">
                      {bibleTranslations.map(
                        (translation) => (
                          <button
                            key={translation.code}
                            type="button"
                            className={[
                              'bible-reference-language-pill',
                              referenceBibleTranslationCode ===
                              translation.code
                                ? 'active'
                                : '',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                            onClick={() =>
                              handleReferenceBibleTranslationChange(
                                translation.code
                              )
                            }
                          >
                            {getBibleReferenceTranslationLabel(
                              translation
                            )}
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  <label className="bible-form-field">
                    <span>Book</span>
                    <select
                      value={
                        bibleSelection.bookKey
                      }
                      onChange={
                        handleBibleBookChange
                      }
                      disabled={
                        bibleBooks.length === 0
                      }
                    >
                      {bibleBooks.map((book) => (
                        <option
                          key={book.key}
                          value={book.key}
                        >
                          {getBibleBookDisplayName(
                            book.key,
                            book.name
                          )}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="bible-form-field">
                    <span>Chapter</span>
                    <select
                      value={
                        bibleSelection.chapter
                      }
                      onChange={
                        handleBibleChapterChange
                      }
                      disabled={
                        !selectedBibleBook
                      }
                    >
                      {selectedBibleChapterOptions.map(
                        (chapter) => (
                          <option
                            key={chapter}
                            value={chapter}
                          >
                            {chapter}
                          </option>
                        )
                      )}
                    </select>
                  </label>

                  <label className="bible-form-field">
                    <span>Start Verse</span>
                    <select
                      value={
                        bibleSelection.startVerse
                      }
                      onChange={
                        handleBibleStartVerseChange
                      }
                      disabled={
                        selectedBibleVerseCount ===
                        0
                      }
                    >
                      {selectedBibleVerseOptions.map(
                        (verse) => (
                          <option
                            key={verse}
                            value={verse}
                          >
                            {verse}
                          </option>
                        )
                      )}
                    </select>
                  </label>

                  <label className="bible-form-field">
                    <span>End Verse</span>
                    <select
                      value={
                        bibleSelection.endVerse
                      }
                      onChange={
                        handleBibleEndVerseChange
                      }
                      disabled={
                        selectedBibleVerseCount ===
                        0
                      }
                    >
                      {selectedBibleContiguousEndVerseOptions.map(
                        (verse) => (
                          <option
                            key={verse}
                            value={verse}
                          >
                            {verse}
                          </option>
                        )
                      )}
                    </select>
                  </label>
                </div>

                <div className="bible-selection-actions">
                  <button
                    className="button button-primary"
                    onClick={
                      previewBiblePassageSelection
                    }
                    disabled={
                      bibleBooks.length === 0
                    }
                  >
                    Preview Passage
                  </button>
                </div>
              </section>

              <section className="console-card bible-preview-card">
                {previewBiblePassage ? (
                  <>
                    <div className="bible-preview-sticky-header">
                      <div className="card-header bible-preview-card-header">
                        <div>
                          <p className="card-kicker">
                            Passage Preview
                          </p>

                          <h3>
                            {previewBiblePassage.reference}
                          </h3>
                        </div>

                        <div className="bible-preview-code-list">
                          {(
                            previewBiblePassage
                              .projectionMode ===
                            BIBLE_PROJECTION_MODES.FRENCH_ENGLISH
                              ? [
                                  BIBLE_TRANSLATION_CODES.FRENCH,
                                  BIBLE_TRANSLATION_CODES.ENGLISH,
                                ]
                              : [
                                  previewBiblePassage.translationCode,
                                ]
                          ).map((code) => (
                            <span
                              key={code}
                              className="number-pill"
                            >
                              {code}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="bible-preview-reference">
                        {previewBiblePassage.translationName}
                      </div>

                      <div className="bible-preview-selection-language">
                        Reference language:{' '}
                        <strong>
                          {selectedReferenceBibleTranslation
                            ? `${selectedReferenceBibleTranslation.name} (${selectedReferenceBibleTranslation.code})`
                            : referenceBibleTranslationCode}
                        </strong>
                      </div>
                    </div>

                    <AppScrollArea
                      className="bible-preview-verses-shell"
                      viewportClassName="bible-preview-verses"
                      dependencyKey={`${previewBiblePassage.reference}-${previewBiblePassage.verses.length}-${previewBiblePassage.translationCode}`}
                    >
                      {previewBiblePassage.verses.map(
                        (verse) => (
                          <p
                            key={`${previewBiblePassage.reference}-${verse.verseNumber}`}
                            className="bible-preview-verse"
                          >
                            <strong>
                              {
                                verse.verseNumber
                              }
                            </strong>

                            {previewBiblePassage.projectionMode ===
                            BIBLE_PROJECTION_MODES.FRENCH_ENGLISH ? (
                              <span className="bible-preview-verse-stack">
                                <span className="bible-preview-verse-text">
                                  {
                                    verse.primaryText
                                  }
                                </span>
                                <span className="bible-preview-verse-text secondary">
                                  {
                                    verse.secondaryText
                                  }
                                </span>
                              </span>
                            ) : (
                              <span className="bible-preview-verse-text">
                                {verse.text}
                              </span>
                            )}
                          </p>
                        )
                      )}
                    </AppScrollArea>

                    <div className="bible-preview-action-bar">
                      <div className="bible-live-control-header">
                        <div>
                          <p className="card-kicker">
                            Live Bible Controls
                          </p>

                          <strong className="bible-live-current-reference">
                            {liveBibleReference ||
                              previewBiblePassage.reference}
                          </strong>
                        </div>

                        <div className="bible-live-nav-buttons">
                          <button
                            className="button button-secondary"
                            onClick={
                              previousSection
                            }
                            disabled={
                              !isBibleProjectionActive ||
                              !canGoToPreviousProjection
                            }
                          >
                            ← Previous Verse
                          </button>

                          <button
                            className="button button-secondary"
                            onClick={nextSection}
                            disabled={
                              !isBibleProjectionActive ||
                              !canGoToNextProjection
                            }
                          >
                            Next Verse →
                          </button>
                        </div>
                      </div>

                      <div className="bible-preview-action-layout">
                        <div className="bible-projection-mode-control">
                          <p className="small-title">
                            Projection Language
                          </p>

                          <div className="bible-projection-mode-pills">
                            {BIBLE_PROJECTION_LANGUAGE_OPTIONS.map(
                              (option) => (
                                <button
                                  key={option.value}
                                  type="button"
                                  className={[
                                    'bible-projection-mode-pill',
                                    bibleProjectionMode ===
                                    option.value
                                      ? 'active'
                                      : '',
                                  ]
                                    .filter(Boolean)
                                    .join(' ')}
                                  onClick={() =>
                                    handleBibleProjectionModeChange(
                                      option.value
                                    )
                                  }
                                >
                                  {option.label}
                                </button>
                              )
                            )}
                          </div>
                        </div>

                        <div className="bible-selection-actions bible-preview-actions">
                          <button
                            className="button button-primary"
                            onClick={
                              projectBiblePassage
                            }
                          >
                            {isBibleProjectionActive
                              ? 'Update Projector'
                              : 'Send to Projector'}
                          </button>

                          {isBibleProjectionActive && (
                            <>
                              <button
                                className="button button-secondary"
                                onClick={
                                  returnToSongProjection
                                }
                              >
                                Return to Song
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {isBibleProjectionActive &&
                        currentBibleVerse && (
                          <p className="inline-note bible-live-note">
                            Projecting{' '}
                            <strong>
                              {liveBibleReference}
                            </strong>{' '}
                            using{' '}
                            <strong>
                              {
                                projectedBiblePassage.translationName
                              }
                            </strong>
                            .
                          </p>
                        )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="card-header bible-preview-card-header">
                      <div>
                        <p className="card-kicker">
                          Passage Preview
                        </p>

                        <h3>Choose a passage</h3>
                      </div>
                    </div>

                    <div className="empty-state bible-preview-empty">
                      Preview a Bible passage to
                      review it before projection.
                    </div>
                  </>
                )}
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

                <AppScrollArea
                  className="song-list-shell"
                  viewportClassName="song-list"
                  dependencyKey={`songs-admin-${filteredSongs.length}-${typeFilter}-${search}`}
                >
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
                </AppScrollArea>
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

                <AppScrollArea
                  className="song-detail-body-shell"
                  viewportClassName="song-detail-body"
                  dependencyKey={`song-detail-${selectedSongResolved?.id || 'none'}-${selectedSongUsageCount}`}
                >
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

                        <div className="section-status-actions">
                          <button
                            type="button"
                            className="button button-secondary button-compact"
                            onClick={() =>
                              openEditSongModal()
                            }
                            disabled={!selectedSong}
                          >
                            Edit Song
                          </button>

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
                          Song Family
                        </strong>

                        {selectedSongFamilyId ? (
                          <span>
                            {selectedSongFamilyDisplayName}{' '}
                            Family
                          </span>
                        ) : (
                          <span>
                            No family assigned
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

                      {!selectedSongFamilyId ? (
                        <div className="translation-availability-empty">
                          <p>
                            This song is currently
                            standalone.
                          </p>

                          <button
                            type="button"
                            className="button button-secondary button-compact"
                            onClick={
                              createOrManageSongFamily
                            }
                          >
                            Create / Manage Family
                          </button>
                        </div>
                      ) : (
                        <>
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
                                  ) ===
                                  language
                                const isAvailable =
                                  Boolean(
                                    languageSong
                                  )

                                return (
                                  <div
                                    key={`translation-availability-${language}`}
                                    className="translation-availability-row translation-availability-row-family"
                                  >
                                    <div className="translation-availability-copy">
                                      <strong>
                                        {getLanguageLabel(
                                          language
                                        )}
                                      </strong>

                                      <span>
                                        {isAvailable
                                          ? languageSong.title
                                          : 'Missing'}
                                      </span>

                                      <small>
                                        {isActive
                                          ? 'Active'
                                          : isAvailable
                                            ? 'Available'
                                            : 'Missing'}
                                      </small>
                                    </div>

                                    <div className="translation-availability-actions">
                                      {isAvailable ? (
                                        <>
                                          <button
                                            type="button"
                                            className="text-button"
                                            onClick={() =>
                                              openLinkedFamilySong(
                                                languageSong
                                              )
                                            }
                                          >
                                            Open
                                          </button>

                                          <button
                                            type="button"
                                            className="text-button text-button-danger"
                                            onClick={() =>
                                              unlinkSongFromFamily(
                                                languageSong
                                              )
                                            }
                                          >
                                            Unlink
                                          </button>
                                        </>
                                      ) : (
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
                                  </div>
                                )
                              }
                            )}
                          </div>

                          <div className="translation-availability-footer">
                            <button
                              type="button"
                              className="button button-secondary button-compact"
                              onClick={
                                openLinkExistingSongModal
                              }
                            >
                              Link Existing Song
                            </button>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="melody-reference-card">
                      <div className="melody-reference-header">
                        <strong>
                          Song Melody Reference
                        </strong>

                        {selectedSongMelodyReference ? (
                          <span>
                            {getMelodyReferenceSummary(
                              selectedSongMelodyReference
                            )}
                          </span>
                        ) : (
                          <span>
                            No melody reference uploaded
                          </span>
                        )}
                      </div>

                      <input
                        ref={
                          melodyReferenceInputRef
                        }
                        type="file"
                        accept=".mp3,.m4a,.wav,audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/wave"
                        className="background-upload-input"
                        onChange={
                          handleMelodyReferenceFileSelected
                        }
                      />

                      {isLoadingSelectedSongMelodyReference ? (
                        <div className="inline-note">
                          Loading melody reference…
                        </div>
                      ) : selectedSongMelodyReference ? (
                        <>
                          <div className="melody-reference-actions">
                            <button
                              type="button"
                              className="button button-secondary button-compact"
                              onClick={
                                playSelectedSongMelodyReference
                              }
                            >
                              ▶ Play Reference
                            </button>

                            <button
                              type="button"
                              className="button button-secondary button-compact"
                              onClick={
                                openMelodyReferenceFilePicker
                              }
                            >
                              Replace
                            </button>

                            <button
                              type="button"
                              className="button button-danger button-compact"
                              onClick={
                                deleteSelectedSongMelodyReference
                              }
                            >
                              Delete
                            </button>
                          </div>

                          <audio
                            ref={
                              melodyReferenceAudioRef
                            }
                            className="melody-reference-audio"
                            controls
                            preload="none"
                            src={getMelodyReferenceAudioUrl(
                              selectedSongMelodyReference
                            )}
                          />

                          <p className="melody-reference-meta">
                            {selectedSongMelodyReference.originalFilename}
                            {' · '}
                            {getLanguageLabel(
                              selectedSongMelodyReference.language
                            )}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="melody-reference-copy">
                            Upload a local MP3, M4A,
                            or WAV sample that helps
                            singers understand the
                            melody, rhythm, phrasing,
                            and lyric placement. Up
                            to 25 MB.
                          </p>

                          <div className="melody-reference-actions">
                            <button
                              type="button"
                              className="button button-secondary button-compact"
                              onClick={
                                openMelodyReferenceFilePicker
                              }
                            >
                              Upload Reference
                            </button>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="song-lyrics-preview">
                      {selectedSongResolved.lyrics ||
                        'No lyrics added yet.'}
                    </div>

                    <div className="detail-actions">
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
                        className="button button-danger"
                        disabled
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
                </AppScrollArea>
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

                <AppScrollArea
                  className="playlist-management-list-shell"
                  viewportClassName="playlist-management-list"
                  dependencyKey={`playlists-${filteredManagedPlaylists.length}-${playlistSearch}-${managedPlaylistId || 'none'}`}
                >
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
                </AppScrollArea>
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

                        <AppScrollArea
                          className="playlist-songs-list-shell"
                          viewportClassName="service-song-list playlist-songs-list"
                          dependencyKey={`managed-playlist-songs-${managedPlaylist?.id || 'none'}-${managedPlaylistSongs.length}`}
                        >
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
                        </AppScrollArea>
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

                        <AppScrollArea
                          className="playlist-library-song-list-shell"
                          viewportClassName="song-list playlist-library-song-list"
                          dependencyKey={`playlist-library-${managedPlaylist?.id || 'none'}-${filteredSongs.length}-${search}-${typeFilter}`}
                        >
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
                        </AppScrollArea>
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

                <AppScrollArea
                  className="playlist-management-list-shell"
                  viewportClassName="playlist-management-list service-history-list"
                  dependencyKey={`history-${completedServiceHistory.length}-${selectedHistoryServicePlanId || 'none'}`}
                >
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
                </AppScrollArea>
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

                        <AppScrollArea
                          className="playlist-songs-list-shell"
                          viewportClassName="service-song-list playlist-songs-list"
                          dependencyKey={`history-songs-${selectedHistoryServicePlan?.id || 'none'}-${(selectedHistoryServicePlan?.songs || []).filter((song) => song != null).length}`}
                        >
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
                        </AppScrollArea>
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
                  Application Settings
                </p>

                <h2>Settings</h2>

                <p className="header-description">
                  Manage your church profile
                  and the defaults used when a
                  new worship session starts.
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
                      Church Profile
                    </p>

                    <h3>Identity</h3>
                  </div>
                </div>

                <div className="settings-form">
                  <label className="settings-field">
                    <span className="settings-label">
                      Church Name
                    </span>

                    <input
                      name="churchName"
                      value={
                        settingsForm.churchName
                      }
                      onChange={
                        handleSettingsChange
                      }
                      type="text"
                    />
                  </label>

                  <label className="settings-field">
                    <span className="settings-label">
                      Church Abbreviation
                    </span>

                    <input
                      name="churchAbbreviation"
                      value={
                        settingsForm.churchAbbreviation
                      }
                      onChange={
                        handleSettingsChange
                      }
                      type="text"
                    />
                  </label>
                </div>
              </section>

              <section className="console-card">
                <div className="card-header">
                  <div>
                    <p className="card-kicker">
                      Projection Defaults
                    </p>

                    <h3>Future Sessions</h3>
                  </div>
                </div>

                <div className="settings-form">
                  <label className="settings-field">
                    <span className="settings-label">
                      Default Language
                    </span>

                    <select
                      name="defaultLanguage"
                      value={
                        settingsForm.defaultLanguage
                      }
                      onChange={
                        handleSettingsChange
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

                  <label className="settings-field">
                    <span className="settings-label">
                      Default Background
                    </span>

                    <select
                      name="defaultBackground"
                      value={
                        settingsForm.defaultBackground
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

                  <label className="settings-field">
                    <span className="settings-label">
                      Default Service Type
                    </span>

                    <select
                      name="defaultServiceType"
                      value={
                        settingsForm.defaultServiceType
                      }
                      onChange={
                        handleSettingsChange
                      }
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

                  <p className="settings-note">
                    These values are used as
                    safe starting defaults for
                    future sessions. Operators
                    can still change language,
                    background, and service type
                    during live use.
                  </p>

                  <div className="settings-actions">
                    <button
                      className="button button-primary"
                      onClick={
                        saveApplicationSettings
                      }
                      type="button"
                    >
                      Save Settings
                    </button>
                  </div>
                </div>
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
                  Song Administration
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

            <p className="settings-preview-copy">
              Update the selected song without
              creating a new record. The song ID
              and existing family/playlists stay
              the same.
            </p>

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

      {showLinkExistingSongModal && (
        <div className="modal-overlay">
          <div className="modal modal-wide">
            <div className="modal-heading">
              <div>
                <p className="card-kicker">
                  Song Family
                </p>

                <h2>
                  Link Existing Song
                </h2>
              </div>

              <button
                className="modal-close"
                onClick={
                  closeLinkExistingSongModal
                }
              >
                ×
              </button>
            </div>

            <div className="translation-editor-grid">
              <section className="translation-source-panel">
                <p className="translation-panel-kicker">
                  TARGET FAMILY
                </p>

                <div className="translation-source-block">
                  <span>Family</span>
                  <strong>
                    {
                      selectedSongFamilyDisplayName
                    }{' '}
                    Family
                  </strong>
                </div>

                <div className="translation-source-block">
                  <span>
                    Current versions
                  </span>
                  <div className="song-family-language-summary">
                    {SUPPORTED_SONG_LANGUAGES.map(
                      (language) => (
                        <div
                          key={`song-family-language-summary-${language}`}
                          className="song-family-language-pill"
                        >
                          <strong>
                            {getLanguageLabel(
                              language
                            )}
                          </strong>
                          <span>
                            {selectedSongLanguageVersions[
                              language
                            ]
                              ? 'Available'
                              : 'Missing'}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </section>

              <section className="translation-form-panel">
                <label>
                  Language

                  <select
                    name="language"
                    value={
                      linkExistingSongForm.language
                    }
                    onChange={
                      handleLinkExistingSongChange
                    }
                  >
                    {SUPPORTED_SONG_LANGUAGES.map(
                      (language) => (
                        <option
                          key={`link-language-${language}`}
                          value={language}
                        >
                          {getLanguageLabel(
                            language
                          )}
                        </option>
                      )
                    )}
                  </select>
                </label>

                <label>
                  Search Existing Songs

                  <input
                    name="search"
                    value={
                      linkExistingSongForm.search
                    }
                    onChange={
                      handleLinkExistingSongChange
                    }
                    placeholder="Search by title or author"
                  />
                </label>

                <div className="link-existing-song-results">
                  {linkExistingSongCandidates.map(
                    (song) => {
                      const songFamilyId =
                        getValidSongFamilyId(
                          song
                        )
                      const canLink =
                        songFamilyId == null

                      return (
                        <div
                          key={`link-existing-song-${song.id}`}
                          className="link-existing-song-row"
                        >
                          <div className="translation-availability-copy">
                            <strong>
                              {song.title}
                            </strong>

                            <span>
                              {getLanguageLabel(
                                song.language
                              )}
                            </span>

                            <small>
                              {songFamilyId
                                ? `Already in Family ${songFamilyId}`
                                : 'Standalone'}
                            </small>
                          </div>

                          <button
                            type="button"
                            className="button button-secondary button-compact"
                            disabled={!canLink}
                            title={
                              canLink
                                ? ''
                                : 'This song already belongs to another Song Family.'
                            }
                            onClick={() =>
                              linkExistingSongToFamily(
                                song
                              )
                            }
                          >
                            Link
                          </button>
                        </div>
                      )
                    }
                  )}

                  {linkExistingSongCandidates.length ===
                    0 && (
                    <div className="empty-state">
                      No matching songs found
                      for{' '}
                      {getLanguageLabel(
                        linkExistingSongForm.language
                      )}
                      .
                    </div>
                  )}
                </div>
              </section>
            </div>

            <div className="modal-buttons">
              <button
                className="button button-secondary"
                onClick={
                  closeLinkExistingSongModal
                }
              >
                Cancel
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
                    activatePlaylistInConsole(
                      selectedSongWorkingPlaylists[0]
                    )
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
