const assert = require("assert");
const fs = require("fs");
const path = require("path");

(() => {
  const root = path.join(__dirname, "..");
  const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");
  const bell = read("assets", "js", "notifications-bell.js");
  const moduleCode = read("assets", "js", "dashboard", "notifications.js");
  const liveClasses = read("assets", "js", "dashboard", "live-classes.js");

  assert.ok(bell.includes("API.notifications.unreadCount"), "the badge must load unread notifications");
  assert.ok(bell.includes("setBadgeCount(0)"), "opening notifications must immediately reset the badge");
  assert.ok(bell.includes("API.notifications.markInboxViewed"), "opening notifications must persist the read state");
  assert.ok(moduleCode.includes("markNotificationsViewed"), "the Notifications page must mark its inbox as opened");
  assert.ok(liveClasses.includes("updateDashboardNotificationCount"), "live-class notifications must refresh the badge promptly");
  console.log("notification badge regression test passed");
})();
