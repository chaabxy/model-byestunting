export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  res.status(200).json({
    status: "OK",
    message: "API Stunting Prediction berjalan dengan baik",
    timestamp: new Date().toISOString(),
    endpoints: {
      predict: "/api/predict (POST)",
      health: "/api/health (GET)",
    },
  });
}
