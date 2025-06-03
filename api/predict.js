const tf = require("@tensorflow/tfjs-node");
const fs = require("fs");
const path = require("path");

let model = null;

// Load model sekali saja
async function loadModel() {
  if (!model) {
    try {
      const modelPath = path.join(process.cwd(), "tfjs_model", "model.json");
      model = await tf.loadLayersModel(`file://${modelPath}`);
      console.log("Model berhasil dimuat");
    } catch (error) {
      console.error("Error loading model:", error);
      throw error;
    }
  }
  return model;
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method tidak diizinkan",
      message: "Gunakan POST method untuk prediksi",
    });
  }

  try {
    const { data } = req.body;

    if (!data || !Array.isArray(data)) {
      return res.status(400).json({
        error: "Data tidak valid",
        message: "Data harus berupa array angka",
      });
    }

    // Load model
    const loadedModel = await loadModel();

    // Konversi data ke tensor
    const inputTensor = tf.tensor2d([data]);

    // Lakukan prediksi
    const prediction = loadedModel.predict(inputTensor);
    const result = await prediction.data();

    // Cleanup tensor
    inputTensor.dispose();
    prediction.dispose();

    // Interpretasi hasil prediksi
    const probability = result[0];
    const isStunting = probability > 0.5;

    res.status(200).json({
      success: true,
      prediction: {
        probability: probability,
        isStunting: isStunting,
        status: isStunting ? "Berisiko Stunting" : "Normal",
        confidence: Math.max(probability, 1 - probability) * 100,
      },
    });
  } catch (error) {
    console.error("Error dalam prediksi:", error);
    res.status(500).json({
      error: "Terjadi kesalahan server",
      message: error.message,
    });
  }
}
