export interface ForumPost {
  id: string;
  title: string;
  content: string;
  created_at: string;
  author_id: string;
  updated_at?: string;
  is_edited?: boolean;
  attachments: string[];
  likes: Array<{
    userId: string;
    isLike: boolean;
    userName: string;
  }> | string | any[];
  author?: {
    first_name: string;
    last_name: string;
    email: string;
    role?: string;
  } | null;
}

export interface ForumComment {
  id: string;
  post_id: string;
  content: string;
  created_at: string;
  author_id: string;
  updated_at?: string;
  is_edited?: boolean;
  parent_comment_id?: string | null;
  likes: Array<{
    userId: string;
    isLike: boolean;
    userName: string;
  }> | string | any[];
  author?: {
    first_name: string;
    last_name: string;
    email: string;
    role?: string;
  } | null;
}

export interface ForumNotification {
  id: string;
  user_id: string;
  type: 'post_created' | 'comment_created' | 'comment_reply' | 'post_edited' | 'post_deleted' | 'post_liked' | 'post_disliked' | 'comment_liked' | 'comment_disliked';
  content: string;
  source_id: string;
  is_read: boolean;
  created_at: string;
}
