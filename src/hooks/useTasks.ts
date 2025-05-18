import { useState, useEffect, useCallback } from 'react';
import { Task, Phase } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { progressMap } from '@/components/tasks/TaskFormSchema';
import { createNotification } from '@/utils/notificationService';

export const useTasks = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [teams, setTeams] = useState<string[]>([]);
  
  // Fetch phases and tasks data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch phases
      const { data: phasesData, error: phasesError } = await supabase
        .from('phases')
        .select('*')
        .order('position');
        
      if (phasesError) throw phasesError;
      setPhases(phasesData as Phase[]);
      
      // Fetch tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select(`
          *,
          phases:phase_id (name)
        `);
        
      if (tasksError) throw tasksError;
      
      // Transform tasks to match our Task type
      const formattedTasks = tasksData.map((task: any) => {
        // Use the progressMap to determine progress based on status
        const progressValue = progressMap[task.status as keyof typeof progressMap] || 0;
        
        return {
          ...task,
          phase: task.phases?.name,
          status: task.status as any,
          // Add the progress property
          progress: progressValue,
          // Add progress_summary if it doesn't exist
          progress_summary: task.progress_summary || '',
          // Handle the duration field explicitly
          duration: task.duration || ''
        };
      });
      
      // Sort tasks by status priority and end date
      const sortedTasks = sortTasksByPriorityAndDate(formattedTasks);
      setTasks(sortedTasks);
      
      // Extract unique teams
      const allTeams = new Set<string>();
      formattedTasks.forEach((task: any) => {
        if (task.responsible_teams && Array.isArray(task.responsible_teams)) {
          task.responsible_teams.forEach((team: string) => allTeams.add(team));
        }
      });

      // Add default teams if they don't exist
      ['ZARSOM', 'SAPPI', 'Afzelia', 'Executive Team'].forEach(team => allTeams.add(team));
      
      setTeams(Array.from(allTeams));
      
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load tasks data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Sort tasks by status priority and end date
  const sortTasksByPriorityAndDate = (tasks: Task[]) => {
    return [...tasks].sort((a, b) => {
      // Updated status priority: notstarted -> inprogress -> ongoing -> complete
      const statusPriority = {
        'notstarted': 0,
        'inprogress': 1,
        'ongoing': 2,
        'complete': 3
      };
      
      const statusComparison = 
        (statusPriority[a.status as keyof typeof statusPriority] || 0) - 
        (statusPriority[b.status as keyof typeof statusPriority] || 0);
      
      if (statusComparison !== 0) return statusComparison;
      
      // Then sort by end date (oldest first)
      if (!a.end_date && !b.end_date) return 0;
      if (!a.end_date) return 1;
      if (!b.end_date) return -1;
      
      // Sort by end date (oldest first)
      return new Date(a.end_date).getTime() - new Date(b.end_date).getTime();
    });
  };

  useEffect(() => {
    fetchData();
    
    // Set up real-time updates for tasks
    const tasksChannel = supabase
      .channel('tasks-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'tasks'
        }, 
        () => {
          fetchData();
        }
      )
      .subscribe();
      
    // Set up real-time updates for phases
    const phasesChannel = supabase
      .channel('phases-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'phases'
        }, 
        () => {
          fetchData();
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(tasksChannel);
      supabase.removeChannel(phasesChannel);
    };
  }, [fetchData]);

  // Function to handle phase creation
  const handleCreatePhase = async (name: string) => {
    try {
      // Get max position from existing phases
      let maxPosition = 0;
      if (phases.length > 0) {
        maxPosition = Math.max(...phases.map(phase => phase.position));
      }
      
      const { data, error } = await supabase
        .from('phases')
        .insert({
          name,
          position: maxPosition + 1
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Update phases locally
      setPhases(prev => [...prev, data as Phase]);
      toast.success(`Phase "${name}" created successfully`);
      return data;
    } catch (error: any) {
      console.error('Error creating phase:', error);
      toast.error('Failed to create phase');
      return null;
    }
  };

  // Function to handle phase update
  const handleUpdatePhase = async (phaseId: string, name: string) => {
    try {
      const { error } = await supabase
        .from('phases')
        .update({ name })
        .eq('id', phaseId);
      
      if (error) throw error;
      
      // Update phases locally
      setPhases(prev => prev.map(phase => 
        phase.id === phaseId ? { ...phase, name } : phase
      ));
      
      toast.success('Phase updated successfully');
      return true;
    } catch (error: any) {
      console.error('Error updating phase:', error);
      toast.error('Failed to update phase');
      return false;
    }
  };

  // Function to handle phase deletion
  const handleDeletePhase = async (phaseId: string) => {
    try {
      // Check if phase has tasks
      const hasTasksInPhase = tasks.some(task => task.phase_id === phaseId);
      
      if (hasTasksInPhase) {
        toast.error('Cannot delete phase with tasks. Delete all tasks in this phase first.');
        return false;
      }

      const phase = phases.find(p => p.id === phaseId);
      if (!phase) {
        toast.error('Phase not found');
        return false;
      }
      
      // Log deletion before actual delete
      await supabase.from('deletion_logs').insert({
        table_name: 'phases',
        record_id: phaseId,
        deleted_by: user?.id || '',
        deleted_by_name: (user?.user_metadata?.full_name || user?.email || ''),
        details: phase,
      });

      // Send notification
      await createNotification({
        userId: user.id,
        type: 'phase_deleted',
        content: `${user?.user_metadata?.full_name || user?.email || ''} deleted phase: ${phase.name}`,
        link: '/tasks',
      });
      
      const { error } = await supabase
        .from('phases')
        .delete()
        .eq('id', phaseId);
      
      if (error) throw error;
      
      // Update phases locally
      setPhases(prev => prev.filter(phase => phase.id !== phaseId));
      
      toast.success('Phase deleted successfully');
      return true;
    } catch (error: any) {
      console.error('Error deleting phase:', error);
      toast.error('Failed to delete phase');
      return false;
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);
        
      if (error) throw error;
      
      // Update tasks locally to prevent freezing
      setTasks(tasks.filter(t => t.id !== taskId));
      toast.success('Task deleted successfully');
      return true;
    } catch (error: any) {
      console.error('Error deleting task:', error);
      toast.error('Failed to delete task');
      return false;
    }
  };
  
  // Function to update task positions
  const updateTaskOrder = async (reorderedTasks: Task[]) => {
    try {
      // Verify tasks are all in the same phase
      const firstPhaseId = reorderedTasks[0]?.phase_id;
      const allSamePhase = reorderedTasks.every(task => task.phase_id === firstPhaseId);
      
      if (!allSamePhase) {
        console.warn('Cannot reorder tasks across different phases');
        return false;
      }
      
      // Update local state immediately for smoother UI
      const updatedTasks = tasks.map(task => {
        const reorderedTask = reorderedTasks.find(rt => rt.id === task.id);
        return reorderedTask || task;
      });
      
      setTasks(updatedTasks);
      
      return true;
    } catch (error: any) {
      console.error('Error updating task order:', error);
      toast.error('Failed to update task order');
      return false;
    }
  };

  // Calculate phase progress - only count completed tasks
  const calculatePhaseProgress = (phaseId: string) => {
    const phaseTasks = tasks.filter(task => task.phase_id === phaseId);
    if (phaseTasks.length === 0) return 0;
    
    const completedTasks = phaseTasks.filter(task => task.status === 'complete').length;
    return Math.round((completedTasks / phaseTasks.length) * 100);
  };

  return {
    tasks,
    phases,
    teams,
    isLoading,
    fetchData,
    handleDeleteTask,
    handleCreatePhase,
    handleUpdatePhase,
    handleDeletePhase,
    updateTaskOrder,
    sortTasksByPriorityAndDate,
    calculatePhaseProgress
  };
};
