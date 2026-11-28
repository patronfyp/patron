import { App, Button, Dropdown, Space } from 'antd'

import checkIcon from '@/assets/icons/check-12.svg'
import chevronDownIcon from '@/assets/icons/chevron-down.svg'
import { getApiErrorMessage } from '@/shared/api/getApiErrorMessage'
import Icon from '@/shared/components/Icon/Icon'

import {
  useAcceptRequest,
  useDeclineRequest,
  useSendRequest,
  useWithdrawRequest,
} from '../hooks/useConnections'

import styles from './ConnectButton.module.css'

/**
 * The one Connect button for every place a person appears: profile pages,
 * search and request lists. It shows the next step for where I stand with
 * them, and every action refreshes all connection data.
 *
 * @param {object} props
 * @param {string} props.userId
 * @param {import('../api/connections.api').Relationship} props.status
 * @param {string | null} [props.requestId] - the pending request, if any
 * @param {'middle' | 'small'} [props.size]
 */
function ConnectButton({ userId, status, requestId = null, size = 'middle' }) {
  const { message } = App.useApp()
  const send = useSendRequest()
  const accept = useAcceptRequest()
  const decline = useDeclineRequest()
  const withdraw = useWithdrawRequest()

  const run = (mutation, argument, done) =>
    mutation.mutate(argument, {
      onSuccess: () => (done ? message.success(done) : undefined),
      onError: (error) =>
        message.error(getApiErrorMessage(error, 'That didn’t work. Please try again.')),
    })

  if (status === 'connected') {
    return (
      <Button size={size} className={styles.connected} disabled>
        <Icon src={checkIcon} size={12} />
        Connected
      </Button>
    )
  }

  if (status === 'pending_received') {
    return (
      <Space size={8}>
        <Button
          type="primary"
          size={size}
          loading={accept.isPending}
          disabled={decline.isPending}
          onClick={() => run(accept, requestId, 'You’re now connected')}
        >
          Accept
        </Button>
        <Button
          size={size}
          loading={decline.isPending}
          disabled={accept.isPending}
          onClick={() => run(decline, requestId)}
        >
          Decline
        </Button>
      </Space>
    )
  }

  if (status === 'pending_sent') {
    return (
      <Dropdown
        trigger={['click']}
        menu={{
          items: [{ key: 'withdraw', label: 'Withdraw request' }],
          onClick: () => run(withdraw, requestId, 'Request withdrawn'),
        }}
      >
        <Button size={size} loading={withdraw.isPending}>
          Pending
          <Icon src={chevronDownIcon} size={12} />
        </Button>
      </Dropdown>
    )
  }

  return (
    <Button
      type="primary"
      size={size}
      loading={send.isPending}
      onClick={() => run(send, userId, 'Request sent')}
    >
      Connect
    </Button>
  )
}

export default ConnectButton
