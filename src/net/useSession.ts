import type { RealtimeChannel } from '@supabase/supabase-js'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createInitialState, gameReducer } from '../engine/game'
import type { GameAction, GameState } from '../engine/types'
import {
  deviceId,
  guestMayDo,
  JOIN_TIMEOUT_MS,
  redactFor,
  roomFor,
  type NetMessage,
  type SeatMap,
} from './protocol'
import { multiplayerConfigured, supabase } from './supabase'

/**
 * Holds the game and, when more than one device is playing, keeps them in step.
 *
 *   solo  — one device, passed round the table. Nothing touches the network.
 *   host  — this device runs the rules and serves the board to the others.
 *   guest — this device shows the host's board and asks it to do things.
 *
 * Everything goes through a Supabase Realtime channel named after the game
 * code, so devices never have to reach each other directly. Different Wi-Fi,
 * mobile data and locked-down networks all work the same way.
 */
export type NetRole = 'solo' | 'host' | 'guest'
export type NetStatus = 'idle' | 'connecting' | 'ready' | 'error'

export interface Session {
  state: GameState
  dispatch: (action: GameAction) => void
  role: NetRole
  status: NetStatus
  error: string | null
  /** The seat this device plays. */
  myPlayerId: string | null
  /** Whether this device is the one that plays a given seat. */
  controlsPlayer: (playerId: string) => boolean
  /** True on the device running the game (and in solo play). */
  isHost: boolean
  /** How many phones have joined this host. */
  guestCount: number
  multiplayerAvailable: boolean
  startHosting: () => void
  joinGame: (code: string) => void
  addMe: (name: string, colourId: string) => void
  editMe: (patch: { name?: string; colourId?: string }) => void
  leave: () => void
}

export function useSession(): Session {
  const [state, setState] = useState<GameState>(() => createInitialState())
  const [role, setRole] = useState<NetRole>('solo')
  const [status, setStatus] = useState<NetStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null)
  const [seats, setSeats] = useState<SeatMap>({})

  const me = useRef(deviceId()).current
  const channelRef = useRef<RealtimeChannel | null>(null)
  /** Host only: which device plays which seat. Survives a guest reconnecting. */
  const seatsRef = useRef<SeatMap>({})
  /** Cleared the moment the host's first state arrives. */
  const joinTimerRef = useRef<number | null>(null)
  const stateRef = useRef(state)
  stateRef.current = state
  const roleRef = useRef(role)
  roleRef.current = role

  const send = useCallback((message: NetMessage) => {
    channelRef.current?.send({ type: 'broadcast', event: 'msg', payload: message })
  }, [])

  // ------------------------------------------------------------------ host --

  /** Send the game out, with each device's copy redacted for that device. */
  const publish = useCallback(
    (next: GameState, onlyTo: string | null = null) => {
      const targets = onlyTo ? [onlyTo] : Object.keys(seatsRef.current)
      for (const device of targets) {
        send({
          t: 'state',
          forDevice: device,
          state: redactFor(next, seatsRef.current[device] || null),
          seats: seatsRef.current,
        })
      }
    },
    [send],
  )

  /** The only place the rules ever run. */
  const applyLocally = useCallback(
    (action: GameAction) => {
      setState((current) => {
        const next = gameReducer(current, action)
        if (roleRef.current === 'host') publish(next)
        return next
      })
    },
    [publish],
  )

  const handleHostMessage = useCallback(
    (message: NetMessage) => {
      const current = stateRef.current

      if (message.t === 'hello') {
        // A device arriving, or coming back after dropping out. If we already
        // know its seat it gets the same player back, money and all.
        if (!(message.deviceId in seatsRef.current)) seatsRef.current[message.deviceId] = ''
        setSeats({ ...seatsRef.current })
        const seat = seatsRef.current[message.deviceId]
        if (seat) send({ t: 'seated', forDevice: message.deviceId, playerId: seat })
        publish(current, message.deviceId)
        return
      }

      if (message.t === 'addMe') {
        const seated = seatsRef.current[message.deviceId]
        if (seated) {
          // A duplicate tap, or a rejoin: confirm the seat they already have.
          send({ t: 'seated', forDevice: message.deviceId, playerId: seated })
          publish(current, message.deviceId)
          return
        }
        if (current.phase !== 'setup') {
          send({
            t: 'reject',
            forDevice: message.deviceId,
            reason: 'That game has already started.',
          })
          return
        }
        if (current.lobby.length >= current.settings.maxPlayers) {
          send({ t: 'reject', forDevice: message.deviceId, reason: 'That game is full.' })
          return
        }
        const id = `p${Math.random().toString(36).slice(2, 8)}`
        seatsRef.current[message.deviceId] = id
        setSeats({ ...seatsRef.current })
        send({ t: 'seated', forDevice: message.deviceId, playerId: id })
        applyLocally({
          type: 'ADD_LOBBY_PLAYER',
          id,
          name: message.name,
          colourId: message.colourId,
        })
        return
      }

      if (message.t === 'editMe') {
        const seat = seatsRef.current[message.deviceId]
        if (!seat) return
        applyLocally({
          type: 'UPDATE_LOBBY_PLAYER',
          id: seat,
          name: message.name,
          colourId: message.colourId,
        })
        return
      }

      if (message.t === 'action') {
        const seat = seatsRef.current[message.deviceId] || null
        if (!guestMayDo(message.action, seat, current)) {
          send({
            t: 'reject',
            forDevice: message.deviceId,
            reason:
              current.phase === 'playing' ? 'It is not your turn.' : 'Only the host can do that.',
          })
          return
        }
        applyLocally(message.action)
      }
    },
    [applyLocally, publish, send],
  )

  // ----------------------------------------------------------------- guest --

  const handleGuestMessage = useCallback(
    (message: NetMessage) => {
      if (message.t === 'state') {
        if (message.forDevice && message.forDevice !== me) return
        setState(message.state)
        setSeats(message.seats)
        setStatus('ready')
        setError(null)
        return
      }
      if (message.t === 'seated' && message.forDevice === me) {
        setMyPlayerId(message.playerId)
        setError(null)
        return
      }
      if (message.t === 'reject' && message.forDevice === me) {
        setError(message.reason)
      }
    },
    [me],
  )

  // ------------------------------------------------------------ connecting --

  const openChannel = useCallback(
    (code: string, asHost: boolean, onReady: () => void, onFail: (why: string) => void) => {
      channelRef.current?.unsubscribe()
      const channel = supabase().channel(roomFor(code), {
        config: { broadcast: { self: false } },
      })
      channelRef.current = channel

      channel.on('broadcast', { event: 'msg' }, ({ payload }) => {
        const message = payload as NetMessage
        if (asHost) handleHostMessage(message)
        else handleGuestMessage(message)
      })

      channel.subscribe((channelStatus) => {
        if (channelStatus === 'SUBSCRIBED') onReady()
        else if (channelStatus === 'CHANNEL_ERROR' || channelStatus === 'TIMED_OUT') {
          onFail('Could not reach the game server. Check your connection and try again.')
        }
      })
    },
    [handleGuestMessage, handleHostMessage],
  )

  const startHosting = useCallback(() => {
    if (!multiplayerConfigured) {
      setError('Multiplayer is not set up on this build.')
      setStatus('error')
      return
    }
    if (channelRef.current && roleRef.current === 'host') return
    setStatus('connecting')
    setError(null)
    setRole('host')
    openChannel(
      stateRef.current.gameCode,
      true,
      () => setStatus('ready'),
      (why) => {
        setError(why)
        setStatus('error')
      },
    )
  }, [openChannel])

  const joinGame = useCallback(
    (code: string) => {
      if (!multiplayerConfigured) {
        setError('Multiplayer is not set up on this build.')
        setStatus('error')
        return
      }
      setStatus('connecting')
      setError(null)
      setRole('guest')
      setMyPlayerId(null)

      // The host answering is what proves the game exists. If nothing comes
      // back in time there is nothing to show, so we drop the whole attempt
      // rather than leaving somebody sitting in an empty lobby.
      const timer = window.setTimeout(() => {
        channelRef.current?.unsubscribe()
        channelRef.current = null
        setRole('solo')
        setStatus('error')
        setError('No game with that code. Check the code and that the host still has it open.')
      }, JOIN_TIMEOUT_MS)
      joinTimerRef.current = timer

      openChannel(
        code,
        false,
        () => send({ t: 'hello', deviceId: me }),
        (why) => {
          window.clearTimeout(timer)
          setRole('solo')
          setError(why)
          setStatus('error')
        },
      )
    },
    [me, openChannel, send],
  )

  useEffect(() => {
    if (status === 'ready' && joinTimerRef.current) {
      window.clearTimeout(joinTimerRef.current)
      joinTimerRef.current = null
    }
  }, [status])

  const addMe = useCallback(
    (name: string, colourId: string) => send({ t: 'addMe', deviceId: me, name, colourId }),
    [me, send],
  )

  const editMe = useCallback(
    (patch: { name?: string; colourId?: string }) => send({ t: 'editMe', deviceId: me, ...patch }),
    [me, send],
  )

  const leave = useCallback(() => {
    channelRef.current?.unsubscribe()
    channelRef.current = null
    seatsRef.current = {}
    setRole('solo')
    setStatus('idle')
    setMyPlayerId(null)
    setSeats({})
    setError(null)
  }, [])

  useEffect(() => () => void channelRef.current?.unsubscribe(), [])

  /**
   * The host plays every seat no phone has taken; a phone plays only its own.
   * This is what stops the host acting on somebody else's behalf.
   */
  const controlsPlayer = useCallback(
    (playerId: string) => {
      if (roleRef.current === 'guest') return myPlayerId === playerId
      return !Object.values(seats).includes(playerId)
    },
    [myPlayerId, seats],
  )

  /** On a guest, a dispatch is a request; the host decides and sends back. */
  const dispatch = useCallback(
    (action: GameAction) => {
      if (roleRef.current === 'guest') {
        send({ t: 'action', deviceId: me, action })
        return
      }
      applyLocally(action)
    },
    [applyLocally, me, send],
  )

  return {
    state,
    dispatch,
    role,
    status,
    error,
    myPlayerId,
    controlsPlayer,
    isHost: role !== 'guest',
    guestCount: Object.values(seats).filter(Boolean).length,
    multiplayerAvailable: multiplayerConfigured,
    startHosting,
    joinGame,
    addMe,
    editMe,
    leave,
  }
}
