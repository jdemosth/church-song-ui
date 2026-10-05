// Presentation adapter only: use the live snapshot, never fetch on the projector.
export function bibleProjectorBlocks(passage, verse) {
  if (!passage || !verse) return []
  const entries = passage.projectionMode === 'FRENCH_ENGLISH'
    ? [['ENGLISH', verse.secondaryText], ['FRENCH', verse.primaryText]]
    : [[passage.projectionMode, verse.text]]
  return entries.filter(([, text]) => text?.trim()).map(([language, text]) => {
    const translation = passage.translations?.[language] || passage
    const name = translation.bookName || translation.bookKey || passage.bookKey || ''
    return { language, text, reference: `${name} ${translation.chapter || passage.chapter}:${verse.verseNumber}` }
  })
}
