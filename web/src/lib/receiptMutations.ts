import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  addReceiptFilesMutation,
  archiveReceiptMutation,
  deleteReceiptFileMutation,
  deleteReceiptMutation,
  deleteReceiptPermanentlyMutation,
  getReceiptQueryKey,
  listReceiptsQueryKey,
  listTrashQueryKey,
  restoreReceiptMutation,
  unarchiveReceiptMutation,
  updateReceiptMutation,
} from '@/api/client/@tanstack/react-query.gen';
import { restoreReceipt, restoreReceiptFile, unarchiveReceipt } from '@/api/client/sdk.gen';
import type { ReceiptDto } from '@/api/client/types.gen';
import { useToast } from '@/lib/toast';

/** Caches the returned receipt and refreshes the lists (active, archived and trash). */
async function receiptChanged(queryClient: QueryClient, receipt: ReceiptDto) {
  queryClient.setQueryData(getReceiptQueryKey({ path: { id: receipt.id } }), receipt);
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: listReceiptsQueryKey() }),
    queryClient.invalidateQueries({ queryKey: listTrashQueryKey() }),
  ]);
}

function useReceiptChanged() {
  const queryClient = useQueryClient();
  return (receipt: ReceiptDto) => receiptChanged(queryClient, receipt);
}

/**
 * Undo runs from the toast, possibly after the page that started it is gone (deleting navigates away), so it
 * calls the API directly instead of through a mounted mutation hook.
 */
function useUndo() {
  const queryClient = useQueryClient();
  return async (call: () => Promise<{ data: ReceiptDto }>) => receiptChanged(queryClient, (await call()).data);
}

export function useArchiveMutations() {
  const { t } = useTranslation();
  const onChanged = useReceiptChanged();
  const toast = useToast();
  const undo = useUndo();
  return {
    archive: useMutation({
      ...archiveReceiptMutation(),
      onSuccess: async (receipt, { path }) => {
        toast({
          message: t('toast.archived', { name: receipt.name }),
          action: { label: t('toast.undo'), run: () => undo(() => unarchiveReceipt({ path, throwOnError: true })) },
        });
        await onChanged(receipt);
      },
    }),
    unarchive: useMutation({ ...unarchiveReceiptMutation(), onSuccess: onChanged }),
  };
}

/** Moves a receipt to the trash (with Undo); `onDeleted` typically navigates away from it. */
export function useDeleteMutation(onDeleted: () => void) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const toast = useToast();
  const undo = useUndo();
  return useMutation({
    ...deleteReceiptMutation(),
    onSuccess: async (_, { path }) => {
      onDeleted();
      toast({
        message: t('toast.deleted'),
        action: { label: t('toast.undo'), run: () => undo(() => restoreReceipt({ path, throwOnError: true })) },
      });
      queryClient.removeQueries({ queryKey: getReceiptQueryKey({ path }) });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: listReceiptsQueryKey() }),
        queryClient.invalidateQueries({ queryKey: listTrashQueryKey() }),
      ]);
    },
  });
}

export function useTrashMutations() {
  const queryClient = useQueryClient();
  const onChanged = useReceiptChanged();
  return {
    restore: useMutation({ ...restoreReceiptMutation(), onSuccess: onChanged }),
    deletePermanently: useMutation({
      ...deleteReceiptPermanentlyMutation(),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: listTrashQueryKey() }),
    }),
  };
}

export function useFileMutations() {
  const { t } = useTranslation();
  const onChanged = useReceiptChanged();
  const toast = useToast();
  const undo = useUndo();
  return {
    add: useMutation({ ...addReceiptFilesMutation(), onSuccess: onChanged }),
    remove: useMutation({
      ...deleteReceiptFileMutation(),
      onSuccess: async (receipt, { path }) => {
        toast({
          message: t('toast.fileRemoved'),
          action: { label: t('toast.undo'), run: () => undo(() => restoreReceiptFile({ path, throwOnError: true })) },
        });
        await onChanged(receipt);
      },
    }),
  };
}

export function useUpdateMutation() {
  return useMutation({ ...updateReceiptMutation(), onSuccess: useReceiptChanged() });
}
