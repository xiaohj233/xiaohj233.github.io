var posts=["posts/32fe1627/","posts/2395baf2/","posts/c7a123cf/","posts/5fbd7f47/","posts/16f800fe/","posts/1e3d76ff/","posts/f94a695e/","posts/20b4b5b9/","posts/da0134c2/","posts/806dfce3/","posts/e0c9a0da/"];function toRandomPost(){
    pjax.loadUrl('/'+posts[Math.floor(Math.random() * posts.length)]);
  };