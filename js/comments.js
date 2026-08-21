document.addEventListener('DOMContentLoaded', async () => {
  const postSlug = window.location.pathname.replace(/^\/|\.html$/g, '') || 'home';
  const commentsList = document.getElementById('comments-list');
  const commentForm = document.getElementById('comment-form');
  const statusMsg = document.getElementById('comment-status');
  const submitBtn = document.getElementById('comment-submit-btn');

  // Reference the initialized client instance
  const db = window.supabaseClient;

  function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }

  // 1. Fetch & Render Comments
  async function loadComments() {
    if (!db) {
      console.error('Supabase client is not initialized.');
      return;
    }

    try {
      const { data: comments, error } = await db
        .from('comments')
        .select('id, created_at, author_name, content')
        .eq('post_slug', postSlug)
        .eq('is_approved', true)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching comments:', error);
        commentsList.innerHTML = '<p class="error-state">Unable to load comments.</p>';
        return;
      }

      if (!comments || comments.length === 0) {
        commentsList.innerHTML = '<p class="empty-state">No comments yet. Be the first to share your thoughts!</p>';
        return;
      }

      commentsList.innerHTML = comments.map(comment => `
        <article class="comment-item">
          <header class="comment-header">
            <strong class="comment-author">${escapeHTML(comment.author_name)}</strong>
            <time datetime="${comment.created_at}">
              ${new Date(comment.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
            </time>
          </header>
          <div class="comment-content">
            <p>${escapeHTML(comment.content).replace(/\n/g, '<br>')}</p>
          </div>
        </article>
      `).join('');
    } catch (err) {
      console.error('Fetch exception:', err);
    }
  }

  // 2. Handle Submissions
  commentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    submitBtn.disabled = true;
    statusMsg.textContent = 'Posting...';
    statusMsg.className = 'comment-status';

    const author_name = document.getElementById('comment-name').value.trim();
    const author_email = document.getElementById('comment-email').value.trim() || null;
    const content = document.getElementById('comment-body').value.trim();

    try {
      const { data, error } = await db
        .from('comments')
        .insert([
          {
            post_slug: postSlug,
            author_name: author_name,
            author_email: author_email,
            content: content
          }
        ]);

      if (error) {
        console.error('Supabase insert error:', error);
        statusMsg.textContent = `Error: ${error.message || 'Unable to post comment'}`;
        statusMsg.className = 'comment-status error';
      } else {
        statusMsg.textContent = 'Comment posted successfully!';
        statusMsg.className = 'comment-status success';
        commentForm.reset();
        loadComments();
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      statusMsg.textContent = 'Something went wrong. Please try again.';
      statusMsg.className = 'comment-status error';
    } finally {
      submitBtn.disabled = false;
    }
  });

  loadComments();
});
