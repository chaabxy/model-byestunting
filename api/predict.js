import * as tf from "@tensorflow/tfjs-node";

export const config = {
  runtime: "nodejs", // Ganti dari "edge" ke "nodejs"
};

let model = null;

// Load model sekali saja
async function loadModel() {
  if (!model) {
    try {
      model = await tf.loadLayersModel("/tfjs_model/model.json");
      console.log("Model berhasil dimuat");
    } catch (error) {
      console.error("Error loading model:", error);
      throw new Error("Gagal memuat model");
    }
  }
  return model;
}

export default async function handler(req) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  // CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Hanya izinkan POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { data } = body;

    // Validasi input
    if (!data || !Array.isArray(data) || data.length !== 4) {
      return new Response(
        JSON.stringify({
          error: "Invalid input",
          message:
            'Expected "data" field with array of 4 numbers [umur_bulan, berat_badan, tinggi_badan, jenis_kelamin]',
          example: { data: [24, 10.5, 85.2, 1] },
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const [umur_bulan, berat_badan, tinggi_badan, jenis_kelamin] =
      data.map(Number);

    // Validasi angka
    if (isNaN(umur_bulan) || umur_bulan < 0 || umur_bulan > 60) {
      return new Response(
        JSON.stringify({
          error: "Invalid age",
          message: "Umur harus antara 0-60 bulan",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (isNaN(berat_badan) || berat_badan < 1 || berat_badan > 50) {
      return new Response(
        JSON.stringify({
          error: "Invalid weight",
          message: "Berat badan harus antara 1-50 kg",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (isNaN(tinggi_badan) || tinggi_badan < 40 || tinggi_badan > 150) {
      return new Response(
        JSON.stringify({
          error: "Invalid height",
          message: "Tinggi badan harus antara 40-150 cm",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (![0, 1].includes(jenis_kelamin)) {
      return new Response(
        JSON.stringify({
          error: "Invalid gender",
          message: "Jenis kelamin harus 0 (perempuan) atau 1 (laki-laki)",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Load model dan lakukan prediksi
    const loadedModel = await loadModel();

    // Normalisasi data input (sesuai dengan preprocessing saat training)
    // Catatan: Idealnya nilai mean dan std ini harus disimpan dari proses training
    // Untuk sementara menggunakan estimasi berdasarkan data umum
    const normalizedData = normalizeInput([
      umur_bulan,
      berat_badan,
      tinggi_badan,
      jenis_kelamin,
    ]);

    // Buat tensor dari data input
    const inputTensor = tf.tensor2d([normalizedData], [1, 4]);

    // Lakukan prediksi
    const prediction = loadedModel.predict(inputTensor);
    const predictionData = await prediction.data();

    // Cleanup tensor
    inputTensor.dispose();
    prediction.dispose();

    // Konversi hasil prediksi
    const probabilities = Array.from(predictionData);
    const predictedClass = probabilities.indexOf(Math.max(...probabilities));

    // Mapping kelas prediksi ke label
    const classLabels = ["normal", "severely stunted", "stunted"];
    const predictedLabel = classLabels[predictedClass];

    // Hitung confidence
    const confidence = Math.max(...probabilities);

    // Buat interpretasi dan rekomendasi berdasarkan hasil prediksi model
    const { interpretation, recommendation } =
      getInterpretationAndRecommendation(predictedLabel, confidence);

    return new Response(
      JSON.stringify({
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
        model_used: "TensorFlow.js Neural Network",
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Prediction error:", error);
    return new Response(
      JSON.stringify({
        error: "Server error",
        message: "Terjadi kesalahan dalam memproses data",
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}

// Fungsi normalisasi input (sesuai dengan StandardScaler yang digunakan saat training)
function normalizeInput(data) {
  // Nilai mean dan std ini harus sesuai dengan yang digunakan saat training
  // Idealnya disimpan dari proses training, untuk sementara menggunakan estimasi
  const means = [30, 12, 85, 0.5]; // estimasi mean untuk [umur, berat, tinggi, gender]
  const stds = [15, 5, 15, 0.5]; // estimasi std untuk [umur, berat, tinggi, gender]

  return data.map((value, index) => (value - means[index]) / stds[index]);
}

// Fungsi untuk memberikan interpretasi dan rekomendasi berdasarkan hasil prediksi model
function getInterpretationAndRecommendation(predictedLabel, confidence) {
  let interpretation, recommendation;

  switch (predictedLabel) {
    case "normal":
      interpretation =
        "Berdasarkan model AI, tinggi badan anak diprediksi normal sesuai dengan umurnya";
      recommendation =
        "Pertahankan pola makan bergizi seimbang dan aktivitas fisik yang baik. Lakukan pemeriksaan rutin untuk memantau pertumbuhan anak.";
      break;

    case "stunted":
      interpretation =
        "Berdasarkan model AI, anak diprediksi mengalami stunting (pendek)";
      recommendation =
        "Segera konsultasi dengan dokter anak atau ahli gizi. Perbaiki asupan gizi dengan makanan bergizi tinggi, terutama protein dan vitamin. Pantau pertumbuhan secara rutin.";
      break;

    case "severely stunted":
      interpretation =
        "Berdasarkan model AI, anak diprediksi mengalami stunting berat (sangat pendek)";
      recommendation =
        "SEGERA konsultasi dengan dokter anak dan ahli gizi untuk penanganan intensif. Diperlukan program gizi khusus dan pemantauan medis yang ketat.";
      break;

    default:
      interpretation = "Hasil prediksi tidak dapat diinterpretasi";
      recommendation =
        "Konsultasi dengan tenaga kesehatan untuk evaluasi lebih lanjut";
  }

  // Tambahkan catatan confidence
  if (confidence < 0.7) {
    interpretation += ` (Catatan: Tingkat kepercayaan model rendah: ${(
      confidence * 100
    ).toFixed(1)}%)`;
    recommendation +=
      " Disarankan untuk melakukan pemeriksaan medis langsung untuk konfirmasi.";
  }

  return { interpretation, recommendation };
}
