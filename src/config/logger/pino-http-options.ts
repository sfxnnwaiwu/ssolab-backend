import { join } from 'path';
import { Options } from 'pino-http';
import { PrettyOptions } from 'pino-pretty';
import { v4 as uuidv4 } from 'uuid';
import { stdSerializers } from 'pino';
import { AppEnvironmentEnum } from '../enum/app-environment.enum';
import { AppConfigService } from '../service/app-config.service';

export const getPinoHttpOptions = (config: AppConfigService): Options => {
    const isDevelopment = (config.env as string) === (AppEnvironmentEnum.DEVELOPMENT as string);
    const isAws =
        !!process.env.AWS_EXECUTION_ENV ||
        !!process.env.ECS_CONTAINER_METADATA_URI ||
        !!process.env.ECS_CONTAINER_METADATA_URI_V4 ||
        !!process.env.KUBERNETES_SERVICE_HOST;

    const enablePretty = isDevelopment && !isAws;

    return {
        serializers: {
            err: stdSerializers.err,
            error: stdSerializers.err,
            req: stdSerializers.req,
            res: stdSerializers.res,
        },
        customProps: (req) => ({
            layer: 'http',
            requestId: req.id,
            method: req.method,
            path: req.url,
        }),
        level: isDevelopment ? 'debug' : 'info',
        redact: ['req.headers.authorization'],
        genReqId: () => uuidv4(),
        ...(enablePretty && {
            transport: {
                options: {
                    colorize: true,
                },
                targets: [
                    {
                        target: join(__dirname, 'pino-pretty-transport'),
                        level: 'trace',
                        options: {
                            colorize: true,
                            translateTime: 'SYS:standard',
                            ignore: 'pid,hostname',
                        } as PrettyOptions,
                    },
                ],
            },
        }),
    };
};
