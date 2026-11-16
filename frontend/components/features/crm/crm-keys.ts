export type QueryParams = Record<string, string | number | undefined>;

export const crmKeys = {
  contacts: {
    all: ["contacts"] as const,
    list: (params: QueryParams) => ["contacts", "list", params] as const,
    detail: (id: string) => ["contacts", "detail", id] as const,
    activities: (id: string, page: number, size: number) => ["contacts", "activities", id, page, size] as const
  },
  tags: ["tags"] as const,
  segments: {
    all: ["segments"] as const,
    list: (params: QueryParams) => ["segments", "list", params] as const,
    detail: (id: string) => ["segments", "detail", id] as const,
    members: (id: string, page: number, size: number) => ["segments", "members", id, page, size] as const,
    preview: (matchType: string, rules: unknown) => ["segments", "preview", matchType, rules] as const
  },
  consent: {
    all: ["consent"] as const,
    list: (params: QueryParams) => ["consent", "list", params] as const
  },
  suppressions: {
    all: ["suppressions"] as const,
    list: (page: number, size: number) => ["suppressions", "list", page, size] as const
  },
  imports: {
    all: ["contact-imports"] as const,
    list: (page: number, size: number) => ["contact-imports", "list", page, size] as const,
    detail: (id: string) => ["contact-imports", "detail", id] as const,
    errors: (id: string, page: number, size: number) => ["contact-imports", "errors", id, page, size] as const
  }
};
