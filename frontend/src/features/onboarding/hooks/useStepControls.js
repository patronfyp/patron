import { createContext, useContext, useEffect, useRef } from 'react'

/**
 * How a step talks to the wizard around it: what Continue says, and work to
 * do before the wizard saves and moves on (e.g. the Account step confirming
 * its code). OnboardingWizard provides it; steps call useStepControls.
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

  // A ref, not state: the function changes every render (it closes over the
  // step's latest values) and the wizard only needs it when Continue is
  // pressed - re-rendering the wizard on each change would be wasted work.
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
