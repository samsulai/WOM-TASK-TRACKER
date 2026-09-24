import { INTERNAL_SCOPE } from '../scope'

// Admin-only. Picks WHICH data you're looking at -- it never changes any
// data. (Moving a week to a different client is a separate, explicit action
// on the week card.)
export default function ViewSwitcher({ clients, value, onChange }) {
  return (
    <label className="view-switcher">
      <span className="view-switcher-label">Viewing</span>
      <select
        className="view-switcher-select"
        value={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
        title="Choose whose weeks to look at. This only changes what you see — it doesn't change any data."
      >
        <option value="">Everything</option>
        <option value={INTERNAL_SCOPE}>Internal only</option>
        {clients.length > 0 && (
          <optgroup label="Clients">
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </optgroup>
        )}
      </select>
    </label>
  )
}
