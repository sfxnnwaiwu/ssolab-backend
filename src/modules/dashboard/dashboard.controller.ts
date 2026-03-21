import { Controller, Delete, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiOkResponse,
    ApiOperation,
    ApiParam,
    ApiQuery,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TestResult } from '../test-results/entities/test-result.entity';
import {
    ConfigurationDetails,
    DashboardConfigurations,
    DashboardService,
} from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('api/dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
    constructor(private readonly dashboardService: DashboardService) {}

    @ApiOperation({
        summary: 'Get all configurations',
        description: 'Retrieve all OIDC and SAML configurations for the authenticated user',
    })
    @ApiOkResponse({
        description: 'All configurations retrieved successfully',
        schema: {
            properties: {
                oidcConfigurations: {
                    type: 'array',
                    description: 'List of OIDC configurations',
                },
                samlConfigurations: {
                    type: 'array',
                    description: 'List of SAML configurations',
                },
            },
        },
    })
    @ApiResponse({
        status: 401,
        description: 'Unauthorized - valid JWT token required',
    })
    @Get('configurations')
    async getConfigurations(@Req() req: Request): Promise<DashboardConfigurations> {
        const user = req.user as { id: string; email: string };
        return this.dashboardService.getConfigurations(user.id);
    }

    @ApiOperation({
        summary: 'Get configuration details',
        description: 'Retrieve detailed information about a specific OIDC or SAML configuration',
    })
    @ApiParam({
        name: 'id',
        description: 'Configuration ID',
        example: 'config_123456',
    })
    @ApiOkResponse({
        description: 'Configuration details retrieved successfully',
        schema: {
            type: 'object',
        },
    })
    @ApiResponse({
        status: 401,
        description: 'Unauthorized - valid JWT token required',
    })
    @ApiResponse({
        status: 404,
        description: 'Configuration not found',
    })
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

    @ApiOperation({
        summary: 'Delete a configuration',
        description: 'Delete an OIDC or SAML configuration and associated test results',
    })
    @ApiParam({
        name: 'id',
        description: 'Configuration ID to delete',
        example: 'config_123456',
    })
    @ApiOkResponse({
        description: 'Configuration deleted successfully',
        schema: {
            properties: {
                message: {
                    type: 'string',
                    example: 'Configuration deleted successfully',
                },
            },
        },
    })
    @ApiResponse({
        status: 401,
        description: 'Unauthorized - valid JWT token required',
    })
    @ApiResponse({
        status: 404,
        description: 'Configuration not found or already deleted',
    })
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

    @ApiOperation({
        summary: 'Get test results for configuration',
        description: 'Retrieve test results history for a specific configuration',
    })
    @ApiParam({
        name: 'configId',
        description: 'Configuration ID',
        example: 'config_123456',
    })
    @ApiQuery({
        name: 'limit',
        description: 'Maximum number of results to return (default: 10)',
        required: false,
        example: 10,
    })
    @ApiOkResponse({
        description: 'Test results retrieved successfully',
        schema: {
            type: 'array',
            items: {
                type: 'object',
            },
        },
    })
    @ApiResponse({
        status: 401,
        description: 'Unauthorized - valid JWT token required',
    })
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
