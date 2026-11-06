import { useState } from 'react';
import { useLocation } from 'wouter';
import { Database, Eraser } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { store } from '@/lib/portfolio';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export function DataControls({ dark }: { dark?: boolean }) {
  const [mode, setMode] = useState<null | 'demo' | 'empty'>(null);
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const btn = cn(
    'flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-all active:scale-[.98]',
    dark ? 'border-sidebar-border text-sidebar-foreground/80 hover:border-sidebar-primary/60 hover:text-sidebar-foreground' : 'border-border hover:bg-secondary',
  );
  return (
    <>
      <div className="space-y-2">
        <button className={btn} onClick={() => setMode('demo')} data-testid="button-load-demo">
          <Database className="h-4 w-4" /> Load demo portfolio
        </button>
        <button className={btn} onClick={() => setMode('empty')} data-testid="button-reset-empty">
          <Eraser className="h-4 w-4" /> Reset to empty
        </button>
      </div>
      <AlertDialog open={mode !== null} onOpenChange={(o) => !o && setMode(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{mode === 'demo' ? 'Replace with the demo portfolio?' : 'Clear every holding?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {mode === 'demo'
                ? 'All current holdings in this browser will be replaced by 11 sample holdings with illustrative, non-live prices.'
                : 'All holdings stored in this browser will be removed. This cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-reset">Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-reset"
              className={mode === 'empty' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
              onClick={() => {
                if (mode === 'demo') {
                  store.loadDemo();
                  toast({ title: 'Demo portfolio loaded', description: 'Sample data with illustrative prices.' });
                  navigate('/');
                } else {
                  store.startEmpty();
                  toast({ title: 'Portfolio cleared', description: 'Start adding holdings or import a CSV.' });
                }
                setMode(null);
              }}
            >
              {mode === 'demo' ? 'Load demo' : 'Clear all'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
