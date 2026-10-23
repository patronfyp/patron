import { createContext, useContext, useEffect, useRef } from 'react'

/**
 * Lets a step set the Continue label and run a check before the wizard moves on.
 */
export const StepControlsContext = createContext(null)

/**
 * @param {object} controls
 * @param {() => Promise<boolean>} [controls.beforeContinue] - resolve true to
 *   let the wizard continue, false to stay (the step shows its own error)
 * @param {string} [controls.continueLabel] - replaces the default "Continue"
 */
export function useStepControls({ beforeContinue, continueLabel }) {
  const wizard = useContext(StepControlsContext)

  // A ref: it changes every render, but is only read on Continue.
  const latest = useRef(beforeContinue)
  useEffect(() => {
    latest.current = beforeContinue
  })

  useEffect(() => {
    if (!wizard) return undefined
    wizard.setBeforeContinue(() => () => latest.current?.() ?? Promise.resolve(true))
    return () => wizard.setBeforeContinue(null)
  }, [wizard])

  useEffect(() => {
    if (!wizard) return undefined
    wizard.setContinueLabel(continueLabel ?? null)
    return () => wizard.setContinueLabel(null)
  }, [wizard, continueLabel])
}
