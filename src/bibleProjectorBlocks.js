// Bib La 1985 names, matching BibleBookDisplayNames on the API: https://ebible.org/hat/
// Resolve at display time too: older live snapshots may contain English bookName values.
const CREOLE_BOOK_NAMES = Object.freeze({
  'GENESIS': 'Jenèz',
  'EXODUS': 'Egzòd',
  'LEVITICUS': 'Levitik',
  'NUMBERS': 'Resansman',
  'DEUTERONOMY': 'Deteronòm',
  'JOSHUA': 'Jozye',
  'JUDGES': 'Jij',
  'RUTH': 'Rit',
  '1_SAMUEL': '1 Samyèl',
  '2_SAMUEL': '2 Samyèl',
  '1_KINGS': '1 Wa',
  '2_KINGS': '2 Wa',
  '1_CHRONICLES': '1 Istwa',
  '2_CHRONICLES': '2 Istwa',
  'EZRA': 'Esdras',
  'NEHEMIAH': 'Neemi',
  'ESTHER': 'Estè',
  'JOB': 'Jòb',
  'PSALMS': 'Sòm',
  'PROVERBS': 'Pwovèb',
  'ECCLESIASTES': 'Eklezyas',
  'SONG_OF_SOLOMON': 'Chante Salomon',
  'ISAIAH': 'Ezayi',
  'JEREMIAH': 'Jeremi',
  'LAMENTATIONS': 'Plenn',
  'EZEKIEL': 'Ezekyèl',
  'DANIEL': 'Danyèl',
  'HOSEA': 'Oze',
  'JOEL': 'Jowèl',
  'AMOS': 'Amòs',
  'OBADIAH': 'Abdias',
  'JONAH': 'Jonas',
  'MICAH': 'Miche',
  'NAHUM': 'Nawoun',
  'HABAKKUK': 'Abakouk',
  'ZEPHANIAH': 'Sofoni',
  'HAGGAI': 'Aje',
  'ZECHARIAH': 'Zakari',
  'MALACHI': 'Malachi',
  'MATTHEW': 'Matye',
  'MARK': 'Mak',
  'LUKE': 'Lik',
  'JOHN': 'Jan',
  'ACTS': 'Travay',
  'ROMANS': 'Ròm',
  '1_CORINTHIANS': '1 Korint',
  '2_CORINTHIANS': '2 Korint',
  'GALATIANS': 'Galasi',
  'EPHESIANS': 'Efèz',
  'PHILIPPIANS': 'Filip',
  'COLOSSIANS': 'Kolòs',
  '1_THESSALONIANS': '1 Tesalonik',
  '2_THESSALONIANS': '2 Tesalonik',
  '1_TIMOTHY': '1 Timote',
  '2_TIMOTHY': '2 Timote',
  'TITUS': 'Tit',
  'PHILEMON': 'Filemon',
  'HEBREWS': 'Ebre',
  'JAMES': 'Jak',
  '1_PETER': '1 Piè',
  '2_PETER': '2 Piè',
  '1_JOHN': '1 Jan',
  '2_JOHN': '2 Jan',
  '3_JOHN': '3 Jan',
  'JUDE': 'Jid',
  'REVELATION': 'Revelasyon',
})

// Presentation adapter only: use the live snapshot, never fetch on the projector.
export function findCreoleTranslation(translations) {
  return translations.find(t => t.code && ['HAITIAN_CREOLE', 'HT', 'HAT', 'KREYOL', 'KREYÒL'].includes(String(t.language || '').toUpperCase())) || null
}

export function bibleProjectorBlocks(passage, verse) {
  if (!passage || !verse) return []
  const entries = ['FRENCH_ENGLISH', 'TRILINGUAL'].includes(passage.projectionMode)
    ? [['ENGLISH', verse.secondaryText], ['FRENCH', verse.primaryText], ...(passage.projectionMode === 'TRILINGUAL' ? [['HAITIAN_CREOLE', verse.creoleText]] : [])]
    : [[passage.projectionMode, verse.text]]
  return entries.filter(([, text]) => text?.trim()).map(([language, text]) => {
    const translation = passage.translations?.[language] || passage
    const bookKey = translation.bookKey || passage.bookKey
    const fallbackName = translation.bookName || bookKey || ''
    const name = language === 'HAITIAN_CREOLE'
      ? CREOLE_BOOK_NAMES[bookKey] || fallbackName
      : fallbackName
    return { language, text, reference: `${name} ${translation.chapter || passage.chapter}:${verse.verseNumber}` }
  })
}

// The passage API accepts contiguous ranges. Preserve source numbering across gaps.
export function contiguousVerseRanges(numbers) {
  const ranges = []
  for (const n of [...new Set(numbers)].sort((a, b) => a - b)) {
    const last = ranges.at(-1)
    if (last && n === last[1] + 1) last[1] = n
    else ranges.push([n, n])
  }
  return ranges
}
