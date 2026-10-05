import NoteHeading from './NoteHeading'
import { useLayoutEffect, useRef } from 'react'
import { renderedNoteLines, renderedNoteBlockEnds, noteLineTarget, noteViewportTarget } from './noteScroll'

export default function NoteProjector({ text, heading = {}, navigation = [], visible = true }) {
  const containerRef = useRef(null), textRef = useRef(null), applied = useRef(0)
  const lines = useRef([0]), blockEnds = useRef([])
  useLayoutEffect(() => {
    const container = containerRef.current, element = textRef.current
    function measure() {
      let lineHeight = parseFloat(getComputedStyle(element).fontSize) * 1.3
      // Fallback fonts can have glyph boxes taller than the requested line-height.
      // Leave their full ascent/descent inside each row without shrinking the font.
      const range = document.createRange()
      range.selectNodeContents(element)
      const glyphHeight = Math.max(0, ...Array.from(range.getClientRects(), rect => rect.height))
      lineHeight = Math.max(lineHeight, Math.ceil(glyphHeight + 2))
      element.style.lineHeight = `${lineHeight}px`
      const parent = container.parentElement
      const css = getComputedStyle(parent)
      const available = parent.clientHeight - parseFloat(css.paddingTop) - parseFloat(css.paddingBottom) - parent.querySelector('.note-heading').getBoundingClientRect().height - parseFloat(getComputedStyle(parent.querySelector('.note-heading')).marginBottom)
      // Reserve less than one line below the viewport rather than slicing a bottom line.
      container.style.height = `${Math.max(lineHeight, Math.floor(available / lineHeight) * lineHeight)}px`
      lines.current = renderedNoteLines(element)
      blockEnds.current = renderedNoteBlockEnds(element)
      container.scrollTop = noteLineTarget(lines.current, container.scrollTop, container.clientHeight,
        container.scrollHeight-container.clientHeight, 0, 'line')
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(container.parentElement); observer.observe(element)
    return () => observer.disconnect()
  }, [text, heading.topic, heading.noteDate])
  useLayoutEffect(() => {
    const container = containerRef.current
    for (const command of navigation) {
      if (command.sequence <= applied.current) continue
      container.scrollTop = noteViewportTarget(lines.current, blockEnds.current, container.scrollTop, container.clientHeight,
        container.scrollHeight-container.clientHeight, command.direction)
      applied.current = command.sequence
    }
  }, [navigation])
  return <div className="screen-content screen-content-note" style={{ visibility: visible ? 'visible' : 'hidden' }} aria-hidden={!visible}>
    <div className="note-document"><NoteHeading heading={heading} /><div ref={containerRef} className="note-fit-container note-projector-content"><div ref={textRef} className="note-text">{text}</div></div></div>
  </div>
}
