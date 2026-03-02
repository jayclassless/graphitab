import { useState, useEffect } from 'react'

import { storage } from '#imports'

import type { OperationType } from './har'

export const FILTER_TYPES: OperationType[] = ['query', 'mutation']

const preserveLogItem = storage.defineItem<boolean>('local:devtools.preserveLog', {
  fallback: false,
})
const activeTypesItem = storage.defineItem<OperationType[]>('local:devtools.activeTypes', {
  fallback: FILTER_TYPES,
})

export function useDevtoolsSettings() {
  const [preserveLog, setPreserveLogState] = useState(false)
  const [activeTypes, setActiveTypes] = useState<Set<OperationType>>(new Set(FILTER_TYPES))

  useEffect(() => {
    preserveLogItem.getValue().then(setPreserveLogState)
    activeTypesItem.getValue().then((types) => setActiveTypes(new Set(types)))
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

  return { preserveLog, setPreserveLog, activeTypes, toggleType }
}
