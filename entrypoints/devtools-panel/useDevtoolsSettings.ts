import { useState, useEffect } from 'react'

import { storage } from '#imports'

import type { OperationType } from './har'

export const FILTER_TYPES: OperationType[] = ['query', 'mutation', 'batch']
export const DEFAULT_COLUMN_WIDTHS = [200, 100, 100, 100]

const preserveLogItem = storage.defineItem<boolean>('local:devtools.preserveLog', {
  fallback: false,
})
const activeTypesItem = storage.defineItem<OperationType[]>('local:devtools.activeTypes', {
  fallback: FILTER_TYPES,
})
const columnWidthsItem = storage.defineItem<number[]>('local:devtools.columnWidths', {
  fallback: DEFAULT_COLUMN_WIDTHS,
})

export function useDevtoolsSettings() {
  const [preserveLog, setPreserveLogState] = useState(false)
  const [activeTypes, setActiveTypes] = useState<Set<OperationType>>(new Set(FILTER_TYPES))
  const [columnWidths, setColumnWidthsState] = useState<number[]>(DEFAULT_COLUMN_WIDTHS)

  useEffect(() => {
    preserveLogItem.getValue().then(setPreserveLogState)
    activeTypesItem.getValue().then((types) => setActiveTypes(new Set(types)))
    columnWidthsItem.getValue().then(setColumnWidthsState)
  }, [])

  function setPreserveLog(value: boolean) {
    setPreserveLogState(value)
    preserveLogItem.setValue(value)
  }

  function toggleType(type: OperationType) {
    setActiveTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) {
        next.delete(type)
      } else {
        next.add(type)
      }
      activeTypesItem.setValue([...next])
      return next
    })
  }

  function setColumnWidths(widths: number[]) {
    setColumnWidthsState(widths)
    columnWidthsItem.setValue(widths)
  }

  return { preserveLog, setPreserveLog, activeTypes, toggleType, columnWidths, setColumnWidths }
}
