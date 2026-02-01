export interface ErrorDetail {
    type: string;
    title: string;
    description: string;
    technicalDetails: string;
    troubleshootingSteps: string[];
    relatedDocs?: Array<{
        title: string;
        url: string;
    }>;
}
