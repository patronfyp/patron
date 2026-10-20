// Carries the role card picked on Create account across the LinkedIn OAuth
// redirect round trip, so SelectRolePage ("One more thing") can pre-select
// it instead of asking again (#75). sessionStorage, not localStorage: this
// is only relevant for the tab that started the sign-up, and should not
// leak into an unrelated later session.
const KEY = 'patron:picked-role'

export function rememberPickedRole(role) {
  try {
    sessionStorage.setItem(KEY, role)
  } catch {
    // Private browsing / storage disabled - SelectRolePage just asks instead.
  }
}

export function getRememberedRole() {
  try {
    return sessionStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function forgetPickedRole() {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // Nothing to clean up if storage was never reachable.
  }
}
