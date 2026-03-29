import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'

vi.mock('../ExtensionsToolbarButton.css', () => ({}))

vi.mock('@graphiql/react', () => ({
  ToolbarButton: ({
    label,
    children,
    ...props
  }: {
    label: string
    children: React.ReactNode
    onClick?: () => void
  }) => (
    <button aria-label={label} {...props}>
      {children}
    </button>
  ),
}))

import ExtensionsToolbarButton from '../ExtensionsToolbarButton'

describe('ExtensionsToolbarButton', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders a button with the Extensions label', () => {
    render(<ExtensionsToolbarButton hasExtensions={false} onClick={vi.fn()} />)
    expect(screen.getByLabelText('Extensions')).toBeInTheDocument()
  })

  it('shows indicator dot when hasExtensions is true', () => {
    const { container } = render(<ExtensionsToolbarButton hasExtensions={true} onClick={vi.fn()} />)
    expect(container.querySelector('.extensions-toolbar-indicator')).toBeInTheDocument()
  })

  it('hides indicator dot when hasExtensions is false', () => {
    const { container } = render(
      <ExtensionsToolbarButton hasExtensions={false} onClick={vi.fn()} />
    )
    expect(container.querySelector('.extensions-toolbar-indicator')).not.toBeInTheDocument()
  })

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<ExtensionsToolbarButton hasExtensions={false} onClick={onClick} />)

    await user.click(screen.getByLabelText('Extensions'))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders an SVG icon', () => {
    const { container } = render(
      <ExtensionsToolbarButton hasExtensions={false} onClick={vi.fn()} />
    )
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
})
