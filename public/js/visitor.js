fetch("/api/track-visitor", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    page: window.location.pathname,
    referrer: document.referrer || "Direct"
  })
}).catch(err => console.log("Visitor tracking error:", err));