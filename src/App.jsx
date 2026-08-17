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

function sortServicePlans(servicePlans) {
  return [...servicePlans].sort((left, right) => {
    const leftDateTime = `${left.serviceDate || ''}T${left.serviceTime || '99:99'}`
    const rightDateTime = `${right.serviceDate || ''}T${right.serviceTime || '99:99'}`

    return leftDateTime.localeCompare(rightDateTime)
  })
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

function parseLyricsSections(lyrics) {
  if (!lyrics) {
    return []
  }

  const lines = lyrics.split('\n')
  const sections = []

  let currentSection = {
    name: 'Verse 1',
    lines: [],
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
        name: match[1],
        lines: [],
      }
    } else {
      currentSection.lines.push(line)
    }
  }

  if (currentSection.lines.length > 0) {
    sections.push(currentSection)
  }

  return sections
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

    return parseLyricsSections(song.lyrics)
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

  const [selectedSong, setSelectedSong] =
    useState(null)
  const [currentSong, setCurrentSong] =
    useState(null)

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
    loadedServicePlanId,
    setLoadedServicePlanId,
  ] = useState(null)

  const [search, setSearch] = useState('')
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
    showDeleteBlockedModal,
    setShowDeleteBlockedModal,
  ] = useState(false)
  const [
    showSaveServiceModal,
    setShowSaveServiceModal,
  ] = useState(false)
  const [
    showUseForTodayModal,
    setShowUseForTodayModal,
  ] = useState(false)

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

  const [newSong, setNewSong] = useState({
    title: '',
    author: '',
    lyrics: '',
    songType: 'SLOW',
  })

  const [editSong, setEditSong] = useState({
    title: '',
    author: '',
    lyrics: '',
    songType: 'SLOW',
  })
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
  const [
    settingsForm,
    setSettingsForm,
  ] = useState(() =>
    normalizeProjectionSettings(
      readStoredProjectorSettings()
    )
  )
  const [
    newPlaylistName,
    setNewPlaylistName,
  ] = useState('')
  const [
    renamePlaylistName,
    setRenamePlaylistName,
  ] = useState('')
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

      setServicePlans(sortedPlans)

      setOpenedServicePlanId((current) => {
        if (current == null) {
          return sortedPlans[0]?.id || null
        }

        return sortedPlans.some(
          (servicePlan) =>
            servicePlan.id === current
        )
          ? current
          : sortedPlans[0]?.id || null
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
  const openedServicePlan =
    servicePlans.find(
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
    servicePlans.filter(
      (servicePlan) =>
        (servicePlan.serviceDate || '') >=
        getTodayDateValue()
    )
  const usingLoadedServicePlan =
    loadedServicePlan != null
  const consoleCollectionLabel =
    usingLoadedServicePlan
      ? loadedServicePlan.serviceName
      : selectedPlaylist?.name
  const consoleCollectionTypeLabel =
    usingLoadedServicePlan
      ? 'Loaded Service Plan'
      : 'Service Playlist'

  const previewSong =
    projectionSong || currentSong

  const previewSections = useMemo(() => {
    if (!previewSong) {
      return []
    }

    return parseLyricsSections(
      previewSong.lyrics
    )
  }, [previewSong])

  const currentSection =
    previewSections[sectionIndex] ||
    previewSections[0]

  const canGoToPreviousProjection =
    sectionIndex > 0

  const canGoToNextProjection =
    sectionIndex <
      previewSections.length - 1

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
      : servicePlans
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

  useEffect(() => {
    setRenamePlaylistName(
      openedPlaylist?.name || ''
    )
  }, [openedPlaylist?.id, openedPlaylist?.name])

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

      setNewSong({
        title: '',
        author: '',
        lyrics: '',
        songType: 'SLOW',
      })

      setShowNewSongModal(false)
    } catch (err) {
      setError(err.message)
    }
  }

  function openEditSongModal(
    song = selectedSong
  ) {
    if (!song) {
      return
    }

    setSelectedSong(song)
    setEditSong({
      title: song.title || '',
      author: song.author || '',
      lyrics: song.lyrics || '',
      songType:
        song.songType || 'SLOW',
    })

    setShowEditSongModal(true)
  }

  async function updateSong() {
    if (!selectedSong) {
      return
    }

    try {
      setError('')

      const response = await fetch(
        `http://localhost:8080/songs/${selectedSong.id}`,
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
        throw new Error(
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

      setShowEditSongModal(false)
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
        throw new Error(
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
      setSelectedSong(nextSongs[0] || null)
      setSectionIndex(0)

      if (projectionSong?.id === deletedSongId) {
        setProjectionSong(null)
      }

      if (currentSong?.id === deletedSongId) {
        setCurrentSong(null)
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

  function returnToActivePlaylist() {
    setLoadedServicePlanId(null)
  }

  async function createPlaylist() {
    const trimmedName = newPlaylistName.trim()

    if (!trimmedName) {
      setError('Playlist name is required')
      return
    }

    try {
      setError('')

      const response = await fetch(
        'http://localhost:8080/playlists',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            name: trimmedName,
          }),
        }
      )

      if (!response.ok) {
        const message =
          await readErrorMessage(response)

        throw new Error(
          message ||
            'Failed to create playlist'
        )
      }

      const createdPlaylist =
        await response.json()

      setPlaylists((current) => [
        ...current,
        createdPlaylist,
      ])
      setOpenedPlaylistId(createdPlaylist.id)
      setNewPlaylistName('')
      setSuccessMessage(
        `Created reusable playlist "${createdPlaylist.name}".`
      )
    } catch (err) {
      setError(err.message)
      setSuccessMessage('')
    }
  }

  async function renameOpenedPlaylist() {
    if (!openedPlaylist) {
      return
    }

    const trimmedName = renamePlaylistName.trim()

    if (!trimmedName) {
      setError('Playlist name is required')
      return
    }

    try {
      setError('')

      const response = await fetch(
        `http://localhost:8080/playlists/${openedPlaylist.id}/rename`,
        {
          method: 'PUT',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            name: trimmedName,
          }),
        }
      )

      if (!response.ok) {
        const message =
          await readErrorMessage(response)

        throw new Error(
          message ||
            'Failed to rename playlist'
        )
      }

      const updatedPlaylist =
        await response.json()

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

      setOpenedPlaylistId(updatedPlaylist.id)
      setRenamePlaylistName(updatedPlaylist.name)
    } catch (err) {
      setError(err.message)
    }
  }

  async function deleteOpenedPlaylist() {
    if (!openedPlaylist) {
      return
    }

    const confirmed = window.confirm(
      `Delete playlist "${openedPlaylist.name}"?`
    )

    if (!confirmed) {
      return
    }

    try {
      setError('')

      const playlistName =
        encodeURIComponent(
          openedPlaylist.name
        )

      const response = await fetch(
        `http://localhost:8080/playlists?name=${playlistName}`,
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
          playlist.id !== openedPlaylist.id
      )
      const remainingReusablePlaylists =
        remainingPlaylists.filter(
          (playlist) =>
            playlist.reusable !== false
        )

      setPlaylists(remainingPlaylists)

      if (selectedPlaylist?.id === openedPlaylist.id) {
        setSelectedPlaylist(
          remainingReusablePlaylists[0] || null
        )
      }

      setOpenedPlaylistId(
        remainingReusablePlaylists[0]?.id ||
          null
      )
      setRenamePlaylistName('')
    } catch (err) {
      setError(err.message)
    }
  }

  function openUseForTodayModal() {
    if (!openedPlaylist) {
      return
    }

    setError('')
    setSuccessMessage('')
    setUseForTodaySourcePlaylistId(
      openedPlaylist.id
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

      if (currentSong?.id === song.id) {
        setSelectedSong((current) =>
          current?.id === song.id
            ? null
            : current
        )
        setCurrentSong(null)
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

    setCurrentSong(song)
    setProjectionSong(song)
    setSectionIndex(0)
    setProjectionMode('LIVE')
  }

  function selectPlaylistSong(song) {
    if (!song) {
      return
    }

    setSelectedSong(song)
    setCurrentSong(song)
    setProjectionSong(song)
    setSectionIndex(0)
    setProjectionMode('LIVE')
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
            onClick={() =>
              setActiveView('songs')
            }
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
          <>
            <header className="service-header">
              <div>
                <p className="page-kicker">
                  Sunday Morning Service
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
                  onClick={() =>
                    setShowNewSongModal(
                      true
                    )
                  }
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

                        <span
                          className={
                            song.songType ===
                            'FAST'
                              ? 'type-label fast'
                              : 'type-label slow'
                          }
                        >
                          {song.songType}
                        </span>
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

                    <button
                      className="button button-secondary inline-button"
                      onClick={
                        openSaveServiceModal
                      }
                    >
                      Save as Service Plan
                    </button>
                  </div>
                </div>

                {playlists.length > 0 && (
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
                          {playlist.reusable === false
                            ? `Working Service: ${playlist.name}`
                            : playlist.name}
                        </option>
                      )
                    )}
                  </select>
                )}

                {loadedServicePlan && (
                  <div className="inline-note">
                    This console is currently
                    showing the saved service
                    plan for{' '}
                    {formatServiceSchedule(
                      loadedServicePlan
                    )}
                    . The active reusable
                    playlist remains{' '}
                    <strong>
                      {selectedPlaylist?.name ||
                        'unchanged'}
                    </strong>
                    .
                  </div>
                )}

                {loadedServicePlan && (
                  <div className="playlist-library-actions service-plan-console-actions">
                    <button
                      className="button button-secondary inline-button"
                      onClick={
                        returnToActivePlaylist
                      }
                    >
                      Use Active Playlist
                    </button>
                  </div>
                )}

                <div className="service-song-list">
                  {playlistSongs.map(
                    (song, index) => (
                      <div
                        key={song.id}
                        className={[
                          'service-song',
                          currentSong?.id ===
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

                    {currentSong && (
                      <span
                        className={
                          currentSong.songType ===
                          'FAST'
                            ? 'type-label fast'
                            : 'type-label slow'
                        }
                      >
                        {
                          currentSong.songType
                        }
                      </span>
                    )}
                  </div>

                  {currentSong && (
                    <>
                      <div className="section-control-area">
                        <p className="small-title">
                          Sections
                        </p>

                        <div className="section-pills">
                          {parseLyricsSections(
                            currentSong.lyrics
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

                  <div className="live-indicator">
                    <span className="green-dot" />

                    {projectionMode}
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
          </>
        )}

        {activeView === 'songs' && (
          <>
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
                    setActiveView('operator')
                  }
                >
                  Worship Console
                </button>

                <button
                  className="button button-primary"
                  onClick={() =>
                    setShowNewSongModal(true)
                  }
                >
                  + New Song
                </button>
              </div>
            </header>

            <div className="songs-management-grid">
              <section className="console-card">
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

                      <span
                        className={
                          song.songType ===
                          'FAST'
                            ? 'type-label fast'
                            : 'type-label slow'
                        }
                      >
                        {song.songType}
                      </span>
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

                  {selectedSong && (
                    <span
                      className={
                        selectedSong.songType ===
                        'FAST'
                          ? 'type-label fast'
                          : 'type-label slow'
                      }
                    >
                      {
                        selectedSong.songType
                      }
                    </span>
                  )}
                </div>

                {selectedSong ? (
                  <>
                    <div className="song-detail-meta">
                      <p>
                        <strong>Author:</strong>{' '}
                        {selectedSong.author ||
                          'Unknown author'}
                      </p>

                      <p>
                        <strong>Type:</strong>{' '}
                        {selectedSong.songType}
                      </p>

                      <p>
                        <strong>Usage:</strong>{' '}
                        {
                          selectedSongUsageCount
                        }
                      </p>
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

                    <div className="song-lyrics-preview">
                      {selectedSong.lyrics ||
                        'No lyrics added yet.'}
                    </div>

                    <div className="detail-actions">
                      <button
                        className="button button-secondary"
                        onClick={
                          openEditSongModal
                        }
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
                  <div className="empty-state">
                    Choose a song to edit or
                    delete it.
                  </div>
                )}
              </section>
            </div>
          </>
        )}

        {activeView === 'playlists' && (
          <>
            <header className="service-header">
              <div>
                <p className="page-kicker">
                  Playlist Administration
                </p>

                <h2>Manage Playlists</h2>

                <p className="header-description">
                  Create service plans, organize
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
              <section className="console-card">
                <div className="card-header">
                  <div>
                    <p className="card-kicker">
                      Reusable Playlists
                    </p>

                    <h3>All Reusable Playlists</h3>
                  </div>

                  <span className="number-pill">
                    {reusablePlaylists.length}
                  </span>
                </div>

                <div className="playlist-create-row">
                  <input
                    type="text"
                    placeholder="New playlist name"
                    value={newPlaylistName}
                    onChange={(event) =>
                      setNewPlaylistName(
                        event.target.value
                      )
                    }
                  />

                  <button
                    className="button button-primary"
                    onClick={createPlaylist}
                  >
                    Create
                  </button>
                </div>

                <div className="playlist-management-list">
                  {reusablePlaylists.map(
                    (playlist) => (
                    <button
                      key={playlist.id}
                      className={
                        openedPlaylistId ===
                        playlist.id
                          ? 'playlist-management-item active'
                          : 'playlist-management-item'
                      }
                      onClick={() =>
                        setOpenedPlaylistId(
                          playlist.id
                        )
                      }
                    >
                      <div className="playlist-management-copy">
                        <strong>
                          {playlist.name}
                        </strong>

                        <span>
                          {(
                            playlist.songs || []
                          ).filter(
                            (song) =>
                              song != null
                          ).length}{' '}
                          songs
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

                  {reusablePlaylists.length ===
                    0 && (
                    <div className="empty-state">
                      Create a playlist to start
                      building a service order.
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
                      {openedPlaylist?.name ||
                        'Select a Playlist'}
                    </h3>
                  </div>

                  {openedPlaylist && (
                    <button
                      className="button button-primary"
                      onClick={openUseForTodayModal}
                    >
                      Use for Today’s Service
                    </button>
                  )}
                </div>

                {openedPlaylist ? (
                  <>
                    <div className="playlist-create-row">
                      <input
                        type="text"
                        placeholder="Rename playlist"
                        value={renamePlaylistName}
                        onChange={(event) =>
                          setRenamePlaylistName(
                            event.target.value
                          )
                        }
                      />

                      <button
                        className="button button-secondary"
                        onClick={
                          renameOpenedPlaylist
                        }
                      >
                        Rename
                      </button>

                      <button
                        className="button button-danger"
                        onClick={
                          deleteOpenedPlaylist
                        }
                      >
                        Delete
                      </button>
                    </div>

                    <div className="playlist-library-layout">
                      <div>
                        <p className="small-title">
                          Playlist Songs
                        </p>

                        <div className="service-song-list">
                          {openedPlaylistSongs.map(
                            (song, index) => (
                              <div
                                key={`${openedPlaylist.id}-${song.id}-${index}`}
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
                                        openedPlaylist
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
                                      openedPlaylistSongs.length -
                                        1
                                    }
                                    onClick={() =>
                                      moveSongInPlaylist(
                                        index,
                                        index + 1,
                                        openedPlaylist
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
                                        openedPlaylist
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

                          {openedPlaylistSongs.length ===
                            0 && (
                            <div className="empty-state">
                              This playlist is
                              empty.
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
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

                        <div className="song-list">
                          {filteredSongs.map(
                            (song) => {
                              const alreadyInPlaylist =
                                openedPlaylistSongs.some(
                                  (
                                    playlistSong
                                  ) =>
                                    playlistSong.id ===
                                    song.id
                                )

                              return (
                                <div
                                  key={`${openedPlaylist.id}-library-${song.id}`}
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
                                          openedPlaylist,
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
                    Choose a playlist to rename,
                    fill with songs, or mark as
                    active for service.
                  </div>
                )}
              </section>
            </div>

            <div className="service-plans-management-grid">
              <section className="console-card">
                <div className="card-header">
                  <div>
                    <p className="card-kicker">
                      Upcoming Services
                    </p>

                    <h3>
                      Dated Service Plans
                    </h3>
                  </div>

                  <span className="number-pill">
                    {upcomingServicePlans.length}
                  </span>
                </div>

                <div className="playlist-create-row">
                  <button
                    className="button button-primary"
                    onClick={() =>
                      openSaveServiceModal(
                        openedPlaylist ||
                          selectedPlaylist
                      )
                    }
                  >
                    New Service Plan
                  </button>
                </div>

                <div className="playlist-management-list">
                  {upcomingServicePlans.map(
                    (servicePlan) => (
                      <button
                        key={servicePlan.id}
                        className={
                          openedServicePlanId ===
                          servicePlan.id
                            ? 'playlist-management-item active'
                            : 'playlist-management-item'
                        }
                        onClick={() =>
                          setOpenedServicePlanId(
                            servicePlan.id
                          )
                        }
                      >
                        <div className="playlist-management-copy">
                          <strong>
                            {
                              servicePlan.serviceName
                            }
                          </strong>

                          <span>
                            {formatServiceSchedule(
                              servicePlan
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
                        </div>

                        {loadedServicePlanId ===
                          servicePlan.id && (
                          <span className="active-playlist-badge">
                            Loaded
                          </span>
                        )}
                      </button>
                    )
                  )}

                  {upcomingServicePlans.length ===
                    0 && (
                    <div className="empty-state">
                      No service plans have been
                      saved yet.
                    </div>
                  )}
                </div>
              </section>

              <section className="console-card playlist-detail-card">
                <div className="card-header">
                  <div>
                    <p className="card-kicker">
                      Service Plan Details
                    </p>

                    <h3>
                      {openedServicePlan
                        ?.serviceName ||
                        'Select a Service'}
                    </h3>
                  </div>

                  {openedServicePlan && (
                    <button
                      className="button button-primary"
                      onClick={() =>
                        openServicePlanInConsole(
                          openedServicePlan
                        )
                      }
                    >
                      {loadedServicePlanId ===
                      openedServicePlan.id
                        ? 'Loaded in Console'
                        : 'Open in Console'}
                    </button>
                  )}
                </div>

                {openedServicePlan ? (
                  <>
                    <div className="service-plan-meta-grid">
                      <input
                        type="text"
                        name="serviceName"
                        placeholder="Service name"
                        value={
                          servicePlanForm.serviceName
                        }
                        onChange={
                          handleServicePlanFormChange
                        }
                      />

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
                    </div>

                    <div className="service-plan-detail-actions">
                      <button
                        className="button button-secondary"
                        onClick={
                          updateOpenedServicePlan
                        }
                      >
                        Save Changes
                      </button>

                      <button
                        className="button button-secondary"
                        onClick={
                          duplicateOpenedServicePlan
                        }
                      >
                        Duplicate
                      </button>

                      <button
                        className="button button-danger"
                        onClick={
                          deleteOpenedServicePlan
                        }
                      >
                        Delete
                      </button>
                    </div>

                    <p className="settings-preview-copy">
                      Loading this service into
                      the Worship Console swaps
                      the service song list but
                      does not automatically
                      send anything to the
                      projector.
                    </p>

                    <div className="service-song-list">
                      {openedServicePlanSongs.map(
                        (song, index) => (
                          <div
                            key={`${openedServicePlan.id}-${song.id}-${index}`}
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

                      {openedServicePlanSongs.length ===
                        0 && (
                        <div className="empty-state">
                          This service plan is
                          empty.
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="empty-state">
                    Select a service plan to
                    rename it, reschedule it,
                    duplicate it, delete it, or
                    load it into the Worship
                    Console.
                  </div>
                )}
              </section>
            </div>
          </>
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
                onClick={() =>
                  setShowNewSongModal(
                    false
                  )
                }
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
                onClick={() =>
                  setShowNewSongModal(
                    false
                  )
                }
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
                onClick={() =>
                  setShowEditSongModal(
                    false
                  )
                }
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
                onClick={() =>
                  setShowEditSongModal(
                    false
                  )
                }
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
