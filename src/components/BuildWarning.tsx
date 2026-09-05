import { displayNameOf } from '../engine/queries'

/**
 * The warning shown before a house goes up on a card that is part of a
 * complete colour group.
 *
 * It matters because building is not a pure upgrade here. While all three
 * cards of a colour are bare, each of them charges DOUBLE its site rent. The
 * moment a house appears on one, that card drops out of the doubling and
 * charges the printed house rent instead — which, on the cheaper countries,
 * can be worth less than the doubled site rent it gave up.
 *
 * So the player is asked first, and no money moves until they say yes.
 */
export function BuildWarning({
  propertyId,
  onConfirm,
  onCancel,
}: {
  propertyId: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="overlay" onClick={onCancel}>
      <div className="modal build-warning" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">Build on {displayNameOf(propertyId)}?</div>
        </div>
        <div className="modal-body">
          <p className="build-warning-text">
            You have 3 cards of the same colour. The rent is doubled. Do you still want to make a
            house?
          </p>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onCancel}>
            No
          </button>
          <button className="btn btn-good" onClick={onConfirm}>
            Yes
          </button>
        </div>
      </div>
    </div>
  )
}
