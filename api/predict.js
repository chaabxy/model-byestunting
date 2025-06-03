export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Import TensorFlow.js di dalam function untuk menghindari cold start issues
    const tf = await import("@tensorflow/tfjs-node");
    const path = await import("path");

    const { data } = req.body;

    if (!data || !Array.isArray(data)) {
      return res.status(400).json({
        error: "Invalid input",
        message: "Expected 'data' field with array of numbers",
      });
    }

    // Load model
    const modelPath = path.join(process.cwd(), "tfjs_model", "model.json");
    const model = await tf.loadLayersModel(`file://${modelPath}`);

    // Make prediction
    const inputTensor = tf.tensor2d([data]);
    const prediction = model.predict(inputTensor);
    const result = await prediction.data();

    // Cleanup
    inputTensor.dispose();
    prediction.dispose();
    model.dispose();

    return res.status(200).json({
      success: true,
      prediction: Array.from(result),
      input: data,
    });
  } catch (error) {
    console.error("Prediction error:", error);
    return res.status(500).json({
      error: "Server error",
      message: error.message,
    });
  }
}
