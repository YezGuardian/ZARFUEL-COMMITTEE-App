export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      comments: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          task_id: string | null
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          task_id?: string | null
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          task_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          company: string | null
          company_visibility: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          role: string | null
          title: string | null
          updated_at: string
          visibility: string | null
        }
        Insert: {
          company?: string | null
          company_visibility?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          role?: string | null
          title?: string | null
          updated_at?: string
          visibility?: string | null
        }
        Update: {
          company?: string | null
          company_visibility?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          role?: string | null
          title?: string | null
          updated_at?: string
          visibility?: string | null
        }
        Relationships: []
      }
      document_repositories: {
        Row: {
          id: string
          name: string
          url: string
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          url: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          url?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          category: string
          created_at: string
          downloaded_by: Json | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          folder_id: string | null
          id: string
          uploaded_by: string | null
        }
        Insert: {
          category: string
          created_at?: string
          downloaded_by?: Json | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          folder_id?: string | null
          id?: string
          uploaded_by?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          downloaded_by?: Json | null
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          folder_id?: string | null
          id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      event_participants: {
        Row: {
          created_at: string
          event_id: string | null
          id: string
          response: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_id?: string | null
          id?: string
          response?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string | null
          id?: string
          response?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_participants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          end_time: string
          id: string
          is_meeting: boolean | null
          location: string | null
          start_time: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time: string
          id?: string
          is_meeting?: boolean | null
          location?: string | null
          start_time: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time?: string
          id?: string
          is_meeting?: boolean | null
          location?: string | null
          start_time?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      folders: {
        Row: {
          created_at: string | null
          created_by: string | null
          icon: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          icon?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          icon?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      invitations: {
        Row: {
          created_at: string | null
          email: string
          expires_at: string | null
          id: string
          invited_by: string
          organization: string | null
          position: string | null
          role: string
        }
        Insert: {
          created_at?: string | null
          email: string
          expires_at?: string | null
          id?: string
          invited_by: string
          organization?: string | null
          position?: string | null
          role?: string
        }
        Update: {
          created_at?: string | null
          email?: string
          expires_at?: string | null
          id?: string
          invited_by?: string
          organization?: string | null
          position?: string | null
          role?: string
        }
        Relationships: []
      }
      meeting_minutes: {
        Row: {
          created_at: string
          event_id: string | null
          file_name: string
          file_path: string
          id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          event_id?: string | null
          file_name: string
          file_path: string
          id?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string | null
          file_name?: string
          file_path?: string
          id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_minutes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          content: string
          created_at: string
          id: string
          is_read: boolean | null
          link: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          link?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          link?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      phases: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          position: number
          project_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          position?: number
          project_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          position?: number
          project_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "phases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company: string | null
          created_at: string
          email: string
          first_name: string | null
          id: string
          invited_by: string | null
          last_name: string | null
          organization: string | null
          phone: string | null
          position: string | null
          role: string
          title: string | null
          updated_at: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          email: string
          first_name?: string | null
          id: string
          invited_by?: string | null
          last_name?: string | null
          organization?: string | null
          phone?: string | null
          position?: string | null
          role?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          invited_by?: string | null
          last_name?: string | null
          organization?: string | null
          phone?: string | null
          position?: string | null
          role?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          id: string
          phase_id: string | null
          progress_summary: string | null
          responsible_teams: string[] | null
          start_date: string | null
          status: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          phase_id?: string | null
          progress_summary?: string | null
          responsible_teams?: string[] | null
          start_date?: string | null
          status?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          phase_id?: string | null
          progress_summary?: string | null
          responsible_teams?: string[] | null
          start_date?: string | null
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "phases"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_posts: {
        Row: {
          id: string;
          title: string;
          content: string;
          author_id: string;
          created_at: string;
          updated_at: string;
          is_edited: boolean;
          likes: Json; // or string, or Json, depending on your schema
        };
        Insert: {
          id?: string;
          title: string;
          content: string;
          author_id: string;
          created_at?: string;
          updated_at?: string;
          is_edited?: boolean;
          likes?: Json; // or string, or Json
        };
        Update: {
          id?: string;
          title?: string;
          content?: string;
          author_id?: string;
          created_at?: string;
          updated_at?: string;
          is_edited?: boolean;
          likes?: Json; // or string, or Json
        };
        Relationships: [];
      },
      forum_comments: {
        Row: {
          id: string;
          post_id: string;
          content: string;
          author_id: string;
          created_at: string;
          updated_at: string;
          is_edited: boolean;
          likes: Json; // or string, or Json
          parent_comment_id?: string | null;
        };
        Insert: {
          id?: string;
          post_id: string;
          content: string;
          author_id: string;
          created_at?: string;
          updated_at?: string;
          is_edited?: boolean;
          likes?: Json; // or string, or Json
          parent_comment_id?: string | null;
        };
        Update: {
          id?: string;
          post_id?: string;
          content?: string;
          author_id?: string;
          created_at?: string;
          updated_at?: string;
          is_edited?: boolean;
          likes?: Json; // or string, or Json
          parent_comment_id?: string | null;
        };
        Relationships: [];
      },
      budget_categories: {
        Row: {
          id: string;
          name: string;
          estimated: number;
          actual: number;
        };
        Insert: {
          id?: string;
          name: string;
          estimated: number;
          actual: number;
        };
        Update: {
          id?: string;
          name?: string;
          estimated?: number;
          actual?: number;
        };
        Relationships: [];
      },
      risks: {
        Row: {
          id: string;
          name: string;
          category: string;
          impact: 'low' | 'medium' | 'high' | 'critical';
          likelihood: 'low' | 'medium' | 'high';
          status: 'identified' | 'mitigated' | 'ongoing';
          description: string;
          mitigation_strategy: string;
          responsible_person: string;
        };
        Insert: {
          id?: string;
          name: string;
          category: string;
          impact: 'low' | 'medium' | 'high' | 'critical';
          likelihood: 'low' | 'medium' | 'high';
          status: 'identified' | 'mitigated' | 'ongoing';
          description: string;
          mitigation_strategy: string;
          responsible_person: string;
        };
        Update: {
          id?: string;
          name?: string;
          category?: string;
          impact?: 'low' | 'medium' | 'high' | 'critical';
          likelihood?: 'low' | 'medium' | 'high';
          status?: 'identified' | 'mitigated' | 'ongoing';
          description?: string;
          mitigation_strategy?: string;
          responsible_person?: string;
        };
        Relationships: [];
      },
      deletion_logs: {
        Row: {
          id: string;
          table_name: string;
          record_id: string;
          deleted_by: string;
          deleted_by_name: string;
          details: unknown;
          created_at: string;
        };
        Insert: {
          id?: string;
          table_name: string;
          record_id: string;
          deleted_by: string;
          deleted_by_name: string;
          details: unknown;
          created_at?: string;
        };
        Update: {
          id?: string;
          table_name?: string;
          record_id?: string;
          deleted_by?: string;
          deleted_by_name?: string;
          details?: unknown;
          created_at?: string;
        };
        Relationships: [];
      },
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_notification: {
        Args: {
          p_user_id: string
          p_type: string
          p_content: string
          p_link: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
