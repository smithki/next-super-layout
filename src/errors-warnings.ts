interface MessageOptions {
  context?: string;
  location?: string;
  layout?: string;
  message: string;
}

function createMessage(options: MessageOptions) {
  const labels = [options.context, options.location, options.layout].filter(Boolean).join(' ➜ ');
  const prefixedLabel = labels ? `next-super-layout: ${labels}` : 'next-super-layout';
  return `[${prefixedLabel}] ${options.message}`;
}

// -------------------------------------------------------------------------- //

export type LayoutErrorCode = `next-super-layout/error/${string}`;

export interface LayoutError extends Error {
  code: LayoutErrorCode;
}

export function createError(code: string, options: MessageOptions) {
  const err = new Error(createMessage(options));
  (err as LayoutError).code = `next-super-layout/error/${code}`;
  return err as LayoutError;
}

// -------------------------------------------------------------------------- //

export type LayoutWarningCode = `next-super-layout/warning/${string}`;

export interface LayoutWarning {
  code: LayoutWarningCode;
  message: string;
  log: () => void;
  logOnce: () => void;
}

export function createWarning(code: string, options: MessageOptions): LayoutWarning {
  const message = createMessage(options);

  return {
    message,
    log: () => console.warn(message),
    logOnce: () => warnOnce(message),
    code: `next-super-layout/warning/${code}`,
  };
}

const warnOnce = /* @__PURE__ */ Object.assign(
  (message: string) => {
    if (warnOnce.memory.has(message)) return;
    console.warn(message);
    warnOnce.memory.add(message);
  },

  { memory: new Set<string>() },
);
