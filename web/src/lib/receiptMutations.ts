import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  archiveReceiptMutation,
  deleteReceiptMutation,
  getReceiptQueryKey,
  listReceiptsQueryKey,
  unarchiveReceiptMutation,
} from '@/api/client/@tanstack/react-query.gen';
import type { ReceiptDto } from '@/api/client/types.gen';

/** Archive and restore update the cached receipt and refresh both lists. */
export function useArchiveMutations() {
  const queryClient = useQueryClient();
  const onSuccess = async (receipt: ReceiptDto) => {
    queryClient.setQueryData(getReceiptQueryKey({ path: { id: receipt.id } }), receipt);
    await queryClient.invalidateQueries({ queryKey: listReceiptsQueryKey() });
  };
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
