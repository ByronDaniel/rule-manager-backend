import Decimal from 'decimal.js';
import { fail } from '../../shared/errors.js';

const DECIMAL = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function matchesType(dataType, value) {
  switch (dataType) {
    case 'MONEY':
    case 'PERCENTAGE':
      return (typeof value === 'number' && Number.isFinite(value)) || (typeof value === 'string' && DECIMAL.test(value));
    case 'INTEGER':
      return Number.isSafeInteger(value);
    case 'BOOLEAN':
      return typeof value === 'boolean';
    case 'DATE':
      return typeof value === 'string' && ISO_DATE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);
    case 'STRING':
      return typeof value === 'string';
    case 'JSON':
      return value !== null && typeof value === 'object';
    default:
      return false;
  }
}

/** Checks a value against the parameter data type and its optional constraints. */
export function validateValue(dataType, value, constraints = {}) {
  if (!matchesType(dataType, value)) fail(422, 'INVALID_VALUE_TYPE', 'El valor no corresponde al tipo del parámetro.');
  const numeric = dataType === 'MONEY' || dataType === 'PERCENTAGE' || dataType === 'INTEGER';
  if (numeric && ((constraints.min !== undefined && new Decimal(value).lt(constraints.min)) || (constraints.max !== undefined && new Decimal(value).gt(constraints.max)))) {
    fail(422, 'VALUE_OUT_OF_RANGE', 'El valor no cumple los límites del parámetro.');
  }
  if (constraints.allowedValues && !constraints.allowedValues.includes(String(value))) fail(422, 'VALUE_NOT_ALLOWED', 'El valor no está permitido.');
  if (constraints.pattern && (typeof value !== 'string' || !new RegExp(constraints.pattern).test(value))) fail(422, 'VALUE_PATTERN_MISMATCH', 'El valor no cumple el formato requerido.');
}

export function validateConstraints(constraints = {}) {
  if (constraints.min !== undefined && constraints.max !== undefined && constraints.min > constraints.max) fail(422, 'INVALID_CONSTRAINTS', 'El mínimo no puede superar el máximo.');
  if (constraints.pattern) {
    try { new RegExp(constraints.pattern); } catch { fail(422, 'INVALID_CONSTRAINTS', 'La expresión regular no es válida.'); }
  }
}
