import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { H1, Paragraph } from '@/components/ui/typography';

interface DeletionLog {
  id: string;
  table_name: string;
  record_id: string;
  deleted_by: string;
  deleted_by_name: string;
  details: Record<string, unknown>;
  created_at: string;
}

const DeletionLogsPage: React.FC = () => {
  const { isSuperAdmin } = useAuth();
  const [logs, setLogs] = useState<DeletionLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSuperAdmin()) return;
    const fetchLogs = async () => {
      setIsLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('deletion_logs')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        setError('Failed to load deletion logs.');
        setIsLoading(false);
        return;
      }
      setLogs((data || []).map((log: unknown) => ({ ...(log as Omit<DeletionLog, 'details'>), details: (log as { details: unknown }).details as Record<string, unknown> })));
      setIsLoading(false);
    };
    fetchLogs();
  }, [isSuperAdmin]);

  if (!isSuperAdmin()) {
    return <div className="p-8 text-center text-destructive">Unauthorized: Super admin access only.</div>;
  }

  return (
    <div className="space-y-6">
      <H1>Deletion Logs</H1>
      <Paragraph className="text-muted-foreground mb-4">
        All deletions (tasks, risks, budgets, meetings, contacts, forum posts, etc.) are logged here for audit purposes.
      </Paragraph>
      <Card>
        <CardHeader>
          <CardTitle>All Deletion Logs</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center">Loading...</div>
          ) : error ? (
            <div className="py-8 text-center text-destructive">{error}</div>
          ) : logs.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No deletions logged yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Who</TableHead>
                    <TableHead>Page</TableHead>
                    <TableHead>Record ID</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map(log => (
                    <TableRow key={log.id}>
                      <TableCell>{new Date(log.created_at).toLocaleString()}</TableCell>
                      <TableCell>{log.deleted_by_name}</TableCell>
                      <TableCell>{log.table_name}</TableCell>
                      <TableCell>{log.record_id}</TableCell>
                      <TableCell>
                        <pre className="max-w-xs whitespace-pre-wrap text-xs bg-muted p-2 rounded overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DeletionLogsPage; 