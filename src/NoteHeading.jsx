export function noteHeading(metadata = {}) {
  return { topic: metadata.topic || '', noteDate: metadata.noteDate || '' }
}

export default function NoteHeading({ heading = {} }) {
  const subject = heading.topic?.trim()
  const date = /^\d{4}-\d{2}-\d{2}$/.test(heading.noteDate || '')
    ? new Date(`${heading.noteDate}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'
  return <header className="note-heading">
    {subject && <div className="note-heading-subject">Subject: {subject}</div>}
    <div className="note-heading-date">Date: {date}</div>
  </header>
}
