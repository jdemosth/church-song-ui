import { useEffect, useState } from 'react'
import { API_BASE_URL } from './apiOrigin'

export default function NetworkAccessPanel() {
  const [network, setNetwork] = useState(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    async function refresh() {
      try {
        const response = await fetch(`${API_BASE_URL}/system/network`, {
          cache: 'no-store', signal: controller.signal,
        })
        if (!response.ok) throw new Error('Network information unavailable')
        const data = await response.json()
        if (data?.application !== 'church-song-system' || !Array.isArray(data.addresses)) {
          throw new Error('Network information unavailable')
        }
        if (active) { setNetwork(data); setError('') }
      } catch {
        if (active) setError('Could not refresh network addresses. Check that the Windows server is running, then try again.')
      }
    }
    refresh()
    const timer = setInterval(refresh, 15000)
    return () => { active = false; controller.abort(); clearInterval(timer) }
  }, [attempt])
  return (
    <section className="console-card network-access-panel" aria-labelledby="network-access-title">
      <p className="card-kicker">Local network</p>
      <h3 id="network-access-title">Connect another computer</h3>
      <p>Connect the Mac to the church Wi-Fi, then open the address below. Windows must keep BOC WorshipView running.</p>
      {error ? <p role="status">{error} Previously shown addresses may be out of date.</p> : null}
      {!network && !error ? <p role="status">Checking network addresses…</p> : null}
      {network && !error ? <>
        <p role="status">{network.message}</p>
        {network.friendlyUrl && <p><strong>Mac bookmark: </strong><a href={network.friendlyUrl} target="_blank" rel="noreferrer">{network.friendlyUrl}</a></p>}
        {network.addresses.length > 0 ? <>
          <p>If the friendly address does not open, ask the Windows administrator for one of these current addresses:</p>
          <ul>{network.addresses.map(address => <li key={address.url}>
            <a href={address.url} target="_blank" rel="noreferrer">{address.url}</a>
            {' — '}{address.adapter} ({address.interfaceName})
          </li>)}</ul>
          <p>These numeric addresses can change when Windows reconnects to the network.</p>
        </> : <p>No private LAN address is available. The Windows administrator can check the network connection and Private network profile.</p>}
      </> : null}
      <p>Current browser address: <span>{window.location.origin}</span>. A localhost address works only on this computer.</p>
      <button type="button" className="button button-secondary" onClick={() => setAttempt(value => value + 1)}>Refresh network addresses</button>
    </section>
  )
}
