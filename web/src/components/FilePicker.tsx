import { Camera, FilePlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ACCEPT } from '@/lib/receiptRules';

const buttonClass =
  'inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100 has-disabled:cursor-not-allowed has-disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800';

/**
 * "Take photo" and "Choose files". `capture` opens the camera directly on phones, which then can't pick a PDF,
 * hence two inputs. Each pick is handed over and the inputs reset, so the same file can be picked again.
 */
export function FilePicker({
  onFiles,
  chooseId,
  disabled,
}: {
  onFiles: (files: File[]) => void;
  chooseId?: string;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])];
    e.target.value = '';
    if (files.length > 0) onFiles(files);
  };

  return (
    <div className="flex flex-wrap gap-2">
      <label className={buttonClass}>
        <Camera className="size-4" aria-hidden />
        {t('files.takePhoto')}
        <input
          type="file"
          className="sr-only"
          accept="image/*"
          capture="environment"
          disabled={disabled}
          onChange={onChange}
        />
      </label>
      <label className={buttonClass}>
        <FilePlus className="size-4" aria-hidden />
        {t('files.chooseFiles')}
        <input
          id={chooseId}
          type="file"
          className="sr-only"
          accept={ACCEPT}
          multiple
          disabled={disabled}
          onChange={onChange}
        />
      </label>
    </div>
  );
}
