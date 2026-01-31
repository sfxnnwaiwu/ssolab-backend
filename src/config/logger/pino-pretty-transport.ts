import { createColors } from 'colorette';
import PinoPretty, { PrettyOptions } from 'pino-pretty';
import { HttpLog } from '../interface/http-log.interface';
import { StandardLog } from '../interface/standard-log.interface';
const availableColors = createColors({ useColor: true });
const { red, yellow, green, blue, gray, yellowBright, redBright } = availableColors;

export default (opts: PrettyOptions) =>
    PinoPretty({
        ...opts,
        singleLine: true,
        ignore: 'pid,req,res,context,responseTime',
        levelFirst: true,
        hideObject: false,
        translateTime: 'UTC:dd.mm.yyyy, HH:MM:ss.l',
        messageFormat: (log: HttpLog | StandardLog, messageKey) => {
            try {
                const message = (log[messageKey as keyof (HttpLog | StandardLog)] as string) ?? '';

                if (isHttpLog(log)) {
                    const statusCode = log.res?.statusCode;
                    const statusCodeColor = getStatusCodeColor(statusCode);

                    const remoteAddress = log.req?.remoteAddress ?? 'unknown';
                    const method = log.req?.method ?? 'UNKNOWN';
                    const url = log.req?.url ?? '/';
                    const context = log.context ?? 'HTTP';

                    return formatHttpLog({
                        context,
                        remoteAddress,
                        method,
                        statusCode,
                        statusCodeColor,
                        url,
                        responseTime: log.responseTime,
                        message,
                    });
                }

                // Standard log formatting
                return formatStandardLog(log.context ?? 'APP', message);
            } catch {
                return `[LOG] ${
                    (log[messageKey as keyof (HttpLog | StandardLog)] as string) ??
                    'Unknown message'
                }`;
            }
        },
    });

function isHttpLog(log: HttpLog | StandardLog): log is HttpLog {
    return (log as HttpLog).req !== undefined;
}

function getStatusCodeColor(statusCode?: number): (text: string | number) => string {
    if (!statusCode) return green;
    if (statusCode >= 500) return redBright;
    if (statusCode >= 400) return red;
    if (statusCode >= 300) return yellow;
    return green;
}

function formatHttpLog(params: {
    context: string;
    remoteAddress: string;
    method: string;
    statusCode?: number;
    statusCodeColor: (text: string | number) => string;
    url: string;
    responseTime?: number;
    message?: string;
}): string {
    const {
        context,
        remoteAddress,
        method,
        statusCode,
        statusCodeColor,
        url,
        responseTime,
        message,
    } = params;

    const parts = [
        `[${context}]`,
        `|${remoteAddress}|`,
        blue(method),
        statusCode ? statusCodeColor(statusCode) : '',
        '-',
        gray(url),
        responseTime ? yellow(`${responseTime}ms`) : '',
        message ? yellowBright(message) : '',
    ];

    return parts.filter(Boolean).join(' ');
}

function formatStandardLog(context: string, message: string): string {
    return `[${context}] ${yellowBright(message)}`;
}
