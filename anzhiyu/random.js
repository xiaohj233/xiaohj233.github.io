var posts=["2025/02/15/哦耶~/","2025/02/22/网站上线一周/","2025/02/23/先帝更新未半，而中道放弃/","2025/03/15/朋友的意义/"];function toRandomPost(){
    pjax.loadUrl('/'+posts[Math.floor(Math.random() * posts.length)]);
  };