import { Reply, TaskDTO } from '../src/contracts';
export function read(value: Reply<TaskDTO>): string {
  if (value.ok) return value.error.message;
  return value.error.message;
}
