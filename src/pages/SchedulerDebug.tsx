import React, { useState } from 'react';
import { SchedulerService } from '../services/scheduler';
import { supabase } from '../lib/supabase';
import { AlertCircle, CheckCircle2, Clock, RefreshCw } from 'lucide-react';

export default function SchedulerDebug() {
  const [logs, setLogs] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [taskDetails, setTaskDetails] = useState<any[]>([]);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const runDiagnostics = async () => {
    setRunning(true);
    setLogs([]);
    setTaskDetails([]);

    addLog('🔍 Starting diagnostics...');

    // Get current date/time
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().split(' ')[0].substring(0, 5);
    
    addLog(`📅 Current date: ${today}`);
    addLog(`⏰ Current time: ${currentTime}`);

    // Get database time
    const { data: dbTime } = await supabase.rpc('get_current_timestamp');
    addLog(`🗄️ Database time: ${dbTime || 'N/A'}`);

    // Get all tasks
    addLog('📋 Fetching all tasks...');
    const { data: allTasks, error: fetchError } = await supabase
      .from('task_instances')
      .select(`
        *,
        template:task_templates(*)
      `)
      .order('due_date', { ascending: false })
      .limit(20);

    if (fetchError) {
      addLog(`❌ Error fetching tasks: ${fetchError.message}`);
      setRunning(false);
      return;
    }

    addLog(`✅ Found ${allTasks?.length || 0} tasks`);

    // Analyze each task
    const analysis: any[] = [];
    allTasks?.forEach(task => {
      const isOverdue = 
        task.status === 'OVERDUE' ||
        task.due_date < today ||
        (task.due_date === today && task.due_time && task.due_time < currentTime);

      const reason = task.status === 'OVERDUE' ? 'Already OVERDUE' :
                    task.status === 'COMPLETED' ? 'Already COMPLETED' :
                    task.due_date < today ? 'Past due date' :
                    task.due_date === today && task.due_time && task.due_time < currentTime ? 'Time passed' :
                    task.due_date === today ? 'Due today, time not passed' :
                    'Future date';

      analysis.push({
        id: task.id,
        title: task.template?.title || 'N/A',
        status: task.status,
        due_date: task.due_date,
        due_time: task.due_time,
        should_be_overdue: isOverdue,
        reason: reason,
      });
    });

    setTaskDetails(analysis);

    // Count tasks that should be overdue
    const shouldBeOverdue = analysis.filter(t => 
      t.should_be_overdue && t.status !== 'OVERDUE' && t.status !== 'COMPLETED'
    );

    addLog(`📊 Analysis:`);
    addLog(`   - Total tasks: ${analysis.length}`);
    addLog(`   - Already OVERDUE: ${analysis.filter(t => t.status === 'OVERDUE').length}`);
    addLog(`   - Already COMPLETED: ${analysis.filter(t => t.status === 'COMPLETED').length}`);
    addLog(`   - Should be marked OVERDUE: ${shouldBeOverdue.length}`);

    if (shouldBeOverdue.length > 0) {
      addLog(`⚠️  Found ${shouldBeOverdue.length} tasks that should be marked as OVERDUE:`);
      shouldBeOverdue.forEach(task => {
        addLog(`   - ${task.title} (Due: ${task.due_date} ${task.due_time || ''}) - ${task.reason}`);
      });
    }

    // Run the scheduler
    addLog('🚀 Running scheduler...');
    const result = await SchedulerService.generateInstances();
    
    addLog(`✅ Scheduler completed:`);
    addLog(`   - Generated: ${result.generated} instances`);
    addLog(`   - Errors: ${result.errors.length}`);
    
    if (result.errors.length > 0) {
      result.errors.forEach(err => addLog(`   ❌ ${err}`));
    }

    // Re-check tasks after scheduler
    addLog('🔄 Re-checking tasks after scheduler...');
    const { data: updatedTasks } = await supabase
      .from('task_instances')
      .select('id, status, due_date, due_time')
      .in('id', shouldBeOverdue.map(t => t.id));

    const nowOverdue = updatedTasks?.filter(t => t.status === 'OVERDUE').length || 0;
    addLog(`✅ ${nowOverdue} of ${shouldBeOverdue.length} tasks are now OVERDUE`);

    if (nowOverdue < shouldBeOverdue.length) {
      addLog(`⚠️  ${shouldBeOverdue.length - nowOverdue} tasks were NOT marked as OVERDUE`);
      addLog(`💡 Check the detailed task list below for more information`);
    }

    addLog('🎉 Diagnostics complete!');
    setRunning(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OVERDUE': return 'bg-red-100 text-red-700';
      case 'COMPLETED': return 'bg-emerald-100 text-emerald-700';
      case 'PENDING': return 'bg-slate-100 text-slate-700';
      case 'IN_PROGRESS': return 'bg-blue-100 text-blue-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Scheduler Debug Tool</h2>
          <p className="text-sm text-slate-500">Diagnose overdue task marking issues</p>
        </div>
        <button
          onClick={runDiagnostics}
          disabled={running}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${running ? 'animate-spin' : ''}`} />
          {running ? 'Running...' : 'Run Diagnostics'}
        </button>
      </div>

      {/* Logs */}
      <div className="bg-slate-900 rounded-xl p-4 font-mono text-xs text-slate-100 max-h-96 overflow-y-auto">
        {logs.length === 0 ? (
          <p className="text-slate-500">Click "Run Diagnostics" to start...</p>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="mb-1">{log}</div>
          ))
        )}
      </div>

      {/* Task Details */}
      {taskDetails.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
            <h3 className="text-sm font-semibold text-slate-800">Task Analysis</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500">Task</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500">Status</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500">Due Date</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500">Due Time</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500">Should Be Overdue?</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {taskDetails.map((task) => (
                  <tr key={task.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-sm text-slate-800">{task.title}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${getStatusColor(task.status)}`}>
                        {task.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm text-slate-600">{task.due_date}</td>
                    <td className="px-4 py-2 text-sm text-slate-600">{task.due_time || '-'}</td>
                    <td className="px-4 py-2">
                      {task.should_be_overdue && task.status !== 'OVERDUE' && task.status !== 'COMPLETED' ? (
                        <span className="inline-flex items-center gap-1 text-xs text-red-600">
                          <AlertCircle className="w-3 h-3" />
                          Yes
                        </span>
                      ) : task.status === 'OVERDUE' ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                          <CheckCircle2 className="w-3 h-3" />
                          Already Overdue
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">No</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-600">{task.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Help Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">💡 How to Use This Tool</h3>
        <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
          <li>Click "Run Diagnostics" to analyze all tasks</li>
          <li>Check the logs to see what the scheduler is doing</li>
          <li>Look at the task analysis table to see which tasks should be overdue</li>
          <li>If tasks are not being marked as overdue, share the logs and task details</li>
        </ol>
      </div>
    </div>
  );
}
