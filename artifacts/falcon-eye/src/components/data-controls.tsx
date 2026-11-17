import { useState } from 'react';
import { useLocation } from 'wouter';
import { Database, Eraser } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { store } from '@/lib/portfolio';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

export function DataControls({ dark }: { dark?: boolean }) {
  const [mode, setMode] = useState<null | 'demo' | 'empty'>(null);
  const { t } = useTranslation('legacy');
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
          <Database className="h-4 w-4" /> {t('dataControls.loadDemo')}
        </button>
        <button className={btn} onClick={() => setMode('empty')} data-testid="button-reset-empty">
          <Eraser className="h-4 w-4" /> {t('dataControls.resetEmpty')}
        </button>
      </div>
      <AlertDialog open={mode !== null} onOpenChange={(o) => !o && setMode(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{mode === 'demo' ? t('dataControls.confirmDemo') : t('dataControls.confirmEmpty')}</AlertDialogTitle>
            <AlertDialogDescription>
              {mode === 'demo'
                ? t('dataControls.descriptionDemo')
                : t('dataControls.descriptionEmpty')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-reset">{t('dataControls.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-reset"
              className={mode === 'empty' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
              onClick={() => {
                if (mode === 'demo') {
                  store.loadDemo();
                  toast({ title: t('onboarding.toast.demoTitle'), description: t('onboarding.toast.demoDescription') });
                  navigate('/');
                } else {
                  store.startEmpty();
                  toast({ title: t('dataControls.clearedTitle'), description: t('dataControls.clearedDescription') });
                }
                setMode(null);
              }}
            >
              {mode === 'demo' ? t('dataControls.loadConfirm') : t('dataControls.clearConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
