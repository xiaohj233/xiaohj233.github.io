var posts=["posts/undefined/","posts/undefined/","posts/undefined/","posts/undefined/","posts/undefined/","posts/undefined/","posts/undefined/","posts/undefined/","posts/undefined/","posts/undefined/","posts/undefined/"];function toRandomPost(){
    pjax.loadUrl('/'+posts[Math.floor(Math.random() * posts.length)]);
  };