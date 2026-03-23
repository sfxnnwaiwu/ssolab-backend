import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sgMail from '@sendgrid/mail';

interface EmailOptions {
    to: string;
    subject: string;
    html: string;
    text?: string;
}

@Injectable()
export class EmailService {
    private readonly logger = new Logger(EmailService.name);
    private readonly sendgridApiKey: string;
    private readonly fromEmail: string;
    private readonly isDevelopment: boolean;

    constructor(private readonly configService: ConfigService) {
        this.sendgridApiKey = this.configService.get<string>('SENDGRID_API_KEY', '');
        this.fromEmail = this.configService.get<string>(
            'SENDGRID_FROM_EMAIL',
            'noreply@example.com',
        );
        this.isDevelopment = this.configService.get<string>('NODE_ENV') === 'development';

        if (this.sendgridApiKey && !this.isDevelopment) {
            sgMail.setApiKey(this.sendgridApiKey);
        }
    }

    /**
     * Send email using SendGrid or log to console in development
     */
    async send(options: EmailOptions): Promise<boolean> {
        const { to, subject, html, text } = options;

        if (this.isDevelopment || !this.sendgridApiKey) {
            // this.logger.log(`[DEV MODE] Email would be sent to: ${to}`);
            // this.logger.log(`[DEV MODE] Subject: ${subject}`);
            // this.logger.log(`[DEV MODE] HTML Content:\n${html}`);
            return true;
        }

        try {
            const msg = {
                to,
                from: this.fromEmail,
                subject,
                html,
                text: text || html,
            };

            const response = await sgMail.send(msg);
            this.logger.log(`Email sent successfully to ${to}`, response[0].statusCode);
            return true;
        } catch (error) {
            this.logger.error(`Failed to send email to ${to}:`, error);
            throw new InternalServerErrorException('Failed to send email');
        }
    }

    /**
     * Send password reset email
     */
    async sendPasswordResetEmail(email: string, resetLink: string): Promise<boolean> {
        const html = this.generatePasswordResetEmailHTML(resetLink);
        const text = this.generatePasswordResetEmailText(resetLink);

        return this.send({
            to: email,
            subject: 'Password Reset Request - SSO Test Lab',
            html,
            text,
        });
    }

    /**
     * Generate HTML content for password reset email
     */
    private generatePasswordResetEmailHTML(resetLink: string): string {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #0066cc; color: white; padding: 20px; text-align: center; border-radius: 4px 4px 0 0; }
                    .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-radius: 0 0 4px 4px; }
                    .button { 
                        display: inline-block; 
                        padding: 12px 24px; 
                        background-color: #0066cc; 
                        color: white; 
                        text-decoration: none; 
                        border-radius: 4px;
                        margin: 20px 0;
                    }
                    .footer { font-size: 12px; color: #666; margin-top: 20px; text-align: center; }
                    .warning { background-color: #fff3cd; border: 1px solid #ffc107; padding: 12px; border-radius: 4px; margin: 20px 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Password Reset Request</h1>
                    </div>
                    <div class="content">
                        <p>Hello,</p>
                        <p>We received a request to reset your password for your SSO Test Lab account.</p>
                        <p>Click the button below to reset your password:</p>
                        <a href="${resetLink}" class="button">Reset Password</a>
                        <p>Or copy and paste this link in your browser:</p>
                        <p><code>${resetLink}</code></p>
                        
                        <div class="warning">
                            <strong>⚠️ Security Notice:</strong> This link will expire in 15 minutes. If you didn't request a password reset, please ignore this email or contact support if you have concerns about your account security.
                        </div>
                        
                        <p><strong>Important:</strong></p>
                        <ul>
                            <li>Do not share this link with anyone</li>
                            <li>Do not click this link if you did not request a password reset</li>
                            <li>This link is valid for 15 minutes only</li>
                        </ul>
                    </div>
                    <div class="footer">
                        <p>&copy; 2026 SSO Test Lab. All rights reserved.</p>
                        <p>If you did not request this password reset, please ignore this email.</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    /**
     * Generate plain text content for password reset email
     */
    private generatePasswordResetEmailText(resetLink: string): string {
        return `
        Password Reset Request
        ======================

        Hello,

        We received a request to reset your password for your SSO Test Lab account.

        Click the link below to reset your password:
        ${resetLink}

        This link will expire in 15 minutes.

        SECURITY NOTICE:
        - Do not share this link with anyone
        - Do not click this link if you did not request a password reset
        - This link is valid for 15 minutes only

        If you did not request a password reset, please ignore this email.

        ---
        © 2026 SSO Test Lab. All rights reserved.
        `;
    }
}
