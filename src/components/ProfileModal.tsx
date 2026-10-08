import { useState } from 'react'
import { avatarById } from '../data/avatars'
import { saveProfile, setAccountAvatar, type Profile } from '../net/accounts'
import { Avatar } from './AvatarArt'
import { AvatarGallery } from './LoginScreen'

/**
 * Changing your character.
 *
 * On a real account the password is asked for again, because the publishable
 * key is public: without it, anybody who knew a username could repaint
 * somebody else's player. On a device-only profile there is nothing to prove,
 * so it saves straight away.
 */
export function ProfileModal({
  profile,
  onSaved,
  onClose,
}: {
  profile: Profile
  onSaved: (profile: Profile) => void
  onClose: () => void
}) {
  const [avatarId, setAvatarId] = useState(profile.avatarId)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const changed = avatarId !== profile.avatarId
  const needsPassword = !profile.local

  const save = async () => {
    setError(null)
    if (!changed) return onClose()

    if (!needsPassword) {
      const next = { ...profile, avatarId }
      saveProfile(next)
      onSaved(next)
      return
    }

    setBusy(true)
    try {
      const result = await setAccountAvatar(profile.username, password, avatarId)
      if (!result.ok) return setError(result.error)
      saveProfile(result.profile)
      onSaved(result.profile)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="setup-shell">
      <div className="setup-hero">
        <h1>Your character</h1>
        <p>
          {profile.username} · {avatarById(avatarId).name}
        </p>
      </div>

      <div className="panel">
        <div className="panel-head">
          <span>Pick another</span>
          <Avatar id={avatarId} size={30} />
        </div>
        <div className="panel-body login-body">
          <AvatarGallery value={avatarId} onChange={setAvatarId} />

          {needsPassword && changed && (
            <div className="login-field">
              <label htmlFor="profile-pass">
                Your password
                <span className="login-hint">So nobody else can change your player</span>
              </label>
              <input
                id="profile-pass"
                className="input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !busy) void save()
                }}
              />
            </div>
          )}

          {error && <div className="login-error">{error}</div>}

          <div className="setup-actions">
            <button className="btn" onClick={onClose}>
              Back
            </button>
            <button
              className="btn btn-primary"
              style={{ marginLeft: 'auto' }}
              disabled={busy || (needsPassword && changed && password === '')}
              onClick={save}
            >
              {busy ? 'Saving…' : changed ? 'Save' : 'Done'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
