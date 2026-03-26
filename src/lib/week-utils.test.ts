import { describe, it, expect } from 'vitest'
import { isSunday, getWeekDates, formatWeekRange, getTodayStr } from './week-utils'

// ---------------------------------------------------------------------------
// getTodayStr
// ---------------------------------------------------------------------------
describe('getTodayStr', () => {
  it('devuelve formato YYYY-MM-DD', () => {
    expect(getTodayStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('coincide con la fecha real de hoy', () => {
    const n = new Date()
    const expected = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
    expect(getTodayStr()).toBe(expected)
  })
})

// ---------------------------------------------------------------------------
// isSunday
// ---------------------------------------------------------------------------
describe('isSunday', () => {
  it('detecta un domingo', () => {
    expect(isSunday('2026-03-22')).toBe(true) // domingo conocido
  })

  it('devuelve false para días que no son domingo', () => {
    expect(isSunday('2026-03-23')).toBe(false) // lunes
    expect(isSunday('2026-03-28')).toBe(false) // sábado
  })
})

// ---------------------------------------------------------------------------
// getWeekDates
// ---------------------------------------------------------------------------
describe('getWeekDates', () => {
  it('devuelve exactamente 7 fechas', () => {
    expect(getWeekDates(0)).toHaveLength(7)
    expect(getWeekDates(1)).toHaveLength(7)
    expect(getWeekDates(-1)).toHaveLength(7)
  })

  it('todas las fechas tienen formato YYYY-MM-DD', () => {
    const dates = getWeekDates(0)
    const iso = /^\d{4}-\d{2}-\d{2}$/
    dates.forEach(d => expect(d).toMatch(iso))
  })

  it('las fechas son 7 días consecutivos', () => {
    const dates = getWeekDates(0)
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1] + 'T00:00:00')
      const curr = new Date(dates[i]     + 'T00:00:00')
      expect(curr.getTime() - prev.getTime()).toBe(86400000) // 1 día en ms
    }
  })

  it('el primer día es lunes (getDay() === 1)', () => {
    const dates = getWeekDates(0)
    expect(new Date(dates[0] + 'T00:00:00').getDay()).toBe(1)
  })

  it('el offset desplaza la semana correctamente', () => {
    const thisWeek = getWeekDates(0)
    const nextWeek = getWeekDates(1)
    const thisMonday = new Date(thisWeek[0] + 'T00:00:00')
    const nextMonday = new Date(nextWeek[0] + 'T00:00:00')
    // Comparar días de calendario (robusto ante cambio de hora DST)
    thisMonday.setHours(12, 0, 0, 0)
    nextMonday.setHours(12, 0, 0, 0)
    const diffDays = Math.round((nextMonday.getTime() - thisMonday.getTime()) / 86400000)
    expect(diffDays).toBe(7)
  })
})

// ---------------------------------------------------------------------------
// formatWeekRange
// ---------------------------------------------------------------------------
describe('formatWeekRange', () => {
  it('formatea rango dentro del mismo mes', () => {
    const dates = [
      '2026-03-23', '2026-03-24', '2026-03-25',
      '2026-03-26', '2026-03-27', '2026-03-28', '2026-03-29',
    ]
    // "23 – 29 marzo"
    expect(formatWeekRange(dates)).toMatch(/23\s*–\s*29/)
    expect(formatWeekRange(dates)).toMatch(/marzo/)
  })

  it('muestra el mes del último día (domingo)', () => {
    const dates = [
      '2026-03-30', '2026-03-31', '2026-04-01',
      '2026-04-02', '2026-04-03', '2026-04-04', '2026-04-05',
    ]
    // el domingo es 5 de abril → muestra "abril"
    expect(formatWeekRange(dates)).toMatch(/abril/)
  })
})
