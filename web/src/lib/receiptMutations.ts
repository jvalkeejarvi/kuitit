import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  addReceiptFilesMutation,
  archiveReceiptMutation,
  deleteReceiptFileMutation,
  deleteReceiptMutation,
  getReceiptQueryKey,
  listReceiptsQueryKey,
  unarchiveReceiptMutation,
  updateReceiptMutation,
} from '@/api/client/@tanstack/react-query.gen';
import type { ReceiptDto } from '@/api/client/types.gen';

/** Mutations that return the updated receipt: cache it and refresh both lists. */
function useReceiptUpdated() {
  const queryClient = useQueryClient();
  return async (receipt: ReceiptDto) => {
    queryClient.setQueryData(getReceiptQueryKey({ path: { id: receipt.id } }), receipt);
    await queryClient.invalidateQueries({ queryKey: listReceiptsQueryKey() });
  };
}

export function useArchiveMutations() {
  const onSuccess = useReceiptUpdated();
  return {
    archive: useMutation({ ...archiveReceiptMutation(), onSuccess }),
    unarchive: useMutation({ ...unarchiveReceiptMutation(), onSuccess }),
  };
}

export function useDeleteMutation(onDeleted: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    ...deleteReceiptMutation(),
    onSuccess: async (_, { path }) => {
      onDeleted();
      queryClient.removeQueries({ queryKey: getReceiptQueryKey({ path }) });
      await queryClient.invalidateQueries({ queryKey: listReceiptsQueryKey() });
    },
  });
}

export function useFileMutations() {
  const onSuccess = useReceiptUpdated();
  return {
    add: useMutation({ ...addReceiptFilesMutation(), onSuccess }),
    remove: useMutation({ ...deleteReceiptFileMutation(), onSuccess }),
  };
}

export function useUpdateMutation() {
  return useMutation({ ...updateReceiptMutation(), onSuccess: useReceiptUpdated() });
}
