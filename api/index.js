export default function handler(req, res) {
  res.status(200).json({
    message: "Stunting Prediction API",
    status: "running",
    endpoints: {
      health: "/api/health",
      predict: "/api/predict",
    },
  });
}
