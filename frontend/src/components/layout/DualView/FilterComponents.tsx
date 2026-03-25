import React from 'react';
import { ColumnFilters } from '@/hooks/useTableFilters';

export interface SearchFilterProps {
    columnKey: string;
    placeholder: string;
    value: string;
    onChange: (value: string) => void;
    isActive: boolean;
}

export const SearchFilter: React.FC<SearchFilterProps> = ({
    columnKey,
    placeholder,
    value,
    onChange,
    isActive,
}) => {
    if (!isActive) return null;

    return (
        <input
            autoFocus
            className="w-full bg-white dark:bg-muted text-[11px] font-normal border border-blue-400 dark:border-border dark:text-foreground dark:placeholder:text-muted-foreground rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-blue-500"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onClick={(e) => e.stopPropagation()}
        />
    );
};

export interface ListFilterOption {
    value: string;
    label: string;
    icon?: React.ReactNode;
    className?: string;
}

export interface ListFilterProps {
    columnKey: string;
    options: ListFilterOption[];
    selectedValue: string;
    onSelect: (value: string) => void;
    onClear: () => void;
    isActive: boolean;
    containerRef?: React.RefObject<HTMLDivElement>;
}

export const ListFilter: React.FC<ListFilterProps> = ({
    columnKey,
    options,
    selectedValue,
    onSelect,
    onClear,
    isActive,
    containerRef,
}) => {
    if (!isActive) return null;

    return (
        <div
            ref={containerRef}
            className="absolute top-full left-0 mt-2 bg-white dark:bg-card border border-[#dfe1e6] dark:border-border shadow-xl rounded-lg py-1 min-w-[160px] z-[110]"
        >
            <div className="flex flex-col">
                {options.map((option) => (
                    <div
                        key={option.value}
                        className={`px-3 py-2 hover:bg-gray-50 dark:hover:bg-muted cursor-pointer text-[12px] dark:text-foreground flex items-center gap-2 ${option.className || ''
                            }`}
                        onClick={() => {
                            onSelect(option.value);
                        }}
                    >
                        {option.icon && <span className="w-3.5 h-3.5">{option.icon}</span>}
                        <span className={`font-medium ${selectedValue === option.value ? 'text-blue-600' : ''}`}>
                            {option.label}
                        </span>
                    </div>
                ))}
            </div>
            <button
                className="mt-1 px-3 py-1 text-[10px] text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 w-full text-left border-t border-gray-100 dark:border-border"
                onClick={onClear}
            >
                Clear Filter
            </button>
        </div>
    );
};

export interface DateFilterProps {
    columnKey: string;
    value: string;
    onChange: (value: string) => void;
    onClear: () => void;
    isActive: boolean;
    containerRef?: React.RefObject<HTMLDivElement>;
}

export const DateFilter: React.FC<DateFilterProps> = ({
    columnKey,
    value,
    onChange,
    onClear,
    isActive,
    containerRef,
}) => {
    if (!isActive) return null;

    return (
        <div
            ref={containerRef}
            className="absolute top-full left-0 mt-2 bg-white dark:bg-card border border-[#dfe1e6] dark:border-border shadow-xl rounded-lg py-1 min-w-[160px] z-[110]"
        >
            <div className="p-2">
                <input
                    type="date"
                    autoFocus
                    value={value}
                    className="w-full text-[12px] border-none p-0 outline-none cursor-pointer dark:text-foreground"
                    style={{ colorScheme: 'light dark' }}
                    onClick={(e) => {
                        e.stopPropagation();
                        e.currentTarget.showPicker?.();
                    }}
                    onChange={(e) => {
                        onChange(e.target.value);
                    }}
                />
            </div>

            {/* Clear Button */}
            <button
                className="mt-1 px-3 py-1 text-[10px] text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 w-full text-left border-t border-gray-100 dark:border-border"
                onClick={onClear}
            >
                Clear Filter
            </button>
        </div>
    );
};

export interface FilterHeaderWrapperProps {
    children: React.ReactNode;
    columnLabel: React.ReactNode;
    filterType: 'search' | 'list' | 'date' | 'none';
    isActive: boolean;
    filterContent?: React.ReactNode;
}

export const FilterHeaderWrapper: React.FC<FilterHeaderWrapperProps> = ({
    children,
    columnLabel,
    filterType,
    isActive,
    filterContent,
}) => {
    return (
        <div className="relative w-full flex flex-col min-h-[40px] justify-end pb-1">
            {filterType === 'search' && isActive && (
                <div className="mb-1 w-full">
                    {children}
                </div>
            )}
            <span className="truncate text-[14px] font-bold tracking-wide text-gray-700 dark:text-foreground">
                {columnLabel}
            </span>
            {(filterType === 'list' || filterType === 'date') && isActive && filterContent}
        </div>
    );
};


export interface ActiveFilterBadgeProps {
    count: number;
    onClearAll: () => void;
}

export const ActiveFilterBadge: React.FC<ActiveFilterBadgeProps> = ({ count, onClearAll }) => {
    if (count === 0) return null;

    return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-md text-[12px]">
            <span className="text-blue-700 font-medium">
                {count} {count === 1 ? 'filter' : 'filters'} active
            </span>
            <button
                onClick={onClearAll}
                className="text-blue-600 hover:text-blue-800 underline font-medium"
            >
                Clear all
            </button>
        </div>
    );
};

export const countActiveFilters = (filters: ColumnFilters): number => {
    return Object.values(filters).filter((value) => value !== '').length;
};