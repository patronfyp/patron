// Keeps the picked role across the LinkedIn redirect, for SelectRolePage.
// sessionStorage: it only matters to the tab that started the sign-up.
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
