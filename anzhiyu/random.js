var posts=["2025/02/15/哦耶~/","2025/02/22/网站上线一周/","2025/02/23/先帝更新未半，而中道放弃/","2025/03/15/朋友的意义/","2025/03/24/c语言-17题/","2025/03/27/网站首次功能升级公告/"];function toRandomPost(){
    pjax.loadUrl('/'+posts[Math.floor(Math.random() * posts.length)]);
  };