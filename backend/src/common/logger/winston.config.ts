import { utilities as nestWinstonUtilities, WinstonModuleOptions } from 'nest-winston';
import * as winston from 'winston';

export function buildWinstonOptions(nodeEnv: string): WinstonModuleOptions {
  const transports: winston.transport[] = [
    new winston.transports.Console({
      format:
        nodeEnv === 'production'
          ? winston.format.combine(winston.format.timestamp(), winston.format.json())
          : winston.format.combine(
              winston.format.timestamp({ format: 'HH:mm:ss' }),
              nestWinstonUtilities.format.nestLike('vakansiya', {
                colors: true,
                prettyPrint: true,
              }),
            ),
    }),
  ];

  if (nodeEnv === 'production') {
    transports.push(
      new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
      new winston.transports.File({ filename: 'logs/combined.log' }),
    );
  }

  return { level: nodeEnv === 'production' ? 'info' : 'debug', transports };
}
