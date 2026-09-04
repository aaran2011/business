import Peer, { type DataConnection } from 'peerjs'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createInitialState, gameReducer } from '../engine/game'
import type { GameAction, GameState } from '../engine/types'
import { guestMayDo, peerIdForCode, redactFor, type NetMessage } from './protocol'

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
  /**
   * Whether this device is the one that plays a given seat. On the host that
   * is every seat no phone has taken; on a phone it is only its own.
   */
  controlsPlayer: (playerId: string) => boolean
  /** How many phones are connected to this host. */
  guestCount: number
  startHosting: () => void
  joinGame: (code: string) => void
  /** Guest: add myself to the host's lobby. */
  addMe: (name: string, colourId: string) => void
  /** Guest: change my own name or colour. */
  editMe: (patch: { name?: string; colourId?: string }) => void
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

        if (message.t === 'addMe') {
          const current = stateRef.current
          if (current.phase !== 'setup') return
          if (current.lobby.length >= current.settings.maxPlayers) {
            conn.send({ t: 'full' } as NetMessage)
            return
          }
          // The host mints the id so two phones cannot generate the same one.
          const id = `p${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`
          guest.playerId = id
          applyLocally({
            type: 'ADD_LOBBY_PLAYER',
            id,
            name: message.name,
            colourId: message.colourId,
          })
          setTakenSeats(
            [...guestsRef.current.values()]
              .map((g) => g.playerId)
              .filter((id): id is string => id !== null),
          )
          conn.send({ t: 'claimed', playerId: id } as NetMessage)
          return
        }

        if (message.t === 'editMe') {
          // A phone may only ever edit its own seat.
          if (!guest.playerId) return
          applyLocally({
            type: 'UPDATE_LOBBY_PLAYER',
            id: guest.playerId,
            name: message.name,
            colourId: message.colourId,
          })
          return
        }

        if (message.t === 'action') {
          // The host is the authority on what a phone may do — see guestMayDo.
          if (!guestMayDo(message.action, guest.playerId, stateRef.current)) {
            conn.send({
              t: 'reject',
              reason:
                stateRef.current.phase === 'playing'
                  ? 'It is not your turn.'
                  : 'Only the host can do that.',
            } as NetMessage)
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
        } else if (message.t === 'full') {
          setError('That game is full.')
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

  const addMe = useCallback((name: string, colourId: string) => {
    hostConnRef.current?.send({ t: 'addMe', name, colourId } as NetMessage)
  }, [])

  const editMe = useCallback((patch: { name?: string; colourId?: string }) => {
    hostConnRef.current?.send({ t: 'editMe', ...patch } as NetMessage)
  }, [])

  /**
   * The host plays every seat no phone has taken; a phone plays only its own.
   * This is what stops the host rolling on somebody else's behalf.
   */
  const controlsPlayer = useCallback(
    (playerId: string) => {
      if (roleRef.current === 'guest') return myPlayerId === playerId
      return !takenSeats.includes(playerId)
    },
    [myPlayerId, takenSeats],
  )

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
    addMe,
    editMe,
    leave,
    controlsPlayer,
  }
}
