import { createFileRoute, useCanGoBack, useRouter } from '@tanstack/react-router';
import { ReceiptForm } from '@/components/ReceiptForm';

export const Route = createFileRoute('/receipts/new')({
  component: NewReceiptPage,
});

function NewReceiptPage() {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const navigate = Route.useNavigate();
  return (
    <ReceiptForm
      // Back to wherever + was clicked; the list when opened directly (a bookmark or the installed app).
      onDone={() => (canGoBack ? router.history.back() : void navigate({ to: '/' }))}
      // Open the new receipt, to check it and add more files. Replaces this page, so back skips the form.
      onSaved={receipt => void navigate({ to: '/receipts/$id', params: { id: receipt.id }, replace: true })}
    />
  );
}
