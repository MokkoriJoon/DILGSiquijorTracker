/**
 * Vercel Serverless Function: Scheduler API
 * 
 * This runs automatically via Vercel Cron at:
 * - 12:01 AM (Midnight)
 * - 8:01 AM (Morning)
 * - 12:01 PM (Noon)
 * - 5:01 PM (Evening)
 * 
 * It handles:
 * 1. Marking overdue tasks
 * 2. Generating new recurring task instances
 * 3. Sending reminder notifications
 */

import { SchedulerService } from '../src/services/scheduler';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(req: any, res: any) {
  try {
    console.log('[Cron] ========================================');
    console.log('[Cron] Running scheduled task generation...');
    console.log('[Cron] Time:', new Date().toISOString());
    console.log('[Cron] ========================================');
    
    // Run the scheduler
    const result = await SchedulerService.generateInstances();
    
    console.log('[Cron] ========================================');
    console.log('[Cron] Scheduler completed successfully!');
    console.log('[Cron] Generated:', result.generated, 'instances');
    console.log('[Cron] Errors:', result.errors.length);
    console.log('[Cron] ========================================');

    if (result.errors.length > 0) {
      console.error('[Cron] Errors encountered:', result.errors);
    }
    
    res.status(200).json({
      success: true,
      message: 'Scheduler executed successfully',
      timestamp: new Date().toISOString(),
      generated: result.generated,
      errorCount: result.errors.length,
      errors: result.errors,
    });
  } catch (error) {
    console.error('[Cron] ========================================');
    console.error('[Cron] Scheduler FAILED!');
    console.error('[Cron] Error:', error);
    console.error('[Cron] ========================================');
    
    res.status(500).json({
      success: false,
      error: 'Scheduler failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
}
