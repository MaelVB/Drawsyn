import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class CleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CleanupService.name);
  private timer?: NodeJS.Timeout;
  private readonly drawingsDir = process.env.DRAWINGS_DIR || path.join(process.cwd(), 'data', 'drawings');
  // 7 jours en ms
  private readonly maxAgeMs = 7 * 24 * 60 * 60 * 1000;
  private readonly intervalMs = 24 * 60 * 60 * 1000; // exécution quotidienne

  onModuleInit() {
    this.logger.log('Initialisation du service de nettoyage des dessins');
    this.runCleanup(); // exécuter immédiatement au démarrage
    this.timer = setInterval(() => this.runCleanup(), this.intervalMs);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private runCleanup() {
    try {
      if (!fs.existsSync(this.drawingsDir)) {
        this.logger.log(`Dossier dessins inexistant: ${this.drawingsDir}`);
        return;
      }
      const now = Date.now();
      const files = fs.readdirSync(this.drawingsDir);
      let removed = 0;
      for (const file of files) {
        if (!file.endsWith('.png')) continue;
        const fullPath = path.join(this.drawingsDir, file);
        try {
          const stats = fs.statSync(fullPath);
          const age = now - stats.mtimeMs;
          if (age > this.maxAgeMs) {
            fs.unlinkSync(fullPath);
            removed++;
          }
        } catch (e) {
          this.logger.warn(`Impossible de traiter ${file}: ${(e as Error).message}`);
        }
      }
      if (removed > 0) {
        this.logger.log(`Nettoyage terminé: ${removed} fichiers supprimés (>7 jours)`);
      }
    } catch (err) {
      this.logger.warn(`Échec nettoyage dessins: ${(err as Error).message}`);
    }
  }
}
