import { Controller, Delete, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TestResult } from '../test-results/entities/test-result.entity';
import {
    ConfigurationDetails,
    DashboardConfigurations,
    DashboardService,
} from './dashboard.service';

@Controller('api/dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
    constructor(private readonly dashboardService: DashboardService) {}

    /**
     * GET /api/dashboard/configurations
     * Get all configurations for the authenticated user
     */
    @Get('configurations')
    async getConfigurations(@Req() req: Request): Promise<DashboardConfigurations> {
        const user = req.user as { id: string; email: string };
        return this.dashboardService.getConfigurations(user.id);
    }

    /**
     * GET /api/dashboard/configurations/:id
     * Get single configuration details
     */
    @Get('configurations/:id')
    async getConfiguration(
        @Param('id') configId: string,
        @Req() req: Request,
    ): Promise<ConfigurationDetails> {
        const user = req.user as { id: string; email: string };
        const config = await this.dashboardService.getConfigurationById(configId, user.id);

        if (!config) {
            throw new Error('Configuration not found');
        }

        return config;
    }

    /**
     * DELETE /api/dashboard/configurations/:id
     * Delete a configuration
     */
    @Delete('configurations/:id')
    async deleteConfiguration(
        @Param('id') configId: string,
        @Req() req: Request,
    ): Promise<{ message: string }> {
        const user = req.user as { id: string; email: string };
        const deleted = await this.dashboardService.deleteConfiguration(configId, user.id);

        if (!deleted) {
            throw new Error('Configuration not found or already deleted');
        }

        return { message: 'Configuration deleted successfully' };
    }

    /**
     * GET /api/dashboard/test-results/:configId
     * Get test results for a configuration
     */
    @Get('test-results/:configId')
    async getTestResults(
        @Param('configId') configId: string,
        @Query('limit') limit: string,
        @Req() req: Request,
    ): Promise<TestResult[]> {
        const user = req.user as { id: string; email: string };
        const resultLimit = limit ? parseInt(limit, 10) : 10;
        return this.dashboardService.getTestResults(configId, user.id, resultLimit);
    }
}
