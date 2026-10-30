import { FileText, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ReceiptDto } from '@/api/client/types.gen';
import { receiptFileUrl } from '@/api/setup';
import { FilePicker } from '@/components/FilePicker';
import { confirmDeleteFile } from '@/lib/confirmations';
import { fileProblemMessage, formatFileSize, previewTypes } from '@/lib/files';
import { useFileMutations } from '@/lib/receiptMutations';
import { fileProblems, MAX_FILES } from '@/lib/receiptRules';
import { useDialog } from '@/lib/useDialog';

/** The receipt's files: previews or icons that open the file, plus adding and removing. */
/** `readOnly` (a trashed receipt): files can be opened but not added or removed. */
export function ReceiptFiles({ receipt, readOnly = false }: { receipt: ReceiptDto; readOnly?: boolean }) {
  const { t, i18n } = useTranslation();
  const { add, remove } = useFileMutations();
  const [dialogNode, openDialog] = useDialog();
  const [problems, setProblems] = useState<string[]>([]);
  const path = { id: receipt.id };
  const onlyOne = receipt.files.length === 1;

  const onAdd = (files: File[]) => {
    const found = fileProblems(files, receipt.files.length).map(p => fileProblemMessage(p, t));
    setProblems(found);
    if (found.length === 0) add.mutate({ path, body: { files } });
  };

  const onRemove = async (fileId: string, fileName: string) => {
    if (await confirmDeleteFile(openDialog, fileName, t)) remove.mutate({ path: { ...path, fileId } });
  };

  return (
    <section aria-labelledby="files-heading" className="space-y-3">
      {dialogNode}
      <h2 id="files-heading" className="text-sm text-slate-500 dark:text-slate-400">
        {t('files.heading', { count: receipt.files.length })}
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {receipt.files.map(file => {
          const url = receiptFileUrl(receipt.id, file.id);
          return (
            <li
              key={file.id}
              className="flex flex-col overflow-hidden rounded-md border border-slate-200 dark:border-slate-800"
            >
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                aria-label={t('files.open', { name: file.fileName })}
                className="flex h-32 items-center justify-center bg-slate-100 dark:bg-slate-950"
              >
                {previewTypes.has(file.contentType) ? (
                  <img src={url} alt="" loading="lazy" className="size-full object-cover" />
                ) : (
                  <FileText className="size-10 text-slate-400" aria-hidden />
                )}
              </a>
              <div className="flex items-start gap-1 p-2 text-xs">
                <div className="min-w-0 flex-1">
                  <p className="truncate" title={file.fileName}>
                    {file.fileName}
                  </p>
                  <p className="text-slate-500">{formatFileSize(file.sizeBytes, i18n.language)}</p>
                </div>
                {!readOnly && (
                  <button
                    type="button"
                    aria-label={t('files.delete', { name: file.fileName })}
                    title={onlyOne ? t('files.lastFile') : t('receipts.delete')}
                    disabled={onlyOne || remove.isPending}
                    onClick={() => void onRemove(file.id, file.fileName)}
                    className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-red-600 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-500 dark:hover:bg-slate-800"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {!readOnly && <FilePicker disabled={receipt.files.length >= MAX_FILES || add.isPending} onFiles={onAdd} />}
      {add.isPending && <p className="text-sm text-slate-500">{t('files.uploading')}</p>}
      {[...problems, ...(add.isError || remove.isError ? [t('files.errors.server')] : [])].map(message => (
        <p key={message} role="alert" className="text-sm text-red-600 dark:text-red-400">
          {message}
        </p>
      ))}
    </section>
  );
}
