import {
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    NotFoundException,
    Req,
    Res,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Controller('api/session')
export class SessionController {
    /**
     * GET /api/session/auth-result
     * Retrieve authentication result from session
     */
    @Get('auth-result')
    getAuthResult(@Req() req: Request): unknown {
        if (!req.session.authResult) {
            throw new NotFoundException('No authentication result in session');
        }

        return req.session.authResult;
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
