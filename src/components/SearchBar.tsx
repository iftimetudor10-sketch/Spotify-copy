import { Search, X } from 'lucide-react'

export function SearchBar({ value, onChange, placeholder = 'Search your library' }: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <label className="search-field">
      <Search size={17} aria-hidden="true" />
      <span className="sr-only">Search</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
      {value && <button type="button" className="icon-button clear-search" onClick={() => onChange('')} aria-label="Clear search"><X size={15} /></button>}
    </label>
  )
}