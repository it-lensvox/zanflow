import { Button } from '@/components/common';
import type { SignupProduct, SignupProductKey } from '@/types';

const PRODUCTS: SignupProduct[] = [
  { key: 'pm',   name: 'Project Management', description: 'Tasks, sprints, milestones, and team collaboration', icon: '📋', locked: true },
  { key: 'hrms', name: 'HRMS',               description: 'Employees, payroll, leave, and attendance',          icon: '👥', locked: false },
  { key: 'crm',  name: 'CRM',                description: 'Leads, deals, customers, and support tickets',       icon: '🤝', locked: false },
  { key: 'ims',  name: 'IMS',                description: 'Inventory, warehouses, orders, and dispatch',        icon: '📦', locked: false },
];

interface Props {
  selectedProducts: SignupProductKey[];
  isSubmitting: boolean;
  onToggle: (key: SignupProductKey) => void;
  onGetStarted: () => void;
  onSkip: () => void;
  onBack: () => void;
}

export function SignupStepProducts({ selectedProducts, isSubmitting, onToggle, onGetStarted, onSkip, onBack }: Props) {
  return (
    <div className="space-y-4">
      <div className="text-center space-y-1 pb-2">
        <h2 className="text-lg font-semibold">Which Dyuksa products do you want?</h2>
        <p className="text-sm text-muted-foreground">PM is included. Select any others you need.</p>
      </div>

      <div className="space-y-3">
        {PRODUCTS.map(product => {
          const isSelected = selectedProducts.includes(product.key);
          return (
            <button
              key={product.key}
              type="button"
              onClick={() => onToggle(product.key)}
              disabled={product.locked}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all
                ${isSelected
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-card hover:border-primary/40'
                }
                ${product.locked ? 'cursor-default' : 'cursor-pointer'}
              `}
            >
              <span className="text-2xl flex-shrink-0">{product.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{product.name}</span>
                  {product.locked && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded font-medium">
                      Included
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{product.description}</p>
              </div>
              <div className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors
                ${isSelected ? 'bg-primary border-primary' : 'border-border'}
              `}>
                {isSelected && (
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <Button className="w-full" onClick={onGetStarted} disabled={isSubmitting}>
        {isSubmitting ? 'Setting up your account…' : 'Get Started'}
      </Button>

      <button type="button" onClick={onSkip} disabled={isSubmitting}
        className="w-full text-center text-sm text-muted-foreground hover:underline disabled:opacity-50">
        Skip for now — PM only
      </button>

      <button type="button" onClick={onBack}
        className="w-full text-center text-sm text-muted-foreground hover:underline">
        ← Back
      </button>
    </div>
  );
}