'use client'

import { useEffect, useState } from 'react'

export function useFirstVisit(key: string) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(`bizarro_help_${key}`)) {
      setShow(true)
    }
  }, [key])

  function dismiss() {
    localStorage.setItem(`bizarro_help_${key}`, '1')
    setShow(false)
  }

  function open() { setShow(true) }

  return { show, dismiss, open }
}
