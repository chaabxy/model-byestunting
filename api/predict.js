// Dynamic import untuk TensorFlow.js
let tf = null;
let model = null;

// Statistik normalisasi dari training data (sesuai dengan yang ada di notebook)
const FEATURE_STATS = {
  mean: [29.5, 12.8, 89.4, 0.5],
  std: [17.2, 4.1, 15.8, 0.5],
};

// Label mapping sesuai dengan training
const LABEL_MAPPING = {
  0: "normal",
  1: "severely stunted",
  2: "stunted",
};

async function initTensorFlow() {
  if (!tf) {
    // Import TensorFlow.js
    tf = await import("@tensorflow/tfjs");
    // Set backend ke CPU untuk konsistensi
    await tf.setBackend("cpu");
    await tf.ready();
  }
  return tf;
}

async function loadModel(baseUrl) {
  if (!model) {
    try {
      await initTensorFlow();

      // URL model yang benar
      const modelUrl = `${baseUrl}/tfjs_model/model.json`;
      console.log("Loading model from:", modelUrl);

      // Load model dengan error handling yang lebih baik
      model = await tf.loadLayersModel(modelUrl);
      console.log("✅ Model berhasil dimuat dari:", modelUrl);
    } catch (error) {
      console.error("❌ Error loading model:", error);
      throw new Error(`Gagal memuat model ML: ${error.message}`);
    }
  }
  return model;
}

function normalizeInput(data) {
  // Normalisasi sesuai dengan training data
  return data.map((value, index) => {
    return (value - FEATURE_STATS.mean[index]) / FEATURE_STATS.std[index];
  });
}

function getInterpretationAndRecommendation(prediction) {
  const interpretations = {
    normal: {
      interpretation:
        "Tinggi badan anak sesuai dengan umurnya berdasarkan prediksi model ML",
      recommendation:
        "Pertahankan pola makan bergizi dan aktivitas fisik yang baik",
    },
    stunted: {
      interpretation: "Model memprediksi anak mengalami stunting ringan",
      recommendation:
        "Perbaiki asupan gizi, konsultasi dengan ahli gizi, dan pantau pertumbuhan secara rutin",
    },
    "severely stunted": {
      interpretation: "Model memprediksi anak mengalami stunting berat",
      recommendation:
        "Segera konsultasi dengan dokter anak dan ahli gizi untuk penanganan intensif",
    },
  };

  return interpretations[prediction] || interpretations["normal"];
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Hanya izinkan POST
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
      message: "Hanya metode POST yang diizinkan",
    });
  }

  try {
    const { data } = req.body;

    // Validasi input
    if (!data || !Array.isArray(data) || data.length !== 4) {
      return res.status(400).json({
        error: "Input tidak valid",
        message:
          'Diperlukan field "data" berupa array dengan 4 angka [umur_bulan, berat_badan, tinggi_badan, jenis_kelamin]',
        example: { data: [24, 10.5, 85.2, 1] },
      });
    }

    const [umur_bulan, berat_badan, tinggi_badan, jenis_kelamin] =
      data.map(Number);

    // Validasi range input
    if (isNaN(umur_bulan) || umur_bulan < 0 || umur_bulan > 60) {
      return res.status(400).json({
        error: "Umur tidak valid",
        message: "Umur harus antara 0-60 bulan",
      });
    }

    if (![0, 1].includes(jenis_kelamin)) {
      return res.status(400).json({
        error: "Jenis kelamin tidak valid",
        message: "Jenis kelamin harus 0 (perempuan) atau 1 (laki-laki)",
      });
    }

    if (isNaN(berat_badan) || berat_badan < 1 || berat_badan > 50) {
      return res.status(400).json({
        error: "Berat badan tidak valid",
        message: "Berat badan harus antara 1-50 kg",
      });
    }

    if (isNaN(tinggi_badan) || tinggi_badan < 40 || tinggi_badan > 150) {
      return res.status(400).json({
        error: "Tinggi badan tidak valid",
        message: "Tinggi badan harus antara 40-150 cm",
      });
    }

    // Dapatkan base URL
    const protocol = req.headers["x-forwarded-proto"] || "http";
    const host = req.headers.host;
    const baseUrl = `${protocol}://${host}`;

    console.log("🔄 Memuat model ML...");

    // Load model
    const mlModel = await loadModel(baseUrl);

    console.log("🔄 Melakukan normalisasi data...");

    // Normalisasi input
    const normalizedData = normalizeInput([
      umur_bulan,
      berat_badan,
      tinggi_badan,
      jenis_kelamin,
    ]);

    console.log("🔄 Membuat prediksi...");

    // Buat tensor dan lakukan prediksi
    const inputTensor = tf.tensor2d([normalizedData], [1, 4]);
    const prediction = mlModel.predict(inputTensor);
    const predictionData = await prediction.data();

    // Cleanup tensors untuk mencegah memory leak
    inputTensor.dispose();
    prediction.dispose();

    // Proses hasil prediksi
    const probabilities = Array.from(predictionData);
    const predictedClassIndex = probabilities.indexOf(
      Math.max(...probabilities)
    );
    const predictedClass = LABEL_MAPPING[predictedClassIndex];
    const confidence = probabilities[predictedClassIndex];

    // Dapatkan interpretasi dan rekomendasi
    const { interpretation, recommendation } =
      getInterpretationAndRecommendation(predictedClass);

    console.log("✅ Prediksi berhasil:", predictedClass);

    return res.status(200).json({
      success: true,
      prediction: predictedClass,
      confidence: Number.parseFloat(confidence.toFixed(3)),
      probabilities: {
        normal: Number.parseFloat(probabilities[0].toFixed(3)),
        "severely stunted": Number.parseFloat(probabilities[1].toFixed(3)),
        stunted: Number.parseFloat(probabilities[2].toFixed(3)),
      },
      input: {
        umur_bulan: umur_bulan,
        berat_badan: berat_badan,
        tinggi_badan: tinggi_badan,
        jenis_kelamin: jenis_kelamin === 1 ? "Laki-laki" : "Perempuan",
      },
      model_info: {
        type: "Neural Network",
        framework: "TensorFlow.js",
        features_used: [
          "umur_bulan",
          "berat_badan",
          "tinggi_badan",
          "jenis_kelamin",
        ],
        model_source: "tfjs_model/model.json",
      },
      interpretation: interpretation,
      recommendation: recommendation,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Error dalam prediksi:", error);
    return res.status(500).json({
      error: "Server error",
      message: "Terjadi kesalahan dalam memproses prediksi",
      details: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}
