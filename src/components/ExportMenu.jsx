import { ChevronDown, Download, FileSpreadsheet, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

export default function ExportMenu({ disabled, onExportXlsx, onExportCsv }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" disabled={disabled} title="Export">
          <Download size={18} aria-hidden="true" /> <span className="hidden sm:inline">Export</span>
          <ChevronDown size={16} aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onExportXlsx}>
          <FileSpreadsheet size={18} aria-hidden="true" /> Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onExportCsv}>
          <FileText size={18} aria-hidden="true" /> CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
