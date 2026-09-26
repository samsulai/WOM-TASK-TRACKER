import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Download, FileSpreadsheet, FileText } from 'lucide-react'

export default function ExportMenu({ disabled, onExportXlsx, onExportCsv }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const choose = (fn) => () => {
    setOpen(false)
    fn()
  }

  return (
    <div className="export-menu" ref={rootRef}>
      <button
        type="button"
        className="export-btn"
        disabled={disabled}
        title="Export"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Download size={18} aria-hidden="true" /> <span className="btn-label">Export</span>{' '}
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <div className="export-menu-list" role="menu">
          <button type="button" role="menuitem" className="week-owner-option" onClick={choose(onExportXlsx)}>
            <FileSpreadsheet size={18} aria-hidden="true" /> Excel (.xlsx)
          </button>
          <button type="button" role="menuitem" className="week-owner-option" onClick={choose(onExportCsv)}>
            <FileText size={18} aria-hidden="true" /> CSV
          </button>
        </div>
      )}
    </div>
  )
}
