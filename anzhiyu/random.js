var posts=["2025/02/15/哦耶~/","2025/02/22/网站上线一周/"];function toRandomPost(){
    pjax.loadUrl('/'+posts[Math.floor(Math.random() * posts.length)]);
  };