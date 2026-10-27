import { SchedulerService } from '../src/services/scheduler';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(req: any, res: any) {
  try {
    console.log('[Cron] Running scheduled task generation...');
    console.log('[Cron] Time:', new Date().toISOString());
    
    // Run the scheduler
    const result = await SchedulerService.generateInstances();
    
    console.log('[Cron] Scheduler completed:', {
      generated: result.generated,
      errors: result.errors.length,
    });

    if (result.errors.length > 0) {
      console.error('[Cron] Errors:', result.errors);
    }
    
    res.status(200).json({
      success: true,
      message: 'Scheduler executed successfully',
      timestamp: new Date().toISOString(),
      generated: result.generated,
      errors: result.errors,
    });
  } catch (error) {
    console.error('[Cron] Scheduler failed:', error);
    
    res.status(500).json({
      success: false,
      error: 'Scheduler failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
}
