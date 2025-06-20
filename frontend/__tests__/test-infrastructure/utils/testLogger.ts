/**
 * 测试日志工具
 * 
 * 提供测试过程中的日志记录和调试支持
 */

export class TestLogger {
  private static instance: TestLogger | null = null;
  private logs: Array<{ timestamp: number; level: string; message: string; data?: any }> = [];
  private enabled = false;

  static getInstance(): TestLogger {
    if (!this.instance) {
      this.instance = new TestLogger();
    }
    return this.instance;
  }

  enable(): void {
    this.enabled = true;
  }

  disable(): void {
    this.enabled = false;
  }

  clear(): void {
    this.logs = [];
  }

  private log(level: string, message: string, data?: any): void {
    if (!this.enabled) return;

    const entry = {
      timestamp: Date.now(),
      level,
      message,
      data
    };

    this.logs.push(entry);

    // 在开发环境中输出到控制台
    if (process.env.NODE_ENV === 'test' && process.env.VITEST_LOG === 'true') {
      console.log(`[TEST ${level}] ${message}`, data || '');
    }
  }

  debug(message: string, data?: any): void {
    this.log('DEBUG', message, data);
  }

  info(message: string, data?: any): void {
    this.log('INFO', message, data);
  }

  warn(message: string, data?: any): void {
    this.log('WARN', message, data);
  }

  error(message: string, data?: any): void {
    this.log('ERROR', message, data);
  }

  getLogs(level?: string): Array<{ timestamp: number; level: string; message: string; data?: any }> {
    if (level) {
      return this.logs.filter(log => log.level === level);
    }
    return [...this.logs];
  }

  getLastLog(): { timestamp: number; level: string; message: string; data?: any } | null {
    return this.logs[this.logs.length - 1] || null;
  }

  hasErrors(): boolean {
    return this.logs.some(log => log.level === 'ERROR');
  }

  hasWarnings(): boolean {
    return this.logs.some(log => log.level === 'WARN');
  }

  exportLogs(): string {
    return this.logs
      .map(log => `[${new Date(log.timestamp).toISOString()}] ${log.level}: ${log.message}${log.data ? ` ${JSON.stringify(log.data)}` : ''}`)
      .join('\n');
  }
}