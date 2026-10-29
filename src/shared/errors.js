/** Business error rendered as `application/problem+json` by the error handler. */
export class Problem extends Error {
  constructor(status, code, detail) {
    super(detail);
    this.status = status;
    this.code = code;
  }
}

export function fail(status, code, detail) {
  throw new Problem(status, code, detail);
}
