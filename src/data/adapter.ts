// 存储适配器 —— 当前使用 localStorage;后端就绪后实现 RestApiAdapter 并在 store 中替换即可。

import type { AppData } from '../lib/types';
import { normalizeKpiConfig } from '../lib/rules';
import { seedData } from './seed';

export interface StorageAdapter {
  load(): Promise<AppData>;
  save(data: AppData): Promise<void>;
  reset(): Promise<AppData>;
}

const STORAGE_KEY = 'kpi-pannel-data-v2-3';

export class LocalStorageAdapter implements StorageAdapter {
  async load(): Promise<AppData> {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as AppData;
        if (parsed.members && parsed.scores && parsed.incidents) {
          return {
            ...parsed,
            archivedMonths: parsed.archivedMonths ?? [],
            annual: parsed.annual ?? {},
            config: normalizeKpiConfig(parsed.config),
          };
        }
      } catch {
        // 数据损坏时回退种子数据
      }
    }
    const seed = seedData();
    await this.save(seed);
    return seed;
  }

  async save(data: AppData): Promise<void> {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  async reset(): Promise<AppData> {
    const seed = seedData();
    await this.save(seed);
    return seed;
  }
}

/**
 * 未来后端对接示例(自有服务器):
 *
 * export class RestApiAdapter implements StorageAdapter {
 *   constructor(private baseUrl: string, private token: string) {}
 *   async load() { return (await fetch(`${this.baseUrl}/api/data`, ...)).json(); }
 *   async save(data) { await fetch(`${this.baseUrl}/api/data`, { method: 'PUT', body: JSON.stringify(data) }); }
 * }
 *
 * 建议后端按实体拆分 REST 资源:/members /scores /incidents /archives /annual,
 * 计算口径直接移植 src/lib/rules.ts。
 */
