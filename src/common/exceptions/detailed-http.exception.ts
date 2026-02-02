import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorDetail } from '../interfaces/error-detail.interface';

export class DetailedHttpException extends HttpException {
    constructor(
        public readonly errorDetail: ErrorDetail,
        status: HttpStatus = HttpStatus.BAD_REQUEST,
    ) {
        super(errorDetail, status);
    }
}
