import test from 'node:test'
import assert from 'node:assert/strict'
import { imageTextTheme } from '../src/projectorTextTheme.js'

test('chooses light text for black/dark images and dark text for bright images', () => {
  assert.equal(imageTextTheme(new Uint8ClampedArray([0, 0, 0, 255]), 1, 1), 'light')
  assert.equal(imageTextTheme(new Uint8ClampedArray([10, 30, 80, 255]), 1, 1), 'light')
  assert.equal(imageTextTheme(new Uint8ClampedArray([255, 255, 255, 255]), 1, 1), 'dark')
  assert.equal(imageTextTheme(new Uint8ClampedArray([255, 255, 255, 0]), 1, 1), 'light')
})
