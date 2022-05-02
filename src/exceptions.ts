interface ErrorMessageOptions {
  errorContext?: string;
  location?: string;
  layoutName?: string;
  message: string;
}

export type LayoutErrorCode = `next-super-layout/${string}`;

export interface LayoutError extends Error {
  code: LayoutErrorCode;
}

function createErrorMessage(options: ErrorMessageOptions) {
  const labels = [options.errorContext, options.location, options.layoutName].filter(Boolean).join(' -> ');
  const prefixedLabel = labels ? `next-super-layout: ${labels}` : 'next-super-layout';
  return `[${prefixedLabel}] ${options.message}`;
}

export function createError(code: string, options: ErrorMessageOptions) {
  const err = new Error(createErrorMessage(options));
  (err as LayoutError).code = `next-super-layout/${code}`;
  return err as LayoutError;
}
