import test from 'node:test'
import assert from 'node:assert/strict'
import { keyboardShortcut, presentationMode } from '../src/projectorKeyboard.js'
const event = (key, overrides = {}) => ({ key, ...overrides })

test('mode-specific mappings preserve song scrolling and Bible verse controls', () => {
  for (const mode of ['REGULAR_EVENTS', 'BIRTHDAY_LIST']) {
    assert.equal(keyboardShortcut(event('ArrowUp'), { mode }), 'PREVIOUS')
    assert.equal(keyboardShortcut(event('ArrowDown'), { mode }), 'NEXT')
    assert.equal(keyboardShortcut(event('ArrowRight'), { mode }), null)
  }
  assert.equal(keyboardShortcut(event('ArrowDown'), { mode: 'SONG' }), 'SCROLL_DOWN')
  assert.equal(keyboardShortcut(event('ArrowUp'), { mode: 'SONG' }), 'SCROLL_UP')
  for (const mode of ['SONG', 'BIBLE']) {
    assert.equal(keyboardShortcut(event('ArrowLeft'), { mode }), 'PREVIOUS')
    assert.equal(keyboardShortcut(event('ArrowRight'), { mode }), 'NEXT')
    assert.equal(keyboardShortcut(event(' '), { mode }), 'NEXT')
  }
  assert.equal(keyboardShortcut(event('ArrowDown'), { mode: 'BIBLE' }), 'NEXT')
  assert.equal(keyboardShortcut(event('ArrowUp'), { mode: 'BIBLE' }), 'PREVIOUS')
})

test('editing, modals, modifiers, composition and handled events suppress shortcuts', () => {
  for (const key of ['ArrowDown', 'ArrowRight', 'b', 'Enter']) {
    for (const overrides of [{ ctrlKey: true }, { altKey: true }, { metaKey: true }, { shiftKey: true }, { isComposing: true }, { defaultPrevented: true }, { target: { isContentEditable: true } }, { target: { closest: () => ({}) } }]) {
      assert.equal(keyboardShortcut(event(key, overrides), { mode: 'REGULAR_EVENTS', canSend: true }), null)
    }
    assert.equal(keyboardShortcut(event(key), { mode: 'SONG', canSend: true, modalOpen: true }), null)
  }
})

test('Enter requires a prepared operator presentation and does not override native activation', () => {
  assert.equal(keyboardShortcut(event('Enter'), { mode: 'SONG', canSend: true }), 'SEND')
  assert.equal(keyboardShortcut(event('Enter'), { mode: 'SONG' }), null)
  assert.equal(keyboardShortcut(event('Enter'), { mode: 'SONG', canSend: true, publicWindow: true }), null)
  const button = { closest: selector => selector.startsWith('button') ? {} : null }
  assert.equal(keyboardShortcut(event('Enter', { target: button }), { mode: 'SONG', canSend: true }), null)
  assert.equal(keyboardShortcut(event(' ', { target: button }), { mode: 'SONG' }), null)
  for (const key of ['Enter', 'b', 'c']) assert.equal(keyboardShortcut(event(key, { repeat: true }), { mode: 'SONG', canSend: true }), null)
})

test('focused buttons and non-editable cards allow mode-specific arrow navigation', () => {
  const button = { closest: selector => selector.startsWith('button') ? {} : null }
  const card = { closest: () => null }
  for (const target of [button, card]) {
    for (const mode of ['REGULAR_EVENTS', 'BIRTHDAY_LIST', 'BIBLE']) {
      assert.equal(keyboardShortcut(event('ArrowDown', { target }), { mode }), 'NEXT')
      assert.equal(keyboardShortcut(event('ArrowUp', { target }), { mode }), 'PREVIOUS')
    }
    assert.equal(keyboardShortcut(event('ArrowRight', { target }), { mode: 'SONG' }), 'NEXT')
    assert.equal(keyboardShortcut(event('ArrowDown', { target }), { mode: 'SONG' }), 'SCROLL_DOWN')
  }
})

test('Black and Clear retain their existing commands; mode follows supplied presentation', () => {
  assert.equal(keyboardShortcut(event('b'), { mode: 'BIBLE' }), 'BLACK')
  assert.equal(keyboardShortcut(event('c'), { mode: 'SONG' }), 'CLEAR')
  assert.equal(presentationMode('EVENT', [{ eventType: 'BIRTHDAY_LIST' }]), 'BIRTHDAY_LIST')
  assert.equal(presentationMode('EVENT', [{ eventType: 'CONFERENCE' }]), 'REGULAR_EVENTS')
})

test('list panels route selection instead of projector commands', () => {
  for (const [mode, prefix] of [['SONG_LIBRARY', 'LIBRARY'], ['WORKING_SERVICE', 'SERVICE']]) {
    assert.equal(keyboardShortcut(event('ArrowDown'), { mode }), `${prefix}_NEXT`)
    assert.equal(keyboardShortcut(event('ArrowUp'), { mode }), `${prefix}_PREVIOUS`)
    assert.equal(keyboardShortcut(event('Enter'), { mode, canSend: true }), `${prefix}_SELECT`)
    for (const key of ['ArrowLeft', 'ArrowRight', ' ']) assert.equal(keyboardShortcut(event(key), { mode }), null)
    const row = { hasAttribute: name => name === 'data-keyboard-song' }
    const target = { closest: selector => selector.startsWith('button') ? row : null }
    assert.equal(keyboardShortcut(event('Enter', { target }), { mode }), `${prefix}_SELECT`)
    assert.equal(keyboardShortcut(event('Enter', { repeat: true }), { mode }), null)
    assert.equal(keyboardShortcut(event('Enter'), { mode, modalOpen: true }), null)
    assert.equal(keyboardShortcut(event('ArrowDown', { target: { isContentEditable: true } }), { mode }), null)
    const action = { closest: selector => selector.startsWith('button') ? {} : null }
    assert.equal(keyboardShortcut(event('Enter', { target: action }), { mode }), null)
  }
})

test('sidebar arrows highlight and Enter activates despite native button focus', () => {
  const mode = 'SIDE_NAV'
  const button = { closest: selector => selector.startsWith('button') ? {} : null }
  assert.equal(keyboardShortcut(event('ArrowDown', { target: button }), { mode }), 'SIDEBAR_NEXT')
  assert.equal(keyboardShortcut(event('ArrowUp'), { mode }), 'SIDEBAR_PREVIOUS')
  assert.equal(keyboardShortcut(event('Enter', { target: button }), { mode }), 'SIDEBAR_OPEN')
  assert.equal(keyboardShortcut(event('Enter', { repeat: true }), { mode }), null)
  for (const key of ['ArrowDown', 'ArrowUp', 'Enter']) {
    assert.equal(keyboardShortcut(event(key), { mode, modalOpen: true }), null)
    assert.equal(keyboardShortcut(event(key, { target: { isContentEditable: true } }), { mode }), null)
  }
})

test('Events management separates card selection/edit from projector paging', () => {
  const mode = 'EVENTS_LIST'
  for (const [key, command] of [['ArrowDown','EVENT_LIST_NEXT'],['ArrowUp','EVENT_LIST_PREVIOUS'],['Enter','EVENT_LIST_EDIT'],['ArrowLeft','PREVIOUS'],['ArrowRight','NEXT']]) {
    assert.equal(keyboardShortcut(event(key), {mode,canSend:true}),command)
    assert.equal(keyboardShortcut(event(key), {mode,modalOpen:true}),null)
  }
  const button={closest: selector=>selector.startsWith('button')?{}:null}
  assert.equal(keyboardShortcut(event('Enter',{target:button}),{mode,canSend:true}),null)
})

test('administration list navigation keeps native activation and editing safeguards', () => {
  const mode = 'ADMIN_LIST'
  assert.equal(keyboardShortcut(event('ArrowDown'), { mode }), 'ADMIN_NEXT')
  assert.equal(keyboardShortcut(event('ArrowUp'), { mode }), 'ADMIN_PREVIOUS')
  assert.equal(keyboardShortcut(event('Enter'), { mode }), 'ADMIN_SELECT')
  const button = { closest: selector => selector.startsWith('button') ? {} : null }
  assert.equal(keyboardShortcut(event('Enter', { target: button }), { mode }), null)
  assert.equal(keyboardShortcut(event('ArrowDown', { target: { isContentEditable: true } }), { mode }), null)
  assert.equal(keyboardShortcut(event('ArrowDown'), { mode, modalOpen: true }), null)
})
