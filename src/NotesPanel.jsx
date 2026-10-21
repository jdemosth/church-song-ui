import { scopedStorage } from './browserScope.js'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { noteValidation } from './operatorFeatures'

import NotesArchive from './NotesArchive'
import NotePrint from './NotePrint'
import NoteHeading, { noteHeading } from './NoteHeading'

import { ARCHIVE_LIMIT, archivePayload } from './noteArchive'
const memory = new Map()
function readNotes(key) {
  try {
    const value = JSON.parse(scopedStorage.getItem(key) || 'null')
    if (value && typeof value.draft === 'string' && Array.isArray(value.history)) return { archive: value.archive || {}, draft: value.draft.slice(0, ARCHIVE_LIMIT), history: value.history.filter(note => typeof note?.text === 'string' && typeof note?.at === 'string').slice(0, 50) }
  } catch { /* Continue with the current browser session when storage is unavailable. */ }
  return memory.get(key) || { draft: '', history: [] }
}
export default function NotesPanel({ serviceKey, onSend, previewBackgroundClass, previewBackgroundUrl, onBlack, onClear, noteIsLive, onScroll }) {
  const key = `church-song-notes:${serviceKey}`
  const [saved, setSaved] = useState(() => readNotes(key))
  const latestSaved = useRef(saved)
  const [printNote, setPrintNote] = useState(null)
  const [archiveBusy, setArchiveBusy] = useState(false)
  const [preview, setPreview] = useState('')
  const [previewHeading, setPreviewHeading] = useState(noteHeading())
  const headingChanged = JSON.stringify(previewHeading) !== JSON.stringify(noteHeading(saved.archive))
  const [previewOpen, setPreviewOpen] = useState(false)
  const dialogRef = useRef(null)
  const editorRef = useRef(null)
  const focusEditorAfterLoad = useRef(false)
  useEffect(() => {
    if (!archiveBusy && focusEditorAfterLoad.current) {
      focusEditorAfterLoad.current = false
      editorRef.current?.focus()
    }
  }, [archiveBusy])
  function closePreview() { setPreviewOpen(false); editorRef.current?.focus() }
  useEffect(() => {
    if (previewOpen) dialogRef.current?.querySelector('button')?.focus()
  }, [previewOpen])
  function dialogKey(event) {
    if (event.key === 'Escape') { event.preventDefault(); closePreview() }
    if (event.key === 'Tab') {
      const controls = [...dialogRef.current.querySelectorAll('button:not(:disabled), [tabindex="0"]')]
      const first = controls[0], last = controls.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
  }
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  function save(value) {
    latestSaved.current = value; setSaved(value); memory.set(key, value)
    try { scopedStorage.setItem(key, JSON.stringify(value)); setMessage('') }
    catch { setMessage('Browser storage is unavailable. Copy your notes before closing or refreshing this page.') }
  }
  async function send() {
    if (sending || noteValidation(preview) || (preview !== saved.draft || headingChanged)) return
    setSending(true)
    try {
      await onSend(preview, previewHeading)
      closePreview()
      save({ ...latestSaved.current, history: [{ text: preview, at: new Date().toISOString() }, ...latestSaved.current.history].slice(0, 50) })
    } catch (error) { setMessage(error.message || 'Could not send note. Try again when connected.') }
    finally { setSending(false) }
  }
  const validation = noteValidation(saved.draft)
  return <section className="console-card notes-panel">
    <h3>Sermon Notes</h3>
    <NotesArchive onPrint={setPrintNote} draft={saved.draft} metadata={saved.archive || {}}
      onBusy={setArchiveBusy}
      onMetadata={archive => save({...saved,archive})}
      onLoad={(note, showPreview=false, focusEditor=false) => {
        if (focusEditor) focusEditorAfterLoad.current = true
        const archive=note || {noteDate:new Date().toLocaleDateString('en-CA'),servicePlanId:serviceKey.startsWith('service-')?Number(serviceKey.slice(8)):null}
        if (!note) archive.savedSnapshot=JSON.stringify(archivePayload(archive,''))
        save({...saved,draft:note?.content || '',archive})
        setPreviewHeading(noteHeading(archive));setPreview(showPreview ? note.content : '');setPreviewOpen(showPreview)
      }}/>
    <label htmlFor="sermon-note-text">Note</label><textarea ref={editorRef} id="sermon-note-text" value={saved.draft} maxLength={ARCHIVE_LIMIT} disabled={archiveBusy} rows={6} onChange={event => save({ ...saved, draft: event.target.value })} />
    <small>{saved.draft.length}/{ARCHIVE_LIMIT} archive characters. Projection: up to 2000 characters and 40 lines. Preview, then Send Live.</small>
    <div className="notes-actions">
      <button className="button button-secondary" disabled={!saved.draft.trim() || archiveBusy} onClick={() => { setPreviewHeading(noteHeading(saved.archive)); setPreview(saved.draft); setPreviewOpen(true) }}>Preview Note</button>
      <button className="button button-primary" disabled={sending || Boolean(noteValidation(preview)) || (preview !== saved.draft || headingChanged)} onClick={send}>Send Note Live</button>
      <button className="button button-secondary" disabled={!saved.draft.trim() || archiveBusy} onClick={() => setPrintNote({...noteHeading(saved.archive), content: saved.draft})}>Print</button>
      <button className="button button-secondary" disabled={archiveBusy} onClick={() => { save({ ...saved, draft: '' }); setPreview('') }}>Clear Draft</button>
    </div>
    <NotePrint note={printNote} onClose={setPrintNote} />
    {previewOpen && createPortal(
      <div className="modal-overlay" onKeyDown={dialogKey}>
        <div ref={dialogRef} className="modal modal-wide note-proofread-modal" role="dialog" aria-modal="true" aria-labelledby="note-preview-title" aria-describedby="note-preview-description">
          <div className="modal-heading"><div><p className="card-kicker">PREVIEW — NOT LIVE</p><h2 id="note-preview-title">Review Note</h2></div><button className="modal-close" aria-label="Close Note Preview" onClick={closePreview}>×</button></div>
          <p id="note-preview-description">Read the complete note before sending. This preview does not change the projector.</p>
          <div className={`note-proofread-scroll ${previewBackgroundClass || ''}`} style={previewBackgroundUrl ? { backgroundImage: `url("${previewBackgroundUrl}")`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined} tabIndex="0" role="region" aria-label="Complete note preview">
            <div className="note-proofread-document"><NoteHeading heading={previewHeading} /><div className="note-proofread-text">{preview}</div></div>
          </div>
          {message && <p role="status">{message}</p>}
          <div className="modal-buttons"><button className="button button-secondary" onClick={closePreview}>Return to Editing</button><button className="button button-primary" disabled={sending || Boolean(noteValidation(preview)) || (preview !== saved.draft || headingChanged)} onClick={send}>Send Note Live</button></div>
        </div>
      </div>, document.querySelector('.app-shell')
    )}
    {preview && (preview !== saved.draft || headingChanged) && <p role="status">Draft changed. Preview again before sending.</p>}
    <div className="notes-safety-actions"><button className="button button-secondary" onClick={onBlack}>Black Screen / Restore</button><button className="button button-secondary" onClick={onClear}>Clear / Show Lyrics</button></div>
    {saved.draft.trim() && validation && <p role="status">{validation}</p>}
    {!previewOpen && message && <p role="status">{message}</p>}
    {noteIsLive && <div className="note-navigation" role="group" aria-label="Live note navigation">
      <div className="note-navigation-bar">
        <button className="button button-secondary" onClick={() => onScroll(-1, 'page')}>‹ Previous</button>
        <span role="status">Note Navigation</span>
        <button className="button button-secondary" onClick={() => onScroll(1, 'page')}>Next ›</button>
      </div>
      <small>Keyboard: ↑ ↓ PgUp PgDn</small>
    </div>}

  </section>
}
