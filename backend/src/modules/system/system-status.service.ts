import { Injectable } from '@nestjs/common';

export type ComponentStatus = 'OK' | 'DEGRADED' | 'DOWN' | 'DISABLED';

export interface ComponentHealth {
  status: ComponentStatus;
  message?: string;
  updatedAt: string;
}

/**
 * Modullar (collector, publisher, queues) o'z holatini shu registrga yozadi,
 * /system/health undan o'qiydi. Crash o'rniga DEGRADED/DOWN badge.
 */
@Injectable()
export class SystemStatusService {
  private readonly components = new Map<string, ComponentHealth>();

  set(name: string, status: ComponentStatus, message?: string): void {
    this.components.set(name, { status, message, updatedAt: new Date().toISOString() });
  }

  get(name: string): ComponentHealth | undefined {
    return this.components.get(name);
  }

  all(): Record<string, ComponentHealth> {
    return Object.fromEntries(this.components.entries());
  }
}
