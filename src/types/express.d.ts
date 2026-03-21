import { Request } from 'express';
import { Session } from 'express-session';
import { HttpLogEntry } from '../common/interface/http-log-entry.interface';

declare global {
    namespace Express {
        interface Request {
            correlationId?: string;
            user?: {
                id: string;
                email: string;
                // add other user properties
            };
            session: Session & {
                logs?: HttpLogEntry[];
            };
        }
    }
}
