import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

/** Validates and replaces req.body with the parsed value. */
export const validateBody =
  (schema: ZodType): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) return next(result.error);
    req.body = result.data;
    next();
  };
