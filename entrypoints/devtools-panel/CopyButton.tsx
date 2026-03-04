import { useEffect, useRef, useState } from 'react'

const CopyIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    data-testid="copy-icon"
  >
    <rect x="9" y="2" width="6" height="4" rx="1" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
  </svg>
)

const CheckIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    data-testid="check-icon"
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
)

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
