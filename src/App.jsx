import NetworkAccessPanel from './NetworkAccessPanel'
import { createNetworkProjector, projectorId, networkBackgroundFile } from './networkProjector'
import { API_BASE_URL } from './apiOrigin'
import { createProjectorStartupGate, projectorAppearanceState } from './projectorStartup'
import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import './App.css'
import './responsive.css'
import NotesPanel from './NotesPanel'
import NoteProjector from './NoteProjector'
import BibleProjector from './BibleProjector'
import { findCreoleTranslation, contiguousVerseRanges } from './bibleProjectorBlocks'
import { nextNoteNavigation } from './noteScroll'
import { selectedEvents, liveVerseIndex, noteValidation } from './operatorFeatures'
import { birthdayDateLabel } from './birthdayDates'
import { keyboardShortcut, presentationMode } from './projectorKeyboard'
import { readImageTextTheme } from './projectorTextTheme'
import { announceProjectorReady, createProjectorConnection } from './projectorConnection'
import { formatEventDateRange, isUpcomingEvent, validateEventDates } from './eventDates'
import {
  loadBackgroundImage,
  loadLatestBackgroundImage,
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
  { id: 'black', textTheme: 'light', name: 'Black', swatchClassName: 'background-swatch background-swatch-black' },
  {
    id: 'sky-field',
    textTheme: 'dark',
    name: 'Sky Field',
    swatchClassName:
      'background-swatch background-swatch-sky-field',
  },
  {
    id: 'sunrise',
    textTheme: 'dark',
    name: 'Sunrise',
    swatchClassName:
      'background-swatch background-swatch-sunrise',
  },
  {
    id: 'deep-blue',
    textTheme: 'light',
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
  TRILINGUAL: 'TRILINGUAL',
}

const BIBLE_PROJECTION_LANGUAGE_OPTIONS = [
  { value: BIBLE_PROJECTION_MODES.TRILINGUAL, label: 'English + Français + Kreyòl' },
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
  EVENT: 'EVENT',
  NOTE: 'NOTE',
}

const EVENTS_PER_PAGE = 4
const BIRTHDAYS_PER_PAGE = 8
const BIRTHDAY_LIST = 'BIRTHDAY_LIST'
const MONTH_NAMES = Array.from({ length: 12 }, (_, index) =>
  new Date(2000, index, 1).toLocaleString('en-US', { month: 'long' }))

function isBirthdayList(event) {
  return event?.eventType === BIRTHDAY_LIST
}

function sortBirthdays(entries = []) {
  return [...entries].sort((a, b) => a.day - b.day || a.name.localeCompare(b.name))
}

function eventPageCount(events) {
  return isBirthdayList(events[0])
    ? Math.ceil((events[0].birthdayEntries?.length || 0) / BIRTHDAYS_PER_PAGE)
    : Math.ceil(events.length / EVENTS_PER_PAGE)
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
  creolePassage,
  referenceTranslationCode,
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

  if (mode === BIBLE_PROJECTION_MODES.TRILINGUAL && (!hasFrench || !hasEnglish || !creolePassage?.verses?.length)) return null
  const effectiveMode =
    mode === BIBLE_PROJECTION_MODES.TRILINGUAL ? mode : mode === BIBLE_PROJECTION_MODES.ENGLISH
      ? BIBLE_PROJECTION_MODES.ENGLISH
      : mode ===
            BIBLE_PROJECTION_MODES.SPANISH
        ? BIBLE_PROJECTION_MODES.SPANISH
      : mode === BIBLE_PROJECTION_MODES.FRENCH
        ? BIBLE_PROJECTION_MODES.FRENCH
        : BIBLE_PROJECTION_MODES.FRENCH_ENGLISH

  const referencePassage =
    referenceTranslationCode ===
    BIBLE_TRANSLATION_CODES.ENGLISH
      ? englishPassage
      : referenceTranslationCode ===
            BIBLE_TRANSLATION_CODES.SPANISH
        ? spanishPassage
        : frenchPassage
  const sourcePassage =
    referencePassage ||
    (effectiveMode ===
    BIBLE_PROJECTION_MODES.ENGLISH
      ? englishPassage || frenchPassage
      : effectiveMode ===
            BIBLE_PROJECTION_MODES.SPANISH
        ? spanishPassage ||
          frenchPassage ||
          englishPassage
      : frenchPassage || englishPassage)
  let verseNumbers = (
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

  const creoleVerses = new Map((creolePassage?.verses || []).map(verse => [verse.verseNumber, verse.text]))
  if (effectiveMode === BIBLE_PROJECTION_MODES.TRILINGUAL) verseNumbers = verseNumbers.filter(n => englishVersesByNumber[n]?.text && frenchVersesByNumber[n]?.text && creoleVerses.get(n))
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
        ...(effectiveMode === BIBLE_PROJECTION_MODES.TRILINGUAL ? { creoleText: creoleVerses.get(verseNumber) } : {}),
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
    referenceTranslationCode,
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
      effectiveMode === BIBLE_PROJECTION_MODES.TRILINGUAL ? `${englishPassage.translationCode}+${BIBLE_TRANSLATION_CODES.FRENCH}+${creolePassage.translationCode}` :
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
      effectiveMode === BIBLE_PROJECTION_MODES.TRILINGUAL ? [englishPassage.translationName, frenchPassage.translationName, creolePassage.translationName].filter(Boolean).join(' + ') :
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
      HAITIAN_CREOLE: creolePassage || null,
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

const EVENT_TYPE_OPTIONS = [
  'SERVICE',
  'MEETING',
  'YOUTH',
  'CONFERENCE',
  'SPECIAL_EVENT',
  'OTHER',
]

const EVENT_COLOR_PALETTE = [
  ['Black', '#000000'], ['White', '#FFFFFF'], ['Dark Blue', '#183A65'],
  ['Royal Blue', '#2563EB'], ['Red', '#C62828'], ['Burgundy', '#800020'],
  ['Purple', '#8B3A8B'], ['Magenta', '#C026D3'], ['Green', '#15803D'],
  ['Gold', '#B8860B'],
]

function createBlankEventForm() {
  return {
    title: '', eventDate: '', endDate: '', startTime: '', endTime: '',
    birthdayMonth: new Date().getMonth() + 1, displayYear: '', birthdayEntries: [],
    hostName: '', location: '', description: '', eventType: '',
    titleColor: '#000000', dateColor: '#8B3A8B', detailsColor: '#000000',
    titleBold: false, titleUnderline: false, titleItalic: false,
    dateBold: true, dateUnderline: true, dateItalic: false,
    detailsBold: false, detailsUnderline: false, detailsItalic: false,
  }
}

function getLocalIsoDate() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
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

  return `${API_BASE_URL}${audioPath}`
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
  event = null,
  events = [],
  eventPageIndex = 0,
  note = '',
  noteHeading = {},
  noteNavigation = [],
  eventSnapshotVersion = 0,
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
    projectedEvent: event || null,
    projectedEvents: events || [],
    projectedEventPageIndex: eventPageIndex,
    projectedNote: note,
    projectedNoteHeading: noteHeading,
    noteNavigation,
    ...(projectionContentType === PROJECTION_CONTENT_TYPES.EVENT ? { eventSnapshotVersion } : {}),
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
  deferResize = false,
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

    let resizeFrame
    const resizeObserver = new ResizeObserver(() => {
      if (!deferResize) { fitText(); return }
      cancelAnimationFrame(resizeFrame)
      resizeFrame = requestAnimationFrame(fitText)
    })

    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
      cancelAnimationFrame(resizeFrame)
    }
  }, [
    maxFontSize,
    minFontSize,
    deferResize,
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

function BirthdayEditor({ value, onChange }) {
  const updatePerson = (index, field, nextValue) => onChange({
    ...value,
    birthdayEntries: value.birthdayEntries.map((person, personIndex) =>
      personIndex === index ? { ...person, [field]: nextValue } : person),
  })
  const maxDay = new Date(2000, Number(value.birthdayMonth), 0).getDate()
  return (
    <div className="birthday-editor">
      <label>Month<select value={value.birthdayMonth} onChange={(event) => onChange({ ...value, birthdayMonth: Number(event.target.value), birthdayEntries: value.birthdayEntries.map((person) => ({ ...person, month: Number(event.target.value) })) })}>
        {MONTH_NAMES.map((month, index) => <option value={index + 1} key={month}>{month}</option>)}
      </select></label>
      <label>Display Year (optional)<input type="number" min="1" max="9999" value={value.displayYear} onChange={(event) => onChange({ ...value, displayYear: event.target.value })} /></label>
      <h3>Birthdays</h3>
      <p>Edit people below. Birthdays are sorted by day when saved. Each person’s birth year is shown when entered. Leave it blank to show only month and day. Display Year is list metadata.</p>
      {value.birthdayEntries.map((person, index) => (
        <div className="birthday-editor-row" key={index}>
          <label>Name<input value={person.name} onChange={(event) => updatePerson(index, 'name', event.target.value)} /></label>
          <label>{MONTH_NAMES[value.birthdayMonth - 1]} Day<input type="number" min="1" max={maxDay} value={person.day} onChange={(event) => updatePerson(index, 'day', event.target.value)} /></label>
          <label>Birth Year (optional)<input type="number" min="1" max="9999" value={person.birthYear ?? ''} onChange={(event) => updatePerson(index, 'birthYear', event.target.value)} /></label>
          <button type="button" className="button button-danger" aria-label={`Delete birthday ${index + 1}`} onClick={() => onChange({ ...value, birthdayEntries: value.birthdayEntries.filter((_, personIndex) => personIndex !== index) })}>Delete</button>
        </div>
      ))}
      <button type="button" className="button button-secondary" onClick={() => onChange({ ...value, birthdayEntries: [...value.birthdayEntries, { name: '', month: Number(value.birthdayMonth), day: '', birthYear: '' }] })}>+ Add Birthday</button>
    </div>
  )
}

function EventsPageStatus({ events, pageIndex, live = true, canSend = false, listNavigation = false }) {
  const birthdays = isBirthdayList(events[0])
  const total = birthdays ? (events[0].birthdayEntries?.length || 0) : events.length
  if (!total) return null
  const pages = eventPageCount(events)
  const size = birthdays ? BIRTHDAYS_PER_PAGE : EVENTS_PER_PAGE
  const page = Math.min(Math.max(pageIndex, 0), pages - 1)
  const label = birthdays ? 'Birthdays' : 'Events'
  const noun = birthdays ? 'birthdays' : 'events'
  return (
    <div className="events-page-status" role="status" aria-live="polite" aria-atomic="true">
      <div>
        <span className="events-page-status-label">{live ? 'Projector' : 'Prepared'}</span>
        <strong>{pages > 1 ? `${label} — Page ${page + 1} of ${pages}` : `${total} ${total === 1 ? (birthdays ? 'birthday' : 'event') : noun}`}</strong>
        {pages > 1 && <span>Showing {noun} {page * size + 1}-{Math.min((page + 1) * size, total)} of {total}</span>}
      </div>
      <span className="events-page-status-hint">{listNavigation ? '↑ / ↓ Select · Enter Edit · ← / → Projector Pages · ' : pages > 1 ? '↑ / ↓ to navigate · ' : ''}{!listNavigation && canSend && 'Enter · Send to Projector · '}B · Black Screen</span>
    </div>
  )
}

function EventsProjection({ events, birthdayList = null, pageIndex = 0 }) {
  const contentRef = useRef(null)

  useLayoutEffect(() => {
    const content = contentRef.current
    const fitEvents = () => {
      const bottom = content.getBoundingClientRect().bottom -
        parseFloat(getComputedStyle(content).paddingBottom)
      const fits = () => content.lastElementChild.getBoundingClientRect().bottom <= bottom
      content.style.setProperty('--event-scale', '1')
      if (fits()) return

      // Fit wrapped titles/descriptions as a whole page without scrolling or overlap.
      let low = 0
      let high = 1
      for (let step = 0; step < 12; step += 1) {
        const scale = (low + high) / 2
        content.style.setProperty('--event-scale', String(scale))
        if (fits()) low = scale
        else high = scale
      }
      content.style.setProperty('--event-scale', String(low))
    }
    fitEvents()
    const observer = new ResizeObserver(fitEvents)
    observer.observe(content)
    return () => observer.disconnect()
  }, [events, birthdayList, pageIndex])

  if (birthdayList) {
    const entries = sortBirthdays(birthdayList.birthdayEntries).slice(
      pageIndex * BIRTHDAYS_PER_PAGE, (pageIndex + 1) * BIRTHDAYS_PER_PAGE)
    return (
      <div ref={contentRef} className="screen-content screen-content-event birthday-projection">
        <div className="event-projection-heading birthday-projection-heading">
          Birthdays for the Month of {MONTH_NAMES[birthdayList.birthdayMonth - 1]}
        </div>
        <div className="birthday-table" role="table" aria-label="Birthdays">
          <div className="birthday-table-header" role="row">
            <div role="columnheader">Name</div><div role="columnheader">Date</div>
          </div>
          {entries.map((person, index) => (
            <div className="birthday-row" role="row" key={index}>
              <div className="birthday-name" role="cell">{person.name}</div>
              <div className="birthday-date" role="cell">{birthdayDateLabel(person)}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div ref={contentRef} className="screen-content screen-content-event">
      <div className="event-projection-heading">Upcoming Events</div>
      {events.map((pageEvent) => {
        const detailsStyle = {
          color: 'var(--event-detail-color)',
          fontWeight: pageEvent.detailsBold == null ? undefined : pageEvent.detailsBold ? 800 : 400,
          fontStyle: pageEvent.detailsItalic ? 'italic' : 'normal',
          textDecoration: pageEvent.detailsUnderline ? 'underline' : 'none',
        }
        return (
          <div className="event-projection-item" key={pageEvent.id}>
            <div className="event-projection-date" style={{ color: 'var(--event-text-color)', fontWeight: 800, fontStyle: pageEvent.dateItalic ? 'italic' : 'normal', textDecoration: 'underline' }}>{formatEventDateRange(pageEvent.eventDate, pageEvent.endDate)}</div>
            <div className="event-projection-title" style={{ color: 'var(--event-text-color)', fontWeight: (pageEvent.titleBold ?? true) ? 800 : 400, fontStyle: pageEvent.titleItalic ? 'italic' : 'normal', textDecoration: pageEvent.titleUnderline ? 'underline' : 'none' }}>{pageEvent.title}</div>
            {pageEvent.hostName?.trim() && <div className="event-projection-detail" style={detailsStyle}>Host: {pageEvent.hostName.trim()}</div>}
            <div className="event-projection-detail" style={detailsStyle}>{formatServiceTime(pageEvent.startTime)}{pageEvent.endTime ? ` - ${formatServiceTime(pageEvent.endTime)}` : ''}</div>
            {[pageEvent.location, pageEvent.description].filter(Boolean).map((detail, index) => <div className="event-projection-detail" key={index} style={detailsStyle}>{detail}</div>)}
          </div>
        )
      })}
    </div>
  )
}

function ProjectorDisplay({
  song,
  sectionIndex,
  projectionContentType = PROJECTION_CONTENT_TYPES.SONG,
  biblePassage = null,
  bibleVerseIndex = 0,
  event = null,
  events = [],
  eventPageIndex = 0,
  note = '',
  noteHeading = {},
  noteNavigation = [],
  liveSendId = '',
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
  const birthdayList = isBirthdayList(events[0] || event) ? (events[0] || event) : null
  const eventPage = events.length
    ? events.slice(eventPageIndex * EVENTS_PER_PAGE, (eventPageIndex + 1) * EVENTS_PER_PAGE)
    : event ? [event] : []
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

  const bibleProjector = projectionContentType === PROJECTION_CONTENT_TYPES.BIBLE
  const customBackgroundStyle =
    !bibleProjector &&
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

  const [customTextTheme, setCustomTextTheme] = useState(null)
  useEffect(() => {
    if (projectionContentType !== PROJECTION_CONTENT_TYPES.EVENT || backgroundType !== 'custom' || !customBackgroundUrl) return
    let cancelled = false
    readImageTextTheme(customBackgroundUrl).then((theme) => {
      if (!cancelled) setCustomTextTheme({ url: customBackgroundUrl, theme })
    })
    return () => { cancelled = true }
  }, [projectionContentType, backgroundType, customBackgroundUrl])
  const eventTextTheme = backgroundType === 'custom'
    ? (customTextTheme?.url === customBackgroundUrl ? customTextTheme.theme : 'light')
    : (BACKGROUND_OPTIONS.find((option) => option.id === backgroundVariant)?.textTheme || 'light')

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
            projectionContentType === PROJECTION_CONTENT_TYPES.NOTE ? 'projector-screen-note' : '',
            projectionContentType === PROJECTION_CONTENT_TYPES.EVENT
              ? 'projector-screen-event'
              : '',
            bibleProjector ? 'projector-screen-bible' : backgroundType === 'preset'
              ? `projector-screen-${backgroundVariant}`
              : 'projector-screen-custom',
            projectionMode === 'BLACK'
              ? 'black'
              : '',
          ]
            .filter(Boolean)
            .join(' ')}
          data-event-text-theme={projectionContentType === PROJECTION_CONTENT_TYPES.EVENT ? eventTextTheme : undefined}
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
              bibleProjector ? <BibleProjector passage={biblePassage} verse={currentBibleVerse} maxFontSize={showFullscreenControl ? lyricsSizing.maxFontSize : 34} /> : <div className="screen-content screen-content-bible">
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

          {projectionContentType === PROJECTION_CONTENT_TYPES.NOTE && note && (
            <NoteProjector key={liveSendId} text={note} heading={noteHeading} navigation={noteNavigation} visible={projectionMode === 'LIVE'} />
          )}

          {projectionMode === 'LIVE' &&
            projectionContentType === PROJECTION_CONTENT_TYPES.EVENT &&
            (birthdayList || eventPage.length > 0) && (
              <EventsProjection events={eventPage} birthdayList={birthdayList} pageIndex={eventPageIndex} />
            )}
        </div>
      </div>
    </div>
  )
}

function App() {
  const isProjectorWindow =
    getProjectorWindowState()

  const [savedCustomBackground, setSavedCustomBackground] = useState(null)
  useEffect(() => {
    let active = true
    loadLatestBackgroundImage().then(record => { if (active) setSavedCustomBackground(record) }).catch(() => {})
    return () => { active = false }
  }, [])
  const [activeView, setActiveView] =
    useState('operator')
  const [projectedNote, setProjectedNote] = useState('')
  const [projectedNoteHeading, setProjectedNoteHeading] = useState({})
  const [noteNavigation, setNoteNavigation] = useState([])
  const [verseJump, setVerseJump] = useState('')
  const [verseJumpError, setVerseJumpError] = useState('')
  const [prepareMode, setPrepareMode] =
    useState(() => readStoredProjectorState()?.projectionContentType === PROJECTION_CONTENT_TYPES.BIBLE ? 'bible' : 'song')
  const [activeKeyboardPanel, setActiveKeyboardPanel] = useState('CURRENT_SONG')
  const [networkStatus, setNetworkStatus] = useState({ mode: 'probing', ready: false, projectors: 0 })
  const networkProjectorRef = useRef(null)
  const networkSendRef = useRef(null)
  const networkSendRequestRef = useRef(null)
  const [networkBackgroundData, setNetworkBackgroundData] = useState(null)
  const [liveSend, setLiveSend] = useState(null)
  const [projectorControl, setProjectorControl] = useState(null)
  const [projectorStartupGate] = useState(() => createProjectorStartupGate(Date.now(), readStoredProjectorState()?.liveSend?.id))
  const [sidebarKeyboardIndex, setSidebarKeyboardIndex] = useState(0)
  const sideNavRef = useRef(null)
  const adminKeyboardListRef = useRef(null)
  const [highlightedServiceSongId, setHighlightedServiceSongId] = useState(null)
  const [highlightedEventId, setHighlightedEventId] = useState(null)

  const [songs, setSongs] = useState([])
  const [playlists, setPlaylists] =
    useState([])
  const [servicePlans, setServicePlans] =
    useState([])
  const [events, setEvents] = useState([])
  const [selectedEventIds, setSelectedEventIds] = useState(null)
  const [eventSelectionVersion, setEventSelectionVersion] = useState(0)
  const [sentEventSelectionVersion, setSentEventSelectionVersion] = useState(0)
  function changeEventSelection(ids) {
    setSelectedEventIds(ids)
    setEventSelectionVersion(version => version + 1)
    setPreparedEventPages({})
  }
  const [eventPresentation, setEventPresentation] = useState(() => {
    const state = readStoredProjectorState()
    const event = state?.projectedEvents?.[0] || state?.projectedEvent
    return state?.projectionContentType === PROJECTION_CONTENT_TYPES.EVENT && isBirthdayList(event)
      ? String(event.id) : 'upcoming'
  })
  const [preparedEventPages, setPreparedEventPages] = useState({})
  const keyboardSendInFlightRef = useRef(false)
  const [isSendingEvents, setIsSendingEvents] = useState(false)
  const eventSendInFlightRef = useRef(false)
  const [eventSnapshotVersion, setEventSnapshotVersion] = useState(0)
  const managementEvents = events.filter((event) => isBirthdayList(event) || isUpcomingEvent(event, getLocalIsoDate()))
  const birthdayLists = events.filter(isBirthdayList)
  const upcomingEvents = events.filter((event) =>
    !isBirthdayList(event) && isUpcomingEvent(event, getLocalIsoDate()))
  const selectedEventPresentation = eventPresentation === 'upcoming'
    ? selectedEvents(upcomingEvents, selectedEventIds)
    : birthdayLists.filter((event) => String(event.id) === eventPresentation)
  const selectedEventPageCount = eventPageCount(selectedEventPresentation)
  const [eventForm, setEventForm] = useState(createBlankEventForm)
  const [editingEventId, setEditingEventId] = useState(null)
  const [showEventModal, setShowEventModal] = useState(false)
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
  const [projectedEvent, setProjectedEvent] = useState(() =>
    readStoredProjectorState()?.projectedEvent || null
  )
  const [projectedEvents, setProjectedEvents] = useState(() => readStoredProjectorState()?.projectedEvents || [])
  const [projectedEventPageIndex, setProjectedEventPageIndex] = useState(() => readStoredProjectorState()?.projectedEventPageIndex || 0)

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
  const [creoleTranslation, setCreoleTranslation] = useState(null)
  const [preparedBibleProjection, setPreparedBibleProjection] = useState(null)
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
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const settingsRequestVersionRef = useRef(0)
  const projectorSyncReadyRef = useRef(false)
  const projectorBackgroundSyncedRef = useRef(false)
  const projectorChannelRef = useRef(null)
  const projectorConnectionRef = useRef(null)
  const operatorContentViewportRef = useRef(null)
  const bibleConsoleVerseRefs = useRef(new Map())
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

    return projectorStartupGate({
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
      projectedNote: '',
      projectedEvent: storedState?.projectedEvent || null,
      projectedEvents: storedState?.projectedEvents || [],
      projectedEventPageIndex: storedState?.projectedEventPageIndex || 0,
      projectionMode:
        'CLEAR',
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
    })
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
    setPrepareMode('song')
    setSelectedPlaylist(playlist)
    setLoadedServicePlanId(null)
    prepareOperatorPreviewForPlaylist(playlist)
    releasePlaylistSelectorFocus()
  }

  function applySavedBackground(variant) {
    setBackgroundType('preset')
    setBackgroundVariant(variant)
    setCustomBackgroundId(null)
    setCustomBackgroundName('')
    if (isProjectorWindow) {
      setProjectorWindowState((current) => ({ ...current,
        backgroundType: 'preset', backgroundVariant: variant,
        customBackgroundId: null, customBackgroundName: '',
      }))
    }
  }

  async function persistApplicationSettings(nextSettings) {
    const response = await fetch(`${API_BASE_URL}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nextSettings),
    })
    if (!response.ok) {
      throw new Error(await readErrorMessage(response) || 'Could not save settings.')
    }
    return createSettingsForm(await response.json())
  }

  async function saveApplicationSettings() {
    if (!settingsLoaded) return
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

      ++settingsRequestVersionRef.current
      const savedSettings = await persistApplicationSettings(nextSettings)
      networkCommand('BACKGROUND_CHANGE', { backgroundType: 'preset', backgroundVariant: savedSettings.defaultBackground, customBackgroundData: null, customBackgroundId: null, customBackgroundName: '' })
      applySavedBackground(savedSettings.defaultBackground)
      setSettingsLoaded(true)
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
        `${API_BASE_URL}/admin/backup/database`
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

  function markExplicitSend() {
    if (networkProjectorRef.current?.mode !== 'local' && !networkProjectorRef.current?.ready) {
      networkSendRef.current = null
      setError('Projector server is not connected. Reconnect, then Send Live again.')
      return
    }
    const send = { id: projectorId(), issuedAt: Date.now() }
    networkSendRequestRef.current = send.id
    networkSendRef.current = send.id
    setLiveSend(send)
  }

  async function publishNetworkSnapshot(snapshot, requestId) {
    const transport = networkProjectorRef.current
    const connection = transport?.connection
    try {
      if (snapshot.backgroundType === 'custom' && !snapshot.customBackgroundData) {
        const record = await loadBackgroundImage(snapshot.customBackgroundId)
        snapshot.customBackgroundData = await networkBackgroundFile(record?.file)
      }
      if (networkSendRequestRef.current !== requestId) return
      if (!transport?.ready || transport.connection !== connection) {
        throw new Error('Projector connection changed. Send Live again when connected.')
      }
      transport.command('SEND_LIVE', snapshot)
    } catch (err) {
      setError(err.message || 'Could not prepare the projector background.')
    }
  }

  function networkCommand(action, payload) {
    return networkProjectorRef.current?.command(action, payload) ?? false
  }

  const receiveNetworkState = useEffectEvent((state, meta) => {
    if (!state) return
    if (state.backgroundType) projectorBackgroundSyncedRef.current = true
    if (isProjectorWindow) {
      if (meta.appearanceOnly) {
        setProjectorWindowState(current => ({
          ...current, ...projectorAppearanceState(state),
          customBackgroundData: state.customBackgroundData,
          ...(meta.action === 'BACKGROUND_CHANGE' ? {} : { projectionMode: state.projectionMode === 'BLACK' ? 'BLACK' : 'CLEAR' }),
        }))
      } else {
        setProjectorWindowState({ ...state, projectionSettings: normalizeProjectionSettings(state.projectionSettings) })
      }
      return
    }
    setProjectionContentType(state.projectionContentType || PROJECTION_CONTENT_TYPES.SONG)
    setProjectionSong(state.projectionSong || null)
    setProjectedBiblePassage(state.projectedBiblePassage || null)
    setProjectedBibleVerseIndex(state.projectedBibleVerseIndex || 0)
    setProjectedNote(state.projectedNote || '')
    setProjectedNoteHeading(state.projectedNoteHeading || {})
    setNoteNavigation(state.noteNavigation || [])
    setProjectedEvents(state.projectedEvents || [])
    setProjectedEvent(state.projectedEvent || null)
    setProjectedEventPageIndex(state.projectedEventPageIndex || 0)
    setSectionIndex(state.sectionIndex || 0)
    setProjectionMode(state.projectionMode || 'CLEAR')
    setLiveSend(state.liveSend || null)
    if (['NEXT', 'PREVIOUS', 'SECTION_CHANGE', 'BIBLE_VERSE_JUMP'].includes(meta.action)) {
      if (isCurrentSongLive && state.projectionSong?.id === currentSongResolved?.id) {
        setCurrentSongSectionIndex(state.sectionIndex || 0)
      }
      if ((isPreparedBibleLive || (meta.action === 'BIBLE_VERSE_JUMP' && previewBiblePassage?.bookKey === state.projectedBiblePassage?.bookKey && previewBiblePassage?.chapter === state.projectedBiblePassage?.chapter)) && state.projectedBiblePassage?.verses?.[state.projectedBibleVerseIndex]) {
        selectPreparedBibleVerse(state.projectedBiblePassage.verses[state.projectedBibleVerseIndex].verseNumber)
      }
    }
    if (state.backgroundType) {
      setBackgroundType(state.backgroundType)
      setBackgroundVariant(state.backgroundVariant)
      setCustomBackgroundId(state.customBackgroundId || null)
      setCustomBackgroundName(state.customBackgroundName || '')
      setNetworkBackgroundData(state.customBackgroundData || null)
    }
  })

  useEffect(() => {
    const transport = createNetworkProjector({
      baseUrl: API_BASE_URL,
      role: isProjectorWindow ? 'PROJECTOR' : 'OPERATOR',
      onState: receiveNetworkState,
      onStatus: setNetworkStatus,
      onError: message => { if (!isProjectorWindow) setError(message) },
    })
    networkProjectorRef.current = transport
    return () => { transport.close(); networkProjectorRef.current = null }
  }, [isProjectorWindow])

  const runProjectionCommand = useEffectEvent((command) => {
    const networkAction = { BLACK: 'BLACK_SCREEN', CLEAR: 'CLEAR_LYRICS', BIBLE_NEXT: 'NEXT', BIBLE_PREVIOUS: 'PREVIOUS' }[command] || command
    if (networkCommand(networkAction)) return
    if (command === 'BLACK') { toggleBlackScreen(); return }
    if (command === 'CLEAR') { toggleClearLyrics(); return }
    const direction = command === 'NEXT' || command === 'BIBLE_NEXT' || command === 'NOTE_PAGE_NEXT' ? 1
      : command === 'PREVIOUS' || command === 'BIBLE_PREVIOUS' || command === 'NOTE_PAGE_PREVIOUS' ? -1 : 0
    if (!direction) return
    if (projectionContentType === PROJECTION_CONTENT_TYPES.EVENT) {
      moveProjectedEventPage(direction)
    } else if (projectionContentType === PROJECTION_CONTENT_TYPES.BIBLE) {
      navigateProjectedBibleVerse(direction)
      if (isPreparedBibleLive) {
        const next = projectedBiblePassage?.verses?.[projectedBibleVerseIndex + direction]
        if (next) selectPreparedBibleVerse(next.verseNumber)
      }
    } else if (projectionContentType === PROJECTION_CONTENT_TYPES.NOTE) {
      scrollLiveNote(direction, command.startsWith('NOTE_PAGE') ? 'page' : 'line')
    } else {
      const next = sectionIndex + direction
      const sections = parseLyricsSections(liveProjectionSong)
      if (next < 0 || next >= sections.length) return
      setSectionIndex(next)
      if (isCurrentSongLive) setCurrentSongSectionIndex(next)
    }
  })

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
    loadSettings()
    if (isProjectorWindow) {
      return
    }
    loadBibleTranslations()
    loadSongs()
    loadPlaylists()
    loadServicePlans()
    loadEvents()
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

    if (!isProjectorWindow) {
      projectorConnectionRef.current = createProjectorConnection(() => {
        const url = new URL(window.location.href)
        url.searchParams.set('projector', '1')
        return window.open(url.toString(), 'church-song-projector-window', 'popup=yes,width=1280,height=720')
      })
    }

    if ('BroadcastChannel' in window) {
      projectorChannelRef.current =
        new BroadcastChannel(
          PROJECTOR_CHANNEL_NAME
        )

      projectorChannelRef.current.addEventListener(
        'message',
        (event) => {
          if (networkProjectorRef.current?.mode !== 'local') return
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
            !projectorSyncReadyRef.current ||
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
      projectorConnectionRef.current?.close()
      projectorConnectionRef.current = null
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
      if (networkProjectorRef.current?.mode !== 'local') return
      if (!state) {
        return
      }

      if (state.appearanceOnly) {
        projectorBackgroundSyncedRef.current = true
        setProjectorWindowState(current => ({
          ...current,
          ...projectorAppearanceState(state),
          ...(state.projectorControl ? { projectionMode: state.projectorControl.mode } : {}),
        }))
        return
      }

      state = projectorStartupGate(state)
      projectorBackgroundSyncedRef.current = true
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
        projectedNote: state.projectedNote || '',
        projectedNoteHeading: state.projectedNoteHeading || {},
        noteNavigation: state.noteNavigation || [],
        liveSend: state.liveSend,
        projectedEvent: state.projectedEvent || null,
        projectedEvents: state.projectedEvents || [],
        projectedEventPageIndex: state.projectedEventPageIndex || 0,
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

    window.addEventListener(
      'storage',
      handleStorage
    )


    const stopProjectorPresence = announceProjectorReady()

    const requestTimer = window.setTimeout(
      () => {
        channel?.postMessage({
          type: PROJECTOR_REQUEST_MESSAGE,
        })
      },
      300
    )

    return () => {
      stopProjectorPresence()
      window.clearTimeout(requestTimer)
      channel?.close()
      window.removeEventListener(
        'storage',
        handleStorage
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

  async function loadSettings() {
    const requestVersion = ++settingsRequestVersionRef.current
    try {
      const response = await fetch(`${API_BASE_URL}/settings`, { cache: 'no-store' })
      if (!response.ok) throw new Error('Failed to load settings')
      const normalizedSettings = createSettingsForm(await response.json())
      if (requestVersion !== settingsRequestVersionRef.current) return
      setAppSettings(normalizedSettings)
      setSettingsForm(normalizedSettings)
      const cached = readStoredProjectorState()
      // Uploaded images keep their existing IndexedDB/session descriptor.
      // Preset selection is authoritative in Settings, regardless of live content.
      const hasCustomBackground = cached?.backgroundType === 'custom' && cached.customBackgroundId
      if (!hasCustomBackground && !(networkProjectorRef.current?.mode === 'network' && projectorBackgroundSyncedRef.current) && !(isProjectorWindow && projectorBackgroundSyncedRef.current)) {
        applySavedBackground(normalizedSettings.defaultBackground)
      }
    } catch (err) {
      // Keep the last cached background when the API is unavailable.
      if (requestVersion === settingsRequestVersionRef.current) {
        setError(err.message || 'Could not load settings. Keeping the last saved projector background.')
      }
    } finally {
      if (requestVersion === settingsRequestVersionRef.current) setSettingsLoaded(true)
    }
  }

  async function loadBibleTranslations() {
    try {
      const response = await fetch(
        `${API_BASE_URL}/bible/translations`
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

      setCreoleTranslation(findCreoleTranslation(data))
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
        `${API_BASE_URL}/bible/books?${query.toString()}`
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
      `${API_BASE_URL}/songs/${songId}/melody-reference`
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

  async function fetchBibleChapterMetadata(
    {
      bookKey,
      chapter,
    },
    translationCode
  ) {
    const response = await fetch(
      `${API_BASE_URL}/bible/books/${bookKey}/chapters/${chapter}/metadata?${new URLSearchParams({ translation: translationCode }).toString()}`
    )

    if (!response.ok) {
      const message = await readErrorMessage(response)

      throw new Error(
        message ||
          'Could not load Bible chapter metadata.'
      )
    }

    const data = await response.json()
    const availableVerseNumbers = Array.isArray(
      data.availableVerseNumbers
    )
      ? data.availableVerseNumbers
      : []

    return {
      ...data,
      availableVerseNumbers,
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
      const metadata = await fetchBibleChapterMetadata(
        { bookKey, chapter },
        translationCode
      )
      const availableVerseNumbers =
        metadata.availableVerseNumbers

      setSelectedBibleChapterMetadata({
        ...metadata,
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

      return {
        ...metadata,
        availableVerseNumbers,
      }
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

  function selectPreparedBibleVerse(verseNumber) {
    setBibleSelection((current) => ({
      ...current,
      startVerse: verseNumber,
      endVerse: verseNumber,
    }))

    window.requestAnimationFrame(() => {
      bibleConsoleVerseRefs.current
        .get(verseNumber)
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
  }

  function moveBiblePreviewVerse(direction) {
    const currentIndex = selectedBibleVerseOptions.indexOf(
      bibleSelection.startVerse
    )
    const nextIndex = currentIndex + direction

    if (
      nextIndex < 0 ||
      nextIndex >= selectedBibleVerseOptions.length
    ) {
      return
    }

    selectPreparedBibleVerse(
      selectedBibleVerseOptions[nextIndex]
    )
  }

  function goToPreviousBibleVerse() {
    const currentIndex = selectedBibleVerseOptions.indexOf(
      bibleSelection.startVerse
    )

    if (currentIndex > 0) {
      selectPreparedBibleVerse(
        selectedBibleVerseOptions[currentIndex - 1]
      )
      return
    }

    if (bibleSelection.chapter > 1) {
      const previousChapter = bibleSelection.chapter - 1

      setPreviewBiblePassageData(null)
      setBibleSelection((current) => ({
        ...current,
        chapter: previousChapter,
        startVerse: 1,
        endVerse: 1,
      }))

      loadBibleChapterMetadata({
        bookKey: bibleSelection.bookKey,
        chapter: previousChapter,
      }).then((metadata) => {
        const lastVerse = metadata?.availableVerseNumbers?.at(-1)

        if (lastVerse) {
          selectPreparedBibleVerse(lastVerse)
        }
      })
    }
  }

  function goToNextBibleVerse() {
    const currentIndex = selectedBibleVerseOptions.indexOf(
      bibleSelection.startVerse
    )

    if (
      currentIndex >= 0 &&
      currentIndex < selectedBibleVerseOptions.length - 1
    ) {
      selectPreparedBibleVerse(
        selectedBibleVerseOptions[currentIndex + 1]
      )
      return
    }

    if (
      bibleSelection.chapter <
      (selectedBibleBook?.chapterCount || 0)
    ) {
      const nextChapter = bibleSelection.chapter + 1

      setPreviewBiblePassageData(null)
      setBibleSelection((current) => ({
        ...current,
        chapter: nextChapter,
        startVerse: 1,
        endVerse: 1,
      }))
    }
  }

  async function previewBiblePassageSelection() {
    if (!selectedBibleBook) {
      return
    }

    const availableVerseNumbers =
      selectedBibleChapterMetadata?.availableVerseNumbers ||
      []
    const firstVerse = availableVerseNumbers[0] || 1
    const startVerse = availableVerseNumbers.includes(
      bibleSelection.startVerse
    )
      ? bibleSelection.startVerse
      : firstVerse
    const validEndVerses =
      getContiguousBibleEndVerseOptions(
        availableVerseNumbers,
        startVerse
      )
    const endVerse = validEndVerses.includes(
      bibleSelection.endVerse
    )
      ? bibleSelection.endVerse
      : startVerse

    if (
      startVerse !== bibleSelection.startVerse ||
      endVerse !== bibleSelection.endVerse
    ) {
      setBibleSelection((current) => ({
        ...current,
        startVerse,
        endVerse,
      }))
    }

    try {
      setError('')

      const query = new URLSearchParams({
        book: bibleSelection.bookKey,
        chapter: String(
          bibleSelection.chapter
        ),
        startVerse: String(
          startVerse
        ),
        endVerse: String(
          endVerse
        ),
        translation:
          referenceBibleTranslationCode,
      })
      const response = await fetch(
        `${API_BASE_URL}/bible/passage?${query.toString()}`
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
    selection = bibleSelection,
    projectionMode = bibleProjectionMode,
    referenceTranslationCode =
      referenceBibleTranslationCode
  ) {
    if (projectionMode === BIBLE_PROJECTION_MODES.TRILINGUAL && !creoleTranslation) throw new Error('Install a real Kreyòl Bible dataset before enabling three languages.')
    const requiredTranslations =
      projectionMode === BIBLE_PROJECTION_MODES.TRILINGUAL ? [BIBLE_TRANSLATION_CODES.FRENCH, 'WEB', creoleTranslation.code] :
      projectionMode === BIBLE_PROJECTION_MODES.FRENCH
        ? [BIBLE_TRANSLATION_CODES.FRENCH]
        : projectionMode === BIBLE_PROJECTION_MODES.ENGLISH
          ? [BIBLE_TRANSLATION_CODES.ENGLISH]
          : projectionMode === BIBLE_PROJECTION_MODES.SPANISH
            ? [BIBLE_TRANSLATION_CODES.SPANISH]
            : [
                BIBLE_TRANSLATION_CODES.FRENCH,
                BIBLE_TRANSLATION_CODES.ENGLISH,
              ]
    const translationsToLoad = [
      ...new Set([
        ...requiredTranslations,
        referenceTranslationCode,
      ]),
    ]
    const passages = await Promise.all(
      translationsToLoad.map(async (translation) => {
        const metadata =
          await fetchBibleChapterMetadata(
            selection,
            translation
          )
        const availableVerseNumbers =
          metadata.availableVerseNumbers
        const startVerse = availableVerseNumbers[0]
        const endVerse =
          availableVerseNumbers[
            availableVerseNumbers.length - 1
          ]

        if (
          !Number.isInteger(startVerse) ||
          !Number.isInteger(endVerse)
        ) {
          throw new Error(
            'Could not determine the available verses for this Bible chapter.'
          )
        }

        const ranges = projectionMode === BIBLE_PROJECTION_MODES.TRILINGUAL
          ? contiguousVerseRanges(availableVerseNumbers) : [[startVerse, endVerse]]
        const parts = await Promise.all(ranges.map(async ([start, end]) => {
          const response = await fetch(`${API_BASE_URL}/bible/passage?${new URLSearchParams({
            book: selection.bookKey, chapter: String(selection.chapter),
            startVerse: String(start), endVerse: String(end), translation,
          })}`)
          if (!response.ok) throw new Error((await readErrorMessage(response)) || `Could not load the ${translation} Bible passage.`)
          return response.json()
        }))
        return [translation, { ...parts[0], startVerse, endVerse, verses: parts.flatMap(part => part.verses) }]
      })
    )
    const passagesByTranslation = Object.fromEntries(passages)

    return {
      creolePassage: passagesByTranslation[creoleTranslation?.code] || null,
      frenchPassage:
        passagesByTranslation[BIBLE_TRANSLATION_CODES.FRENCH] || null,
      englishPassage:
        passagesByTranslation[projectionMode === BIBLE_PROJECTION_MODES.TRILINGUAL ? 'WEB' : BIBLE_TRANSLATION_CODES.ENGLISH] || null,
      spanishPassage:
        passagesByTranslation[BIBLE_TRANSLATION_CODES.SPANISH] || null,
    }
  }

  function navigateProjectedBibleVerse(direction) {
    if (
      projectionContentType !== PROJECTION_CONTENT_TYPES.BIBLE ||
      !projectedBiblePassage?.verses?.length
    ) {
      return
    }

    if (networkCommand(direction > 0 ? 'NEXT' : 'PREVIOUS')) return
    setProjectedBibleVerseIndex((currentIndex) => {
      const nextIndex = currentIndex + direction

      return nextIndex < 0 ||
        nextIndex >= projectedBiblePassage.verses.length
        ? currentIndex
        : nextIndex
    })
    setProjectionMode('LIVE')
  }

  async function projectBiblePassage({
    singleVerse = false,
  } = {}) {
    if (
      !previewBiblePassage ||
      !previewBiblePassage.verses?.length
    ) {
      return
    }

    try {
      setError('')

      const currentChapterMetadata =
        await loadBibleChapterMetadata(
          {
            bookKey: bibleSelection.bookKey,
            chapter: bibleSelection.chapter,
          },
          referenceBibleTranslationCode
        )
      const availableVerseNumbers =
        currentChapterMetadata?.availableVerseNumbers || []
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
        throw new Error(
          'Could not determine the available verses for this Bible chapter.'
        )
      }

      const preparedVerse = availableVerseNumbers.includes(
        bibleSelection.startVerse
      )
        ? bibleSelection.startVerse
        : chapterFirstVerse

      if (
        singleVerse &&
        preparedVerse !== bibleSelection.startVerse
      ) {
        setBibleSelection((current) => ({
          ...current,
          startVerse: preparedVerse,
          endVerse: preparedVerse,
        }))
      }

      const chapterPassageData =
        await loadBiblePassageSet(
          bibleSelection,
          bibleProjectionMode,
          referenceBibleTranslationCode
        )
      const chapterBiblePassage =
        createBiblePreviewPassage({
          mode: bibleProjectionMode,
          creolePassage: chapterPassageData.creolePassage,
          frenchPassage:
            chapterPassageData.frenchPassage,
          englishPassage:
            chapterPassageData.englishPassage,
          spanishPassage:
            chapterPassageData.spanishPassage,
          referenceTranslationCode:
            referenceBibleTranslationCode,
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
            preparedVerse
        )

      if (bibleProjectionMode === BIBLE_PROJECTION_MODES.TRILINGUAL && targetVerseIndex < 0) throw new Error('This verse is not available in all three translations. Select a shared verse or another projection mode.')

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
      markExplicitSend()
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
    if (nextMode === BIBLE_PROJECTION_MODES.TRILINGUAL && !creoleTranslation) return
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
        creolePassage: projectedBiblePassage.translations?.HAITIAN_CREOLE || null,
        frenchPassage:
          projectedBiblePassage.translations
            ?.FRENCH || null,
        englishPassage:
          projectedBiblePassage.translations
            ?.ENGLISH || null,
        spanishPassage:
          projectedBiblePassage.translations
            ?.SPANISH || null,
        referenceTranslationCode:
          projectedBiblePassage.referenceTranslationCode ||
          referenceBibleTranslationCode,
      })

    if (
      nextProjectedBiblePassage?.verses
        ?.length
    ) {
      if (networkCommand('BIBLE_MODE_CHANGE', { passage: nextProjectedBiblePassage })) return
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
      if (networkProjectorRef.current?.mode === 'network') markExplicitSend()
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
      if (networkProjectorRef.current?.mode === 'network') markExplicitSend()
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
        `${API_BASE_URL}/songs`
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
        `${API_BASE_URL}/playlists`
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

  async function loadEvents() {
    try {
      const response = await fetch(`${API_BASE_URL}/events`)
      if (!response.ok) {
        throw new Error(await readErrorMessage(response) || 'Could not load events.')
      }
      setEvents(await response.json())
    } catch (err) {
      setError(err.message)
    }
  }

  function openNewEventModal() {
    setError('')
    setEditingEventId(null)
    setEventForm(createBlankEventForm())
    setShowEventModal(true)
  }

  function openEditEventModal(event) {
    setError('')
    setEditingEventId(event.id)
    setEventForm({
      title: event.title || '', eventDate: event.eventDate || '', endDate: event.endDate || '',
      startTime: event.startTime || '', endTime: event.endTime || '',
      hostName: event.hostName || '', location: event.location || '', description: event.description || '',
      eventType: event.eventType || '',
      birthdayMonth: event.birthdayMonth || new Date().getMonth() + 1,
      displayYear: event.displayYear || '',
      birthdayEntries: (event.birthdayEntries || []).map((person) => ({ ...person })),
      titleColor: event.titleColor || '#000000',
      dateColor: event.dateColor || '#8B3A8B',
      detailsColor: event.detailsColor || '#000000',
      titleBold: event.titleBold || false,
      titleUnderline: event.titleUnderline || false,
      titleItalic: event.titleItalic || false,
      dateBold: event.dateBold ?? true,
      dateUnderline: event.dateUnderline ?? true,
      dateItalic: event.dateItalic || false,
      detailsBold: event.detailsBold || false,
      detailsUnderline: event.detailsUnderline || false,
      detailsItalic: event.detailsItalic || false,
    })
    setShowEventModal(true)
  }

  async function saveEvent() {
    if (!isBirthdayList(eventForm)) {
      const dateError = validateEventDates(eventForm.eventDate, eventForm.endDate)
      if (dateError) {
        setError(dateError)
        return
      }
    }
    try {
      setError('')
      const response = await fetch(
        editingEventId == null
          ? `${API_BASE_URL}/events`
          : `${API_BASE_URL}/events/${editingEventId}`,
        {
          method: editingEventId == null ? 'POST' : 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(isBirthdayList(eventForm) ? {
            eventType: BIRTHDAY_LIST,
            title: `Birthdays for the Month of ${MONTH_NAMES[Number(eventForm.birthdayMonth) - 1]}`,
            birthdayMonth: Number(eventForm.birthdayMonth),
            displayYear: eventForm.displayYear === '' ? null : Number(eventForm.displayYear),
            birthdayEntries: sortBirthdays(eventForm.birthdayEntries).map((person) => ({
              name: person.name, month: Number(eventForm.birthdayMonth),
              day: Number(person.day), birthYear: person.birthYear === '' || person.birthYear == null ? null : Number(person.birthYear),
            })),
          } : { ...eventForm, endDate: eventForm.endDate || null, hostName: eventForm.hostName.trim() || null }),
        }
      )
      if (!response.ok) {
        throw new Error(await readErrorMessage(response) || 'Could not save event.')
      }
      setShowEventModal(false)
      await loadEvents()
    } catch (err) {
      setError(err.message)
    }
  }

  async function deleteEvent(event) {
    if (!window.confirm(`Delete event "${event.title}"?`)) return
    try {
      setError('')
      const response = await fetch(`${API_BASE_URL}/events/${event.id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error(await readErrorMessage(response) || 'Could not delete event.')
      await loadEvents()
    } catch (err) {
      setError(err.message)
    }
  }

  async function projectEvent() {
    if (eventSendInFlightRef.current) return
    eventSendInFlightRef.current = true
    setIsSendingEvents(true)
    try {
      setError('')
      // Read saved data directly: the post-save list reload may still be pending.
      const response = await fetch(`${API_BASE_URL}/events`, { cache: 'no-store' })
      if (!response.ok) {
        throw new Error(await readErrorMessage(response) || 'Could not load events for projection.')
      }
      const savedEvents = await response.json()
      const eventSet = eventPresentation === 'upcoming'
        ? selectedEvents(savedEvents.filter((event) => !isBirthdayList(event) && isUpcomingEvent(event, getLocalIsoDate())), selectedEventIds)
          .sort((a, b) => a.eventDate.localeCompare(b.eventDate) || (a.startTime || '').localeCompare(b.startTime || ''))
        : savedEvents.filter((event) => isBirthdayList(event) && String(event.id) === eventPresentation)
      if (eventPresentation === 'upcoming' && selectedEventIds !== null && !eventSet.length) throw new Error('Select at least one upcoming event before sending.')
      if (eventPresentation !== 'upcoming' && !eventPageCount(eventSet)) {
        throw new Error('The selected Birthday List is unavailable or empty.')
      }
      // Detached from saved/form data; only explicit sends replace this snapshot.
      const snapshot = JSON.parse(JSON.stringify(eventSet))
      await ensureProjectorReady()
      setEvents(savedEvents)
      setSentEventSelectionVersion(eventSelectionVersion)
      setProjectionContentType(PROJECTION_CONTENT_TYPES.EVENT)
      setProjectionSong(null)
      setProjectedBiblePassage(null)
      setProjectedBibleVerseIndex(0)
      setProjectedEvent(snapshot[0] || null)
      setProjectedEvents(snapshot)
      setActiveKeyboardPanel('EVENTS_LIST')
      setProjectedEventPageIndex(0)
      setEventSnapshotVersion((version) => Math.max(Date.now(), version + 1))
      setProjectionMode('LIVE')
      markExplicitSend()
    } catch (err) {
      setError(err.message || 'Could not send events to projector.')
    } finally {
      eventSendInFlightRef.current = false
      setIsSendingEvents(false)
    }
  }

  async function sendNoteLive(text, heading = {}) {
    if (noteValidation(text)) throw new Error(noteValidation(text))
    const transport = networkProjectorRef.current
    if (transport?.mode !== 'local' && !transport?.ready) throw new Error('Projector server is not connected. Reconnect and send again.')
    if (!transport.supportsContent(PROJECTION_CONTENT_TYPES.NOTE)) throw new Error('This running projector server does not advertise Notes support. Restart the backend with the updated Notes build, then refresh this operator and Send Note Live again.')
    await ensureProjectorReady()
    setProjectedNote(text)
    setProjectedNoteHeading({...heading})
    setNoteNavigation([])
    setProjectionContentType(PROJECTION_CONTENT_TYPES.NOTE)
    setProjectionSong(null); setProjectedBiblePassage(null); setProjectedBibleVerseIndex(0)
    setProjectedEvents([]); setProjectedEvent(null); setProjectedEventPageIndex(0); setSectionIndex(0)
    setProjectionMode('LIVE')
    markExplicitSend()
  }

  function scrollLiveNote(direction, unit = 'line') {
    if (projectionContentType !== PROJECTION_CONTENT_TYPES.NOTE || !liveSend) return
    if (networkCommand(unit === 'page' ? (direction > 0 ? 'NOTE_PAGE_NEXT' : 'NOTE_PAGE_PREVIOUS') : (direction > 0 ? 'NEXT' : 'PREVIOUS'))) return
    setNoteNavigation(previous => nextNoteNavigation(previous, direction, unit))
  }

  function jumpLiveBibleVerse(event) {
    event.preventDefault()
    const index = projectionContentType === PROJECTION_CONTENT_TYPES.BIBLE && liveSend
      ? liveVerseIndex(projectedBiblePassage, verseJump) : -1
    if (index < 0) { setVerseJumpError('Enter a verse number in the currently live passage.'); return }
    setVerseJumpError('')
    if (networkCommand('BIBLE_VERSE_JUMP', { verseNumber: Number(verseJump) })) return
    setProjectedBibleVerseIndex(index); setProjectionMode('LIVE')
    if (previewBiblePassage?.bookKey === projectedBiblePassage.bookKey && previewBiblePassage?.chapter === projectedBiblePassage.chapter) {
      selectPreparedBibleVerse(projectedBiblePassage.verses[index].verseNumber)
    }
  }

  function moveProjectedEventPage(direction) {
    if (networkCommand(direction > 0 ? 'NEXT' : 'PREVIOUS')) return
    if (projectionContentType !== PROJECTION_CONTENT_TYPES.EVENT) return
    setProjectedEventPageIndex((index) => {
      const next = index + direction
      return next < 0 || next >= eventPageCount(projectedEvents) ? index : next
    })
  }

  async function loadServicePlans() {
    try {
      const response = await fetch(
        `${API_BASE_URL}/service-plans`
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
  useEffect(() => {
    let cancelled = false
    setPreparedBibleProjection(null)
    if (!previewBiblePassageData) return
    loadBiblePassageSet(bibleSelection, bibleProjectionMode, referenceBibleTranslationCode)
      .then(data => {
        const passage = createBiblePreviewPassage({ mode: bibleProjectionMode, ...data, referenceTranslationCode: referenceBibleTranslationCode })
        if (!cancelled) setPreparedBibleProjection(passage)
      })
      .catch(err => { if (!cancelled) setError(err.message) })
    return () => { cancelled = true }
  }, [previewBiblePassageData, bibleProjectionMode, creoleTranslation?.code])
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
        referenceTranslationCode:
          referenceBibleTranslationCode,
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
      ? (networkStatus.mode === 'network' ? projectionSong : projectionSongResolved)
      : null
  const liveProjectorState = useMemo(
    () =>
      ({ ...createProjectorState({
        song: liveProjectionSong,
        sectionIndex,
        projectionContentType,
        biblePassage: projectedBiblePassage,
        bibleVerseIndex: projectedBibleVerseIndex,
        note: projectedNote,
        noteHeading: projectedNoteHeading,
        noteNavigation,
        event: projectedEvent,
        events: projectedEvents,
        eventPageIndex: projectedEventPageIndex,
        eventSnapshotVersion,
        projectionMode,
        backgroundType,
        backgroundVariant,
        customBackgroundId,
        customBackgroundName,
        projectionSettings,
      }), liveSend }),
    [
      liveSend,
      backgroundType,
      backgroundVariant,
      customBackgroundId,
      customBackgroundName,
      liveProjectionSong,
      projectedBiblePassage,
      projectedBibleVerseIndex,
      projectedNote,
      projectedNoteHeading,
      noteNavigation,
      projectedEvent,
      projectedEvents,
      projectedEventPageIndex,
      eventSnapshotVersion,
      projectionContentType,
      projectionMode,
      projectionSettings,
      sectionIndex,
    ]
  )
  const liveEventPresentation = projectionContentType === PROJECTION_CONTENT_TYPES.EVENT
    ? (isBirthdayList(projectedEvents[0]) ? String(projectedEvents[0].id) : 'upcoming') : null
  const isPreparedEventsLive = eventPresentation === liveEventPresentation && (eventPresentation !== 'upcoming' || eventSelectionVersion === sentEventSelectionVersion)
  const operatorEvents = isPreparedEventsLive ? projectedEvents : selectedEventPresentation
  const operatorEventPage = isPreparedEventsLive ? projectedEventPageIndex
    : Math.min(preparedEventPages[eventPresentation] || 0, Math.max(0, eventPageCount(operatorEvents) - 1))
  const operatorKeyboardMode = activeKeyboardPanel === 'SIDE_NAV' ? 'SIDE_NAV' : ['songs', 'playlists', 'serviceHistory'].includes(activeView) && activeKeyboardPanel === 'ADMIN_LIST' ? 'ADMIN_LIST' : activeView === 'events' && activeKeyboardPanel === 'EVENTS_LIST' ? 'EVENTS_LIST' : (activeView === 'events' || activeView === 'operator') && ['EVENTS', 'BIRTHDAYS'].includes(activeKeyboardPanel)
    ? (eventPresentation === 'upcoming' ? 'REGULAR_EVENTS' : 'BIRTHDAY_LIST')
    : activeView === 'operator' ? (activeKeyboardPanel === 'CURRENT_SONG'
      ? (prepareMode === 'notes' ? 'NOTE' : prepareMode === 'bible' ? 'BIBLE' : 'SONG') : activeKeyboardPanel) : null
  const isEventsKeyboardMode = operatorKeyboardMode === 'EVENTS_LIST' || operatorKeyboardMode === 'REGULAR_EVENTS' || operatorKeyboardMode === 'BIRTHDAY_LIST'
  const isPreparedBibleLive = projectionContentType === PROJECTION_CONTENT_TYPES.BIBLE &&
    previewBiblePassage?.bookKey === projectedBiblePassage?.bookKey &&
    previewBiblePassage?.chapter === projectedBiblePassage?.chapter &&
    projectedBiblePassage?.verses?.[projectedBibleVerseIndex]?.verseNumber === bibleSelection.startVerse &&
    projectedBiblePassage?.referenceTranslationCode === referenceBibleTranslationCode
  const canKeyboardSend = isEventsKeyboardMode ? selectedEventPageCount > 0 && !isSendingEvents
    : activeView === 'operator' ? (prepareMode === 'notes' ? false : prepareMode === 'bible' ? Boolean(previewBiblePassage?.verses?.length) : Boolean(currentSongResolved && currentSongSections.length)) : false

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
  const liveProjectorPreviewSections = useMemo(() => {
    if (
      !liveProjectorState.projectionSong ||
      liveProjectorState.projectionContentType !==
        PROJECTION_CONTENT_TYPES.SONG
    ) {
      return []
    }

    return parseLyricsSections(
      liveProjectorState.projectionSong
    )
  }, [
    liveProjectorState.projectionContentType,
    liveProjectorState.projectionSong,
  ])
  const liveProjectorPreviewSection =
    liveProjectorPreviewSections[
      liveProjectorState.sectionIndex
    ] ||
    liveProjectorPreviewSections[0]
  const liveProjectorBibleVerse =
    liveProjectorState.projectionContentType ===
    PROJECTION_CONTENT_TYPES.BIBLE
      ? liveProjectorState.projectedBiblePassage
          ?.verses?.[
          liveProjectorState.projectedBibleVerseIndex
        ] ||
        liveProjectorState.projectedBiblePassage
          ?.verses?.[0] ||
        null
      : null
  const currentSongSelectionId =
    currentSongSourceId ??
    currentSongResolved?.id ??
    null
  const canGoToPreviousProjection = currentSongSectionIndex > 0
  const canGoToNextProjection = currentSongSectionIndex < currentSongSections.length - 1
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
          `${API_BASE_URL}/song-families/${familyId}/versions`
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
            url: `${API_BASE_URL}/song-families/${familyId}/versions`,
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
    if (isProjectorWindow || !settingsLoaded) {
      return
    }

    if (networkProjectorRef.current?.mode !== 'local') {
      if (networkSendRef.current && networkSendRef.current === liveSend?.id) {
        networkSendRef.current = null
        publishNetworkSnapshot(JSON.parse(JSON.stringify({
          ...liveProjectorState,
          songSectionCount: parseLyricsSections(liveProjectorState.projectionSong).length,
          customBackgroundData: networkBackgroundData,
        })), liveSend.id)
      }
      return
    }
    projectorSyncReadyRef.current = true
    // No live authority survives an operator reload. Keep appearance in sync,
    // but do not publish restored/prepared content until an explicit Send Live.
    const syncState = liveSend ? liveProjectorState : {
      ...projectorAppearanceState(liveProjectorState),
      appearanceOnly: true,
      projectorControl,
    }
    latestProjectorStateRef.current = syncState

    if ([PROJECTION_CONTENT_TYPES.EVENT, PROJECTION_CONTENT_TYPES.NOTE].includes(liveProjectorState.projectionContentType)) {
      try {
        persistProjectorState(syncState)
      } catch {
        console.warn('Projector storage is unavailable; continuing with BroadcastChannel synchronization.')
      }
    } else {
      persistProjectorState(syncState)
    }
    projectorChannelRef.current?.postMessage(
      createProjectorSyncMessage(
        syncState
      )
    )
  }, [
    isProjectorWindow,
    settingsLoaded,
    liveProjectorState,
    liveSend,
    projectorControl,
    networkStatus,
    networkBackgroundData,
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
        `${API_BASE_URL}/songs`,
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
        `${API_BASE_URL}/song-families/from-song/${selectedSongResolved.id}`,
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
        `${API_BASE_URL}/song-families/${linkExistingSongTargetFamilyId}/songs/${song.id}`,
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
        `${API_BASE_URL}/song-families/${familyId}/songs/${song.id}`,
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
        `${API_BASE_URL}/songs/${editingSongId}`,
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
        `${API_BASE_URL}/songs/${selectedSongResolved.id}/melody-reference`,
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
        `${API_BASE_URL}/songs/${selectedSongResolved.id}/melody-reference`,
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
        `${API_BASE_URL}/songs/${addTranslationSourceSongId}/translations`,
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
        `${API_BASE_URL}/songs/${editingSectionsSongId}/sections`,
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
        `${API_BASE_URL}/playlists/id/${playlist.id}/songs/${song.id}`,
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
        `${API_BASE_URL}/service-plans/${servicePlan.id}/songs/${song.id}`,
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
        `${API_BASE_URL}/songs/${selectedSong.id}`,
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
        `${API_BASE_URL}/service-plans`,
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
        `${API_BASE_URL}/service-plans/${openedServicePlan.id}`,
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
        `${API_BASE_URL}/service-plans/${openedServicePlan.id}/duplicate`,
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
        `${API_BASE_URL}/service-plans/${openedServicePlan.id}`,
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
        `${API_BASE_URL}/service-plans/history/${servicePlanToDelete.id}`,
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
          ? `${API_BASE_URL}/service-plans/${target.servicePlan.id}/complete`
          : `${API_BASE_URL}/playlists/${target.playlist.id}/complete-service`,
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
        `${API_BASE_URL}/service-plans/${selectedHistoryServicePlan.id}/reuse`,
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
        `${API_BASE_URL}/playlists`
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
        ? `${API_BASE_URL}/playlists/${savedPlaylistSource.id}/copy`
        : `${API_BASE_URL}/playlists/saved-service`
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
        `${API_BASE_URL}/playlists`
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
        `${API_BASE_URL}/playlists/${managedPlaylist.id}/metadata`,
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
        `${API_BASE_URL}/playlists/${managedPlaylist.id}`,
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
        `${API_BASE_URL}/playlists/${useForTodaySourcePlaylist.id}/use-for-today-service`,
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
        `${API_BASE_URL}/playlists`
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
        `${API_BASE_URL}/playlists/id/${playlist.id}/songs/${song.id}`,
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
        `${API_BASE_URL}/service-plans/${servicePlan.id}/songs/${song.id}`,
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
        `${API_BASE_URL}/playlists/id/${playlist.id}/songs/reorder?fromIndex=${fromIndex}&toIndex=${toIndex}`,
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
        `${API_BASE_URL}/service-plans/${servicePlan.id}/songs/reorder?fromIndex=${fromIndex}&toIndex=${toIndex}`,
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
    markExplicitSend()
  }

  function selectPlaylistSong(song) {
    if (!song) {
      return
    }

    setPrepareMode('song')
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
  }

  function showLyrics() {
    if (networkCommand('SHOW_LYRICS')) return
    setProjectorControl({ mode: 'LIVE' })
    setProjectionMode('LIVE')
  }

  function clearLiveProjectionLyrics() {
    if (networkCommand('CLEAR_LYRICS', { clear: true })) return
    if (projectionMode === 'BLACK') {
      previousVisibleModeRef.current = 'CLEAR'
      return
    }

    setProjectorControl({ mode: 'CLEAR' })
    setProjectionMode('CLEAR')
  }

  function toggleClearLyrics() {
    if (networkCommand('CLEAR_LYRICS')) return
    if (projectionMode === 'BLACK') {
      previousVisibleModeRef.current =
        previousVisibleModeRef.current ===
        'CLEAR'
          ? 'LIVE'
          : 'CLEAR'
      return
    }

    if (projectionMode === 'CLEAR') {
      setProjectorControl({ mode: 'LIVE' })
      setProjectionMode('LIVE')
      return
    }

    clearLiveProjectionLyrics()
  }

  function toggleBlackScreen() {
    if (networkCommand('BLACK_SCREEN')) return
    if (projectionMode === 'BLACK') {
      if (currentSong) {
        setSelectedSong(currentSong)
      }

      setProjectorControl({ mode: previousVisibleModeRef.current })
      setProjectionMode(
        previousVisibleModeRef.current
      )
      return
    }

    previousVisibleModeRef.current =
      projectionMode
    setProjectorControl({ mode: 'BLACK' })
    setProjectionMode('BLACK')
  }

  function previousSection() {
    if (prepareMode === 'bible') { moveBiblePreviewVerse(-1); return }
    moveOperatorPreviewSection(-1)
  }

  function nextSection() {
    if (prepareMode === 'bible') { moveBiblePreviewVerse(1); return }
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

    if (networkCommand('SECTION_CHANGE', { index: liveSectionIndex })) return
    setSectionIndex(liveSectionIndex)
    setProjectionMode((currentMode) =>
      getNavigationProjectionMode(currentMode)
    )
  }

  async function ensureProjectorReady() {
    const transport = networkProjectorRef.current
    if (transport?.mode !== 'local') {
      if (!transport?.ready) throw new Error('Projector server is not connected.')
      if (transport.projectors > 0) return
      if (!['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)) {
        throw new Error('Open the projector display on the Windows computer, then Send Live.')
      }
    }
    await projectorConnectionRef.current.ensureReady()
    if (transport?.mode === 'network') {
      const deadline = Date.now() + 5000
      while (!transport.projectors && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50))
      if (!transport.projectors) throw new Error('Projector has not connected to the server. Try Send Live again.')
    }
  }

  async function openProjectorWindow() {
    try {
      await ensureProjectorReady()
    } catch (err) {
      setError(err.message)
    }
  }

  async function selectPresetBackground(variantId) {
    if (!settingsLoaded) return
    try {
      setError('')
      ++settingsRequestVersionRef.current
      const saved = await persistApplicationSettings({ ...appSettings, defaultBackground: variantId })
      setAppSettings(saved)
      setSettingsForm((current) => ({ ...current, defaultBackground: saved.defaultBackground }))
      networkCommand('BACKGROUND_CHANGE', { backgroundType: 'preset', backgroundVariant: saved.defaultBackground, customBackgroundData: null, customBackgroundId: null, customBackgroundName: '' })
      applySavedBackground(saved.defaultBackground)
    } catch (err) {
      setError(err.message || 'Could not save projector background.')
    } finally {
      setSettingsLoaded(true)
    }
  }

  async function selectCustomBackground() {
    try {
      const record = await loadBackgroundImage(savedCustomBackground?.id || customBackgroundId)
      if (!record?.file) throw new Error('Custom background image is unavailable. Upload it again.')
      const data = networkProjectorRef.current?.mode === 'network' ? await networkBackgroundFile(record.file) : null
      setCustomBackgroundId(record.id)
      setCustomBackgroundName(record.fileName)
      setBackgroundType('custom')
      setNetworkBackgroundData(data)
      networkCommand('BACKGROUND_CHANGE', { backgroundType: 'custom', customBackgroundId: record.id, customBackgroundName: record.fileName, customBackgroundData: data })
    } catch (err) { setError(err.message) }
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

      let imageData = null
      if (networkProjectorRef.current?.mode === 'network') {
        imageData = await networkBackgroundFile(file)
      }
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

      setSavedCustomBackground(savedBackground)
      setCustomBackgroundId(
        savedBackground.id
      )
      setCustomBackgroundName(
        savedBackground.fileName
      )
      setBackgroundType('custom')
      setNetworkBackgroundData(imageData)
      networkCommand('BACKGROUND_CHANGE', { backgroundType: 'custom', customBackgroundId: savedBackground.id,
        customBackgroundName: savedBackground.fileName, customBackgroundData: imageData })
    } catch (err) {
      setError(
        'Failed to store background image'
      )
    } finally {
      event.target.value = ''
    }
  }

  function activateSideNav(event) {
    const item = event.target.closest?.('.side-link')
    if (!item) return
    const items = Array.from(sideNavRef.current.querySelectorAll('.side-link'))
    setSidebarKeyboardIndex(items.indexOf(item))
    setActiveKeyboardPanel('SIDE_NAV')
  }

  function activateAdminKeyboardList(event) {
    if (!['songs', 'playlists', 'serviceHistory'].includes(activeView)) return
    const list = event.target.closest?.('.song-list, .playlist-management-list')
      || event.target.closest?.('section')?.querySelector('.song-list, .playlist-management-list')
    if (!list) return
    adminKeyboardListRef.current = list
    setActiveKeyboardPanel('ADMIN_LIST')
  }

  function activateEventsKeyboardPanel(event) {
    if (activeView !== 'events' || event.target?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"], [role="spinbutton"], [role="slider"], [role="listbox"], .modal-overlay, [aria-modal="true"]')) return
    setActiveKeyboardPanel('EVENTS_LIST')
  }

  const handlePresentationKey = useEffectEvent((event) => {
    const mode = isProjectorWindow
      ? presentationMode(projectorWindowState.projectionContentType, projectorWindowState.projectedEvents)
      : operatorKeyboardMode
    const command = keyboardShortcut(event, {
      mode, canSend: canKeyboardSend, publicWindow: isProjectorWindow,
      modalOpen: Boolean(document.querySelector('.modal-overlay, [aria-modal="true"], dialog[open]')),
    })
    if (!command) return
    if (isProjectorWindow) {
      if (networkCommand({ BLACK: 'BLACK_SCREEN', CLEAR: 'CLEAR_LYRICS' }[command] || command)) {
        event.preventDefault()
        return
      }
      if (!projectorChannelRef.current) return
      event.preventDefault()
      projectorChannelRef.current.postMessage(createProjectorCommandMessage(command))
      return
    }
    if (command.startsWith('ADMIN_')) {
      const list = adminKeyboardListRef.current
      if (!list?.isConnected) return
      const items = Array.from(list.querySelectorAll('.song-item, .playlist-management-item'))
      const selected = items.findIndex((item) => item.classList.contains('selected') || item.classList.contains('active'))
      const index = command === 'ADMIN_SELECT' ? selected : selected < 0 ? 0
        : Math.max(0, Math.min(items.length - 1, selected + (command === 'ADMIN_NEXT' ? 1 : -1)))
      const item = items[index]
      if (!item) return
      event.preventDefault()
      event.stopPropagation()
      // Reuse the row's existing selection action; never invoke nested controls.
      item.click()
      item.focus({ preventScroll: true })
      item.scrollIntoView({ block: 'nearest' })
      return
    }
    if (command.startsWith('EVENT_LIST_')) {
      event.preventDefault()
      const index = managementEvents.findIndex((item) => item.id === highlightedEventId)
      if (command === 'EVENT_LIST_EDIT') {
        if (index >= 0) openEditEventModal(managementEvents[index])
        return
      }
      const nextIndex = index < 0 ? 0 : Math.max(0, Math.min(managementEvents.length - 1, index + (command === 'EVENT_LIST_NEXT' ? 1 : -1)))
      const item = managementEvents[nextIndex]
      if (!item) return
      setHighlightedEventId(item.id)
      Array.from(document.querySelectorAll('[data-keyboard-event]')).find((node) => node.dataset.keyboardEvent === String(item.id))?.scrollIntoView({ block: 'nearest' })
      return
    }
    if (command.startsWith('SIDEBAR_')) {
      event.preventDefault()
      event.stopPropagation()
      const items = Array.from(sideNavRef.current?.querySelectorAll('.side-link') || [])
      if (command === 'SIDEBAR_OPEN') {
        items[sidebarKeyboardIndex]?.click()
      } else {
        const index = Math.max(0, Math.min(items.length - 1, sidebarKeyboardIndex + (command === 'SIDEBAR_NEXT' ? 1 : -1)))
        setSidebarKeyboardIndex(index)
        items[index]?.scrollIntoView({ block: 'nearest' })
      }
      return
    }
    if (['LIBRARY_NEXT', 'LIBRARY_PREVIOUS', 'SERVICE_NEXT', 'SERVICE_PREVIOUS', 'LIBRARY_SELECT', 'SERVICE_SELECT'].includes(command)) {
      event.preventDefault()
      event.stopPropagation()
      const library = command.startsWith('LIBRARY_')
      const items = library ? filteredSongs : playlistSongs
      const selectedId = library ? selectedSong?.id : highlightedServiceSongId
      const index = items.findIndex((song) => song.id === selectedId)
      if (command.endsWith('_SELECT')) {
        if (library && index >= 0) addSelectedSongToConsoleCollection()
        else if (!library && index >= 0) selectPlaylistSong(items[index])
        return
      }
      const nextIndex = index < 0 ? 0 : Math.max(0, Math.min(items.length - 1, index + (command.endsWith('_NEXT') ? 1 : -1)))
      const song = items[nextIndex]
      if (!song) return
      if (library) setSelectedSong(song)
      else setHighlightedServiceSongId(song.id)
      const panel = document.querySelector(library ? '.library-card' : '.service-card')
      Array.from(panel?.querySelectorAll('[data-keyboard-song]') || []).find((node) => node.dataset.keyboardSong === String(song.id))?.scrollIntoView({ block: 'nearest' })
      return
    }
    if (command === 'SCROLL_UP' || command === 'SCROLL_DOWN') {
      if (scrollOperatorContent(command === 'SCROLL_DOWN' ? 1 : -1)) event.preventDefault()
      return
    }
    event.preventDefault()
    if (command === 'BLACK') { toggleBlackScreen(); return }
    if (command === 'CLEAR') { toggleClearLyrics(); return }
    if (command === 'SEND') {
      if (keyboardSendInFlightRef.current) return
      keyboardSendInFlightRef.current = true
      Promise.resolve().then(() => {
        if (isEventsKeyboardMode) return projectEvent()
        if (prepareMode === 'bible') return projectBiblePassage({ singleVerse: true })
        return projectSong(currentSong)
      }).finally(() => { keyboardSendInFlightRef.current = false })
      return
    }
    const direction = command === 'NEXT' || command === 'NOTE_PAGE_NEXT' ? 1 : -1
    if (mode === 'EVENTS_LIST' || mode === 'REGULAR_EVENTS' || mode === 'BIRTHDAY_LIST') {
      if (isPreparedEventsLive) moveProjectedEventPage(direction)
      else setPreparedEventPages((pages) => ({ ...pages,
        [eventPresentation]: Math.max(0, Math.min(operatorEventPage + direction, eventPageCount(operatorEvents) - 1)),
      }))
    } else if (mode === 'NOTE') {
      scrollLiveNote(direction, command.startsWith('NOTE_PAGE') ? 'page' : 'line')
    } else if (mode === 'SONG') {
      moveOperatorPreviewSection(direction)
    } else if (mode === 'BIBLE') {
      if (isPreparedBibleLive) {
        const next = projectedBiblePassage.verses[projectedBibleVerseIndex + direction]
        if (next) {
          // In LAN mode the server echo advances both live and prepared positions together.
          // Optimistic selection would temporarily detach the keyboard from live navigation.
          if (networkProjectorRef.current?.mode === 'local') selectPreparedBibleVerse(next.verseNumber)
          navigateProjectedBibleVerse(direction)
        }
      } else moveBiblePreviewVerse(direction)
    }
  })

  useEffect(() => {
    const handleKeyDown = (event) => handlePresentationKey(event)
    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [])

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
        note={projectorWindowState.projectedNote}
        noteHeading={projectorWindowState.projectedNoteHeading}
        noteNavigation={projectorWindowState.noteNavigation}
        liveSendId={projectorWindowState.liveSend?.id}
        event={projectorWindowState.projectedEvent}
        events={projectorWindowState.projectedEvents}
        eventPageIndex={projectorWindowState.projectedEventPageIndex}
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
          projectorWindowState.customBackgroundData || customBackgroundUrl
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
          <div className="brand-logo" title={appSettings.churchName}>
            {appSettings.churchAbbreviation}
          </div>

          <div className="brand-copy">
            <h1>BOC WorshipView</h1>
            <p className="product-tagline">Worship • Scripture • Presentation</p>
          </div>
        </div>

        <nav className="side-nav" ref={sideNavRef} onClickCapture={activateSideNav} onFocusCapture={activateSideNav}>
          <button
            data-keyboard-highlight={activeKeyboardPanel === 'SIDE_NAV' && sidebarKeyboardIndex === 0}
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
            data-keyboard-highlight={activeKeyboardPanel === 'SIDE_NAV' && sidebarKeyboardIndex === 1}
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
            data-keyboard-highlight={activeKeyboardPanel === 'SIDE_NAV' && sidebarKeyboardIndex === 2}
            className={activeView === 'events' ? 'side-link active' : 'side-link'}
            onClick={() => setActiveView('events')}
          >
            <span className="nav-icon">▣</span>
            Upcoming Events
          </button>

          <button
            data-keyboard-highlight={activeKeyboardPanel === 'SIDE_NAV' && sidebarKeyboardIndex === 3}
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
            data-keyboard-highlight={activeKeyboardPanel === 'SIDE_NAV' && sidebarKeyboardIndex === 4}
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
            data-keyboard-highlight={activeKeyboardPanel === 'SIDE_NAV' && sidebarKeyboardIndex === 5}
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
            data-keyboard-highlight={activeKeyboardPanel === 'SIDE_NAV' && sidebarKeyboardIndex === 6}
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
          <footer className="app-copyright">© 2026 Jean Kennedy Demosthene. All rights reserved.</footer>
        </div>
      </aside>

      <main
        className={`main-area${activeView === 'events' ? ` keyboard-panel${activeKeyboardPanel === 'EVENTS_LIST' ? ' keyboard-panel-active' : ''}` : ''}`}
        data-keyboard-panel={activeView === 'events' ? activeKeyboardPanel : undefined}
        onPointerDownCapture={activateEventsKeyboardPanel}
        onClickCapture={(event) => { activateEventsKeyboardPanel(event); activateAdminKeyboardList(event) }}
        onFocusCapture={(event) => { activateEventsKeyboardPanel(event); activateAdminKeyboardList(event) }}
      >
        {(activeView === 'events' || isEventsKeyboardMode) && (
          <EventsPageStatus events={operatorEvents} pageIndex={operatorEventPage} live={isPreparedEventsLive} canSend={canKeyboardSend} listNavigation={activeView === 'events'} />
        )}
        {activeView === 'operator' && !isEventsKeyboardMode && (
          <div className="keyboard-status" role="status" aria-live="polite">
            {activeKeyboardPanel === 'SONG_LIBRARY' ? 'Song Library · ↑ ↓ Select · Enter Add Selected Song' : activeKeyboardPanel === 'WORKING_SERVICE' ? 'Working Service · ↑ ↓ Select · Enter Prepare Song' : prepareMode === 'bible' ? 'Bible · ← → / ↑ ↓ Verses' : `Song${currentSongSections[currentSongSectionIndex] ? ` · ${currentSongSections[currentSongSectionIndex].name}` : ''} · ← → Sections · ↑ ↓ Scroll`}
            {activeKeyboardPanel === 'CURRENT_SONG' && canKeyboardSend && ' · Enter · Send Live'} · B · Black Screen
          </div>
        )}
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

            <nav className="operator-panel-nav" aria-label="Console panels">
              <a href="#song-library-panel">Song Library</a>
              <a href="#working-service-panel">Service</a>
              <a href="#prepare-panel">Prepare</a>
              <a href="#live-controls">Live Controls</a>
            </nav>

            <div className="console-grid">
              <section id="song-library-panel" className={`console-card library-card keyboard-panel${activeKeyboardPanel === 'SONG_LIBRARY' ? ' keyboard-panel-active' : ''}`} onPointerDownCapture={() => setActiveKeyboardPanel('SONG_LIBRARY')} onFocusCapture={() => setActiveKeyboardPanel('SONG_LIBRARY')}>
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
                        data-keyboard-song={song.id}
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

              <section id="working-service-panel" className={`console-card service-card keyboard-panel${activeKeyboardPanel === 'WORKING_SERVICE' ? ' keyboard-panel-active' : ''}`} onPointerDownCapture={() => setActiveKeyboardPanel('WORKING_SERVICE')} onFocusCapture={() => setActiveKeyboardPanel('WORKING_SERVICE')}>
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
                          data-keyboard-song={song.id}
                          key={song.id}
                          className={[
                            'service-song',
                            highlightedServiceSongId === song.id ? 'keyboard-song-highlight' : '',
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
                            setHighlightedServiceSongId(song.id)
                            selectPlaylistSong(song)
                          }}
                          onKeyDown={(event) => {
                            // Enter is routed centrally to the highlighted row.
                            if (event.key === ' ' && event.target === event.currentTarget) {
                              event.preventDefault()
                              setHighlightedServiceSongId(song.id)
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

              <section id="prepare-panel" className={`right-console keyboard-panel${activeKeyboardPanel === 'CURRENT_SONG' ? ' keyboard-panel-active' : ''}`} onPointerDownCapture={() => setActiveKeyboardPanel('CURRENT_SONG')} onFocusCapture={() => setActiveKeyboardPanel('CURRENT_SONG')}>
                <AppScrollArea
                  className="song-detail-body-shell"
                  viewportClassName="song-detail-body"
                  viewportRef={
                    operatorContentViewportRef
                  }
                  dependencyKey={`operator-preview-${prepareMode}-${currentSongResolved?.id || 'none'}-${previewProjectionContentType}-${projectionMode}`}
                >
                <div className="prepare-workspace-tabs">
                    <button
                      type="button"
                      className={
                        prepareMode === 'song'
                          ? 'prepare-workspace-tab active'
                          : 'prepare-workspace-tab'
                      }
                      onClick={() => { setPrepareMode('song'); setActiveKeyboardPanel('CURRENT_SONG') }}
                    >
                      Song
                    </button>

                    <button
                      type="button"
                      className={
                        prepareMode === 'bible'
                          ? 'prepare-workspace-tab active'
                          : 'prepare-workspace-tab'
                      }
                      onClick={() => { setPrepareMode('bible'); setActiveKeyboardPanel('CURRENT_SONG') }}
                    >
                      Bible
                    </button>
                    <button type="button" className={`prepare-workspace-tab${prepareMode === 'notes' ? ' active' : ''}`} onClick={() => { setPrepareMode('notes'); setActiveKeyboardPanel('CURRENT_SONG') }}>Notes</button>
                </div>

                {prepareMode === 'notes' && <NotesPanel
                  key={loadedServicePlan ? `service-${loadedServicePlan.id}` : selectedPlaylist ? `playlist-${selectedPlaylist.id}` : 'session'}
                  serviceKey={loadedServicePlan ? `service-${loadedServicePlan.id}` : selectedPlaylist ? `playlist-${selectedPlaylist.id}` : 'session'}
                  serviceName={consoleCollectionLabel}
                  onSend={sendNoteLive} onBlack={toggleBlackScreen} onClear={toggleClearLyrics}
                  noteIsLive={projectionContentType === PROJECTION_CONTENT_TYPES.NOTE && Boolean(liveSend)}
                  onScroll={scrollLiveNote}
                  previewBackgroundClass={backgroundType === 'preset' ? `projector-screen-${backgroundVariant}` : 'projector-screen-custom'}
                  previewBackgroundUrl={backgroundType === 'custom' ? networkBackgroundData || customBackgroundUrl : ''}
                />}

                {prepareMode === 'song' && (
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

                      <div className="prepared-song-preview">
                        <p className="small-title">
                          Prepared Song Preview
                        </p>

                        <strong>
                          {currentSongSections[
                            currentSongSectionIndex
                          ]?.name || 'Ready'}
                        </strong>

                        <ProjectorDisplay
                          song={currentSongResolved}
                          sectionIndex={
                            currentSongSectionIndex
                          }
                          projectionMode="LIVE"
                          backgroundType={backgroundType}
                          backgroundVariant={
                            backgroundVariant
                          }
                          customBackgroundUrl={
                            networkBackgroundData || customBackgroundUrl
                          }
                          projectionSettings={
                            projectionSettings
                          }
                        />

                        <div className="current-actions">
                          <button
                            className="button button-secondary"
                            onClick={() =>
                              openEditSongModal(currentSong)
                            }
                          >
                            Edit
                          </button>

                          <button
                            className="button button-primary"
                            onClick={() =>
                              projectSong(currentSong)
                            }
                          >
                            Send to Projector
                          </button>
                        </div>

                        <div className="background-selector">
                          <span className="background-selector-label">
                            Background
                          </span>
                          <div className="background-options">
                            {BACKGROUND_OPTIONS.map((option) => (
                              <button
                                key={option.id}
                                type="button"
                                className={[
                                  'background-option',
                                  backgroundVariant === option.id
                                    ? 'active'
                                    : '',
                                ]
                                  .filter(Boolean)
                                  .join(' ')}
                                onClick={() =>
                                  selectPresetBackground(option.id)
                                }
                              >
                                <span className={option.swatchClassName} />
                                <span className="background-option-name">
                                  {option.name}
                                </span>
                              </button>
                            ))}
                            {(customBackgroundId || savedCustomBackground) && <button type="button" className="background-option" onClick={selectCustomBackground}>Custom</button>}
                            <button type="button" className="background-option" onClick={() => backgroundInputRef.current?.click()}>Upload Background</button>
                          </div>
                        </div>

                        <div id="live-controls" className="projection-controls">
                          <button
                            className="button button-secondary"
                            onClick={previousSection}
                            disabled={!canGoToPreviousProjection}
                          >
                            ← Previous
                          </button>
                          <button
                            className="button button-secondary"
                            onClick={toggleClearLyrics}
                          >
                            {projectionMode === 'CLEAR'
                              ? 'Show Lyrics'
                              : 'Clear Lyrics'}
                          </button>
                          <button
                            className="button button-secondary"
                            onClick={toggleBlackScreen}
                          >
                            {projectionMode === 'BLACK'
                              ? 'Show Screen'
                              : 'Black'}
                          </button>
                          <button
                            className="button button-primary"
                            onClick={openProjectorWindow}
                          >
                            Open Projector
                          </button>
                          <button
                            className="button button-primary"
                            onClick={nextSection}
                            disabled={!canGoToNextProjection}
                          >
                            Next →
                          </button>
                        </div>
                      </div>

                    </>
                  )}
                </div>
                  )}

                {prepareMode === 'bible' && (
                    <div className="console-card bible-prepare-workspace">
                      <div className="current-heading">
                        <div>
                          <p className="card-kicker">
                            Bible Preparation
                          </p>

                          <h3>
                            {previewBiblePassage?.reference ||
                              'Select a passage'}
                          </h3>
                        </div>
                      </div>

                      <form className="live-verse-jump" onSubmit={jumpLiveBibleVerse}>
                        <label>Live verse number<input inputMode="numeric" value={verseJump} onChange={event => { setVerseJump(event.target.value); setVerseJumpError('') }} disabled={!isBibleProjectionActive || !liveSend} aria-describedby="verse-jump-status" /></label>
                        <button className="button button-secondary" disabled={!isBibleProjectionActive || !liveSend}>Go to Verse</button>
                        <small id="verse-jump-status" role="status">{verseJumpError || (isBibleProjectionActive && liveSend ? `Navigates live: ${projectedBiblePassage.reference}` : 'Send a Bible passage live before using this control.')}</small>
                      </form>
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
                            value={bibleSelection.bookKey}
                            onChange={handleBibleBookChange}
                            disabled={bibleBooks.length === 0}
                          >
                            {bibleBooks.map((book) => (
                              <option key={book.key} value={book.key}>
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
                            value={bibleSelection.chapter}
                            onChange={handleBibleChapterChange}
                            disabled={!selectedBibleBook}
                          >
                            {selectedBibleChapterOptions.map(
                              (chapter) => (
                                <option key={chapter} value={chapter}>
                                  {chapter}
                                </option>
                              )
                            )}
                          </select>
                        </label>

                        <label className="bible-form-field">
                          <span>Start Verse</span>
                          <select
                            value={bibleSelection.startVerse}
                            onChange={handleBibleStartVerseChange}
                            disabled={selectedBibleVerseCount === 0}
                          >
                            {selectedBibleVerseOptions.map((verse) => (
                              <option key={verse} value={verse}>
                                {verse}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="bible-form-field">
                          <span>End Verse</span>
                          <select
                            value={bibleSelection.endVerse}
                            onChange={handleBibleEndVerseChange}
                            disabled={selectedBibleVerseCount === 0}
                          >
                            {selectedBibleContiguousEndVerseOptions.map(
                              (verse) => (
                                <option key={verse} value={verse}>
                                  {verse}
                                </option>
                              )
                            )}
                          </select>
                        </label>
                      </div>

                      <div id="live-controls" className="bible-selection-actions">
                        <button
                          className="button button-secondary"
                          onClick={previewBiblePassageSelection}
                          disabled={bibleBooks.length === 0}
                        >
                          Preview Passage
                        </button>
                      </div>

                      {previewBiblePassage ? (
                        <>
                          <div className="bible-projection-mode-control">
                            <p className="small-title">
                              Projection Language
                            </p>

                            <div className="bible-projection-mode-pills">
                              {BIBLE_PROJECTION_LANGUAGE_OPTIONS.map(
                                (option) => (
                                  <button
                                    key={option.value}
                                    disabled={option.value === BIBLE_PROJECTION_MODES.TRILINGUAL && !creoleTranslation}
                                    title={option.value === BIBLE_PROJECTION_MODES.TRILINGUAL && !creoleTranslation ? 'A real Kreyòl Bible dataset must be installed first.' : undefined}
                                    type="button"
                                    className={[
                                      'bible-projection-mode-pill',
                                      bibleProjectionMode === option.value
                                        ? 'active'
                                        : '',
                                    ]
                                      .filter(Boolean)
                                      .join(' ')}
                                    onClick={() =>
                                      setBibleProjectionMode(
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

                          {preparedBibleProjection && <details className="bible-presentation-preview">
                            <summary>Projector Preview (prepared — not live)</summary>
                            <ProjectorDisplay projectionContentType={PROJECTION_CONTENT_TYPES.BIBLE} biblePassage={preparedBibleProjection}
                              bibleVerseIndex={Math.max(0, preparedBibleProjection.verses.findIndex(v => v.verseNumber === bibleSelection.startVerse))} projectionMode="LIVE" />
                          </details>}

                          <div className="bible-reading-header">
                            <p className="small-title">
                              {previewBiblePassage.reference}
                            </p>
                            <span>
                              Select a verse to prepare it.
                            </span>
                          </div>

                          <div className="bible-live-nav-buttons">
                            <button
                              className="button button-secondary"
                              onClick={() =>
                                navigateProjectedBibleVerse(-1)
                              }
                              disabled={
                                !isBibleProjectionActive
                              }
                            >
                              ← Previous
                            </button>
                            <button
                              className="button button-secondary"
                              onClick={() =>
                                navigateProjectedBibleVerse(1)
                              }
                              disabled={
                                !isBibleProjectionActive
                              }
                            >
                              Next →
                            </button>
                            <button
                              className="button button-primary"
                              onClick={() =>
                                projectBiblePassage({
                                  singleVerse: true,
                                })
                              }
                            >
                              Send to Projector
                            </button>
                          </div>

                          <AppScrollArea
                            className="bible-console-reading-shell"
                            viewportClassName="bible-console-reading"
                            dependencyKey={`${previewBiblePassage.reference}-${bibleSelection.startVerse}-${bibleProjectionMode}`}
                          >
                            {previewBiblePassage.verses.map((verse) => (
                              <button
                                key={`${previewBiblePassage.reference}-${verse.verseNumber}`}
                                ref={(element) => {
                                  if (element) {
                                    bibleConsoleVerseRefs.current.set(
                                      verse.verseNumber,
                                      element
                                    )
                                  } else {
                                    bibleConsoleVerseRefs.current.delete(
                                      verse.verseNumber
                                    )
                                  }
                                }}
                                type="button"
                                className={[
                                  'bible-console-verse',
                                  bibleSelection.startVerse ===
                                  verse.verseNumber
                                    ? 'active'
                                    : '',
                                ]
                                  .filter(Boolean)
                                  .join(' ')}
                                onClick={() =>
                                  selectPreparedBibleVerse(
                                    verse.verseNumber
                                  )
                                }
                              >
                                <strong>
                                  {verse.verseNumber}
                                  {isBibleProjectionActive &&
                                    projectedBiblePassage?.reference ===
                                      previewBiblePassage.reference &&
                                    projectedBiblePassage.verses?.[
                                      projectedBibleVerseIndex
                                    ]?.verseNumber ===
                                      verse.verseNumber && (
                                      <span className="bible-live-indicator">
                                        Live
                                      </span>
                                    )}
                                </strong>
                                {previewBiblePassage.projectionMode ===
                                BIBLE_PROJECTION_MODES.FRENCH_ENGLISH ? (
                                  <span className="bible-console-verse-stack">
                                    <span>{verse.primaryText}</span>
                                    <span>{verse.secondaryText}</span>
                                  </span>
                                ) : (
                                  <span>{verse.text}</span>
                                )}
                              </button>
                            ))}
                          </AppScrollArea>

                        </>
                      ) : (
                        <div className="empty-state">
                          Preview a passage to review it before projection.
                        </div>
                      )}
                    </div>
                  )}

                <input
                  ref={backgroundInputRef}
                  className="background-upload-input"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleBackgroundUpload}
                />
                {false && (
                  <>
                <div className="preview-title-row">
                  <div>
                    <p className="card-kicker">
                      Live Projector Preview
                    </p>

                    <strong>
                      {liveProjectorState.projectionMode ===
                      'BLACK'
                        ? 'Black Screen'
                        : liveProjectorState.projectionMode !==
                            'LIVE'
                          ? 'Ready'
                          : liveProjectorState.projectionContentType ===
                              PROJECTION_CONTENT_TYPES.BIBLE
                            ? liveProjectorBibleVerse
                              ? `${liveProjectorState.projectedBiblePassage.reference} · Verse ${liveProjectorBibleVerse.verseNumber}`
                              : liveProjectorState.projectedBiblePassage?.reference ||
                                'Bible Passage'
                            : liveProjectorPreviewSection?.name ||
                              'Ready'}
                    </strong>
                  </div>

                  <div className="preview-header-actions">
                    <div className="live-indicator">
                      <span className="green-dot" />

                      {liveProjectorState.projectionMode}
                    </div>
                  </div>
                </div>

                <ProjectorDisplay
                  song={
                    liveProjectorState.projectionSong
                  }
                  sectionIndex={
                    liveProjectorState.sectionIndex
                  }
                  projectionContentType={
                    liveProjectorState.projectionContentType
                  }
                  biblePassage={
                    liveProjectorState.projectedBiblePassage
                  }
                  bibleVerseIndex={
                    liveProjectorState.projectedBibleVerseIndex
                  }
                  event={liveProjectorState.projectedEvent}
                  events={liveProjectorState.projectedEvents}
                  eventPageIndex={liveProjectorState.projectedEventPageIndex}
                  projectionMode={
                    liveProjectorState.projectionMode
                  }
                  backgroundType={
                    liveProjectorState.backgroundType
                  }
                  backgroundVariant={
                    liveProjectorState.backgroundVariant
                  }
                  customBackgroundUrl={
                    networkBackgroundData || customBackgroundUrl
                  }
                  projectionSettings={
                    liveProjectorState.projectionSettings
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
                      projectionContentType === PROJECTION_CONTENT_TYPES.EVENT
                        ? () => moveProjectedEventPage(-1)
                        : previousSection
                    }
                    disabled={
                      projectionContentType === PROJECTION_CONTENT_TYPES.EVENT
                        ? projectedEventPageIndex <= 0
                        : !canGoToPreviousProjection
                    }
                  >
                    {projectionContentType !== PROJECTION_CONTENT_TYPES.EVENT && previewProjectionContentType ===
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
                    onClick={projectionContentType === PROJECTION_CONTENT_TYPES.EVENT ? () => moveProjectedEventPage(1) : nextSection}
                    disabled={
                      projectionContentType === PROJECTION_CONTENT_TYPES.EVENT
                        ? projectedEventPageIndex >= eventPageCount(projectedEvents) - 1
                        : !canGoToNextProjection
                    }
                  >
                    {projectionContentType !== PROJECTION_CONTENT_TYPES.EVENT && previewProjectionContentType ===
                    PROJECTION_CONTENT_TYPES.BIBLE
                      ? 'Next Verse →'
                      : 'Next →'}
                  </button>
                </div>

                <p className="projection-shortcuts-hint">
                  Shortcuts: `←` previous, `→` or `Space` next, `B` black, `C` clear lyrics.
                </p>
                  </>
                )}
                </AppScrollArea>
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

        {activeView === 'events' && (
          <div className="admin-view">
            <header className="service-header">
              <div>
                <p className="page-kicker">Upcoming Events</p>
                <h2>Upcoming Events</h2>
                <p className="header-description">Plan and manage upcoming church events.</p>
              </div>
              <div className="header-right">
                <label>
                  Presentation
                  <select value={eventPresentation} onChange={(event) => { setEventPresentation(event.target.value); setActiveKeyboardPanel('EVENTS_LIST') }}>
                    <option value="upcoming">Upcoming Events ({upcomingEvents.length})</option>
                    {birthdayLists.map((event) => (
                      <option key={event.id} value={String(event.id)}>
                        Birthday List — {MONTH_NAMES[event.birthdayMonth - 1]}{event.displayYear ? ` ${event.displayYear}` : ''} ({event.birthdayEntries.length} birthdays)
                      </option>
                    ))}
                    {eventPresentation !== 'upcoming' && !selectedEventPresentation.length && (
                      <option value={eventPresentation} disabled>Birthday List unavailable</option>
                    )}
                  </select>
                </label>
                <button className="button button-secondary" onClick={openNewEventModal}>+ Add Event</button>
                <button className="button button-primary" disabled={isSendingEvents || (selectedEventIds !== null && eventPresentation === 'upcoming' && !selectedEventPageCount) || (eventPresentation !== 'upcoming' && !selectedEventPageCount)} onClick={projectEvent}>{isSendingEvents ? 'Sending…' : 'Send to Projector'}</button>
              </div>
            </header>

            <div className="event-selection-toolbar">
              <span>{selectedEvents(upcomingEvents, selectedEventIds).length} upcoming events selected</span>
              <button className="button button-secondary" onClick={() => changeEventSelection(null)}>Select All Events</button>
              <button className="button button-secondary" onClick={() => changeEventSelection([])}>Clear Event Selection</button>
              <small>Selection is preparation only. Send to Projector to replace live events. Birthday lists use the existing presentation selector.</small>
            </div>
            <section className="events-list">
              {managementEvents.map((event) => (
                <article className={`console-card event-card${highlightedEventId === event.id ? ' keyboard-event-highlight' : ''}`} data-keyboard-event={event.id} key={event.id} onClick={(click) => { if (!click.target.closest('button, input, select, textarea, [contenteditable]')) setHighlightedEventId(event.id) }}>
                  <div>

                    {isBirthdayList(event) ? <>
                      <p className="card-kicker">Birthday List</p>
                      <h3>Birthdays for the Month of {MONTH_NAMES[event.birthdayMonth - 1]}</h3>
                      <p>{event.birthdayEntries.length} birthdays{event.displayYear ? ` · Display year: ${event.displayYear}` : ''}</p>
                      <ul className="birthday-summary">{sortBirthdays(event.birthdayEntries).map((person, index) => <li key={index}>{person.name} — {birthdayDateLabel(person)}</li>)}</ul>
                    </> : <>
                    <p className="card-kicker">{event.eventType || 'Event'}</p>
                    <p style={{ color: event.dateColor || '#8B3A8B', fontWeight: event.dateBold ?? true ? 800 : undefined, fontStyle: event.dateItalic ? 'italic' : undefined, textDecoration: event.dateUnderline ?? true ? 'underline' : undefined }}>{formatEventDateRange(event.eventDate, event.endDate)}</p>
                    <h3 style={{ color: event.titleColor || '#000000', fontWeight: event.titleBold ? 800 : undefined, fontStyle: event.titleItalic ? 'italic' : undefined, textDecoration: event.titleUnderline ? 'underline' : undefined }}>{event.title}</h3>
                    {event.hostName?.trim() && <p style={{ color: event.detailsColor || '#000000' }}>Host: {event.hostName.trim()}</p>}
                    <p>{formatServiceTime(event.startTime)}{event.endTime ? ` - ${formatServiceTime(event.endTime)}` : ''}</p>
                    {event.location && <p style={{ color: event.detailsColor || '#000000' }}>{event.location}</p>}
                    {event.description && <p className="event-description" style={{ color: event.detailsColor || '#000000' }}>{event.description}</p>}
                    </>}
                    {!isBirthdayList(event) && <label className="event-selection-control"><input type="checkbox" aria-label={`Include ${event.title} in projection`} checked={selectedEventIds === null || selectedEventIds.includes(event.id)} onChange={change => {
                      const ids = selectedEventIds === null ? upcomingEvents.map(item => item.id) : selectedEventIds
                      changeEventSelection(change.target.checked ? [...ids, event.id] : ids.filter(id => id !== event.id))
                    }} /><span>Include in projection</span></label>}
                  </div>
                  <div className="event-actions">
                    <button className="button button-secondary" onClick={() => openEditEventModal(event)}>Edit</button>
                    <button className="button button-danger" onClick={() => deleteEvent(event)}>Delete</button>
                  </div>
                </article>
              ))}
              {events.every((event) => !isBirthdayList(event) && !isUpcomingEvent(event, getLocalIsoDate())) && (
                <div className="empty-state">No upcoming events.<br /><button className="button button-primary" onClick={openNewEventModal}>+ Add Event</button></div>
              )}
            </section>
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

            <NetworkAccessPanel />

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

                    <h3>Projection Preferences</h3>
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
                    The background applies to the projector and remains saved after refresh.
                    Language and service type provide defaults for future sessions.
                  </p>

                  <div className="settings-actions">
                    <button
                      className="button button-primary"
                      onClick={
                        saveApplicationSettings
                      }
                      disabled={!settingsLoaded}
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
                  Protect your BOC WorshipView
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

      {showEventModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-heading">
              <div><p className="card-kicker">Upcoming Events</p><h2>{editingEventId == null ? 'Add Event' : 'Edit Event'}</h2></div>
              <button className="modal-close" onClick={() => setShowEventModal(false)}>×</button>
            </div>
            {error && <p role="alert" className="event-editor-error">{error}</p>}
            <label>Event Type<select value={isBirthdayList(eventForm) ? BIRTHDAY_LIST : 'REGULAR'} onChange={(event) => setEventForm({ ...eventForm, eventType: event.target.value === BIRTHDAY_LIST ? BIRTHDAY_LIST : '' })}>
              <option value="REGULAR">Regular Event</option><option value={BIRTHDAY_LIST}>Birthday List</option>
            </select></label>
            {isBirthdayList(eventForm) ? <BirthdayEditor value={eventForm} onChange={setEventForm} /> : <>
            <label>Title *<input value={eventForm.title} onChange={(event) => setEventForm({ ...eventForm, title: event.target.value })} /></label>
            <label>Start Date *<input type="date" required value={eventForm.eventDate} onChange={(event) => setEventForm({ ...eventForm, eventDate: event.target.value })} /></label>
            <label>End Date<input type="date" min={eventForm.eventDate || undefined} value={eventForm.endDate} onChange={(event) => setEventForm({ ...eventForm, endDate: event.target.value })} /></label>
            <label>Start Time *<input type="time" value={eventForm.startTime} onChange={(event) => setEventForm({ ...eventForm, startTime: event.target.value })} /></label>
            <label>End Time<input type="time" value={eventForm.endTime} onChange={(event) => setEventForm({ ...eventForm, endTime: event.target.value })} /></label>
            <label>Host Name (optional)<input type="text" value={eventForm.hostName} onChange={(event) => setEventForm({ ...eventForm, hostName: event.target.value })} /></label>
            <label>Location<input value={eventForm.location} onChange={(event) => setEventForm({ ...eventForm, location: event.target.value })} /></label>
            <label>Category<select value={eventForm.eventType} onChange={(event) => setEventForm({ ...eventForm, eventType: event.target.value })}><option value="">Select type</option>{EVENT_TYPE_OPTIONS.map((type) => <option key={type} value={type}>{type.replace('_', ' ')}</option>)}</select></label>
            <label>Description<textarea rows="4" value={eventForm.description} onChange={(event) => setEventForm({ ...eventForm, description: event.target.value })} /></label>
            {[
              ['Title Color', 'titleColor'],
              ['Date Color', 'dateColor'],
              ['Details Color', 'detailsColor'],
            ].map(([label, field]) => (
              <div className="event-color-field" key={field}>
                <span>{label}</span>
                <input type="color" value={eventForm[field]} onChange={(event) => setEventForm({ ...eventForm, [field]: event.target.value })} />
                <div className="event-color-palette">
                  {EVENT_COLOR_PALETTE.map(([name, color]) => (
                    <button key={color} type="button" title={name} aria-label={name} className={eventForm[field] === color ? 'active' : ''} style={{ backgroundColor: color }} onClick={() => setEventForm({ ...eventForm, [field]: color })} />
                  ))}
                </div>
              </div>
            ))}
            {[
              ['Title Formatting', 'titleBold', 'titleItalic', 'titleUnderline'],
              ['Date Formatting', 'dateBold', 'dateItalic', 'dateUnderline'],
              ['Details Formatting', 'detailsBold', 'detailsItalic', 'detailsUnderline'],
            ].map(([label, bold, italic, underline]) => (
              <div className="event-format-field" key={label}>
                <span>{label}</span>
                <div className="event-format-buttons">
                  {[[bold, 'B', 'Bold'], [italic, 'I', 'Italic'], [underline, 'U', 'Underline']].map(([field, text, name]) => (
                    <button key={field} type="button" aria-label={name} title={name} className={eventForm[field] ? 'active' : ''} onClick={() => setEventForm({ ...eventForm, [field]: !eventForm[field] })}>{text}</button>
                  ))}
                </div>
              </div>
            ))}
            </>}
            <div className="modal-buttons"><button className="button button-secondary" onClick={() => setShowEventModal(false)}>Cancel</button><button className="button button-primary" onClick={saveEvent}>{editingEventId == null ? 'Add Event' : 'Save Event'}</button></div>
          </div>
        </div>
      )}

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
