import { useEffect, useRef, useState } from 'react'

import { CheckIcon } from './CheckIcon'
import { CopyIcon } from './CopyIcon'

type Props = {
  text: string
  title: string
  className?: string
}

export function CopyButton({ text, title, className = 'gt-headers-copy-btn' }: Props) {
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current)
    }
  }, [])

  function handleClick() {
    navigator.clipboard.writeText(text).catch(() => {})
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current)
    setCopied(true)
    timeoutRef.current = setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button className={className} title={title} onClick={handleClick}>
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  )
}
