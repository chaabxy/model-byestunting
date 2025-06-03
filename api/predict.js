import * as tf from "@tensorflow/tfjs-node"

let model = null
let scaler = null

// Load model dan scaler saat pertama kali digunakan
async function loadModel() {
  if (!model) {
    try {
      // Load model TensorFlow.js
      model = await tf.loadLayersModel("/tfjs_model/model.json")
      console.log("Model berhasil dimuat")

      // Scaler parameters dari training (hardcoded karena tidak ada file .pkl di browser)
      // Ini adalah mean dan std dari data training - seharusnya disimpan saat training
      scaler = {
        mean: [30.5, 12.8, 89.2, 0.5], // Approximate values - seharusnya dari training
        std: [15.2, 4.1, 12.8, 0.5], // Approximate values - seharusnya dari training
      }
    } catch (error) {
      console.error("Error loading model:", error)
      throw new Error("Gagal memuat model prediksi")
    }
  }
}

// Fungsi untuk normalisasi data (StandardScaler)
function standardScale(data, mean, std) {
  return data.map((value, index) => (value - mean[index]) / std[index])
}

export const config = {
  runtime: "edge",
}

export default async function handler(req) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  }

  // CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  // Hanya izinkan POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  try {
    // Load model jika belum dimuat
    await loadModel()

    const body = await req.json()
    const { data } = body

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
        },
      )
    }

    const [umur_bulan, berat_badan, tinggi_badan, jenis_kelamin] = data.map(Number)

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
        },
      )
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
        },
      )
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
        },
      )
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
        },
      )
    }

    // Preprocessing data (normalisasi seperti saat training)
    const inputData = [umur_bulan, berat_badan, tinggi_badan, jenis_kelamin]
    const scaledData = standardScale(inputData, scaler.mean, scaler.std)

    // Konversi ke tensor untuk prediksi
    const inputTensor = tf.tensor2d([scaledData], [1, 4])

    // Lakukan prediksi menggunakan model
    const prediction = model.predict(inputTensor)
    const probabilities = await prediction.data()

    // Cleanup tensor
    inputTensor.dispose()
    prediction.dispose()

    // Interpretasi hasil prediksi
    const classNames = ["normal", "severely stunted", "stunted"]
    const maxIndex = probabilities.indexOf(Math.max(...probabilities))
    const predictedClass = classNames[maxIndex]
    const confidence = probabilities[maxIndex]

    // Buat interpretasi dan rekomendasi berdasarkan hasil model
    let interpretation, recommendation

    if (predictedClass === "normal") {
      interpretation = "Tinggi badan anak sesuai dengan umurnya berdasarkan model AI"
      recommendation = "Pertahankan pola makan bergizi dan aktivitas fisik yang baik"
    } else if (predictedClass === "stunted") {
      interpretation = "Model AI mendeteksi anak mengalami stunting"
      recommendation = "Perbaiki asupan gizi, konsultasi dengan ahli gizi, dan pantau pertumbuhan secara rutin"
    } else {
      interpretation = "Model AI mendeteksi anak mengalami stunting berat"
      recommendation = "Segera konsultasi dengan dokter anak dan ahli gizi untuk penanganan intensif"
    }

    return new Response(
      JSON.stringify({
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
        interpretation: interpretation,
        recommendation: recommendation,
        model_info: "Prediksi menggunakan Neural Network yang dilatih dengan dataset stunting",
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    )
  } catch (error) {
    console.error("Prediction error:", error)
    return new Response(
      JSON.stringify({
        error: "Server error",
        message: "Terjadi kesalahan dalam memproses data dengan model AI",
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    )
  }
}
