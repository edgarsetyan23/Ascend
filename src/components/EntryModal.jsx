import { useState, useEffect } from 'react'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function buildInitial(columns, existing) {
  const init = {}
  columns.forEach((col) => {
    init[col.key] = existing?.[col.key] ?? (col.type === 'date' ? todayStr() : '')
  })
  return init
}

export function EntryModal({ tracker, existing, onSave, onClose }) {
  const [form, setForm] = useState(() => buildInitial(tracker.columns, existing))
  const [errors, setErrors] = useState({})

  // Reset form when tracker changes or modal reopens
  useEffect(() => {
    setForm(buildInitial(tracker.columns, existing))
    setErrors({})
  }, [tracker.id, existing])

  function validate() {
    const errs = {}
    tracker.columns.forEach((col) => {
      if (col.required && !form[col.key]?.toString().trim()) {
        errs[col.key] = `${col.label} is required`
      }
    })
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (validate()) onSave(form)
  }

  function handleChange(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-header">
          <h2 className="modal-title">
            {tracker.icon} {existing ? 'Edit' : 'Add'} {tracker.name} Entry
          </h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="modal-fields">
            {tracker.columns.map((col) => (
              <div key={col.key} className={`field ${col.type === 'textarea' ? 'field--full' : ''}`}>
                <label className="field-label" htmlFor={col.key}>
                  {col.label}
                  {col.required && <span className="field-required">*</span>}
                </label>

                {col.type === 'select' ? (
                  <select
                    id={col.key}
                    className={`field-input ${errors[col.key] ? 'field-input--error' : ''}`}
                    value={form[col.key]}
                    onChange={(e) => handleChange(col.key, e.target.value)}
                  >
                    <option value="">— Select —</option>
                    {col.options.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : col.type === 'textarea' ? (
                  <textarea
                    id={col.key}
                    className={`field-input field-textarea ${errors[col.key] ? 'field-input--error' : ''}`}
                    value={form[col.key]}
                    onChange={(e) => handleChange(col.key, e.target.value)}
                    placeholder={col.placeholder}
                    rows={3}
                  />
                ) : (
                  <input
                    id={col.key}
                    type={col.type === 'url' ? 'url' : col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'}
                    className={`field-input ${errors[col.key] ? 'field-input--error' : ''}`}
                    value={form[col.key]}
                    onChange={(e) => handleChange(col.key, e.target.value)}
                    placeholder={col.placeholder}
                    min={col.type === 'number' ? 0 : undefined}
                  />
                )}

                {errors[col.key] && (
                  <span className="field-error">{errors[col.key]}</span>
                )}
              </div>
            ))}
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary">
              {existing ? 'Save Changes' : 'Add Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
