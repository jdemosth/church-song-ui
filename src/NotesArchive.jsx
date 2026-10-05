import { useEffect, useId, useRef, useState } from 'react'
import { API_BASE_URL } from './apiOrigin'

import { archivePayload } from './noteArchive'

export default function NotesArchive({ draft, metadata, onMetadata, onLoad, onBusy, onPrint }) {
  const [open, setOpen] = useState(false), [notes, setNotes] = useState([]), [query, setQuery] = useState('')
  const [message, setMessage] = useState(''), [busy, setBusy] = useState(false)
  const requestNumber = useRef(0)
  const libraryId = useId()
  const [count, setCount] = useState(null)
  const countRequest = useRef(0)
  useEffect(() => {
    let active = true
    const sequence = ++countRequest.current
    request('/count').then(value => { if (active && sequence === countRequest.current && Number.isInteger(value)) setCount(value) }).catch(() => {})
    return () => { active = false }
  }, [])
  async function refreshCount() {
    const sequence = ++countRequest.current
    try { const value = await request('/count'); if (sequence === countRequest.current) setCount(Number.isInteger(value) ? value : null) }
    catch { if (sequence === countRequest.current) setCount(null) }
  }
  async function request(path, options) {
    const response = await fetch(`${API_BASE_URL}/notes${path}`, options)
    if (!response.ok) {
      let error; try { error = await response.json() } catch { /* Use the status fallback. */ }
      throw new Error(error?.message || `Note request failed (${response.status}). Your draft is retained.`)
    }
    return response.status === 204 ? null : response.json()
  }
  async function operation(action) {
    if (busy) return
    setBusy(true); onBusy(true); setMessage('')
    try { await action() } catch (error) { setMessage(error.message || 'Could not reach the note archive. Your draft is retained.') }
    finally { setBusy(false); onBusy(false) }
  }
  async function refresh(search = query) {
    const sequence=++requestNumber.current
    const data=await request(`?q=${encodeURIComponent(search)}`)
    await refreshCount()
    if (sequence===requestNumber.current) setNotes(data)
  }
  function canReplace() {
    const payload=archivePayload(metadata,draft)
    const changed=JSON.stringify(payload)!==(metadata.savedSnapshot || JSON.stringify(archivePayload({},'')))
    return !changed || window.confirm('Replace the unsaved note draft? Save it first if you want to keep it.')
  }
  function load(note, preview = false, focusEditor = false) {
    onLoad(note ? {...note, savedSnapshot:JSON.stringify(archivePayload(note,note.content))} : null,preview,focusEditor)
  }
  async function saveNote() {
    const payload=archivePayload(metadata,draft)
    // The existing API requires title; only seed it when no stored title exists.
    if (!payload.title.trim()) payload.title = payload.topic.trim() || 'Untitled note'
    if (!payload.content.trim()) {setMessage('Enter note text before saving.');return}
    await operation(async()=>{
      const note=await request(metadata.id ? `/${metadata.id}` : '',{method:metadata.id?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
      load(note);setMessage('Note saved in the application database.')
      if(open) await refresh()
      else await refreshCount()
    })
  }
  return <div className="notes-archive">
    <label>Subject<input value={metadata.topic || ''} maxLength={300} disabled={busy} onChange={event=>onMetadata({...metadata,topic:event.target.value})}/></label>
    <div className="note-metadata-grid">
      {[['noteDate','Date','date']].map(([field,label,type])=><label key={field}>{label}<input type={type} value={metadata[field] || ''} disabled={busy} maxLength={300} onChange={event=>onMetadata({...metadata,[field]:event.target.value})}/></label>)}
    </div>
    <div className="notes-actions">
      <button className="button button-secondary" disabled={busy} onClick={()=>{if(canReplace()){load(null);setMessage('')}}}>New Note</button>
      <button className="button button-primary" disabled={busy} onClick={()=>saveNote()}>Save Note</button>
    </div>
    {message && <p role="status">{message}</p>}
    <button className="saved-notes-toggle" aria-label="Saved Notes" aria-expanded={open} aria-controls={libraryId} disabled={busy} onClick={()=>{setOpen(!open);if(!open) operation(()=>refresh())}}>
      <span aria-hidden="true">{open ? '▾' : '▸'}</span>
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 4h5v16H4zM10 4h5v16h-5zM17 4l4 1-3 15-4-1z"/></svg>
      Saved Notes {count !== null && <span className="saved-notes-count" aria-label={`${count} saved notes`}>{count}</span>}
    </button>
    {open && <section id={libraryId} className="saved-notes-library" aria-label="Saved Notes library">
      <form className="notes-actions" onSubmit={event=>{event.preventDefault();operation(()=>refresh())}}><label>Search saved notes<input value={query} onChange={event=>setQuery(event.target.value)}/></label><button className="button button-secondary" disabled={busy}>Search</button></form>
      {!notes.length && <p>No saved notes found.</p>}
      <div className="saved-notes-list" tabIndex={0} role="region" aria-label="Saved notes rows"><table className="saved-notes-table">
        <thead><tr><th scope="col">Subject</th><th scope="col">Date</th><th scope="col">Actions</th></tr></thead>
        <tbody>{notes.map(note=><tr className="saved-note-row" key={note.id}>
        <td className="saved-note-subject"><h4>{note.topic || '—'}</h4></td>
        <td className="saved-note-date">{note.noteDate ? <time dateTime={note.noteDate}>{note.noteDate.split('-').slice(1).concat(note.noteDate.split('-')[0]).join('/')}</time> : '—'}</td>
        <td><div className="saved-note-actions">
          <button className="button button-secondary" disabled={busy} onClick={()=>{if(canReplace())operation(async()=>{const selected=await request(`/${note.id}`);load(selected,false,true);setOpen(false)})}}>Open/Edit</button>
          <button className="button button-secondary" disabled={busy} onClick={()=>operation(async()=>{const selected=await request(`/${note.id}`);onPrint({topic:selected.topic || '',noteDate:selected.noteDate || '',content:selected.content})})}>Print</button>
          <button className="button button-danger" disabled={busy} onClick={()=>{if(window.confirm(`Delete saved note “${note.topic || 'without a subject'}”? This cannot be undone.`))operation(async()=>{
            await request(`/${note.id}`,{method:'DELETE'});if(metadata.id===note.id)onMetadata({...metadata,id:null,updatedAt:null,savedSnapshot:null});await refresh();setMessage('Saved note deleted. The editor and live projector are unchanged.')
          })}}>Delete</button>
        </div></td>
      </tr>)}</tbody></table></div>
    </section>}
  </div>
}
