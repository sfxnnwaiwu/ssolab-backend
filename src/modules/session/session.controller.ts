import {
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    NotFoundException,
    Query,
    Req,
    Res,
} from '@nestjs/common';
import {
    ApiNoContentResponse,
    ApiOkResponse,
    ApiOperation,
    ApiQuery,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { SessionService } from './session.service';

@ApiTags('Session')
@Controller('api/session')
export class SessionController {
    constructor(private readonly sessionService: SessionService) {}

    @ApiOperation({
        summary: 'Get authentication result from session',
        description: 'Retrieve the authentication result stored in session after OIDC or SAML flow',
    })
    @ApiQuery({
        name: 'resultId',
        description: 'Optional result ID to fetch a specific authentication result',
        required: false,
        example: 'result_123456',
    })
    @ApiOkResponse({
        description: 'Authentication result found',
        schema: {
            type: 'object',
        },
    })
    @ApiResponse({
        status: 404,
        description: 'No authentication result found in session or with given ID',
    })
    @Get('auth-result')
    async getAuthResult(
        @Req() req: Request,
        @Query('resultId') resultId?: string,
    ): Promise<unknown> {
        if (resultId) {
            const result = await this.sessionService.getAuthResultById(resultId);

            if (!result) {
                throw new NotFoundException(`Authentication result not found for ID: ${resultId}`);
            }

            return result;
        }

        if (!req.session.authResult) {
            throw new NotFoundException('No authentication result in session');
        }

        return req.session.authResult;
    }

    @ApiOperation({
        summary: 'Get HTTP request/response logs',
        description: 'Retrieve HTTP request and response logs captured during authentication flow',
    })
    @ApiOkResponse({
        description: 'HTTP logs retrieved successfully',
        schema: {
            properties: {
                logs: {
                    type: 'array',
                    description: 'Array of HTTP log entries',
                },
                count: {
                    type: 'number',
                    description: 'Number of log entries',
                    example: 5,
                },
            },
        },
    })
    @Get('logs')
    getLogs(@Req() req: Request): unknown {
        return {
            logs: req.session.logs || [],
            count: req.session.logs?.length || 0,
        };
    }

    @ApiOperation({
        summary: 'Clear session data',
        description: 'Destroy session and remove all stored authentication and session data',
    })
    @ApiNoContentResponse({
        description: 'Session cleared successfully',
    })
    @ApiResponse({
        status: 500,
        description: 'Failed to clear session',
    })
    @Delete('clear')
    @HttpCode(HttpStatus.NO_CONTENT)
    clearSession(@Req() req: Request, @Res() res: Response) {
        req.session.destroy((err) => {
            if (err) {
                return res.status(500).json({ message: 'Failed to clear session' });
            }
            res.clearCookie(process.env.SESSION_COOKIE_NAME || 'connect.sid');
            return res.status(204).send();
        });
    }
}
