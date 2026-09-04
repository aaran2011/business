import Peer, { type DataConnection } from 'peerjs'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createInitialState, gameReducer } from '../engine/game'
import type { GameAction, GameState } from '../engine/types'
import { peerIdForCode, redactFor, type NetMessage } from './protocol'

/**
 * Holds the game and, when more than one device is playing, keeps them in step.
 *
 * Three ways to be:
 *   solo  — one device, passed round the table. Nothing touches the network.
 *   host  — this device runs the rules and serves the board to the others.
 *   guest — this device shows the host's board and asks it to do things.
 *
 * The rules only ever run on the host, so there is one copy of the truth and
 * no way for two devices to disagree about who owns Iraq.
 */
export type NetRole = 'solo' | 'host' | 'guest'
export type NetStatus = 'idle' | 'connecting' | 'ready' | 'error'

export interface Session {
  state: GameState
  /** Dispatch as usual — on a guest this asks the host instead. */
  dispatch: (action: GameAction) => void
  role: NetRole
  status: NetStatus
  error: string | null
  /** The seat this device controls. Null on the host and before claiming. */
  myPlayerId: string | null
  /** Seats already taken by a phone, so two people cannot claim one player. */
  takenSeats: string[]
  /** How many phones are connected to this host. */
  guestCount: number
  startHosting: () => void
  joinGame: (code: string) => void
  claimSeat: (playerId: string) => void
  leave: () => void
}

export function useSession(): Session {
  const [state, rawDispatch] = useState<GameState>(() => createInitialState())
  const [role, setRole] = useState<NetRole>('solo')
  const [status, setStatus] = useState<NetStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null)
  const [takenSeats, setTakenSeats] = useState<string[]>([])
  const [guestCount, setGuestCount] = useState(0)

  const peerRef = useRef<Peer | null>(null)
  /** Host: every connected phone, and which seat it claimed. */
  const guestsRef = useRef<Map<string, { conn: DataConnection; playerId: string | null }>>(
    new Map(),
  )
  /** Guest: the single channel back to the host. */
  const hostConnRef = useRef<DataConnection | null>(null)
  /** Always the newest game, for use inside callbacks that were made earlier. */
  const stateRef = useRef(state)
  stateRef.current = state
  const roleRef = useRef(role)
  roleRef.current = role

  // ---------------------------------------------------------------- host ---

  const broadcast = useCallback((next: GameState) => {
    for (const [, guest] of guestsRef.current) {
      if (!guest.conn.open) continue
      const message: NetMessage = {
        t: 'state',
        state: redactFor(next, guest.playerId),
        seats: [...guestsRef.current.values()]
          .map((g) => g.playerId)
          .filter((id): id is string => id !== null),
      }
      guest.conn.send(message)
    }
  }, [])

  /** The only place the rules ever run. */
  const applyLocally = useCallback(
    (action: GameAction) => {
      rawDispatch((current) => {
        const next = gameReducer(current, action)
        if (roleRef.current === 'host') broadcast(next)
        return next
      })
    },
    [broadcast],
  )

  const startHosting = useCallback(() => {
    if (peerRef.current) return
    setStatus('connecting')
    setError(null)

    const peer = new Peer(peerIdForCode(stateRef.current.gameCode))
    peerRef.current = peer

    peer.on('open', () => {
      setRole('host')
      setStatus('ready')
    })

    peer.on('connection', (conn) => {
      conn.on('open', () => {
        guestsRef.current.set(conn.connectionId, { conn, playerId: null })
        setGuestCount(guestsRef.current.size)
        conn.send({ t: 'state', state: redactFor(stateRef.current, null), seats: [] } as NetMessage)
      })

      conn.on('data', (raw) => {
        const message = raw as NetMessage
        const guest = guestsRef.current.get(conn.connectionId)
        if (!guest) return

        if (message.t === 'claim') {
          const alreadyTaken = [...guestsRef.current.values()].some(
            (g) => g.playerId === message.playerId && g.conn.connectionId !== conn.connectionId,
          )
          if (alreadyTaken) {
            conn.send({ t: 'reject', reason: 'Someone else is already playing as them.' } as NetMessage)
            return
          }
          guest.playerId = message.playerId
          setTakenSeats(
            [...guestsRef.current.values()]
              .map((g) => g.playerId)
              .filter((id): id is string => id !== null),
          )
          conn.send({ t: 'claimed', playerId: message.playerId } as NetMessage)
          conn.send({
            t: 'state',
            state: redactFor(stateRef.current, message.playerId),
            seats: [],
          } as NetMessage)
          return
        }

        if (message.t === 'action') {
          // A phone may only act for the seat it claimed, and only on its turn.
          const current = stateRef.current
          const whoseTurn = current.turnOrder[current.currentIndex]
          const allowed = guest.playerId !== null && guest.playerId === whoseTurn
          if (!allowed) {
            conn.send({ t: 'reject', reason: 'It is not your turn.' } as NetMessage)
            return
          }
          applyLocally(message.action)
        }
      })

      const drop = () => {
        guestsRef.current.delete(conn.connectionId)
        setGuestCount(guestsRef.current.size)
        setTakenSeats(
          [...guestsRef.current.values()]
            .map((g) => g.playerId)
            .filter((id): id is string => id !== null),
        )
      }
      conn.on('close', drop)
      conn.on('error', drop)
    })

    peer.on('error', (err) => {
      // The commonest one by far: this code is already hosting somewhere.
      const unavailable = String(err).includes('unavailable-id')
      setError(
        unavailable
          ? 'That game code is already in use. Reload to get a new one.'
          : `Could not start hosting: ${err.message ?? err}`,
      )
      setStatus('error')
    })
  }, [applyLocally])

  // --------------------------------------------------------------- guest ---

  const joinGame = useCallback((code: string) => {
    if (peerRef.current) {
      peerRef.current.destroy()
      peerRef.current = null
    }
    setStatus('connecting')
    setError(null)
    setRole('guest')

    const peer = new Peer()
    peerRef.current = peer

    peer.on('open', () => {
      const conn = peer.connect(peerIdForCode(code), { reliable: true })
      hostConnRef.current = conn

      const timeout = window.setTimeout(() => {
        if (!conn.open) {
          setError('No game found with that code. Check it and try again.')
          setStatus('error')
        }
      }, 12000)

      conn.on('open', () => {
        window.clearTimeout(timeout)
        setStatus('ready')
        conn.send({ t: 'hello' } as NetMessage)
      })

      conn.on('data', (raw) => {
        const message = raw as NetMessage
        if (message.t === 'state') {
          rawDispatch(message.state)
          setTakenSeats(message.seats)
        } else if (message.t === 'claimed') {
          setMyPlayerId(message.playerId)
          setError(null)
        } else if (message.t === 'reject') {
          setError(message.reason)
        }
      })

      conn.on('close', () => {
        setError('The host closed the game.')
        setStatus('error')
      })
    })

    peer.on('error', (err) => {
      const gone = String(err).includes('peer-unavailable')
      setError(
        gone
          ? 'No game found with that code. Check it and try again.'
          : `Could not join: ${err.message ?? err}`,
      )
      setStatus('error')
    })
  }, [])

  const claimSeat = useCallback((playerId: string) => {
    hostConnRef.current?.send({ t: 'claim', playerId } as NetMessage)
  }, [])

  const leave = useCallback(() => {
    peerRef.current?.destroy()
    peerRef.current = null
    hostConnRef.current = null
    guestsRef.current.clear()
    setRole('solo')
    setStatus('idle')
    setMyPlayerId(null)
    setTakenSeats([])
    setGuestCount(0)
    setError(null)
  }, [])

  useEffect(() => () => peerRef.current?.destroy(), [])

  /**
   * On a guest, a dispatch is a request: the host decides and sends the game
   * back. Everywhere else it just runs the rules here.
   */
  const dispatch = useCallback(
    (action: GameAction) => {
      if (roleRef.current === 'guest') {
        hostConnRef.current?.send({ t: 'action', action } as NetMessage)
        return
      }
      applyLocally(action)
    },
    [applyLocally],
  )

  return {
    state,
    dispatch,
    role,
    status,
    error,
    myPlayerId,
    takenSeats,
    guestCount,
    startHosting,
    joinGame,
    claimSeat,
    leave,
  }
}
