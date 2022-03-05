interface ErrorMessageOptions {
  errorContext: string;
  location?: string;
  layoutName?: string;
  message: string;
}

export type LayoutErrorCode = `next-super-layout/${string}`;

export interface LayoutError extends Error {
  code: LayoutErrorCode;
}

function createErrorMessage(options: ErrorMessageOptions) {
  const locationLabel = options.location ? ` -> ${options.location}` : '';
  const layoutNameLabel = options.location ? ` -> ${options.layoutName}` : '';
  return `[next-super-layout: ${options.errorContext}${locationLabel}${layoutNameLabel}] ${options.message}`;
}

export function createError(code: string, options: ErrorMessageOptions) {
  const err = new Error(createErrorMessage(options));
  (err as LayoutError).code = `next-super-layout/${code}`;
  return err as LayoutError;
}
