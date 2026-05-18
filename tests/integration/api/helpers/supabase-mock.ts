import { vi } from "vitest";

type MaybeRecord = Record<string, unknown> | null;

interface QueryResult {
  data: MaybeRecord;
  error: { message: string } | null;
}

interface RpcResult {
  data: MaybeRecord;
  error: { message: string } | null;
}

interface SupabaseMockOptions {
  user?: { id: string } | null;
  noteSelectResult?: QueryResult;
  noteUpdateResult?: QueryResult;
  noteErrorUpdateResult?: QueryResult;
  rpcResult?: RpcResult;
}

function createSingleResult(result: QueryResult = { data: null, error: null }) {
  return vi.fn().mockResolvedValue(result);
}

function createSelectChain(result?: QueryResult) {
  return {
    eq: vi.fn().mockReturnValue({
      single: createSingleResult(result),
      maybeSingle: createSingleResult(result)
    })
  };
}

function createUpdateChain(result?: QueryResult) {
  return {
    eq: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: createSingleResult(result)
      })
    })
  };
}

export function createSupabaseMock(options: SupabaseMockOptions = {}) {
  const noteSelectChain = createSelectChain(options.noteSelectResult);
  const noteUpdateChain = createUpdateChain(options.noteUpdateResult);
  const noteErrorUpdateEq = vi.fn().mockResolvedValue(options.noteErrorUpdateResult ?? { data: null, error: null });
  const noteDeleteEq = vi.fn();

  const notesTable = {
    select: vi.fn().mockReturnValue(noteSelectChain),
    update: vi.fn((payload?: Record<string, unknown>) => {
      if (payload?.ai_status === "error") {
        return {
          eq: noteErrorUpdateEq
        };
      }

      return noteUpdateChain;
    }),
    delete: vi.fn().mockReturnValue({
      eq: noteDeleteEq
    })
  };

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: options.user ?? null
        }
      })
    },
    from: vi.fn((table: string) => {
      if (table === "notes") {
        return notesTable;
      }

      throw new Error(`Unexpected table mock: ${table}`);
    }),
    rpc: vi.fn().mockResolvedValue(options.rpcResult ?? { data: null, error: null }),
    __mocks: {
      noteSelectChain,
      noteUpdateChain,
      noteErrorUpdateEq,
      noteDeleteEq,
      notesTable
    }
  };
}
