import { describe, it, expect } from 'vitest'
import { fmt } from './timer-utils'

describe('fmt', () => {
  it('formatea segundos a MM:SS', () => {
    expect(fmt(0)).toBe('00:00')
    expect(fmt(60)).toBe('01:00')
    expect(fmt(90)).toBe('01:30')
    expect(fmt(3600)).toBe('60:00')
    expect(fmt(9)).toBe('00:09')
  })

  it('maneja valores negativos (cuenta regresiva)', () => {
    expect(fmt(-5)).toBe('00:05')
    expect(fmt(-70)).toBe('01:10')
  })
})
