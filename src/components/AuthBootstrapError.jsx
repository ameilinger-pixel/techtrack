import { Button } from '@/components/ui/button';

export default function AuthBootstrapError({ message, onRetry }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm space-y-4 text-center">
        <h1 className="text-lg font-semibold text-foreground">Could not load your session</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
          <Button type="button" onClick={onRetry}>
            Try again
          </Button>
          <Button type="button" variant="outline" onClick={() => { window.location.assign('/login'); }}>
            Go to sign in
          </Button>
          <Button type="button" variant="ghost" onClick={() => window.location.reload()}>
            Hard refresh
          </Button>
        </div>
      </div>
    </div>
  );
}
