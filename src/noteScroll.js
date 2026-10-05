// A bounded command history survives React batching without replaying commands on reconnect.
export function nextNoteNavigation(previous = [], direction, unit = 'line') {
  return [...previous, { sequence: (previous.at(-1)?.sequence || 0) + 1, direction, unit }].slice(-256)
}
export function renderedNoteLines(element) {
  const node = element.firstChild
  if (!node) return [0]
  const range = document.createRange(), tops = []
  for (let offset = 0; offset < node.length;) {
    const length = node.textContent.codePointAt(offset) > 0xffff ? 2 : 1
    range.setStart(node, offset); range.setEnd(node, offset + length)
    for (const rect of range.getClientRects()) if (!tops.some(top => Math.abs(top - rect.top) < .5)) tops.push(rect.top)
    offset += length
  }
  const first = tops[0] || 0
  return tops.map(top => top - first)
}
export function noteLineTarget(lines, current, height, maximum, direction, unit) {
  const stops = lines.filter(top => top <= maximum + .5)
  if (!stops.length) return 0
  const nearest = stops.reduce((best, top) => Math.abs(top-current) < Math.abs(best-current) ? top : best, 0)
  let index = stops.indexOf(nearest)
  if (unit === 'page') {
    const lineHeight = lines[1] - lines[0] || height
    const distance = Math.max(lineHeight, height - lineHeight)
    const target = nearest + direction * distance
    index = direction > 0 ? stops.findLastIndex(top => top <= target + .5) : stops.findIndex(top => top >= target - .5)
    if (index < 0) index = direction > 0 ? stops.length - 1 : 0
  } else index += direction
  return stops[Math.max(0, Math.min(stops.length - 1, index))]
}

// Source newlines delimit blocks, but their endpoints are measured after wrapping.
export function renderedNoteBlockEnds(element) {
  const node = element.firstChild
  if (!node?.length) return []
  const range = document.createRange()
  range.setStart(node, 0); range.setEnd(node, 1)
  const firstTop = range.getBoundingClientRect().top
  const lineHeight = parseFloat(getComputedStyle(element).lineHeight)
  const ends = []
  for (const match of node.textContent.matchAll(/[^\n]*\S[^\n]*(?=\n|$)/g)) {
    const end = match.index + match[0].trimEnd().length
    if (end <= match.index) continue
    range.setStart(node, end - 1); range.setEnd(node, end)
    ends.push(range.getBoundingClientRect().top - firstTop + lineHeight)
  }
  return ends
}

export function noteViewportTarget(lines, blockEnds, current, height, maximum, direction) {
  const fallback = noteLineTarget(lines, current, height, maximum, direction, 'page')
  if (!direction || fallback <= .5 || fallback >= maximum - .5) return fallback
  const lineHeight = lines[1] - lines[0] || height
  const candidates = lines.filter(top => top >= 0 && top <= maximum + .5
    && (top-current)*direction >= height*.45
    && (top-current)*direction <= Math.max(lineHeight,height-lineHeight)+.5
    && blockEnds.some(end => Math.abs(end-(top+height)) < 1))
  return candidates.reduce((best, top) => Math.abs(top-fallback) < Math.abs(best-fallback) ? top : best,
    candidates[0] ?? fallback)
}
