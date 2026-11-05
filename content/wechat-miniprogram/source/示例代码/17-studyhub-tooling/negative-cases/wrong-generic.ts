import { Reply } from '../src/contracts';
const value: Reply<number> = { ok: true, data: 'not-a-number' };
void value;
