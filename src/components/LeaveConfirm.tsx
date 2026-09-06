/**
 * Leaving is deliberate. A stray tap must never take somebody out of a game,
 * so it is always asked first, and the consequence is spelled out.
 */
export function LeaveConfirm({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">Leave the game?</div>
        </div>
        <div className="modal-body">
          <p className="build-warning-text">
            Are you sure you want to leave the game? Your money and your properties go back to the
            Bank, and the others carry on without you.
          </p>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onCancel}>
            No, stay
          </button>
          <button className="btn btn-bad" onClick={onConfirm}>
            Yes, leave
          </button>
        </div>
      </div>
    </div>
  )
}
