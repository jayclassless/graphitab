import { ToolbarButton } from '@graphiql/react'

import './ExtensionsToolbarButton.css'

type ExtensionsToolbarButtonProps = {
  hasExtensions: boolean
  onClick: () => void
}

export default function ExtensionsToolbarButton({
  hasExtensions,
  onClick,
}: ExtensionsToolbarButtonProps) {
  return (
    <div className="extensions-toolbar-wrapper">
      <ToolbarButton label="Extensions" onClick={onClick}>
        <svg
          height="1em"
          viewBox="2 3 20 18"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M7 4a2 2 0 0 0-2 2v3a2 2 0 0 1-2 2 2 2 0 0 1 2 2v3a2 2 0 0 0 2 2"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M17 4a2 2 0 0 1 2 2v3a2 2 0 0 0 2 2 2 2 0 0 0-2 2v3a2 2 0 0 1-2 2"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      </ToolbarButton>
      {hasExtensions && <span className="extensions-toolbar-indicator" />}
    </div>
  )
}
