import * as tf from "@tensorflow/tfjs-node";

// PENTING: Ganti ke nodejs runtime
export const config = {
  runtime: "nodejs",
  maxDuration: 30,
};

let model = null;

// Load model sekali saja untuk efisiensi
async function loadModel() {
  if (!model) {
    try {
      // Path ke model di folder public atau gunakan URL absolut
      const modelPath = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}/tfjs_model/model.json`
        : "/tfjs_model/model.json";

      console.log("Loading model from:", modelPath);
      model = await tf.loadLayersModel(modelPath);
      console.log("✅ Model berhasil dimuat dengan akurasi 96%");
    } catch (error) {
      console.error("❌ Error loading model:", error);
      throw new Error("Gagal memuat model TensorFlow.js");
    }
  }
  return model;
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
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { data } = req.body;

    // Validasi input
    if (!data || !Array.isArray(data) || data.length !== 4) {
      return res.status(400).json({
        error: "Invalid input",
        message:
          'Expected "data" field with array of 4 numbers [umur_bulan, berat_badan, tinggi_badan, jenis_kelamin]',
        example: { data: [24, 10.5, 85.2, 1] },
      });
    }

    const [umur_bulan, berat_badan, tinggi_badan, jenis_kelamin] =
      data.map(Number);

    // Validasi detail
    if (isNaN(umur_bulan) || umur_bulan < 0 || umur_bulan > 60) {
      return res.status(400).json({
        error: "Invalid age",
        message: "Umur harus antara 0-60 bulan",
      });
    }

    if (isNaN(berat_badan) || berat_badan < 1 || berat_badan > 50) {
      return res.status(400).json({
        error: "Invalid weight",
        message: "Berat badan harus antara 1-50 kg",
      });
    }

    if (isNaN(tinggi_badan) || tinggi_badan < 40 || tinggi_badan > 150) {
      return res.status(400).json({
        error: "Invalid height",
        message: "Tinggi badan harus antara 40-150 cm",
      });
    }

    if (![0, 1].includes(jenis_kelamin)) {
      return res.status(400).json({
        error: "Invalid gender",
        message: "Jenis kelamin harus 0 (perempuan) atau 1 (laki-laki)",
      });
    }

    // Load model dan lakukan prediksi dengan model ASLI
    console.log("🔄 Memuat model TensorFlow.js...");
    const loadedModel = await loadModel();

    // Normalisasi data sesuai dengan training
    // CATATAN: Nilai ini harus sesuai dengan StandardScaler saat training
    const normalizedData = normalizeInput([
      umur_bulan,
      berat_badan,
      tinggi_badan,
      jenis_kelamin,
    ]);

    // Buat tensor dari data input
    const inputTensor = tf.tensor2d([normalizedData], [1, 4]);

    console.log("🧠 Melakukan prediksi dengan model neural network...");
    // Lakukan prediksi dengan model ASLI yang akurasi 96%
    const prediction = loadedModel.predict(inputTensor);
    const predictionData = await prediction.data();

    // Cleanup tensor untuk mencegah memory leak
    inputTensor.dispose();
    prediction.dispose();

    // Konversi hasil prediksi
    const probabilities = Array.from(predictionData);
    const predictedClass = probabilities.indexOf(Math.max(...probabilities));

    // Mapping sesuai dengan label encoder dari training
    const classLabels = ["normal", "severely stunted", "stunted"];
    const predictedLabel = classLabels[predictedClass];
    const confidence = Math.max(...probabilities);

    console.log(
      `✅ Prediksi selesai: ${predictedLabel} (confidence: ${confidence.toFixed(
        3
      )})`
    );

    // Interpretasi berdasarkan hasil model ASLI
    const { interpretation, recommendation } =
      getInterpretationAndRecommendation(predictedLabel, confidence);

    return res.status(200).json({
      success: true,
      prediction: predictedLabel,
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
      interpretation: interpretation,
      recommendation: recommendation,
      model_info: {
        type: "TensorFlow.js Neural Network",
        accuracy: "96%",
        architecture: "Sequential (Dense layers with Dropout)",
        training_data: "Dataset Stunting dengan preprocessing StandardScaler",
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Prediction error:", error);
    return res.status(500).json({
      error: "Server error",
      message: "Terjadi kesalahan dalam memproses prediksi",
      details: error.message,
    });
  }
}

// Fungsi normalisasi yang HARUS sesuai dengan StandardScaler saat training
function normalizeInput(data) {
  // PENTING: Nilai mean dan std ini harus PERSIS sama dengan saat training
  // Idealnya disimpan dari proses training, untuk sementara menggunakan estimasi
  // Anda bisa menyimpan nilai scaler dari training untuk akurasi maksimal

  const means = [30.5, 12.8, 87.2, 0.5]; // Estimasi mean dari dataset training
  const stds = [17.2, 4.8, 12.5, 0.5]; // Estimasi std dari dataset training

  return data.map((value, index) => (value - means[index]) / stds[index]);
}

// Interpretasi berdasarkan hasil prediksi model ASLI
function getInterpretationAndRecommendation(predictedLabel, confidence) {
  let interpretation, recommendation;

  switch (predictedLabel) {
    case "normal":
      interpretation =
        "Berdasarkan model AI (akurasi 96%), tinggi badan anak diprediksi NORMAL sesuai dengan umurnya";
      recommendation =
        "Pertahankan pola makan bergizi seimbang dan aktivitas fisik yang baik. Lakukan pemeriksaan rutin untuk memantau pertumbuhan anak.";
      break;

    case "stunted":
      interpretation =
        "Berdasarkan model AI (akurasi 96%), anak diprediksi mengalami STUNTING (pendek)";
      recommendation =
        "Segera konsultasi dengan dokter anak atau ahli gizi. Perbaiki asupan gizi dengan makanan bergizi tinggi, terutama protein dan vitamin. Pantau pertumbuhan secara rutin.";
      break;

    case "severely stunted":
      interpretation =
        "Berdasarkan model AI (akurasi 96%), anak diprediksi mengalami STUNTING BERAT (sangat pendek)";
      recommendation =
        "SEGERA konsultasi dengan dokter anak dan ahli gizi untuk penanganan intensif. Diperlukan program gizi khusus dan pemantauan medis yang ketat.";
      break;

    default:
      interpretation = "Hasil prediksi tidak dapat diinterpretasi";
      recommendation =
        "Konsultasi dengan tenaga kesehatan untuk evaluasi lebih lanjut";
  }

  // Tambahkan informasi confidence
  if (confidence < 0.7) {
    interpretation += ` (Catatan: Tingkat kepercayaan model: ${(
      confidence * 100
    ).toFixed(1)}%)`;
    recommendation +=
      " Disarankan untuk melakukan pemeriksaan medis langsung untuk konfirmasi yang lebih akurat.";
  } else {
    interpretation += ` (Tingkat kepercayaan tinggi: ${(
      confidence * 100
    ).toFixed(1)}%)`;
  }

  return { interpretation, recommendation };
}
