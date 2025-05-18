import { z } from 'zod';

export const progressMap = {
  complete: 100,
  inprogress: 50,
  notstarted: 0,
  ongoing: 75,
};

export const taskFormSchema = z.object({
  title: z.string().min(1, { message: "Task title is required" }),
  description: z.string().optional(),
  phase_id: z.string().min(1, { message: "Phase is required" }),
  responsible_teams: z.array(z.string()).optional(),
  start_date: z.union([z.string(), z.date(), z.null()]).optional().nullable(),
  end_date: z.union([z.string(), z.date(), z.null()]).optional().nullable(),
  duration: z.string().optional(),
  status: z.enum(['notstarted', 'inprogress', 'ongoing', 'complete']),
  progress_summary: z.string().optional(),
});

export type TaskFormValues = z.infer<typeof taskFormSchema>;

export const defaultValues: Partial<TaskFormValues> = {
  title: '',
  description: '',
  phase_id: '',
  responsible_teams: [],
  start_date: null,
  end_date: null,
  duration: '',
  status: 'notstarted',
  progress_summary: '',
};
