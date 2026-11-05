export type Priority = 'normal' | 'high';
export interface TaskFields {
    title: string;
    done: boolean;
    priority: Priority;
}
export interface TaskDTO extends TaskFields {
    id: string;
    version: number;
}
export interface TaskPage {
    items: TaskDTO[];
    nextCursor: string | null;
}
export type Code = 'INVALID_INPUT' | 'UNAUTHORIZED' | 'NOT_FOUND' | 'CONFLICT' | 'OP_REUSED' | 'CAPACITY' | 'TOO_LARGE' | 'MEDIA_TYPE' | 'METHOD' | 'PROTOCOL' | 'INTERNAL';
export type Reply<T> = {
    ok: true;
    data: T;
} | {
    ok: false;
    error: {
        code: Code;
        message: string;
    };
};
export declare class DomainError extends Error {
    readonly code: Code;
    constructor(code: Code);
}
export declare function failure(code: Code): Reply<never>;
export declare function isRecord(value: unknown): value is Record<string, unknown>;
export declare function parseFields(value: unknown): TaskFields;
export declare function parseCreate(value: unknown): {
    opId: string;
    fields: TaskFields;
};
export declare function parseUpdate(value: unknown): {
    opId: string;
    version: number;
    fields: TaskFields;
};
export declare function validId(value: unknown): value is string;
export declare function parseList(value: unknown): {
    limit: number;
    cursor: string | null;
};
export declare function isTask(value: unknown): value is TaskDTO;
export declare function parseTaskReply(value: unknown): TaskDTO;
export declare function parsePageReply(value: unknown): TaskPage;
