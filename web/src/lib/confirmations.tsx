import type { TFunction } from 'i18next';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import type { OpenDialog } from '@/lib/useDialog';

export function confirmArchive(openDialog: OpenDialog, name: string, t: TFunction): Promise<boolean> {
  return openDialog<boolean>(close => (
    <ConfirmDialog
      title={t('confirm.archiveTitle')}
      description={t('confirm.archiveBody', { name })}
      confirmLabel={t('receipts.archive')}
      onClose={close}
    />
  ));
}

export function confirmDelete(openDialog: OpenDialog, name: string, t: TFunction): Promise<boolean> {
  return openDialog<boolean>(close => (
    <ConfirmDialog
      variant="delete"
      title={t('confirm.deleteTitle')}
      description={t('confirm.deleteBody', { name })}
      confirmLabel={t('receipts.delete')}
      onClose={close}
    />
  ));
}

export function confirmDeleteFile(openDialog: OpenDialog, fileName: string, t: TFunction): Promise<boolean> {
  return openDialog<boolean>(close => (
    <ConfirmDialog
      variant="delete"
      title={t('files.deleteTitle')}
      description={t('files.deleteBody', { name: fileName })}
      confirmLabel={t('receipts.delete')}
      onClose={close}
    />
  ));
}

export function confirmDeletePermanently(openDialog: OpenDialog, name: string, t: TFunction): Promise<boolean> {
  return openDialog<boolean>(close => (
    <ConfirmDialog
      variant="delete"
      title={t('trash.confirmTitle')}
      description={t('trash.confirmBody', { name })}
      confirmLabel={t('trash.deletePermanently')}
      onClose={close}
    />
  ));
}
