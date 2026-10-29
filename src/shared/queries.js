import { fail } from './errors.js';

/** Equality filter with the given query parameters that have a value. */
export function pick(query, keys) {
  return Object.fromEntries(keys.filter(key => query[key]).map(key => [key, query[key]]));
}

export async function findById(repository, id) {
  const result = await repository.findOne({ id });
  if (!result) fail(404, 'NOT_FOUND', 'No se encontró el recurso solicitado.');
  return result;
}

export function page(items, number, size, total) {
  return { items, page: { page: number, size, totalElements: total, totalPages: Math.ceil(total / size) } };
}

/** Paginated, sorted read driven by the `page`, `size` and `sort` query parameters. */
export async function listPage(repository, filter, query, defaultSort) {
  const pageNumber = Number(query.page ?? 0);
  const size = Number(query.size ?? 20);
  const [field, direction] = (query.sort ?? defaultSort).split(',');
  const [items, total] = await Promise.all([
    repository.find(filter, { sort: { [field]: direction === 'desc' ? -1 : 1 }, skip: pageNumber * size, limit: size }),
    repository.count(filter)
  ]);
  return page(items, pageNumber, size, total);
}
