self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(self.registration.showNotification(data.title || "Skillsroom", {
    body: data.body || "You have a new chat notification.",
    icon: "/icon.svg",
    badge: "/icon.svg",
    tag: data.tag || "skillsroom-chat",
    data: { url: data.url || "/chat" }
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/chat";
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((windowClient) => "focus" in windowClient);
    return existing ? existing.navigate(target).then(() => existing.focus()) : clients.openWindow(target);
  }));
});
