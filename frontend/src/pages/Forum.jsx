import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import '../styles/Forum.css';

function Forum() {
  const { user, isAuthenticated } = useAuth();
  const [currentUserId] = useState(user?.id || ('user-' + Date.now()));
  const [currentUserName] = useState(user?.fullName || 'You');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newPost, setNewPost] = useState({ title: '', content: '' });
  const [showPostForm, setShowPostForm] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyContent, setReplyContent] = useState('');

  useEffect(() => {
    checkBackendConnection();
    loadPosts();
  }, []);

  const checkBackendConnection = async () => {
    try {
      await axios.get('`${process.env.REACT_APP_API_URL || `${process.env.REACT_APP_API_URL || "http://localhost:4000"}`"}`/api/health', { timeout: 3000 });
    } catch (err) {
      console.error('Backend not reachable:', err);
    }
  };

  const loadPosts = async () => {
    try {
      const res = await axios.get('`${process.env.REACT_APP_API_URL || `${process.env.REACT_APP_API_URL || "http://localhost:4000"}`"}`/api/forum/posts', { timeout: 5000 });
      setPosts(res.data.posts || []);
    } catch (err) {
      console.error('Error loading posts:', err);
      if (err.code === 'ECONNREFUSED' || err.response?.status === 404) {
        alert('⚠️ Cannot connect to backend server. Please ensure the backend is running on `${process.env.REACT_APP_API_URL || `${process.env.REACT_APP_API_URL || "http://localhost:4000"}`"}`');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePostSubmit = async (e) => {
    e.preventDefault();
    if (!newPost.title || !newPost.content) {
      alert('Please fill in title and content');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await axios.post('`${process.env.REACT_APP_API_URL || `${process.env.REACT_APP_API_URL || "http://localhost:4000"}`"}`/api/forum/posts', {
        title: newPost.title,
        content: newPost.content,
        author: currentUserName,
        authorId: currentUserId
      }, {
        timeout: 10000,
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (res.data.success) {
        await loadPosts(); // Reload posts from server
        setNewPost({ title: '', content: '' });
        setShowPostForm(false);
        alert('Post created successfully!');
      } else {
        throw new Error(res.data.error || 'Post creation failed');
      }
    } catch (err) {
      console.error('Error creating post:', err);
      let errorMsg = 'Failed to create post. ';
      if (err.code === 'ECONNREFUSED' || err.response?.status === 404) {
        errorMsg += 'Backend server is not running. Please start the backend server on port 4000.';
      } else {
        errorMsg += err.response?.data?.detail || err.response?.data?.error || err.message;
      }
      alert(errorMsg);
    }
  };

  const handleReply = async (postId) => {
    if (!replyContent.trim()) {
      alert('Please enter a reply');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(``${process.env.REACT_APP_API_URL || `${process.env.REACT_APP_API_URL || "http://localhost:4000"}`"}`/api/forum/posts/${postId}/reply`, {
        content: replyContent,
        author: currentUserName,
        authorId: currentUserId
      }, { headers: token ? { Authorization: `Bearer ${token}` } : {} });

      setPosts(posts.map(post => 
        post._id === postId ? res.data.post : post
      ));
      setReplyContent('');
      setReplyingTo(null);
    } catch (err) {
      console.error('Error adding reply:', err);
      alert('Failed to add reply');
    }
  };

  const handleLike = async (postId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(``${process.env.REACT_APP_API_URL || `${process.env.REACT_APP_API_URL || "http://localhost:4000"}`"}`/api/forum/posts/${postId}/like`, {
        authorId: currentUserId
      }, { headers: token ? { Authorization: `Bearer ${token}` } : {} });

      setPosts(posts.map(post => 
        post._id === postId ? { ...post, likes: res.data.likes } : post
      ));
    } catch (err) {
      console.error('Error liking post:', err);
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'ExamSeva Forum',
        text: 'Check out this discussion on ExamSeva!',
        url: window.location.href
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  return (
    <div className="forum-container whatsapp-style">
      <div className="forum-chat-wrapper">
        {/* Chat Header */}
        <div className="chat-header">
          <div className="chat-header-content">
            <div className="chat-title">
            <h1>Study Forum</h1>
              <p className="chat-subtitle">Chat with fellow students</p>
          </div>
            <button 
              onClick={() => {
            if (!isAuthenticated) {
              alert('Please log in to create a post');
              return;
            }
            setShowPostForm(!showPostForm);
              }} 
              className="new-post-btn-chat"
            >
              {showPostForm ? '✕' : '+ New'}
          </button>
          </div>
        </div>

        {/* New Post Form (WhatsApp style) */}
        {showPostForm && (
          <div className="new-post-chat">
              <form onSubmit={handlePostSubmit} className="chat-input-container">
                <input
                  type="text"
                  value={newPost.title}
                  onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                placeholder="Post title..."
                className="chat-title-input"
                  required
                />
                <textarea
                  value={newPost.content}
                  onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                placeholder="Type your message..."
                rows="3"
                className="chat-message-input"
                  required
                />
              <div className="chat-send-container">
                <button 
                  type="submit"
                  className="chat-send-btn"
                  disabled={!newPost.title || !newPost.content}
                >
                  Send
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    setShowPostForm(false);
                    setNewPost({ title: '', content: '' });
                  }} 
                  className="chat-cancel-btn"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Chat Messages */}
        <div className="chat-messages">
          {loading ? (
            <div className="chat-loading">Loading messages...</div>
          ) : (
            <>
              {posts.map(post => (
                <div key={post._id} className="chat-message-wrapper">
                  {/* Main Post Message */}
                  <div className={`chat-message ${post.authorId === currentUserId ? 'sent' : 'received'}`}>
                    <div className="message-avatar">
                      {post.author.charAt(0).toUpperCase()}
                    </div>
                    <div className="message-content">
                      <div className="message-header">
                        <span className="message-author">{post.author}</span>
                        <span className="message-time">
                          {new Date(post.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {post.title && (
                        <div className="message-title">{post.title}</div>
                      )}
                      <div className="message-text">{post.content}</div>
                      <div className="message-actions">
                        <button 
                          className="message-action-btn"
                          onClick={() => setReplyingTo(replyingTo === post._id ? null : post._id)}
                        >
                          Reply
                        </button>
                        <button 
                          className="message-action-btn"
                          onClick={() => handleLike(post._id)}
                        >
                          👍 {post.likes || 0}
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Replies */}
                  {post.replies && post.replies.length > 0 && (
                    <div className="replies-container">
                      {post.replies.map((reply, idx) => (
                        <div 
                          key={idx} 
                          className={`chat-message reply-message ${reply.authorId === currentUserId ? 'sent' : 'received'}`}
                        >
                          <div className="message-avatar small">
                            {reply.author.charAt(0).toUpperCase()}
                          </div>
                          <div className="message-content">
                            <div className="message-header">
                              <span className="message-author">{reply.author}</span>
                              <span className="message-time">
                                {new Date(reply.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div className="message-text">{reply.content}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Reply Input */}
                  {replyingTo === post._id && (
                    <div className="reply-input-container">
                      <textarea
                        value={replyContent}
                        onChange={(e) => setReplyContent(e.target.value)}
                        placeholder="Type a reply..."
                        rows="2"
                        className="chat-message-input"
                      />
                      <div className="chat-send-container">
                        <button 
                          onClick={() => handleReply(post._id)} 
                          className="chat-send-btn"
                          disabled={!replyContent.trim()}
                        >
                          Send
                        </button>
                        <button 
                          onClick={() => {
                          setReplyingTo(null);
                          setReplyContent('');
                          }} 
                          className="chat-cancel-btn"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {posts.length === 0 && (
                <div className="chat-empty">
                  <p>No messages yet. Start the conversation!</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Forum;
