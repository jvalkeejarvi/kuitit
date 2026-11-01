import { useForm } from '@tanstack/react-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { createReceiptMutation, listReceiptsQueryKey } from '@/api/client/@tanstack/react-query.gen';
import type { ReceiptDto } from '@/api/client/types.gen';
import { addMonths, formatDate, today } from '@/lib/dates';
import { X } from 'lucide-react';
import { FilePicker } from '@/components/FilePicker';
import { fileProblemMessage, formatFileSize } from '@/lib/files';
import { useUpdateMutation } from '@/lib/receiptMutations';
import {
  fileProblems,
  MAX_DESCRIPTION_LENGTH,
  MAX_FILE_MB,
  MAX_FILES,
  MAX_NAME_LENGTH,
  MAX_STORE_LENGTH,
  MAX_UPLOAD_MB,
  MAX_WARRANTY_MONTHS,
  MIN_WARRANTY_MONTHS,
} from '@/lib/receiptRules';

type Unit = 'months' | 'years';

const inputClass =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950';

/**
 * Creates a receipt, or edits the details of `receipt` (its files are managed on the detail page).
 * `onDone` runs on cancel, and after saving unless `onSaved` is given (which then gets the saved receipt).
 */
export function ReceiptForm({
  receipt,
  onDone,
  onSaved,
}: {
  receipt?: ReceiptDto;
  onDone: () => void;
  onSaved?: (receipt: ReceiptDto) => void;
}) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const create = useMutation({
    ...createReceiptMutation(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: listReceiptsQueryKey() }),
  });
  const update = useUpdateMutation();
  const editing = receipt !== undefined;
  const title = editing ? t('form.editTitle') : t('form.title');

  const schema = z
    .object({
      name: z
        .string()
        .trim()
        .min(1, t('form.errors.nameRequired'))
        .max(MAX_NAME_LENGTH, t('form.errors.nameTooLong', { max: MAX_NAME_LENGTH })),
      store: z
        .string()
        .trim()
        .max(MAX_STORE_LENGTH, t('form.errors.storeTooLong', { max: MAX_STORE_LENGTH })),
      description: z
        .string()
        .trim()
        .max(MAX_DESCRIPTION_LENGTH, t('form.errors.descriptionTooLong', { max: MAX_DESCRIPTION_LENGTH })),
      purchasedOn: z
        .string()
        .min(1, t('form.errors.purchasedOnRequired'))
        .refine(d => d <= today(), t('form.errors.purchasedOnFuture')),
      noWarranty: z.boolean(),
      // NaN while the box is empty; the range check below reports it unless there's no warranty.
      warrantyAmount: z.number().or(z.nan()),
      warrantyUnit: z.enum(['months', 'years']),
      files: z
        .array(z.instanceof(File))
        .min(editing ? 0 : 1, t('form.errors.fileRequired'))
        .superRefine((files, ctx) => {
          for (const problem of fileProblems(files)) {
            ctx.addIssue({ code: 'custom', message: fileProblemMessage(problem, t) });
          }
        }),
    })
    .refine(
      v => {
        if (v.noWarranty) return true;
        const months = toMonths(v.warrantyAmount, v.warrantyUnit);
        return Number.isInteger(months) && months >= MIN_WARRANTY_MONTHS && months <= MAX_WARRANTY_MONTHS;
      },
      {
        path: ['warrantyAmount'],
        message: t('form.errors.warrantyRange', { min: MIN_WARRANTY_MONTHS, max: MAX_WARRANTY_MONTHS }),
      },
    );

  const form = useForm({
    defaultValues: {
      name: receipt?.name ?? '',
      store: receipt?.store ?? '',
      description: receipt?.description ?? '',
      purchasedOn: receipt?.purchasedOn ?? today(),
      noWarranty: receipt !== undefined && receipt.warrantyMonths === null,
      ...fromMonths(receipt?.warrantyMonths ?? 24),
      files: [] as File[],
    },
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      const details = { name: value.name.trim(), purchasedOn: value.purchasedOn };
      const warrantyMonths = value.noWarranty ? null : toMonths(value.warrantyAmount, value.warrantyUnit);
      let saved: ReceiptDto;
      if (editing) {
        saved = await update.mutateAsync({
          path: { id: receipt.id },
          body: {
            ...details,
            warrantyMonths,
            store: value.store.trim() || null,
            description: value.description.trim() || null,
          },
        });
      } else {
        saved = await create.mutateAsync({
          body: {
            ...details,
            warrantyMonths: warrantyMonths ?? undefined,
            store: value.store.trim() || undefined,
            description: value.description.trim() || undefined,
            files: value.files,
          },
        });
      }
      if (onSaved) onSaved(saved);
      else onDone();
    },
  });

  return (
    <form
      aria-label={title}
      className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
      onSubmit={e => {
        e.preventDefault();
        void form.handleSubmit();
      }}
      noValidate
    >
      <h2 className="text-lg font-semibold">{title}</h2>

      <form.Field name="name">
        {field => (
          <Field label={t('form.name')} id={field.name} errors={field.state.meta.errors}>
            <input
              id={field.name}
              className={inputClass}
              placeholder={t('form.namePlaceholder')}
              maxLength={MAX_NAME_LENGTH}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={e => field.handleChange(e.target.value)}
            />
          </Field>
        )}
      </form.Field>

      <form.Field name="store">
        {field => (
          <Field label={t('form.store')} id={field.name} errors={field.state.meta.errors}>
            <input
              id={field.name}
              className={inputClass}
              placeholder={t('form.storePlaceholder')}
              maxLength={MAX_STORE_LENGTH}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={e => field.handleChange(e.target.value)}
            />
          </Field>
        )}
      </form.Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <form.Field name="purchasedOn">
          {field => (
            <Field label={t('form.purchasedOn')} id={field.name} errors={field.state.meta.errors}>
              <input
                id={field.name}
                type="date"
                className={inputClass}
                max={today()}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={e => field.handleChange(e.target.value)}
              />
            </Field>
          )}
        </form.Field>

        <form.Subscribe selector={s => s.values.noWarranty}>
          {noWarranty => (
            <form.Field name="warrantyAmount">
              {field => (
                <Field label={t('form.warranty')} id={field.name} errors={noWarranty ? [] : field.state.meta.errors}>
                  <div className="flex gap-2">
                    <input
                      id={field.name}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      disabled={noWarranty}
                      className={`${inputClass} disabled:opacity-50`}
                      value={Number.isNaN(field.state.value) ? '' : field.state.value}
                      onBlur={field.handleBlur}
                      onChange={e => field.handleChange(e.target.valueAsNumber)}
                    />
                    <form.Field name="warrantyUnit">
                      {unit => (
                        <select
                          aria-label={t('form.unit')}
                          disabled={noWarranty}
                          className={`${inputClass} disabled:opacity-50`}
                          value={unit.state.value}
                          onChange={e => unit.handleChange(e.target.value as Unit)}
                        >
                          <option value="months">{t('form.months')}</option>
                          <option value="years">{t('form.years')}</option>
                        </select>
                      )}
                    </form.Field>
                  </div>
                  <form.Field name="noWarranty">
                    {check => (
                      <label className="mt-2 flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="size-4 accent-brand"
                          checked={check.state.value}
                          onChange={e => check.handleChange(e.target.checked)}
                        />
                        {t('form.noWarranty')}
                      </label>
                    )}
                  </form.Field>
                </Field>
              )}
            </form.Field>
          )}
        </form.Subscribe>
      </div>

      <form.Subscribe selector={s => s.values}>
        {v => {
          const months = toMonths(v.warrantyAmount, v.warrantyUnit);
          if (v.noWarranty || !v.purchasedOn || !Number.isInteger(months) || months < MIN_WARRANTY_MONTHS) return null;
          const date = formatDate(addMonths(v.purchasedOn, months), i18n.language);
          return <p className="text-sm text-slate-600 dark:text-slate-400">{t('form.expiresPreview', { date })}</p>;
        }}
      </form.Subscribe>

      <form.Field name="description">
        {field => (
          <Field label={t('form.description')} id={field.name} errors={field.state.meta.errors}>
            <textarea
              id={field.name}
              rows={3}
              className={inputClass}
              placeholder={t('form.descriptionPlaceholder')}
              maxLength={MAX_DESCRIPTION_LENGTH}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={e => field.handleChange(e.target.value)}
            />
          </Field>
        )}
      </form.Field>

      {!editing && (
        <form.Field name="files">
          {field => (
            <Field label={t('form.file')} id="file-choose" errors={field.state.meta.errors}>
              <FilePicker
                chooseId="file-choose"
                disabled={field.state.value.length >= MAX_FILES}
                onFiles={files => field.handleChange([...field.state.value, ...files])}
              />
              {field.state.value.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm">
                  {field.state.value.map((file, i) => (
                    <li key={`${file.name}-${i}`} className="flex items-center gap-2">
                      <span className="min-w-0 truncate">{file.name}</span>
                      <span className="shrink-0 text-slate-500">{formatFileSize(file.size, i18n.language)}</span>
                      <button
                        type="button"
                        aria-label={t('files.removeSelected', { name: file.name })}
                        onClick={() => field.handleChange(field.state.value.filter((_, j) => j !== i))}
                        className="ml-auto rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                      >
                        <X className="size-4" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-1 text-xs text-slate-500">
                {t('files.hint', { mb: MAX_FILE_MB, max: MAX_FILES, totalMb: MAX_UPLOAD_MB })}
              </p>
            </Field>
          )}
        </form.Field>
      )}

      {(create.isError || update.isError) && (
        <p className="text-sm text-red-600 dark:text-red-400">{t('form.errors.server')}</p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="rounded-md px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          {t('form.cancel')}
        </button>
        <form.Subscribe selector={s => s.isSubmitting}>
          {submitting => (
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark disabled:opacity-60"
            >
              {submitting ? t('form.saving') : t('form.save')}
            </button>
          )}
        </form.Subscribe>
      </div>
    </form>
  );
}

function toMonths(amount: number, unit: Unit): number {
  return unit === 'years' ? amount * 12 : amount;
}

/** Whole years show as years, anything else as months. */
function fromMonths(months: number): { warrantyAmount: number; warrantyUnit: Unit } {
  return months % 12 === 0
    ? { warrantyAmount: months / 12, warrantyUnit: 'years' }
    : { warrantyAmount: months, warrantyUnit: 'months' };
}

function Field({
  label,
  id,
  errors,
  children,
}: {
  label: string;
  id: string;
  errors: unknown[];
  children: React.ReactNode;
}) {
  const messages = errors.map(e => (typeof e === 'string' ? e : (e as { message?: string })?.message)).filter(Boolean);
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      {children}
      {messages.length > 0 && (
        <p role="alert" className="mt-1 text-sm text-red-600 dark:text-red-400">
          {messages[0]}
        </p>
      )}
    </div>
  );
}
