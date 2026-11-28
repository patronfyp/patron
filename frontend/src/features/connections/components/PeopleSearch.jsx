import { useEffect, useRef, useState } from 'react'

import { Input, Modal } from 'antd'
import { useNavigate } from 'react-router-dom'

import searchIcon from '@/assets/icons/search-16.svg'
import Icon from '@/shared/components/Icon/Icon'
import PersonAvatar from '@/shared/components/PersonAvatar/PersonAvatar'

import { MIN_QUERY_LENGTH, usePeopleSearch } from '../hooks/usePeopleSearch'
import { personSubline } from '../lib/connectionTypes'

import ConnectButton from './ConnectButton'
import styles from './PeopleSearch.module.css'

// Wait for a pause in typing before searching.
const SEARCH_DELAY_MS = 300
const NO_RESULTS = []

/**
 * The search overlay: a box and a list of people, each with the Connect
 * button in the right state. Opens from the top bar and the sidebar (or ⌘K /
 * Ctrl+K), closes on Esc or a click outside, and works from the keyboard:
 * arrows move through the results, Enter opens one's profile.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 */
function PeopleSearch({ open, onClose }) {
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef(null)

  // Search once typing pauses, not on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(text), SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [text])

  const { data, isFetching, isError } = usePeopleSearch(query)
  // One shared empty array: a fresh `[]` each render would look like new results.
  const results = data ?? NO_RESULTS
  const searchable = query.trim().length >= MIN_QUERY_LENGTH

  // The highlight belongs to one list of results: a new search starts at the
  // top, and it never points past the end of a shorter list.
  const [highlightFor, setHighlightFor] = useState(results)
  if (highlightFor !== results) {
    setHighlightFor(results)
    setActive(0)
  }

  const close = () => {
    setText('')
    setQuery('')
    onClose()
  }

  const openProfile = (person) => {
    close()
    navigate(`/profile/${person.user_id}`)
  }

  const onKeyDown = (event) => {
    if (results.length === 0) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((index) => (index + 1) % results.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((index) => (index - 1 + results.length) % results.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      openProfile(results[active])
    }
  }

  let body = null
  if (!searchable) {
    body = <p className={styles.hint}>Type at least 2 letters to find people.</p>
  } else if (isError) {
    body = <p className={styles.hint}>Couldn’t search. Please try again.</p>
  } else if (isFetching && results.length === 0) {
    body = <p className={styles.hint}>Searching…</p>
  } else if (results.length === 0) {
    body = <p className={styles.hint}>No one found for “{query.trim()}”.</p>
  } else {
    body = (
      <ul className={styles.list} role="listbox" aria-label="People">
        {results.map((person, index) => (
          <li
            key={person.user_id}
            role="option"
            aria-selected={index === active}
            className={index === active ? `${styles.row} ${styles.active}` : styles.row}
            onMouseEnter={() => setActive(index)}
          >
            <button type="button" className={styles.person} onClick={() => openProfile(person)}>
              <PersonAvatar person={person} />
              <span className={styles.text}>
                <span className={styles.name}>
                  {person.full_name}
                  {person.university_verified || person.employer_verified ? (
                    <span className={styles.verified}>
                      {[
                        person.university_verified && 'Alumni',
                        person.employer_verified && 'Employee',
                      ]
                        .filter(Boolean)
                        .join(' · ')}{' '}
                      verified
                    </span>
                  ) : null}
                </span>
                <span className={styles.subline}>{personSubline(person)}</span>
              </span>
            </button>
            <ConnectButton
              userId={person.user_id}
              status={person.relationship}
              requestId={person.request_id}
              size="small"
            />
          </li>
        ))}
      </ul>
    )
  }

  return (
    <Modal
      open={open}
      onCancel={close}
      footer={null}
      closable={false}
      // The dialog's accessible name, with no visible title bar.
      title={<span className={styles.srOnly}>Search people</span>}
      destroyOnHidden
      width={600}
      styles={{ body: { padding: 0 } }}
      afterOpenChange={(visible) => visible && inputRef.current?.focus()}
    >
      <div className={styles.box}>
        <Input
          ref={inputRef}
          variant="borderless"
          size="large"
          className={styles.input}
          prefix={<Icon src={searchIcon} className={styles.icon} />}
          placeholder="Search people by name, job, company or university"
          aria-label="Search people"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
        />
      </div>
      <div className={styles.results} aria-live="polite">
        {body}
      </div>
    </Modal>
  )
}

export default PeopleSearch
