import { SchedulerService } from '../src/services/scheduler';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(req: any, res: any) {
  try {
    console.log('[Cron] Running scheduled task generation...');
    
    // Actually call the scheduler service
    const result = await SchedulerService.generateInstances();
    
    console.log('[Cron] Scheduler completed:', {
      generated: result.generated,
      errors: result.errors,
    });
    
    res.status(200).json({
      success: true,
      generated: result.generated,
      errors: result.errors,
    });
  } catch (error) {
    console.error('[Cron] Scheduler failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
