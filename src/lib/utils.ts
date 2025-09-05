import { PAD_LEN } from '../defaults';

export const paddedInt = (i: number) => `${i}`.padStart(PAD_LEN, '0');

export const pause = (timeout: number) => new Promise((resolve) => {
  setTimeout(resolve, timeout, undefined);
});

export const sanitizeVersion = (version?: number | string, defaultVersion?: 0 | 1 | boolean) => {
  let sanitized = version;
  if (defaultVersion && !sanitized) {
    sanitized = sanitized || 1;
  }

  if (typeof sanitized == 'number') {
    sanitized = paddedInt(sanitized);
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-template-expression
  sanitized = (sanitized === undefined) ? sanitized : `${sanitized}`;
  return sanitized;
};

export interface SortableSecret {
  name: string;
  version: string;
}

export const sortSecrets = (a: SortableSecret, b: SortableSecret) => {
  const nameDiff = a.name.localeCompare(b.name);
  return nameDiff || b.version.localeCompare(a.version);
};
