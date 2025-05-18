import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, ThumbsUp, ThumbsDown, MessageSquare, Edit, Trash2, Reply, ChevronDown, ChevronUp, MoreHorizontal } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { refreshSupabaseSchema } from '@/integrations/supabase/client';
import { ForumPost, ForumComment } from '@/types/forum';
import { createNotification } from '@/utils/notificationService';
import { UserRole } from '@/utils/permissions';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

// Define ForumUser type for notification filtering
interface ForumUser {
  id: string;
  role: string;
  [key: string]: any;
}

const ForumPage: React.FC = () => {
  const { user, profile } = useAuth();
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [comments, setComments] = useState<Record<string, ForumComment[]>>({});
  const [newPostDialogOpen, setNewPostDialogOpen] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [newCommentContent, setNewCommentContent] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [users, setUsers] = useState<ForumUser[]>([]);
  const [editingPost, setEditingPost] = useState<ForumPost | null>(null);
  const [schemaRefreshed, setSchemaRefreshed] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{commentId: string, postId: string} | null>(null);
  // New state for expanded comments
  const [expandedPosts, setExpandedPosts] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<string>("recent");
  
  // Refresh schema on load to ensure forum tables are recognized
  useEffect(() => {
    const initializeSchema = async () => {
      try {
        console.log("Initializing forum tables schema...");
        // Try to refresh the schema to make sure forum tables are recognized
        const success = await refreshSupabaseSchema();
        setSchemaRefreshed(success);
        if (success) {
          console.log("Schema refresh successful");
        } else {
          console.warn("Schema refresh might not have been successful");
          // Try again after a short delay
          setTimeout(async () => {
            console.log("Retrying schema refresh...");
            const retrySuccess = await refreshSupabaseSchema();
            setSchemaRefreshed(retrySuccess);
            if (retrySuccess) {
              console.log("Schema refresh retry successful");
            } else {
              console.error("Schema refresh retry failed");
            }
          }, 2000);
        }
      } catch (error) {
        console.error("Failed to refresh schema:", error);
        // Continue anyway - we'll retry on any API calls
      }
    };
    
    initializeSchema();
  }, []);
  
  // Fetch forum posts and users
  useEffect(() => {
    const fetchPosts = async () => {
      setIsLoading(true);
      try {
        // Ensure schema is refreshed
        if (!schemaRefreshed) {
          await refreshSupabaseSchema();
        }
        
        // Fetch users for notifications
        const { data: usersData, error: usersError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, role')
          .order('first_name', { ascending: true });
          
        if (usersError) throw usersError;
        setUsers(usersData || []);
        
        // Fix: Use simpler query to avoid foreign key relationship issues
        const { data: postsData, error: postsError } = await supabase
          .from('forum_posts')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (postsError) throw postsError;
        
        // If posts are fetched, then fetch author details for each post
        if (postsData && postsData.length > 0) {
          const postsWithAuthors = await Promise.all(
            postsData.map(async (post) => {
              // Fetch author details
              const { data: authorData } = await supabase
                .from('profiles')
                .select('first_name, last_name, email, role')
                .eq('id', post.author_id)
                .single();
                
              return {
                ...post,
                author: authorData || null,
                attachments: [] // Ensure this field exists
              };
            })
          );
          
          setPosts(postsWithAuthors);
          
          // Fetch comments for all posts
          const allComments: Record<string, ForumComment[]> = {};
          
          for (const post of postsData) {
            // Simple query to avoid foreign key relationship issues
            const { data: commentsData, error: commentsError } = await supabase
              .from('forum_comments')
              .select('*')
              .eq('post_id', post.id)
              .order('created_at', { ascending: true });
              
            if (commentsError) throw commentsError;
            
            // If comments exist, fetch author details for each comment
            if (commentsData && commentsData.length > 0) {
              const commentsWithAuthors = await Promise.all(
                commentsData.map(async (comment) => {
                  // Fetch author details
                  const { data: authorData } = await supabase
                    .from('profiles')
                    .select('first_name, last_name, email, role')
                    .eq('id', comment.author_id)
                    .single();
                    
                  return {
                    ...comment,
                    author: authorData || null
                  };
                })
              );
              
              allComments[post.id] = commentsWithAuthors;
            } else {
              allComments[post.id] = [];
            }
          }
          
          setComments(allComments);
        } else {
        setPosts([]);
        }
      } catch (error) {
        console.error('Error fetching forum data:', error);
        toast.error('Failed to load forum data');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchPosts();
  }, [schemaRefreshed]);
  
  // Subscribe to real-time updates for posts and comments
  useEffect(() => {
    // Posts
    const postsChannel = supabase
      .channel('forum-posts-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'forum_posts' }, () => {
        // Refetch posts and comments when posts change
        if (schemaRefreshed) {
          // Only refetch if schema is ready
          (async () => {
            await refreshSupabaseSchema();
            // Trigger the fetchPosts effect
            setSchemaRefreshed(false);
            setTimeout(() => setSchemaRefreshed(true), 100);
          })();
        }
      })
      .subscribe();
    // Comments
    const commentsChannel = supabase
      .channel('forum-comments-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'forum_comments' }, () => {
        if (schemaRefreshed) {
          (async () => {
            await refreshSupabaseSchema();
            setSchemaRefreshed(false);
            setTimeout(() => setSchemaRefreshed(true), 100);
          })();
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(postsChannel);
      supabase.removeChannel(commentsChannel);
    };
  }, [schemaRefreshed]);
  
  // New function to toggle comments section
  const toggleComments = (postId: string) => {
    setExpandedPosts(prev => ({
      ...prev,
      [postId]: !prev[postId]
    }));
  };

  // Create new forum post
  const handleCreatePost = async () => {
    if (!user || !newPostTitle.trim() || !newPostContent.trim()) return;
    
    setIsLoading(true);
    try {
      // Try to refresh schema if not already done
      if (!schemaRefreshed) {
        await refreshSupabaseSchema();
      }
      
      console.log("Creating new post");
      
      // Create the post
      const { data, error } = await supabase
        .from('forum_posts')
        .insert({
          title: newPostTitle.trim(),
          content: newPostContent.trim(),
          author_id: user.id,
          likes: '[]',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_edited: false
        })
        .select();
      
      if (error) {
        console.error('Error creating post:', error);
        throw error;
      }
      
      console.log("Post created successfully:", data);
      
      if (data && data[0]) {
        // Add new post to state
        const newPost: ForumPost = {
          ...(data[0] as any),
          author: {
            first_name: profile?.first_name || '',
            last_name: profile?.last_name || '',
            email: user.email || ''
          },
          likes: [],
          attachments: []
        };
        
        setPosts([newPost, ...posts]);
        setComments({
          ...comments,
          [newPost.id]: []
        });
        
        // Close the dialog
        setNewPostDialogOpen(false);
        
        // Reset form
        setNewPostTitle('');
        setNewPostContent('');
        
        // Create notifications for all users about the new post
        if (users.length > 0) {
          try {
            // Batch notifications in groups to avoid hitting rate limits
            const batchSize = 5;
            const nonViewerUsers = filterNonViewerUsers(users).filter(u => u.id !== user.id);
            
            for (let i = 0; i < nonViewerUsers.length; i += batchSize) {
              const batch = nonViewerUsers.slice(i, i + batchSize);
              
              const notificationsToInsert = batch.map(u => ({
                user_id: u.id,
                type: 'post_created',
                content: `${profile?.first_name || ''} ${profile?.last_name || ''} created a new post: ${newPost.title}`,
                source_id: newPost.id,
                is_read: false,
                created_at: new Date().toISOString()
              }));
              
              if (notificationsToInsert.length > 0) {
                await supabase
                  .from('notifications')
                  .insert(notificationsToInsert);
              }
              
              // Small delay between batches to avoid rate limits
              if (i + batchSize < nonViewerUsers.length) {
                await new Promise(resolve => setTimeout(resolve, 300));
              }
            }
            
            console.log(`Notifications created for ${nonViewerUsers.length} users about new post`);
          } catch (notifError) {
            console.error('Error creating post notifications:', notifError);
          }
        }
        
      toast.success('Post created successfully');
      }
    } catch (error: any) {
      console.error('Error creating post:', error);
      toast.error(`Failed to create post: ${error.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Update an existing post
  const handleUpdatePost = async () => {
    if (!user || !editingPost || !newPostTitle.trim() || !newPostContent.trim()) return;
    
    setIsLoading(true);
    try {
      // Try to refresh schema if not already done
      if (!schemaRefreshed) {
        await refreshSupabaseSchema();
      }
      
      const { error } = await supabase
        .from('forum_posts')
        .update({
          title: newPostTitle.trim(),
          content: newPostContent.trim(),
        })
        .eq('id', editingPost.id);
        
      if (error) throw error;
      
      // Update post in state
      const updatedPosts = posts.map(p => 
        p.id === editingPost.id 
          ? { 
              ...p, 
              title: newPostTitle.trim(), 
              content: newPostContent.trim(),
              is_edited: true
            } 
          : p
      );
      
      setPosts(updatedPosts);
      
      // Create notifications for post edit
      if (users.length > 0) {
        const notificationPromises = users.map(async (u) => {
          if (u.id !== user.id) {
            return (supabase
              .from('notifications')
              .insert({
                user_id: u.id,
                type: 'post_edited',
                content: `${profile?.first_name} ${profile?.last_name} edited a post: ${newPostTitle}`,
                source_id: editingPost.id
              }));
          }
          return Promise.resolve();
        });
        
        await Promise.all(notificationPromises);
      }
      
      toast.success('Post updated successfully');
      setNewPostDialogOpen(false);
      setEditingPost(null);
      setNewPostTitle('');
      setNewPostContent('');
    } catch (error: any) {
      console.error('Error updating post:', error);
      toast.error(`Failed to update post: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Delete post
  const handleDeletePost = async (postId: string) => {
    if (!user) return;
    if (!confirm('Are you sure you want to delete this post?')) {
      return;
    }
    setIsLoading(true);
    try {
      if (!schemaRefreshed) {
        await refreshSupabaseSchema();
      }
      const post = posts.find(p => p.id === postId);
      if (post) {
        await supabase.from('deletion_logs').insert({
          table_name: 'forum_posts',
          record_id: postId,
          deleted_by: user?.id || '',
          deleted_by_name: (user?.user_metadata?.full_name || user?.email || ''),
          details: post,
        });
        // Send notification to admins/superadmins
        await createNotification({
          userId: user.id,
          type: 'forum_post_deleted',
          content: `${user?.user_metadata?.full_name || user?.email || ''} deleted forum post: ${post.title}`,
          link: '/forum',
        });
      }
      const { error } = await supabase
        .from('forum_posts')
        .delete()
        .eq('id', postId);
      if (error) throw error;
      setPosts(posts.filter(p => p.id !== postId));
      toast.success('Post deleted successfully');
    } catch (error) {
      console.error('Error deleting post:', error);
      toast.error(`Failed to delete post: ${error instanceof Error ? error.message : error}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Comment on a post or reply to a comment
  const handleAddComment = async (postId: string) => {
    if (!user || !newCommentContent[postId]?.trim()) return;
    
    setIsLoading(true);
    try {
      // Try to refresh schema if not already done
      if (!schemaRefreshed) {
        await refreshSupabaseSchema();
      }
      
      console.log("Adding comment or reply to post:", postId);
      console.log("Replying to:", replyingTo);
      
      const commentContent = newCommentContent[postId].trim();
      
      // Prepare comment data
      const commentData = {
        post_id: postId,
        content: commentContent,
        author_id: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_edited: false,
        likes: '[]',
        ...(replyingTo && replyingTo.postId === postId 
          ? { parent_comment_id: replyingTo.commentId } 
          : {})
      };
      
      // Insert the comment
      const { data, error } = await supabase
        .from('forum_comments')
        .insert(commentData)
        .select('*');
        
      if (error) {
        console.error('Error inserting comment:', error);
        throw error;
      }
      
      console.log("Comment added successfully:", data);
      
      if (data && data[0]) {
        // Get profile data for the new comment
        const { data: profileData } = await supabase
          .from('profiles')
          .select('first_name, last_name, email')
          .eq('id', user.id)
          .single();
          
        // Add new comment to state with author information
        const newComment: ForumComment = {
          ...(data[0] as any),
          author: {
            first_name: profileData?.first_name || profile?.first_name || '',
            last_name: profileData?.last_name || profile?.last_name || '',
            email: profileData?.email || user.email || ''
          },
          likes: []
        };
        
        // Update the comments state
        const postComments = comments[postId] || [];
        setComments({
          ...comments,
          [postId]: [...postComments, newComment]
        });
        
        // Reset the comment form for this post
      setNewCommentContent({
        ...newCommentContent,
        [postId]: ''
      });
      
        // Get the post for notifications
        const post = posts.find(p => p.id === postId);
        
        // If this is a reply to another comment, notify that comment's author
        if (replyingTo && replyingTo.commentId) {
          const parentComment = postComments.find(c => c.id === replyingTo.commentId);
          
          if (parentComment && parentComment.author_id !== user.id) {
            try {
              const notificationData = {
                user_id: parentComment.author_id,
                type: 'comment_reply',
                content: `${profile?.first_name || ''} ${profile?.last_name || ''} replied to your comment`,
                source_id: newComment.id,
                is_read: false,
                created_at: new Date().toISOString()
              };
              
              await supabase
                .from('notifications')
                .insert(notificationData);
                
              console.log('Notification created for comment reply');
            } catch (notifError) {
              console.error('Error creating reply notification:', notifError);
            }
          }
          
          // Reset the replying state
          setReplyingTo(null);
        }
        
        // Create notification for post author about the new comment
        if (post && post.author_id !== user.id) {
          try {
            const notificationData = {
              user_id: post.author_id,
              type: 'comment_created',
              content: `${profile?.first_name || ''} ${profile?.last_name || ''} commented on your post: ${post.title}`,
              source_id: postId,
              is_read: false,
              created_at: new Date().toISOString()
            };
            
            await supabase
              .from('notifications')
              .insert(notificationData);
              
            console.log('Notification created for post author');
          } catch (notifError) {
            console.error('Error creating post comment notification:', notifError);
          }
        }
        
        // Create notifications for all other users (global forum activity)
        if (users.length > 0) {
          try {
            // Batch notifications in groups to avoid hitting rate limits
            const batchSize = 5;
            const otherUsers = filterNonViewerUsers(users).filter(u => 
              u.id !== user.id && 
              u.id !== post?.author_id && 
              (!replyingTo || !postComments.find(c => c.id === replyingTo.commentId)?.author_id || 
               u.id !== postComments.find(c => c.id === replyingTo.commentId)?.author_id)
            );
            
            for (let i = 0; i < otherUsers.length; i += batchSize) {
              const batch = otherUsers.slice(i, i + batchSize);
              
              const notificationsToInsert = batch.map(u => ({
                user_id: u.id,
                type: replyingTo ? 'comment_reply_created' : 'comment_created',
                content: `${profile?.first_name || ''} ${profile?.last_name || ''} ${replyingTo ? 'replied to a comment' : 'commented'} on a post: ${post?.title || 'Forum post'}`,
                source_id: postId,
                is_read: false,
                created_at: new Date().toISOString()
              }));
              
              if (notificationsToInsert.length > 0) {
                await supabase
                  .from('notifications')
                  .insert(notificationsToInsert);
              }
              
              // Small delay between batches to avoid rate limits
              if (i + batchSize < otherUsers.length) {
                await new Promise(resolve => setTimeout(resolve, 300));
              }
            }
            
            console.log(`Notifications created for ${otherUsers.length} other users`);
          } catch (notifError) {
            console.error('Error creating notifications for other users:', notifError);
          }
        }
      
        toast.success(replyingTo ? 'Reply added' : 'Comment added');
      }
    } catch (error: any) {
      console.error('Error adding comment:', error);
      toast.error(`Failed to add comment: ${error.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Like or dislike a comment
  const handleLikeComment = async (commentId: string, isLike: boolean) => {
    if (!user) return;
    let foundComment: ForumComment | undefined;
    let foundPostId: string | undefined;
    for (const [postId, postComments] of Object.entries(comments)) {
      const comment = postComments.find(c => c.id === commentId);
      if (comment) {
        foundComment = comment;
        foundPostId = postId;
        break;
      }
    }
    if (!foundComment || !foundPostId) {
      toast.error('Comment not found');
      return;
    }
    try {
      if (!schemaRefreshed) {
        await refreshSupabaseSchema();
      }
      // Fetch latest likes from DB
      const { data: latestComment, error: fetchError } = await supabase
        .from('forum_comments')
        .select('likes')
        .eq('id', commentId)
        .single();
      if (fetchError) throw fetchError;
      let currentLikes = [];
      if (latestComment && latestComment.likes) {
        try {
          if (typeof latestComment.likes === 'string') {
            currentLikes = JSON.parse(latestComment.likes);
          } else if (Array.isArray(latestComment.likes)) {
            currentLikes = latestComment.likes;
          }
        } catch (e) {
          currentLikes = [];
        }
      }
      if (!Array.isArray(currentLikes)) currentLikes = [];
      const userLikeIndex = currentLikes.findIndex(like => like.userId === user.id);
      let newLikes;
      if (userLikeIndex >= 0) {
        const currentLike = currentLikes[userLikeIndex];
        if (currentLike.isLike === isLike) {
          newLikes = [...currentLikes.slice(0, userLikeIndex), ...currentLikes.slice(userLikeIndex + 1)];
        } else {
          newLikes = [...currentLikes];
          newLikes[userLikeIndex] = {
            userId: user.id,
            isLike,
            userName: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim()
          };
        }
      } else {
        newLikes = [...currentLikes, {
          userId: user.id,
          isLike,
          userName: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim()
        }];
      }
      const likesString = JSON.stringify(newLikes);
      // Update the comment likes directly
      const { error: updateError } = await supabase
        .from('forum_comments')
        .update({ likes: likesString })
        .eq('id', commentId);
      
      if (updateError) throw updateError;
      // Refetch comment likes from DB to update state
      const { data: updatedComment, error: refetchError } = await supabase
        .from('forum_comments')
        .select('likes')
        .eq('id', commentId)
        .single();
      if (refetchError) throw refetchError;
      const updatedComments = { ...comments };
      for (const postId in updatedComments) {
        updatedComments[postId] = updatedComments[postId].map(c =>
          c.id === commentId ? { ...c, likes: updatedComment && updatedComment.likes ? updatedComment.likes : [] } : c
        );
      }
      setComments(updatedComments);
      
      // Send notification to comment author about the like/dislike
      if (foundComment && foundComment.author_id !== user.id) {
        try {
          await supabase
            .from('notifications')
            .insert({
              user_id: foundComment.author_id,
              type: isLike ? 'comment_liked' : 'comment_disliked',
              content: `${profile?.first_name || ''} ${profile?.last_name || ''} ${isLike ? 'liked' : 'disliked'} your comment`,
              source_id: commentId,
              is_read: false,
              created_at: new Date().toISOString()
            });
          
          console.log('Notification created for comment like/dislike');
        } catch (notifError) {
          console.error('Error creating comment like notification:', notifError);
        }
      }
      toast.success(isLike ? 'Comment liked' : 'Comment disliked');
    } catch (error: any) {
      console.error('Error updating comment likes:', error);
      toast.error(`Failed to update comment like: ${error.message || 'Unknown error'}`);
    }
  };
  
  // Like or dislike a post
  const handleLikePost = async (postId: string, isLike: boolean) => {
    if (!user) return;
    const post = posts.find(p => p.id === postId);
    if (!post) {
      console.error('Post not found:', postId);
      toast.error('Post not found');
      return;
    }
    try {
      if (!schemaRefreshed) {
        await refreshSupabaseSchema();
      }
      // Fetch latest likes from DB
      const { data: latestPost, error: fetchError } = await supabase
        .from('forum_posts')
        .select('likes')
        .eq('id', postId)
        .single();
      if (fetchError) throw fetchError;
      let currentLikes = [];
      if (latestPost && latestPost.likes) {
        try {
          if (typeof latestPost.likes === 'string') {
            currentLikes = JSON.parse(latestPost.likes);
          } else if (Array.isArray(latestPost.likes)) {
            currentLikes = latestPost.likes;
          }
        } catch (e) {
          currentLikes = [];
        }
      }
      if (!Array.isArray(currentLikes)) currentLikes = [];
      const userLikeIndex = currentLikes.findIndex(like => like.userId === user.id);
      let newLikes;
      if (userLikeIndex >= 0) {
        const currentLike = currentLikes[userLikeIndex];
        if (currentLike.isLike === isLike) {
          newLikes = [...currentLikes.slice(0, userLikeIndex), ...currentLikes.slice(userLikeIndex + 1)];
        } else {
          newLikes = [...currentLikes];
          newLikes[userLikeIndex] = {
            userId: user.id,
            isLike,
            userName: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim()
          };
        }
      } else {
        newLikes = [...currentLikes, {
          userId: user.id,
          isLike,
          userName: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim()
        }];
      }
      const likesString = JSON.stringify(newLikes);
      // Update post likes directly
      const { error: updateError } = await supabase
        .from('forum_posts')
        .update({ likes: likesString })
        .eq('id', postId);
      
      if (updateError) throw updateError;
      // Refetch post likes from DB to update state
      const { data: updatedPost, error: refetchError } = await supabase
        .from('forum_posts')
        .select('likes')
        .eq('id', postId)
        .single();
      if (refetchError) throw refetchError;
      setPosts(posts.map(p => p.id === postId ? { ...p, likes: updatedPost && updatedPost.likes ? updatedPost.likes : [] } : p));
      
      // Send notification to post author about the like/dislike
      if (post.author_id !== user.id) {
        try {
          await supabase
            .from('notifications')
            .insert({
              user_id: post.author_id,
              type: isLike ? 'post_liked' : 'post_disliked',
              content: `${profile?.first_name || ''} ${profile?.last_name || ''} ${isLike ? 'liked' : 'disliked'} your post: ${post.title}`,
              source_id: postId,
              is_read: false,
              created_at: new Date().toISOString()
            });
          
          console.log('Notification created for post like/dislike');
        } catch (notifError) {
          console.error('Error creating post like notification:', notifError);
        }
      }
      toast.success(isLike ? 'Post liked' : 'Post disliked');
    } catch (error: any) {
      console.error('Error updating likes:', error);
      toast.error(`Failed to update like: ${error.message || 'Unknown error'}`);
    }
  };
  
  // Helper function to start replying to a comment
  const startReplyingToComment = (commentId: string, postId: string) => {
    setReplyingTo({ commentId, postId });
    
    // Focus on the comment input field
    setNewCommentContent({
      ...newCommentContent,
      [postId]: newCommentContent[postId] || ''
    });
    
    // Scroll to the comment form
    setTimeout(() => {
      const commentForm = document.getElementById(`comment-form-${postId}`);
      commentForm?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };
  
  // Start editing a post
  const handleEditPost = (post: ForumPost) => {
    setEditingPost(post);
    setNewPostTitle(post.title);
    setNewPostContent(post.content);
    setNewPostDialogOpen(true);
  };
  
  // Format display names and dates
  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`;
  };
  
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };
  
  const getLikesData = (likes: any): Array<{userId: string; isLike: boolean; userName: string}> => {
    if (!likes) return [];
    if (typeof likes === 'string') {
      try {
        return JSON.parse(likes) || [];
      } catch (e) {
        return [];
      }
    }
    return Array.isArray(likes) ? likes : [];
  };
  
  const getLikesCount = (likes: any, isLike: boolean): number => {
    const likesData = getLikesData(likes);
    return likesData.filter(like => like && like.isLike === isLike).length;
  };
  
  const getLikeStatus = (likes: any, userId?: string): 'like' | 'dislike' | null => {
    if (!userId) return null;
    const likesData = getLikesData(likes);
    const userLike = likesData.find(like => like && like.userId === userId);
    if (!userLike) return null;
    return userLike.isLike ? 'like' : 'dislike';
  };
  
  const getLikeUsersList = (likes: any, isLike: boolean): string => {
    const likesData = getLikesData(likes);
    const filteredLikes = likesData.filter(like => like && like.isLike === isLike);
    if (filteredLikes.length === 0) return 'No one yet';
    
    const names = filteredLikes.map(like => like.userName || 'Anonymous').join('\n');
    return names;
  };
  
  // Helper to get parent-child comment structure
  const getCommentThreads = (postComments: ForumComment[]) => {
    // Separate parent comments and replies
    const parentComments = postComments.filter(c => !c.parent_comment_id);
    const childComments = postComments.filter(c => c.parent_comment_id);
    
    // Create a map of parent comments with their replies
    const commentThreads = parentComments.map(parentComment => {
      const replies = childComments.filter(c => c.parent_comment_id === parentComment.id);
      return {
        parent: parentComment,
        replies
      };
    });
    
    return commentThreads;
  };
  
  // Helper to filter out viewer users
  const filterNonViewerUsers = (users: ForumUser[]) => users.filter(u => u.role !== 'viewer');
  
  // Function to get color for user avatar based on role
  const getUserRoleColor = (role?: string): string => {
    switch (role) {
      case 'superadmin':
        return 'bg-red-500 text-white';
      case 'admin':
        return 'bg-blue-500 text-white';
      case 'special':
        return 'bg-green-500 text-white';
      case 'viewer':
        return 'bg-amber-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };
  
  // Filter posts based on active tab
  const getFilteredPosts = () => {
    if (activeTab === "recent") {
      return [...posts].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    } else if (activeTab === "popular") {
      return [...posts].sort((a, b) => {
        const aLikes = getLikesCount(a.likes, true) - getLikesCount(a.likes, false);
        const bLikes = getLikesCount(b.likes, true) - getLikesCount(b.likes, false);
        return bLikes - aLikes;
      });
    }
    return posts;
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Committee Forum</h1>
          <p className="text-muted-foreground">
            Engage with other committee members, share ideas, and discuss topics
          </p>
        </div>
        <Button 
          className="bg-zarfuel-blue hover:bg-zarfuel-blue/90"
          onClick={() => {
            setEditingPost(null);
            setNewPostTitle('');
            setNewPostContent('');
            setNewPostDialogOpen(true);
          }}
        >
          <MessageSquare className="h-4 w-4 mr-2" />
          New Post
        </Button>
      </div>
      
      <Tabs defaultValue="recent" value={activeTab} onValueChange={setActiveTab}>
        <div className="flex justify-between items-center mb-4">
          <TabsList>
            <TabsTrigger value="recent">Recent Posts</TabsTrigger>
            <TabsTrigger value="popular">Popular</TabsTrigger>
          </TabsList>
        </div>
      
        <TabsContent value="recent" className="mt-0">
          {isLoading && posts.length === 0 ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-3 text-muted-foreground">Loading forum posts...</span>
            </div>
          ) : posts.length === 0 ? (
            <Card className="text-center p-8">
              <CardContent>
                <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium">No posts yet</p>
                <p className="text-muted-foreground mt-1">Be the first to start a discussion!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {getFilteredPosts().map(post => (
                <Card key={post.id} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback className={getUserRoleColor(post.author?.role)}>
                            {getInitials(post.author?.first_name || '', post.author?.last_name || '')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {post.author?.first_name} {post.author?.last_name}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {formatDate(post.created_at)}
                            </span>
                            {post.is_edited && (
                              <span className="text-xs text-muted-foreground italic">(edited)</span>
                            )}
                          </div>
                          <CardTitle className="text-base mt-1">{post.title}</CardTitle>
                        </div>
                      </div>
                      
                      {user && post.author_id === user.id && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditPost(post)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDeletePost(post.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </CardHeader>
                  
                  <CardContent className="pb-3 pt-0">
                    <div className="text-sm whitespace-pre-wrap">{post.content}</div>
                  </CardContent>
                  
                  <CardFooter className="flex justify-between border-t pt-3 pb-2">
                    <div className="flex space-x-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="flex items-center gap-1 text-xs"
                        onClick={() => handleLikePost(post.id, true)}
                      >
                        <ThumbsUp className="h-4 w-4" 
                          fill={
                            getLikeStatus(post.likes, user?.id) === 'like' ? 'currentColor' : 'none'
                          }
                        />
                        <span title={getLikeUsersList(post.likes, true)}>
                          {getLikesCount(post.likes, true)}
                        </span>
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="flex items-center gap-1 text-xs"
                        onClick={() => handleLikePost(post.id, false)}
                      >
                        <ThumbsDown className="h-4 w-4"
                          fill={
                            getLikeStatus(post.likes, user?.id) === 'dislike' ? 'currentColor' : 'none'
                          }
                        />
                        <span title={getLikeUsersList(post.likes, false)}>
                          {getLikesCount(post.likes, false)}
                        </span>
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="flex items-center gap-1 text-xs"
                        onClick={() => toggleComments(post.id)}
                      >
                        <MessageSquare className="h-4 w-4" />
                        <span>{comments[post.id]?.length || 0}</span>
                        {expandedPosts[post.id] ? (
                          <ChevronUp className="h-3 w-3 ml-1" />
                        ) : (
                          <ChevronDown className="h-3 w-3 ml-1" />
                        )}
                      </Button>
                    </div>
                  </CardFooter>
                  
                  {/* Comments section - only visible when expanded */}
                  {expandedPosts[post.id] && (
                    <div className="bg-muted/30 px-6 py-3 border-t">
                      {comments[post.id] && comments[post.id].length > 0 ? (
                        <>
                          {getCommentThreads(comments[post.id]).map(thread => (
                            <div key={thread.parent.id} className="mb-6">
                              {/* Parent comment */}
                              <div className="flex items-start gap-3 mb-2">
                                <Avatar className="h-8 w-8 mt-0.5">
                                  <AvatarFallback className={`text-xs ${getUserRoleColor(thread.parent.author?.role)}`}>
                                    {getInitials(thread.parent.author?.first_name || '', thread.parent.author?.last_name || '')}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                  <div className="bg-background rounded-lg p-3">
                                    <div className="font-semibold text-sm">
                                      {thread.parent.author?.first_name} {thread.parent.author?.last_name}
                                    </div>
                                    <div className="text-sm mt-1">{thread.parent.content}</div>
                                  </div>
                                  <div className="flex items-center gap-4 mt-1">
                                    <div className="text-xs text-muted-foreground">
                                      {formatDate(thread.parent.created_at)}
                                      {thread.parent.is_edited && <span className="ml-2 italic">(edited)</span>}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-6 px-2 text-xs flex items-center gap-1"
                                        onClick={() => handleLikeComment(thread.parent.id, true)}
                                      >
                                        <ThumbsUp className="h-3 w-3" 
                                          fill={
                                            getLikeStatus(thread.parent.likes, user?.id) === 'like' ? 'currentColor' : 'none'
                                          }
                                        />
                                        <span>{getLikesCount(thread.parent.likes, true)}</span>
                                      </Button>
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-6 px-2 text-xs flex items-center gap-1"
                                        onClick={() => handleLikeComment(thread.parent.id, false)}
                                      >
                                        <ThumbsDown className="h-3 w-3"
                                          fill={
                                            getLikeStatus(thread.parent.likes, user?.id) === 'dislike' ? 'currentColor' : 'none'
                                          }
                                        />
                                        <span>{getLikesCount(thread.parent.likes, false)}</span>
                                      </Button>
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-6 px-2 text-xs flex items-center gap-1"
                                        onClick={() => startReplyingToComment(thread.parent.id, post.id)}
                                      >
                                        <Reply className="h-3 w-3" />
                                        <span>Reply</span>
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Replies */}
                              {thread.replies.length > 0 && (
                                <div className="ml-11 pl-6 border-l-2 border-muted">
                                  {thread.replies.map(reply => (
                                    <div key={reply.id} className="flex items-start gap-3 mb-3">
                                      <Avatar className="h-7 w-7 mt-0.5">
                                        <AvatarFallback className={`text-xs ${getUserRoleColor(reply.author?.role)}`}>
                                          {getInitials(reply.author?.first_name || '', reply.author?.last_name || '')}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div className="flex-1">
                                        <div className="bg-background rounded-lg p-2">
                                          <div className="font-semibold text-xs">
                                            {reply.author?.first_name} {reply.author?.last_name}
                                          </div>
                                          <div className="text-sm mt-1">{reply.content}</div>
                                        </div>
                                        <div className="flex items-center gap-4 mt-1">
                                          <div className="text-xs text-muted-foreground">
                                            {formatDate(reply.created_at)}
                                            {reply.is_edited && <span className="ml-2 italic">(edited)</span>}
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <Button 
                                              variant="ghost" 
                                              size="sm" 
                                              className="h-5 px-1.5 text-xs flex items-center gap-1"
                                              onClick={() => handleLikeComment(reply.id, true)}
                                            >
                                              <ThumbsUp className="h-3 w-3" 
                                                fill={
                                                  getLikeStatus(reply.likes, user?.id) === 'like' ? 'currentColor' : 'none'
                                                }
                                              />
                                              <span>{getLikesCount(reply.likes, true)}</span>
                                            </Button>
                                            <Button 
                                              variant="ghost" 
                                              size="sm" 
                                              className="h-5 px-1.5 text-xs flex items-center gap-1"
                                              onClick={() => handleLikeComment(reply.id, false)}
                                            >
                                              <ThumbsDown className="h-3 w-3"
                                                fill={
                                                  getLikeStatus(reply.likes, user?.id) === 'dislike' ? 'currentColor' : 'none'
                                                }
                                              />
                                              <span>{getLikesCount(reply.likes, false)}</span>
                                            </Button>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </>
                      ) : (
                        <div className="text-center py-3">
                          <p className="text-sm text-muted-foreground">No comments yet. Be the first to comment!</p>
                        </div>
                      )}
                      
                      {/* New comment form */}
                      {user && (
                        <div className="flex items-start gap-3 mt-4" id={`comment-form-${post.id}`}>
                          <Avatar className="h-8 w-8 mt-0.5">
                            <AvatarFallback className={getUserRoleColor(profile?.role)}>
                              {getInitials(profile?.first_name || '', profile?.last_name || '')}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 flex items-end gap-2">
                            <Textarea
                              placeholder={replyingTo && replyingTo.postId === post.id 
                                ? "Write a reply..." 
                                : "Write a comment..."}
                              className="min-h-10 flex-1"
                              value={newCommentContent[post.id] || ''}
                              onChange={(e) => setNewCommentContent({
                                ...newCommentContent,
                                [post.id]: e.target.value
                              })}
                            />
                            <Button 
                              size="sm" 
                              className="h-8"
                              disabled={!newCommentContent[post.id]?.trim() || isLoading}
                              onClick={() => handleAddComment(post.id)}
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                      
                      {/* Show who you're replying to */}
                      {replyingTo && replyingTo.postId === post.id && (
                        <div className="ml-11 mt-2 text-xs text-muted-foreground flex items-center">
                          <span>
                            Replying to comment - 
                            <Button 
                              variant="link" 
                              className="h-auto p-0 text-xs" 
                              onClick={() => setReplyingTo(null)}
                            >
                              Cancel
                            </Button>
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="popular" className="mt-0">
          <div className="space-y-4">
            {getFilteredPosts().map(post => (
              <Card key={post.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback className={getUserRoleColor(post.author?.role)}>
                          {getInitials(post.author?.first_name || '', post.author?.last_name || '')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {post.author?.first_name} {post.author?.last_name}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {formatDate(post.created_at)}
                          </span>
                          {post.is_edited && (
                            <span className="text-xs text-muted-foreground italic">(edited)</span>
                          )}
                        </div>
                        <CardTitle className="text-base mt-1">{post.title}</CardTitle>
                      </div>
                    </div>
                    
                    {user && post.author_id === user.id && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditPost(post)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDeletePost(post.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </CardHeader>
                
                <CardContent className="pb-3 pt-0">
                  <div className="text-sm whitespace-pre-wrap">{post.content}</div>
                </CardContent>
                
                <CardFooter className="flex justify-between border-t pt-3 pb-2">
                  <div className="flex space-x-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="flex items-center gap-1 text-xs"
                      onClick={() => handleLikePost(post.id, true)}
                    >
                      <ThumbsUp className="h-4 w-4" 
                        fill={
                          getLikeStatus(post.likes, user?.id) === 'like' ? 'currentColor' : 'none'
                        }
                      />
                      <span title={getLikeUsersList(post.likes, true)}>
                        {getLikesCount(post.likes, true)}
                      </span>
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="flex items-center gap-1 text-xs"
                      onClick={() => handleLikePost(post.id, false)}
                    >
                      <ThumbsDown className="h-4 w-4"
                        fill={
                          getLikeStatus(post.likes, user?.id) === 'dislike' ? 'currentColor' : 'none'
                        }
                      />
                      <span title={getLikeUsersList(post.likes, false)}>
                        {getLikesCount(post.likes, false)}
                      </span>
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="flex items-center gap-1 text-xs"
                      onClick={() => toggleComments(post.id)}
                    >
                      <MessageSquare className="h-4 w-4" />
                      <span>{comments[post.id]?.length || 0}</span>
                      {expandedPosts[post.id] ? (
                        <ChevronUp className="h-3 w-3 ml-1" />
                      ) : (
                        <ChevronDown className="h-3 w-3 ml-1" />
                      )}
                    </Button>
                  </div>
                </CardFooter>
                
                {/* Comments section - only visible when expanded */}
                {expandedPosts[post.id] && (
                  <div className="bg-muted/30 px-6 py-3 border-t">
                    {comments[post.id] && comments[post.id].length > 0 ? (
                      <>
                        {getCommentThreads(comments[post.id]).map(thread => (
                          <div key={thread.parent.id} className="mb-6">
                            {/* Parent comment */}
                            <div className="flex items-start gap-3 mb-2">
                              <Avatar className="h-8 w-8 mt-0.5">
                                <AvatarFallback className={`text-xs ${getUserRoleColor(thread.parent.author?.role)}`}>
                                  {getInitials(thread.parent.author?.first_name || '', thread.parent.author?.last_name || '')}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1">
                                <div className="bg-background rounded-lg p-3">
                                  <div className="font-semibold text-sm">
                                    {thread.parent.author?.first_name} {thread.parent.author?.last_name}
                                  </div>
                                  <div className="text-sm mt-1">{thread.parent.content}</div>
                                </div>
                                <div className="flex items-center gap-4 mt-1">
                                  <div className="text-xs text-muted-foreground">
                                    {formatDate(thread.parent.created_at)}
                                    {thread.parent.is_edited && <span className="ml-2 italic">(edited)</span>}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="h-6 px-2 text-xs flex items-center gap-1"
                                      onClick={() => handleLikeComment(thread.parent.id, true)}
                                    >
                                      <ThumbsUp className="h-3 w-3" 
                                        fill={
                                          getLikeStatus(thread.parent.likes, user?.id) === 'like' ? 'currentColor' : 'none'
                                        }
                                      />
                                      <span>{getLikesCount(thread.parent.likes, true)}</span>
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="h-6 px-2 text-xs flex items-center gap-1"
                                      onClick={() => handleLikeComment(thread.parent.id, false)}
                                    >
                                      <ThumbsDown className="h-3 w-3"
                                        fill={
                                          getLikeStatus(thread.parent.likes, user?.id) === 'dislike' ? 'currentColor' : 'none'
                                        }
                                      />
                                      <span>{getLikesCount(thread.parent.likes, false)}</span>
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="h-6 px-2 text-xs flex items-center gap-1"
                                      onClick={() => startReplyingToComment(thread.parent.id, post.id)}
                                    >
                                      <Reply className="h-3 w-3" />
                                      <span>Reply</span>
                                    </Button>
                                  </div>
                                </div>
                              </div>

                              {/* Replies */}
                              {thread.replies.length > 0 && (
                                <div className="ml-11 pl-6 border-l-2 border-muted">
                                  {thread.replies.map(reply => (
                                    <div key={reply.id} className="flex items-start gap-3 mb-3">
                                      <Avatar className="h-7 w-7 mt-0.5">
                                        <AvatarFallback className={`text-xs ${getUserRoleColor(reply.author?.role)}`}>
                                          {getInitials(reply.author?.first_name || '', reply.author?.last_name || '')}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div className="flex-1">
                                        <div className="bg-background rounded-lg p-2">
                                          <div className="font-semibold text-xs">
                                            {reply.author?.first_name} {reply.author?.last_name}
                                          </div>
                                          <div className="text-sm mt-1">{reply.content}</div>
                                        </div>
                                        <div className="flex items-center gap-4 mt-1">
                                          <div className="text-xs text-muted-foreground">
                                            {formatDate(reply.created_at)}
                                            {reply.is_edited && <span className="ml-2 italic">(edited)</span>}
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <Button 
                                              variant="ghost" 
                                              size="sm" 
                                              className="h-5 px-1.5 text-xs flex items-center gap-1"
                                              onClick={() => handleLikeComment(reply.id, true)}
                                            >
                                              <ThumbsUp className="h-3 w-3" 
                                                fill={
                                                  getLikeStatus(reply.likes, user?.id) === 'like' ? 'currentColor' : 'none'
                                                }
                                              />
                                              <span>{getLikesCount(reply.likes, true)}</span>
                                            </Button>
                                            <Button 
                                              variant="ghost" 
                                              size="sm" 
                                              className="h-5 px-1.5 text-xs flex items-center gap-1"
                                              onClick={() => handleLikeComment(reply.id, false)}
                                            >
                                              <ThumbsDown className="h-3 w-3"
                                                fill={
                                                  getLikeStatus(reply.likes, user?.id) === 'dislike' ? 'currentColor' : 'none'
                                                }
                                              />
                                              <span>{getLikesCount(reply.likes, false)}</span>
                                            </Button>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </>
                    ) : (
                      <div className="text-center py-3">
                        <p className="text-sm text-muted-foreground">No comments yet. Be the first to comment!</p>
                      </div>
                    )}
                    
                    {/* New comment form */}
                    {user && (
                      <div className="flex items-start gap-3 mt-4" id={`comment-form-${post.id}`}>
                        <Avatar className="h-8 w-8 mt-0.5">
                          <AvatarFallback className={getUserRoleColor(profile?.role)}>
                            {getInitials(profile?.first_name || '', profile?.last_name || '')}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 flex items-end gap-2">
                          <Textarea
                            placeholder={replyingTo && replyingTo.postId === post.id 
                              ? "Write a reply..." 
                              : "Write a comment..."}
                            className="min-h-10 flex-1"
                            value={newCommentContent[post.id] || ''}
                            onChange={(e) => setNewCommentContent({
                              ...newCommentContent,
                              [post.id]: e.target.value
                            })}
                          />
                          <Button 
                            size="sm" 
                            className="h-8"
                            disabled={!newCommentContent[post.id]?.trim() || isLoading}
                            onClick={() => handleAddComment(post.id)}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    {/* Show who you're replying to */}
                    {replyingTo && replyingTo.postId === post.id && (
                      <div className="ml-11 mt-2 text-xs text-muted-foreground flex items-center">
                        <span>
                          Replying to comment - 
                          <Button 
                            variant="link" 
                            className="h-auto p-0 text-xs" 
                            onClick={() => setReplyingTo(null)}
                          >
                            Cancel
                          </Button>
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
      
      {/* New Post / Edit Post Dialog */}
      <Dialog open={newPostDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setEditingPost(null);
          setNewPostTitle('');
          setNewPostContent('');
        }
        setNewPostDialogOpen(open);
      }}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>{editingPost ? 'Edit Post' : 'Create New Post'}</DialogTitle>
            <DialogDescription>
              {editingPost 
                ? 'Update your post content and title.' 
                : 'Start a new discussion topic or share information with the committee.'}
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[calc(80vh-180px)]">
            <div className="space-y-4 p-1">
              <div className="space-y-2">
                <label htmlFor="post-title" className="text-sm font-medium">
                  Title
                </label>
                <Input
                  id="post-title"
                  placeholder="Enter post title"
                  value={newPostTitle}
                  onChange={(e) => setNewPostTitle(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="post-content" className="text-sm font-medium">
                  Content
                </label>
                <Textarea
                  id="post-content"
                  placeholder="Write your post content here..."
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  rows={8}
                />
              </div>
            </div>
          </ScrollArea>
          
          <div className="flex gap-2 justify-end pt-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setNewPostDialogOpen(false);
                setEditingPost(null);
                setNewPostTitle('');
                setNewPostContent('');
              }}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button 
              onClick={editingPost ? handleUpdatePost : handleCreatePost}
              disabled={isLoading || !newPostTitle.trim() || !newPostContent.trim()}
            >
              {isLoading ? 'Saving...' : editingPost ? 'Update Post' : 'Create Post'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ForumPage;

