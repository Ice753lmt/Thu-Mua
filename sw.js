const CACHE_NAME = "thu-mua-pwa-v1";
const CORE = ["./","./index.html","./style.css","./config.js","./app.js","./manifest.json"];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const req=event.request;
  if(req.method!=="GET" || new URL(req.url).origin!==location.origin) return;
  event.respondWith(fetch(req).then(res=>{
    const copy=res.clone(); caches.open(CACHE_NAME).then(cache=>cache.put(req,copy)); return res;
  }).catch(()=>caches.match(req).then(cached=>cached || caches.match("./index.html"))));
});
self.addEventListener("push", event => {
  let data={title:"Thu Mua",body:"Bạn có thông báo mới.",url:"./"};
  try { if(event.data) data={...data,...event.data.json()}; } catch {}
  event.waitUntil(self.registration.showNotification(data.title,{
    body:data.body,icon:"./assets/icon-192.png",badge:"./assets/icon-192.png",
    data:{url:data.url},tag:data.tag || "thu-mua-notification"
  }));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target=new URL(event.notification.data?.url || "./",self.location.origin).href;
  event.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(list=>{
    for(const client of list){if(client.url===target && "focus" in client)return client.focus();}
    return clients.openWindow ? clients.openWindow(target) : undefined;
  }));
});