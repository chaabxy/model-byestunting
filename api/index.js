export default function handler(req, res) {
  const baseUrl = `${req.headers["x-forwarded-proto"] || "http"}://${req.headers.host}`

  res.status(200).json({
    message: "Stunting Prediction API",
    status: "running",
    version: "1.0.0",
    runtime: "nodejs",
    endpoints: {
      health: `${baseUrl}/api/health`,
      predict: `${baseUrl}/api/predict`,
    },
    usage: {
      predict: {
        method: "POST",
        url: `${baseUrl}/api/predict`,
        body: {
          data: [24, 10.5, 85.2, 1],
        },
        description: "Array of [umur_bulan, berat_badan, tinggi_badan, jenis_kelamin(1=laki-laki, 0=perempuan)]",
      },
    },
  })
}
