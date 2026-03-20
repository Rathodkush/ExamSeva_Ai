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
      await axios.get(`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/api/health`, { timeout: 3000 });
    } catch (err) {
      console.error('Backend not reachable:', err);
    }
  };

  const loadPosts = async () => {
    try {
      const res = await axios.get(`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/api/forum/posts`, { timeout: 5000 });
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
      const res = await axios.post(`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/api/forum/posts`, {
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
      const res = await axios.post(`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/api/forum/posts/${postId}/reply`, {
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
      const res = await axios.post(`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/api/forum/posts/${postId}/like`, {
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
    <div className="forum-container">
      <div className="forum-hero">
        <div className="hero-content">
          <h1>Community Forum</h1>
          <p>Ask questions, share knowledge, and learn with fellow students.</p>
          <div className="forum-controls">
            <div className="search-box">
              <input type="text" placeholder="Search discussions..." />
            </div>
            <button 
              className="ask-btn"
              onClick={() => {
                if (!isAuthenticated) {
                  alert('Please log in to create a post');
                  return;
                }
                setShowPostForm(!showPostForm);
              }}
            >
              {showPostForm ? '✕ Close Form' : '+ Ask a Question'}
            </button>
          </div>
        </div>
      </div>

      <div className="forum-main">
        {showPostForm && (
          <div className="post-form-card">
            <h3>Create New Discussion</h3>
            <form onSubmit={handlePostSubmit}>
              <input
                type="text"
                value={newPost.title}
                onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                placeholder="What is your question about?"
                required
              />
              <textarea
                value={newPost.content}
                onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                placeholder="Describe your question or share your thoughts..."
                required
              />
              <div className="form-actions">
                <button type="submit" className="submit-btn" disabled={loading}>
                  {loading ? 'Posting...' : 'Post Discussion'}
                </button>
                <button type="button" className="cancel-btn" onClick={() => setShowPostForm(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="posts-list">
          {loading ? (
            <div className="loading-state">Loading discussions...</div>
          ) : (
            posts.map(post => (
              <div key={post._id} className="post-card">
                <div className="post-header">
                  <div className="author-avatar">{post.author.charAt(0).toUpperCase()}</div>
                  <div className="author-info">
                    <h4>{post.author}</h4>
                    <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="post-body">
                  <h3>{post.title}</h3>
                  <p>{post.content}</p>
                </div>
                <div className="post-footer">
                  <div className="post-stats">
                    <button onClick={() => handleLike(post._id)} className="stat-btn">
                      👍 {post.likes || 0}
                    </button>
                    <button onClick={() => setReplyingTo(replyingTo === post._id ? null : post._id)} className="stat-btn">
                      💬 {post.replies?.length || 0}
                    </button>
                  </div>
                  <button className="share-btn" onClick={handleShare}>Share</button>
                </div>

                {replyingTo === post._id && (
                  <div className="reply-section">
                    <div className="existing-replies">
                      {post.replies?.map((reply, i) => (
                        <div key={i} className="reply-item">
                          <strong>{reply.author}:</strong> {reply.content}
                        </div>
                      ))}
                    </div>
                    <div className="reply-input">
                      <textarea
                        value={replyContent}
                        onChange={(e) => setReplyContent(e.target.value)}
                        placeholder="Write a reply..."
                      />
                      <button onClick={() => handleReply(post._id)}>Reply</button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default Forum;
