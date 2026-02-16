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
import { Request, Response } from 'express';
import { SessionService } from './session.service';

@Controller('api/session')
export class SessionController {
    constructor(private readonly sessionService: SessionService) {}

    /**
     * GET /api/session/auth-result
     * Retrieve authentication result from session
     */
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

    /**
     * GET /api/session/logs
     * Retrieve HTTP request/response logs from session
     */
    @Get('logs')
    getLogs(@Req() req: Request): unknown {
        return {
            logs: req.session.logs || [],
            count: req.session.logs?.length || 0,
        };
    }

    /**
     * DELETE /api/session/clear
     * Clear session data
     */
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
