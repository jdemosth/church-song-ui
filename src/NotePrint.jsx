import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import NoteHeading from './NoteHeading'

// A separate print-only document leaves the editor and live snapshot untouched.
export default function NotePrint({ note, onClose }) {
  useEffect(() => {
    if (!note) return
    const done = () => onClose(null)
    window.addEventListener('afterprint', done)
    const frame = requestAnimationFrame(() => window.print())
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('afterprint', done)
    }
  }, [note, onClose])
  if (!note) return null
  return createPortal(<article className="note-print-document" aria-label="Printable note">
    <NoteHeading heading={note} />
    <div className="note-print-body">{note.content}</div>
  </article>, document.body)
}
