import { useCallback, useState, type ReactNode } from 'react';

/** Closes the dialog and resolves the caller's `openDialog` promise with `result`. */
type CloseDialog<Result> = (result: Result) => void;

/** Builds the dialog UI; gets the close function to call with the result. */
type DialogFactory<Result> = (close: CloseDialog<Result>) => ReactNode;

export type OpenDialog = <Result>(dialogFactory: DialogFactory<Result>) => Promise<Result>;

/**
 * Promise-based dialogs: `const ok = await openDialog(close => <ConfirmDialog onClose={close} ... />)`.
 * Render `dialogNode` somewhere in the calling component.
 */
export function useDialog() {
  const [dialogNode, setDialogNode] = useState<ReactNode>(null);

  // Memoised because callers put this in their own dependency arrays.
  const openDialog = useCallback<OpenDialog>(
    dialogFactory =>
      new Promise(resolve => {
        setDialogNode(
          dialogFactory(result => {
            setDialogNode(null);
            resolve(result);
          }),
        );
      }),
    [],
  );

  return [dialogNode, openDialog] as const;
}
