import ReactDOM from 'react-dom';

interface DropdownOption {
  value: string;
  label: string;
}

interface FieldSwitcherDropdownProps {
  show:          boolean;
  pos:           { top: number; left: number } | null;
  options:       DropdownOption[];
  activeValue:   string;
  dataAttr?:     string;
  onSelect:      (value: string) => void;
}

const ACTIVE_CLS  = 'font-semibold text-purple-600 bg-purple-50';
const DEFAULT_CLS = 'text-gray-700';

export function FieldSwitcherDropdown({
  show, pos, options, activeValue, dataAttr, onSelect,
}: FieldSwitcherDropdownProps) {
  if (!show || !pos) return null;

  return ReactDOM.createPortal(
    <div
      {...(dataAttr ? { [dataAttr]: 'true' } : {})}
      style={{ position: 'absolute', top: pos.top, left: pos.left, zIndex: 9999 }}
      className="bg-white border border-gray-200 rounded-lg shadow-xl py-1 min-w-[150px]"
      onMouseDown={e => e.stopPropagation()}
    >
      {options.map(opt => (
        <button
          key={opt.value}
          onMouseDown={e => { e.stopPropagation(); onSelect(opt.value); }}
          className={`w-full text-left px-3 py-2 text-[13px] hover:bg-purple-50 hover:text-purple-700 transition-colors flex items-center gap-2 ${activeValue === opt.value ? ACTIVE_CLS : DEFAULT_CLS}`}
        >
          {activeValue === opt.value && <span className="text-purple-600">✓</span>}
          {opt.label}
        </button>
      ))}
    </div>,
    document.body
  );
}