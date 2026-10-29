import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import * as OpenApiValidator from 'express-openapi-validator';

const contract = YAML.parse(readFileSync(fileURLToPath(new URL('../../../openapi-rma.yaml', import.meta.url)), 'utf8'));
contract.servers = [{ url: '/' }];

/** Rejects requests that do not match the OpenAPI contract. Responses are not validated. */
export function validateContract() {
  return OpenApiValidator.middleware({ apiSpec: contract, validateRequests: true, validateResponses: false, validateSecurity: false });
}
