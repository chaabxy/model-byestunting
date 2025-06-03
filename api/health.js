export default function handler(req, res) {
  res.status(200).json({
    status: "OK",
    message: "Stunting Prediction API is healthy",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    runtime: "nodejs",
  })
}
