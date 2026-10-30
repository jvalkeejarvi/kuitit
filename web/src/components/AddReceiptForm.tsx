import { useForm } from '@tanstack/react-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { createReceiptMutation, listReceiptsQueryKey } from '@/api/client/@tanstack/react-query.gen';
import { addMonths, formatDate, today } from '@/lib/dates';
import {
  isAcceptedFile,
  MAX_DESCRIPTION_LENGTH,
  MAX_FILE_BYTES,
  MAX_FILE_MB,
  MAX_NAME_LENGTH,
  MAX_STORE_LENGTH,
  MAX_WARRANTY_MONTHS,
  MIN_WARRANTY_MONTHS,
} from '@/lib/receiptRules';

type Unit = 'months' | 'years';

const inputClass =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950';

export function AddReceiptForm({ onDone }: { onDone: () => void }) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const create = useMutation({
    ...createReceiptMutation(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: listReceiptsQueryKey() }),
  });

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
      warrantyAmount: z.number(),
      warrantyUnit: z.enum(['months', 'years']),
      file: z
        .instanceof(File, { message: t('form.errors.fileRequired') })
        .nullable()
        .refine(f => f !== null, t('form.errors.fileRequired'))
        .refine(f => !f || f.size <= MAX_FILE_BYTES, t('form.errors.fileTooLarge', { mb: MAX_FILE_MB }))
        .refine(f => !f || isAcceptedFile(f), t('form.errors.fileType')),
    })
    .refine(
      v => {
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
      name: '',
      store: '',
      description: '',
      purchasedOn: today(),
      warrantyAmount: 2,
      warrantyUnit: 'years' as Unit,
      file: null as File | null,
    },
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      await create.mutateAsync({
        body: {
          name: value.name.trim(),
          store: value.store.trim() || undefined,
          description: value.description.trim() || undefined,
          purchasedOn: value.purchasedOn,
          warrantyMonths: toMonths(value.warrantyAmount, value.warrantyUnit),
          file: value.file!,
        },
      });
      onDone();
    },
  });

  return (
    <form
      aria-label={t('form.title')}
      className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
      onSubmit={e => {
        e.preventDefault();
        void form.handleSubmit();
      }}
      noValidate
    >
      <h2 className="text-lg font-semibold">{t('form.title')}</h2>

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

        <form.Field name="warrantyAmount">
          {field => (
            <Field label={t('form.warranty')} id={field.name} errors={field.state.meta.errors}>
              <div className="flex gap-2">
                <input
                  id={field.name}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  className={inputClass}
                  value={Number.isNaN(field.state.value) ? '' : field.state.value}
                  onBlur={field.handleBlur}
                  onChange={e => field.handleChange(e.target.valueAsNumber)}
                />
                <form.Field name="warrantyUnit">
                  {unit => (
                    <select
                      aria-label={t('form.unit')}
                      className={inputClass}
                      value={unit.state.value}
                      onChange={e => unit.handleChange(e.target.value as Unit)}
                    >
                      <option value="months">{t('form.months')}</option>
                      <option value="years">{t('form.years')}</option>
                    </select>
                  )}
                </form.Field>
              </div>
            </Field>
          )}
        </form.Field>
      </div>

      <form.Subscribe selector={s => s.values}>
        {v => {
          const months = toMonths(v.warrantyAmount, v.warrantyUnit);
          if (!v.purchasedOn || !Number.isInteger(months) || months < MIN_WARRANTY_MONTHS) return null;
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

      <form.Field name="file">
        {field => (
          <Field label={t('form.file')} id="file-choose" errors={field.state.meta.errors}>
            <div className="flex flex-wrap items-center gap-2">
              {/* `capture` opens the camera directly on phones, which can't then pick a PDF, hence two inputs. */}
              <FileButton
                label={t('form.takePhoto')}
                accept="image/*"
                capture="environment"
                onFile={f => field.handleChange(f)}
              />
              <FileButton
                id="file-choose"
                label={t('form.chooseFile')}
                accept="image/*,application/pdf,.heic,.heif"
                onFile={f => field.handleChange(f)}
              />
              {field.state.value && <span className="truncate text-sm">{field.state.value.name}</span>}
            </div>
            <p className="mt-1 text-xs text-slate-500">{t('form.fileHint', { mb: MAX_FILE_MB })}</p>
          </Field>
        )}
      </form.Field>

      {create.isError && <p className="text-sm text-red-600 dark:text-red-400">{t('form.errors.server')}</p>}

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

function FileButton({
  id,
  label,
  accept,
  capture,
  onFile,
}: {
  id?: string;
  label: string;
  accept: string;
  capture?: 'environment';
  onFile: (file: File | null) => void;
}) {
  return (
    <label className="cursor-pointer rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
      {label}
      <input
        id={id}
        type="file"
        className="sr-only"
        accept={accept}
        capture={capture}
        onChange={e => onFile(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}
