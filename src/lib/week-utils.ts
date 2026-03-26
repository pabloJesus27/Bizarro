export const DAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export function getTodayStr(): string {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

export function isSunday(date: string): boolean {
  return new Date(date + 'T00:00:00').getDay() === 0
}

export function getWeekDates(offset = 0): string[] {
  const today = new Date()
  const dow = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1) + offset * 7)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
}

export function formatWeekRange(dates: string[]): string {
  const from = new Date(dates[0] + 'T00:00:00')
  const to   = new Date(dates[6] + 'T00:00:00')
  return `${from.getDate()} – ${to.getDate()} ${to.toLocaleDateString('es-ES', { month: 'long' })}`
}
