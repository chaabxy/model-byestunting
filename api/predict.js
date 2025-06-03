// Menggunakan dynamic import untuk mengurangi bundle size
let tf = null

// Cache untuk model yang sudah di-load
let model = null

// Statistik dari training data untuk normalisasi
const FEATURE_STATS = {
  mean: [29.5, 12.8, 89.4, 0.5],
  std: [17.2, 4.1, 15.8, 0.5],
}

// Label mapping
const LABEL_MAPPING = {
  0: "normal",
  1: "severely stunted",
  2: "stunted",
}

async function initTensorFlow() {
  if (!tf) {
    // Dynamic import untuk mengurangi cold start
    tf = await import("@tensorflow/tfjs")
    // Set backend ke CPU untuk konsistensi
    await tf.setBackend("cpu")
  }
  return tf
}

async function loadModel(baseUrl) {
  if (!model) {
    try {
      await initTensorFlow()
      // Load model dari URL public
      const modelUrl = `${baseUrl}/tfjs_model/model.json`
      model = await tf.loadLayersModel(modelUrl)
      console.log("Model loaded successfully from:", modelUrl)
    } catch (error) {
      console.error("Error loading model:", error)
      throw new Error(`Failed to load ML model: ${error.message}`)
    }
  }
  return model
}

function normalizeInput(data) {
  return data.map((value, index) => {
    return (value - FEATURE_STATS.mean[index]) / FEATURE_STATS.std[index]
  })
}

function getInterpretationAndRecommendation(prediction) {
  const interpretations = {
    normal: {
      interpretation: "Tinggi badan anak sesuai dengan umurnya berdasarkan prediksi model ML",
      recommendation: "Pertahankan pola makan bergizi dan aktivitas fisik yang baik",
    },
    stunted: {
      interpretation: "Model memprediksi anak mengalami stunting ringan",
      recommendation: "Perbaiki asupan gizi, konsultasi dengan ahli gizi, dan pantau pertumbuhan secara rutin",
    },
    "severely stunted": {
      interpretation: "Model memprediksi anak mengalami stunting berat",
      recommendation: "Segera konsultasi dengan dokter anak dan ahli gizi untuk penanganan intensif",
    },
  }

  return interpretations[prediction] || interpretations["normal"]
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")

  // CORS Preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end()
  }

  // Hanya izinkan POST
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
      message: "Hanya metode POST yang diizinkan",
    })
  }

  try {
    const { data } = req.body

    // Validasi input
    if (!data || !Array.isArray(data) || data.length !== 4) {
      return res.status(400).json({
        error: "Invalid input",
        message: 'Expected "data" field with array of 4 numbers [umur_bulan, berat_badan, tinggi_badan, jenis_kelamin]',
        example: { data: [24, 10.5, 85.2, 1] },
      })
    }

    const [umur_bulan, berat_badan, tinggi_badan, jenis_kelamin] = data.map(Number)

    // Validasi input
    if (isNaN(umur_bulan) || umur_bulan < 0 || umur_bulan > 60) {
      return res.status(400).json({
        error: "Invalid age",
        message: "Umur harus antara 0-60 bulan",
      })
    }

    if (![0, 1].includes(jenis_kelamin)) {
      return res.status(400).json({
        error: "Invalid gender",
        message: "Jenis kelamin harus 0 (perempuan) atau 1 (laki-laki)",
      })
    }

    if (isNaN(berat_badan) || berat_badan < 1 || berat_badan > 50) {
      return res.status(400).json({
        error: "Invalid weight",
        message: "Berat badan harus antara 1-50 kg",
      })
    }

    if (isNaN(tinggi_badan) || tinggi_badan < 40 || tinggi_badan > 150) {
      return res.status(400).json({
        error: "Invalid height",
        message: "Tinggi badan harus antara 40-150 cm",
      })
    }

    // Get base URL untuk load model
    const protocol = req.headers["x-forwarded-proto"] || "http"
    const host = req.headers.host
    const baseUrl = `${protocol}://${host}`

    // Load model ML
    const mlModel = await loadModel(baseUrl)

    // Normalisasi input data
    const normalizedData = normalizeInput([umur_bulan, berat_badan, tinggi_badan, jenis_kelamin])

    // Buat tensor untuk prediksi
    const inputTensor = tf.tensor2d([normalizedData], [1, 4])

    // Lakukan prediksi
    const prediction = mlModel.predict(inputTensor)
    const predictionData = await prediction.data()

    // Cleanup tensors
    inputTensor.dispose()
    prediction.dispose()

    // Konversi hasil prediksi
    const probabilities = Array.from(predictionData)
    const predictedClassIndex = probabilities.indexOf(Math.max(...probabilities))
    const predictedClass = LABEL_MAPPING[predictedClassIndex]
    const confidence = probabilities[predictedClassIndex]

    // Get interpretation dan recommendation
    const { interpretation, recommendation } = getInterpretationAndRecommendation(predictedClass)

    return res.status(200).json({
      success: true,
      prediction: predictedClass,
      confidence: confidence.toFixed(3),
      probabilities: {
        normal: probabilities[0].toFixed(3),
        "severely stunted": probabilities[1].toFixed(3),
        stunted: probabilities[2].toFixed(3),
      },
      input: {
        umur_bulan: umur_bulan,
        berat_badan: berat_badan,
        tinggi_badan: tinggi_badan,
        jenis_kelamin: jenis_kelamin === 1 ? "Laki-laki" : "Perempuan",
      },
      model_info: {
        type: "Neural Network",
        framework: "TensorFlow.js Browser",
        features_used: ["umur_bulan", "berat_badan", "tinggi_badan", "jenis_kelamin"],
      },
      interpretation: interpretation,
      recommendation: recommendation,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Prediction error:", error)
    return res.status(500).json({
      error: "Server error",
      message: "Terjadi kesalahan dalam memproses data dengan model ML",
      details: error.message,
    })
  }
}
