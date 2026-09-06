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
import { multiplayerConfigured, multiplayerSetupHint, supabase } from './supabase'

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
/**
 * How long the line may be down before the player is told. Long enough that
 * an ordinary blip passes unnoticed, short enough that a real outage is not a
 * mystery.
 */
const RECONNECT_GRACE_MS = 2500

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
  /**
   * How many DEVICES are in this game, including this one. A device is a
   * device — phone, tablet or laptop — so the wording never assumes a phone.
   */
  deviceCount: number
  /**
   * True only when the line has been down long enough to be worth telling the
   * player about. Short blips never set it, so the badge does not flicker.
   */
  reconnecting: boolean
  multiplayerAvailable: boolean
  startHosting: () => void
  joinGame: (code: string) => void
  addMe: (name: string, colourId: string) => void
  editMe: (patch: { name?: string; colourId?: string }) => void
  leave: () => void
  /**
   * Walk away from a game in progress: take this device's player out of the
   * game properly, so the others see them go, and then disconnect.
   */
  leaveGame: () => void
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
  /**
   * The game we are in and how to get back into it.
   *
   * A phone loses its connection all the time — the screen locks, the app goes
   * to the background, the train goes into a tunnel, Wi-Fi hands over to
   * mobile data. None of that should end anybody's game, so once a device has
   * been in a game it keeps trying to get back in, and the host gives it the
   * same seat back because it recognises the device id.
   */
  const codeRef = useRef<string | null>(null)
  /** True once this device has actually been in the game, not just dialling. */
  const joinedRef = useRef(false)
  const retryTimerRef = useRef<number | null>(null)
  const retryCountRef = useRef(0)
  const stateRef = useRef(state)
  stateRef.current = state
  const roleRef = useRef(role)
  roleRef.current = role
  const statusRef = useRef(status)
  statusRef.current = status
  /** Bumped by every message the host sends us, to prove the line is alive. */
  const lastMessageRef = useRef(0)
  /** Which channel is the live one; older ones' callbacks are ignored. */
  const generationRef = useRef(0)
  /**
   * Whether to actually SAY we are reconnecting.
   *
   * A dropped channel is normal and usually fixed within a few hundred
   * milliseconds. Announcing every one of those made the badge flicker on and
   * off all game while nothing was actually wrong, so the badge only appears
   * once the line has been down long enough to be worth mentioning, and goes
   * the instant it is back.
   */
  const [reconnecting, setReconnecting] = useState(false)
  const announceTimerRef = useRef<number | null>(null)

  const send = useCallback((message: NetMessage) => {
    channelRef.current?.send({ type: 'broadcast', event: 'msg', payload: message })
  }, [])

  // ------------------------------------------------------------------ host --

  /** Send the game out, with each device's copy redacted for that device. */
  const publish = useCallback(
    (next: GameState, onlyTo: string | null = null) => {
      const targets = onlyTo ? [onlyTo] : Object.keys(seatsRef.current)
      // Once the game is over the balances stop being private: the final
      // standings are the point, and every device must be able to show the
      // same ones. Sending the redacted state here left guests looking at a
      // leaderboard of zeroes.
      const over =
        next.phase === 'gameOver' || next.phase === 'timeUp' || next.phase === 'ended'
      for (const device of targets) {
        send({
          t: 'state',
          forDevice: device,
          state: over ? redactFor(next, null, true) : redactFor(next, seatsRef.current[device] || null),
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

  /** The line is back. Say nothing, and cancel any pending announcement. */
  const linkIsUp = useCallback(() => {
    if (announceTimerRef.current !== null) {
      window.clearTimeout(announceTimerRef.current)
      announceTimerRef.current = null
    }
    setReconnecting(false)
  }, [])

  /**
   * The line is down. Start the clock, but do not say so yet — most drops are
   * fixed before this fires, and a badge that blinks on every one of them is
   * worse than no badge.
   */
  const linkIsDown = useCallback(() => {
    if (announceTimerRef.current !== null) return
    announceTimerRef.current = window.setTimeout(() => {
      announceTimerRef.current = null
      setReconnecting(true)
    }, RECONNECT_GRACE_MS)
  }, [])

  // ----------------------------------------------------------------- guest --

  const handleGuestMessage = useCallback(
    (message: NetMessage) => {
      lastMessageRef.current += 1
      if (message.t === 'state') {
        if (message.forDevice && message.forDevice !== me) return
        joinedRef.current = true
        linkIsUp()
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
    [linkIsUp, me],
  )

  // ------------------------------------------------------------ connecting --

  const openChannel = useCallback(
    (code: string, asHost: boolean, onReady: () => void, onFail: (why: string) => void) => {
      channelRef.current?.unsubscribe()
      const channel = supabase().channel(roomFor(code), {
        config: { broadcast: { self: false } },
      })
      channelRef.current = channel
      // Every channel we open gets a number. The one we replaced still fires
      // its own callbacks as it shuts down — including a CLOSED that used to
      // be read as "the connection dropped" and kick off another reconnect,
      // which replaced the channel, which closed it, round and round. A
      // callback from anything but the current channel is now ignored.
      generationRef.current += 1
      const generation = generationRef.current
      const isCurrent = () => generationRef.current === generation

      channel.on('broadcast', { event: 'msg' }, ({ payload }) => {
        if (!isCurrent()) return
        const message = payload as NetMessage
        if (asHost) handleHostMessage(message)
        else handleGuestMessage(message)
      })

      channel.subscribe((channelStatus) => {
        if (!isCurrent()) return
        if (channelStatus === 'SUBSCRIBED') {
          onReady()
          return
        }
        // CLOSED is deliberately not a failure: it is what a channel says when
        // it is taken down, which is usually us taking it down.
        if (channelStatus === 'CHANNEL_ERROR' || channelStatus === 'TIMED_OUT') {
          onFail('Could not reach the game server. Check your connection and try again.')
        }
      })
    },
    [handleGuestMessage, handleHostMessage],
  )

  /**
   * Get back into the game we were already in.
   *
   * The game is not abandoned and nothing is reset: the board stays on screen
   * while this runs, and the moment the channel is back the host is asked for
   * the current state, which comes back with this device's own seat, money and
   * properties exactly as they were.
   */
  const reconnect = useCallback(() => {
    const code = codeRef.current
    if (!code || !joinedRef.current) return
    if (retryTimerRef.current !== null) return

    const asHost = roleRef.current === 'host'
    // Quick at first, then backing off, so a blip is invisible and a long
    // outage does not hammer the server. It never gives up on its own.
    const wait = Math.min(400 * 2 ** retryCountRef.current, 5000)
    retryCountRef.current += 1
    linkIsDown()

    retryTimerRef.current = window.setTimeout(() => {
      retryTimerRef.current = null
      if (!codeRef.current || !joinedRef.current) return
      openChannel(
        code,
        asHost,
        () => {
          retryCountRef.current = 0
          setError(null)
          linkIsUp()
          if (asHost) {
            setStatus('ready')
            publish(stateRef.current)
          } else {
            // The host answering with the state is what makes us ready again.
            send({ t: 'hello', deviceId: me })
          }
        },
        () => reconnect(),
      )
    }, wait)
  }, [linkIsDown, linkIsUp, me, openChannel, publish, send])

  /**
   * A locked phone stops talking. Rather than wait for the next failure, try
   * the moment the player looks at their screen again or the network returns.
   */
  useEffect(() => {
    const wake = () => {
      if (!joinedRef.current) return
      retryCountRef.current = 0
      if (statusRef.current === 'ready') {
        // The channel may look fine and be dead. Prod it, and only rebuild it
        // if nothing comes back — rebuilding a healthy channel every time the
        // player switches apps would interrupt the game for no reason.
        if (roleRef.current === 'host') publish(stateRef.current)
        else {
          send({ t: 'hello', deviceId: me })
          const answeredAt = lastMessageRef.current
          window.setTimeout(() => {
            if (lastMessageRef.current === answeredAt) reconnect()
          }, 2500)
        }
        return
      }
      reconnect()
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') wake()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', wake)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', wake)
    }
  }, [me, publish, reconnect, send])

  const startHosting = useCallback(() => {
    if (!multiplayerConfigured) {
      setError(multiplayerSetupHint())
      setStatus('error')
      return
    }
    if (channelRef.current && roleRef.current === 'host') return
    setStatus('connecting')
    setError(null)
    setRole('host')
    roleRef.current = 'host'
    codeRef.current = stateRef.current.gameCode
    retryCountRef.current = 0
    openChannel(
      stateRef.current.gameCode,
      true,
      () => {
        joinedRef.current = true
        setStatus('ready')
      },
      (why) => {
        // Once the game is open, losing the line is a hiccup to ride out, not
        // a reason to close it and lose everybody who has joined.
        if (joinedRef.current) {
          reconnect()
          return
        }
        setError(why)
        setStatus('error')
      },
    )
  }, [openChannel, reconnect])

  const joinGame = useCallback(
    (code: string) => {
      if (!multiplayerConfigured) {
        setError(multiplayerSetupHint())
        setStatus('error')
        return
      }
      setStatus('connecting')
      setError(null)
      setRole('guest')
      roleRef.current = 'guest'
      setMyPlayerId(null)
      codeRef.current = code
      joinedRef.current = false
      retryCountRef.current = 0

      // The host answering is what proves the game exists. If nothing comes
      // back in time there is nothing to show, so we drop the whole attempt
      // rather than leaving somebody sitting in an empty lobby.
      const timer = window.setTimeout(() => {
        if (joinedRef.current) return
        channelRef.current?.unsubscribe()
        channelRef.current = null
        codeRef.current = null
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
          // Dropping out of a game we are already in is a reconnection, not a
          // failed join: the board stays up and we quietly get back in.
          if (joinedRef.current) {
            reconnect()
            return
          }
          window.clearTimeout(timer)
          codeRef.current = null
          setRole('solo')
          setError(why)
          setStatus('error')
        },
      )
    },
    [me, openChannel, reconnect, send],
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

  const leaveGame = useCallback(() => {
    const seat = myPlayerId
    if (roleRef.current === 'guest') {
      // Ask the host to take us out, give the message a moment to reach it,
      // and only then drop the connection.
      if (seat) send({ t: 'action', deviceId: me, action: { type: 'LEAVE_GAME', playerId: seat } })
      window.setTimeout(() => leaveRef.current(), 250)
      return
    }
    // The host IS the game: without it there is nothing for the others to be
    // connected to, so leaving ends the game rather than stranding everybody.
    if (roleRef.current === 'host') {
      setState((current) => {
        const next = gameReducer(current, { type: 'END_GAME' })
        publish(next)
        return next
      })
      window.setTimeout(() => leaveRef.current(), 250)
    }
  }, [me, myPlayerId, publish, send])

  const leave = useCallback(() => {
    // Deliberately walking away is the one thing that stops the reconnecting.
    codeRef.current = null
    joinedRef.current = false
    retryCountRef.current = 0
    generationRef.current += 1
    linkIsUp()
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
    channelRef.current?.unsubscribe()
    channelRef.current = null
    seatsRef.current = {}
    setRole('solo')
    setStatus('idle')
    setMyPlayerId(null)
    setSeats({})
    setError(null)
    setState(createInitialState())
  }, [linkIsUp])

  const leaveRef = useRef(leave)
  leaveRef.current = leave

  useEffect(
    () => () => {
      channelRef.current?.unsubscribe()
      if (announceTimerRef.current !== null) window.clearTimeout(announceTimerRef.current)
      if (retryTimerRef.current !== null) window.clearTimeout(retryTimerRef.current)
    },
    [],
  )

  /**
   * A way to pull the plug on purpose, so that losing the connection can be
   * tested rather than hoped about. Development only — it is compiled out of
   * the built game.
   */
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window as unknown as { businessDropConnection?: () => void }
    w.businessDropConnection = () => {
      channelRef.current?.unsubscribe()
      channelRef.current = null
      reconnect()
    }
    return () => void delete w.businessDropConnection
  }, [reconnect])

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
    deviceCount: role === 'solo' ? 1 : Object.keys(seats).length + 1,
    reconnecting,
    multiplayerAvailable: multiplayerConfigured,
    startHosting,
    joinGame,
    addMe,
    editMe,
    leave,
    leaveGame,
  }
}
