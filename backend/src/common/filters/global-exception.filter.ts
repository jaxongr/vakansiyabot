import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from '@prisma/client';
import { AppException } from '../errors/app.exception';
import { ErrorCode } from '../errors/error-codes';
import { captureException } from '../monitoring/sentry';

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: ErrorBody = {
      error: { code: ErrorCode.INTERNAL, message: 'Internal server error' },
    };

    if (exception instanceof AppException) {
      status = exception.getStatus();
      body = {
        error: {
          code: exception.code,
          message: exception.message,
          details: exception.details,
        },
      };
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      const message =
        typeof res === 'string'
          ? res
          : ((res as Record<string, unknown>).message as string | string[] | undefined);
      body = {
        error: {
          code: this.codeForStatus(status),
          message: Array.isArray(message) ? message.join('; ') : (message ?? exception.message),
        },
      };
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        body = { error: { code: ErrorCode.CONFLICT, message: 'Duplicate record' } };
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        body = { error: { code: ErrorCode.NOT_FOUND, message: 'Record not found' } };
      } else {
        this.logger.error(`Prisma error ${exception.code}: ${exception.message}`);
      }
    } else {
      const err = exception as Error;
      this.logger.error(err.message ?? 'Unknown error', err.stack);
      captureException(exception); // kutilmagan xatolar -> Sentry
    }

    response.status(status).json(body);
  }

  private codeForStatus(status: number): ErrorCode {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ErrorCode.VALIDATION;
      case HttpStatus.UNAUTHORIZED:
        return ErrorCode.UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ErrorCode.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ErrorCode.NOT_FOUND;
      case HttpStatus.CONFLICT:
        return ErrorCode.CONFLICT;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ErrorCode.RATE_LIMITED;
      default:
        return ErrorCode.INTERNAL;
    }
  }
}
