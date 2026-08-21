document.addEventListener('DOMContentLoaded', async () => {
  // Use pathname or fallback slug
  const postSlug = window.location.pathname.replace(/^\/|\.html$/g, '') || 'home';
  const commentsList = document.getElementById('comments-list');
  const commentForm = document.getElementById('comment-form');
  const statusMsg = document.getElementById('comment-status');
  const submitBtn = document.getElementById('comment-submit-btn');

  // Prevent XSS
  function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }

  // 1. Fetch & Render Comments
  async function loadComments() {
    const { data: comments, error } = await supabase
      .from('comments')
      .select('id, created_at, author_name, content')
      .eq('post_slug', postSlug)
      .eq('is_approved', true)
      .order('created_at', { ascending: true });

    if (error) {
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
  }

  // 2. Handle Submissions
  commentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    submitBtn.disabled = true;
    statusMsg.textContent = 'Posting...';

    const author_name = document.getElementById('comment-name').value.trim();
    const author_email = document.getElementById('comment-email').value.trim() || null;
    const content = document.getElementById('comment-body').value.trim();

    const { error } = await supabase.from('comments').insert([
      { post_slug: postSlug, author_name, author_email, content }
    ]);

    if (error) {
      statusMsg.textContent = 'Failed to post comment. Please try again.';
      statusMsg.className = 'comment-status error';
    } else {
      statusMsg.textContent = 'Comment posted successfully!';
      statusMsg.className = 'comment-status success';
      commentForm.reset();
      loadComments();
    }
    submitBtn.disabled = false;
  });

  loadComments();
});
