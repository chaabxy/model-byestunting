export default function handler(req, res) {
  res.status(200).json({
    status: "OK",
    message: "Stunting Prediction API is running",
    timestamp: new Date().toISOString(),
  });
}
