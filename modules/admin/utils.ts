import { FastifyRequest } from "fastify";

export function parseDateRange(request: FastifyRequest) {
  const { from, to, range } = request.query as {
    from?: string;
    to?: string;
    range?: string;
  };

  if (range) {
    const days = parseInt(range.replace("d", ""));
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(toDate.getDate() - days);
    return { from: fromDate, to: toDate };
  }

  return {
    from: from ? new Date(from) : null,
    to: to ? new Date(to) : null,
  };
}

export function parsePagination(request: FastifyRequest) {
  const { page = "1", limit = "20" } = request.query as any;

  const p = Math.max(parseInt(page), 1);
  const l = Math.min(parseInt(limit), 100);

  return {
    offset: (p - 1) * l,
    limit: l,
  };
}